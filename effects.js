(() => {
  const page = document.documentElement;
  const hero = document.querySelector('.hero');
  const directory = document.querySelector('.directory');
  const canvas = document.querySelector('.particles');
  const portraitCanvas = document.querySelector('.portrait-particles');
  const portrait = document.querySelector('.portrait-frame');
  const portraitImage = portrait.querySelector('img');
  const orbitFlares = [...hero.querySelectorAll('.orbit-flare')];
  const effectsButton = document.getElementById('effects-toggle');

  effectsButton.hidden = false;
  if (page.dataset.motion === 'on') {
    page.classList.add('motion-intro');
    setTimeout(() => page.classList.remove('motion-intro'), 850);
  }

  if ('IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver(([entry]) => {
      hero.toggleAttribute('data-outside', !entry.isIntersecting);
    });
    heroObserver.observe(hero);

    const directoryObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      if (page.dataset.motion === 'on') {
        directory.classList.add('group-arrival');
        setTimeout(() => directory.classList.remove('group-arrival'), 620);
      }
      directoryObserver.disconnect();
    }, { rootMargin: '0px 0px -60px 0px' });
    directoryObserver.observe(directory);
  }

  const ctx = canvas.getContext('2d');
  const portraitCtx = portraitCanvas.getContext('2d');
  if (!ctx || !portraitCtx) return;

  const turn = Math.PI * 2;
  const palettes = {
    pink: ['#ff5abf', '#b388ff', '#62eaff', '#fff3ff'],
    blue: ['#5fc8ff', '#8e8dff', '#65fff3', '#f2f7ff'],
    rainbow: ['#ff528f', '#ffd071', '#6efbb1', '#38eaff', '#b195ff'],
  };
  let paletteName;
  let colors;
  let glows;
  let width = 1;
  let height = 1;
  let stars = [];
  const screenEffects = { sparks: [], rings: [] };
  const portraitEffects = { sparks: [], rings: [] };
  let portraitWidth = 0;
  let portraitHeight = 0;
  let previousPointer;
  let pointerGlow;
  let portraitAnimations = [];
  let frame = 0;
  let previousTime = 0;
  let elapsed = 0;
  let running = false;

  function makeGlow(color) {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const pen = sprite.getContext('2d');
    const light = pen.createRadialGradient(32, 32, 0, 32, 32, 32);
    light.addColorStop(0, color);
    light.addColorStop(.23, color + '85');
    light.addColorStop(.64, color + '25');
    light.addColorStop(1, color + '00');
    pen.fillStyle = light;
    pen.fillRect(0, 0, 64, 64);
    return sprite;
  }

  function syncPalette() {
    const next = page.classList.contains('rainbow') ? 'rainbow' : page.dataset.theme;
    if (paletteName === next) return;
    paletteName = next;
    colors = palettes[next] || palettes.pink;
    glows = colors.map(makeGlow);
    if (next === 'rainbow' && running) {
      if (hero.hasAttribute('data-outside')) {
        burst(screenEffects, width * .5, height * .44, 54, 420);
      } else {
        burstPortrait();
      }
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    // Limit the backing canvas on high-density and ultrawide screens.
    const scale = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1300000 / (width * height)));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);

    portraitWidth = Math.max(1, portraitCanvas.clientWidth);
    portraitHeight = Math.max(1, portraitCanvas.clientHeight);
    portraitCanvas.width = Math.round(portraitWidth * scale);
    portraitCanvas.height = Math.round(portraitHeight * scale);
    portraitCtx.setTransform(portraitCanvas.width / portraitWidth, 0, 0, portraitCanvas.height / portraitHeight, 0, 0);
    clearBurst(portraitEffects);

    const count = Math.min(125, Math.max(38, Math.round(width * height / 10200)));
    stars = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 9 + Math.random() * 34,
      radius: .65 + Math.random() * 1.25,
      phase: Math.random() * turn,
      color: index % 3,
    }));
  }

  function glow(context, x, y, size, alpha, color) {
    context.globalAlpha = alpha;
    context.drawImage(glows[color % glows.length], x - size / 2, y - size / 2, size, size);
  }

  function drawStars(delta) {
    for (const star of stars) {
      star.x -= star.speed * .28 * delta;
      star.y -= star.speed * delta;
      if (star.y < -12) star.y += height + 24;
      if (star.x < -12) star.x += width + 24;

      const alpha = .31 + .23 * Math.sin(elapsed * 2.2 + star.phase);
      if (star.radius > 1.38) glow(ctx, star.x, star.y, 12 + star.radius * 5, alpha, star.color);
      ctx.globalAlpha = alpha + .12;
      ctx.fillStyle = colors[star.color];
      ctx.fillRect(star.x, star.y, star.radius, star.radius);
    }
  }

  function drawMeteor(phase, originX, originY, color) {
    if (phase < 0 || phase > .86) return;
    const life = phase / .86;
    const distance = Math.min(width * .44, 440);
    const x = width * originX - distance * life;
    const y = height * originY + distance * .58 * life;
    const tail = Math.min(width * .16, 142);
    const alpha = Math.sin(life * Math.PI) * .82;
    const line = ctx.createLinearGradient(x, y, x + tail, y - tail * .58);
    line.addColorStop(0, '#fff8ff');
    line.addColorStop(.17, colors[color]);
    line.addColorStop(1, colors[color] + '00');
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = line;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + tail, y - tail * .58);
    ctx.stroke();
    glow(ctx, x, y, 30, alpha, color);
  }

  function addSpark(sparks, x, y, vx, vy, life, color, size, drag, gravity) {
    sparks.push({ x, y, vx, vy, life, maxLife: life, color, size, drag, gravity });
  }

  function burst({ sparks, rings }, x, y, count, speed, radiusScale = 1) {
    const isLarge = count > 30;
    rings.push({ x, y, age: 0, life: isLarge ? .84 : .53, radius: (isLarge ? 270 : 108) * radiusScale, color: 0 });
    rings.push({ x, y, age: -.075, life: isLarge ? .92 : .58, radius: (isLarge ? 208 : 78) * radiusScale, color: 2 });
    if (rings.length > 14) rings.splice(0, rings.length - 14);

    for (let index = 0; index < count; index += 1) {
      const angle = (index + Math.random() * .8) / count * turn;
      const velocity = speed * (.35 + Math.random() * .65);
      addSpark(sparks, x, y, Math.cos(angle) * velocity, Math.sin(angle) * velocity,
        .36 + Math.random() * .54, index % colors.length, 1 + Math.random() * 1.8, 1.9, 105);
    }
  }

  function drawRings(context, rings, delta) {
    let live = 0;
    for (const ring of rings) {
      ring.age += delta;
      const progress = ring.age / ring.life;
      if (progress >= 1) continue;
      rings[live++] = ring;
      if (progress < 0) continue;

      const radius = 8 + ring.radius * (1 - (1 - progress) ** 3);
      context.beginPath();
      context.arc(ring.x, ring.y, radius, 0, turn);
      context.strokeStyle = colors[ring.color];
      context.globalAlpha = (1 - progress) ** 2 * .18;
      context.lineWidth = 8;
      context.stroke();
      context.globalAlpha *= 3.8;
      context.lineWidth = 1.4;
      context.stroke();
    }
    rings.length = live;
  }

  function drawSparks(context, sparks, delta) {
    if (sparks.length > 220) sparks.splice(0, sparks.length - 220);
    let live = 0;
    for (const spark of sparks) {
      spark.life -= delta;
      if (spark.life <= 0) continue;
      sparks[live++] = spark;

      spark.vx *= 1 - spark.drag * delta;
      spark.vy = spark.vy * (1 - spark.drag * delta) + spark.gravity * delta;
      spark.x += spark.vx * delta;
      spark.y += spark.vy * delta;

      const alpha = (spark.life / spark.maxLife) ** 1.5;
      context.globalAlpha = alpha;
      context.lineWidth = spark.size;
      context.strokeStyle = colors[spark.color % colors.length];
      context.beginPath();
      context.moveTo(spark.x - spark.vx * .046, spark.y - spark.vy * .046);
      context.lineTo(spark.x, spark.y);
      context.stroke();
      glow(context, spark.x, spark.y, 8 + spark.size * 4, alpha, spark.color);
    }
    sparks.length = live;
  }

  function render(time) {
    const delta = previousTime ? Math.min((time - previousTime) / 1000, .04) : 0;
    previousTime = time;
    elapsed += delta;
    ctx.clearRect(0, 0, width, height);

    drawStars(delta);
    drawMeteor(elapsed % 3.8 - .35, .88, .13, 2);
    drawMeteor((elapsed + 2.6) % 5.4, .61, .61, 0);

    if (pointerGlow) {
      const { x, y, targetX, targetY, life } = pointerGlow;
      const follow = 1 - Math.exp(-19 * delta);
      pointerGlow.x = x + (targetX - x) * follow;
      pointerGlow.y = y + (targetY - y) * follow;
      pointerGlow.life = Math.max(0, life - delta * 1.3);
      if (pointerGlow.life > 0) glow(ctx, pointerGlow.x, pointerGlow.y, 190, pointerGlow.life * .30, 0);
      else pointerGlow = null;
    }

    drawRings(ctx, screenEffects.rings, delta);
    drawSparks(ctx, screenEffects.sparks, delta);
    ctx.globalAlpha = 1;

    if (portraitEffects.rings.length || portraitEffects.sparks.length) {
      portraitCtx.clearRect(0, 0, portraitWidth, portraitHeight);
      drawRings(portraitCtx, portraitEffects.rings, delta);
      drawSparks(portraitCtx, portraitEffects.sparks, delta);
      portraitCtx.globalAlpha = 1;
    }

    frame = requestAnimationFrame(render);
  }

  function syncPlayback() {
    const enabled = page.dataset.motion === 'on';
    portrait.disabled = !enabled;
    portrait.setAttribute('aria-hidden', String(!enabled));
    page.classList.toggle('motion-paused', document.hidden);
    const next = enabled && !document.hidden;
    if (running === next) return;
    running = next;
    previousTime = 0;
    if (running) {
      resize();
      frame = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(frame);
      clearBurst(screenEffects);
      clearBurst(portraitEffects);
      portraitCtx.clearRect(0, 0, portraitWidth, portraitHeight);
      pointerGlow = previousPointer = null;
      stopPortraitAnimations();
    }
  }

  function clearBurst({ sparks, rings }) {
    sparks.length = 0;
    rings.length = 0;
  }

  function stopPortraitAnimations() {
    for (const animation of portraitAnimations) animation.cancel();
    portraitAnimations = [];
  }

  function burstPortrait() {
    const scale = Math.min(1, portraitHeight / 285);
    burst(portraitEffects, portraitWidth / 2, portraitHeight / 2, 56, 440 * scale, .78 * scale);
    if (!portraitImage.animate) return;
    stopPortraitAnimations();
    portraitAnimations = [
      portraitImage.animate([
        { transform: 'scale(.95)', offset: 0 },
        { transform: 'scale(1.085)', offset: .30 },
        { transform: 'scale(1)', offset: 1 },
      ], { duration: 580, easing: 'cubic-bezier(.23, 1, .32, 1)' }),
      ...orbitFlares.map((flare, index) => {
        const start = index ? 142 : -24;
        const direction = index ? -1 : 1;
        return flare.animate([
          { opacity: .1, transform: `rotate(${start}deg)` },
          { opacity: 1, transform: `rotate(${start + direction * 70}deg)`, offset: .18 },
          { opacity: .9, transform: `rotate(${start + direction * 240}deg)`, offset: .68 },
          { opacity: 0, transform: `rotate(${start + direction * 360}deg)` },
        ], { duration: 700 + 140 * index, delay: 42 * index });
      }),
    ];
  }

  function leavePointer() {
    previousPointer = null;
  }

  window.addEventListener('pointermove', (event) => {
    if (!running || event.pointerType === 'touch') return;
    const x = event.clientX;
    const y = event.clientY;
    if (!pointerGlow) pointerGlow = { x, y, targetX: x, targetY: y, life: 1 };
    pointerGlow.targetX = x;
    pointerGlow.targetY = y;
    pointerGlow.life = 1;

    if (previousPointer) {
      const dx = x - previousPointer.x;
      const dy = y - previousPointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 10) return;
      const count = Math.min(7, Math.floor(distance / 10));
      for (let index = 0; index < count; index += 1) {
        const point = index / count;
        addSpark(screenEffects.sparks, x - dx * point, y - dy * point,
          -dx / distance * 36 + (Math.random() - .5) * 64,
          -dy / distance * 36 + (Math.random() - .5) * 64,
          .34 + Math.random() * .29, Math.floor(Math.random() * colors.length), 1.1 + Math.random(), 1.2, 45);
      }
    }
    previousPointer = { x, y };
  }, { passive: true });

  window.addEventListener('pointerdown', (event) => {
    if (!running || !event.isPrimary || event.button !== 0 || portrait.contains(event.target)) return;
    burst(screenEffects, event.clientX, event.clientY, 23, 290);
  }, { passive: true });

  portrait.addEventListener('click', () => {
    if (running) burstPortrait();
  });

  document.documentElement.addEventListener('pointerleave', leavePointer);
  window.addEventListener('blur', leavePointer);
  window.addEventListener('resize', () => {
    if (running) resize();
  }, { passive: true });
  document.addEventListener('visibilitychange', syncPlayback);

  syncPalette();
  syncPlayback();
  new MutationObserver(() => {
    syncPalette();
    syncPlayback();
  }).observe(page, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-motion'] });
})();
