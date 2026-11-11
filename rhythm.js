(() => {
  const page = document.documentElement;
  const launch = document.getElementById('rhythm-launch');
  const dialog = document.getElementById('rhythm');
  const canvas = dialog.querySelector('.rhythm-canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof dialog.showModal !== 'function') return;

  const audio = document.getElementById('rhythm-audio');
  const mute = document.getElementById('rhythm-mute');
  const pads = [...dialog.querySelectorAll('.rhythm-pads button')];
  const start = document.getElementById('rhythm-start');
  const prompt = document.getElementById('rhythm-prompt');
  const promptTitle = document.getElementById('rhythm-prompt-title');
  const promptText = document.getElementById('rhythm-prompt-text');
  const scoreDisplay = document.getElementById('rhythm-score');
  const comboDisplay = document.getElementById('rhythm-combo');
  const bestDisplay = document.getElementById('rhythm-best');
  const progress = dialog.querySelector('.rhythm-progress span');

  const beat = 60 / 144;
  const approach = 1.43;
  const hitWindow = .148;
  const perfectWindow = .068;
  const laneKeys = ['D', 'F', 'J', 'K'];
  const keyCodes = laneKeys.map(key => 'Key' + key);
  const bars = [
    '- - - - - - - -',
    'D - F - J - K -',
    'K - J - F - D -',
    'D F - J K - F -',
    'D - J F K - J -',
    'F J K - J F D -',
    'DJ - F - K J F -',
    'FK - J D F - K -',
    'D F J K K J F -',
    'DK - F J FJ - K D',
    'DJ F K - FK J D -',
    'D F J K F J DK -',
    'DJ - FK - D F JK -',
  ];
  const chart = bars.flatMap((bar, barIndex) =>
    bar.split(' ').flatMap((step, stepIndex) =>
      [...step].filter(key => key !== '-').map(key => ({
        time: (barIndex * 4 + stepIndex / 2) * beat,
        lane: laneKeys.indexOf(key),
      }))
    )
  );
  const duration = (bars.length * 4 + .7) * beat;

  const labels = {
    ru: {
      ready: 'Поймай ритм',
      instructions: 'Жми D, F, J, K или тапай по кнопкам, когда ноты доходят до линии.',
      begin: 'Начать раунд',
      loading: 'Запускаем трек…',
      interrupted: 'Раунд прерван',
      retry: 'Сыграть ещё',
      result: 'Раунд завершён',
      record: 'Новый рекорд!',
      accuracy: 'Точность',
      bestCombo: 'Лучшее комбо',
      perfect: 'Точно!',
      good: 'Хорошо',
      miss: 'Мимо',
    },
    en: {
      ready: 'Catch the beat',
      instructions: 'Press D, F, J, K or tap the pads as the notes reach the line.',
      begin: 'Start round',
      loading: 'Starting the track…',
      interrupted: 'Round interrupted',
      retry: 'Play again',
      result: 'Round complete',
      record: 'New best!',
      accuracy: 'Accuracy',
      bestCombo: 'Best combo',
      perfect: 'Perfect!',
      good: 'Good',
      miss: 'Miss',
    },
  };

  const storedBest = Number(readPreference('wko-rhythm-best'));
  let best = Number.isSafeInteger(storedBest) && storedBest >= 0 ? storedBest : 0;
  let muted = readPreference('wko-rhythm-muted') === 'true';
  let language = labels.ru;
  let numbers = new Intl.NumberFormat('ru');
  let round = null;
  let frame = 0;
  let width = 1;
  let height = 1;
  let target = 1;
  let laneWidth = 1;
  let colors = [];
  let railGradient;

  function applyMute() {
    audio.muted = muted;
    mute.setAttribute('aria-pressed', String(muted));
  }

  function updateHud() {
    scoreDisplay.textContent = numbers.format(round?.score ?? 0);
    comboDisplay.textContent = '×' + (round?.combo ?? 0);
    bestDisplay.textContent = numbers.format(best);
  }

  function showPrompt(title, text, action) {
    promptTitle.textContent = title;
    promptText.textContent = text;
    start.textContent = action;
    start.disabled = false;
    prompt.hidden = false;
  }

  function setPads(enabled) {
    for (const pad of pads) {
      pad.disabled = !enabled;
      pad.removeAttribute('data-lit');
    }
  }

  function resize() {
    if (!dialog.open) return;
    // Use layout dimensions so the dialog's entrance transform does not resize the board.
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    target = height * .81;
    laneWidth = width / laneKeys.length;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    const style = getComputedStyle(dialog);
    colors = laneKeys.map((_, lane) => style.getPropertyValue('--lane-' + (lane + 1)).trim());
    railGradient = ctx.createLinearGradient(0, 0, width, 0);
    colors.forEach((color, lane) => railGradient.addColorStop(lane / (colors.length - 1), color));
    if (!round?.playing) drawBoard(0);
  }

  function drawBoard(time) {
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = .24;
    ctx.fillStyle = railGradient;
    ctx.fillRect(0, target - 4, width, 8);
    ctx.globalAlpha = .95;
    ctx.fillRect(0, target - 1, width, 2);
    ctx.globalAlpha = 1;
    if (!round?.playing) return;

    const light = .13 * (1 - (time % beat) / beat) ** 3;
    ctx.globalAlpha = light;
    ctx.fillRect(0, target - 7, width, 14);
    ctx.globalAlpha = 1;

    for (let index = round.firstPending; index < round.notes.length; index += 1) {
      const note = round.notes[index];
      const remaining = note.time - time;
      if (remaining > approach) break;
      if (!note.pending) continue;

      const x = (note.lane + .11) * laneWidth;
      const y = target * (1 - remaining / approach);
      const size = laneWidth * .78;
      ctx.fillStyle = colors[note.lane];
      ctx.globalAlpha = .19;
      ctx.fillRect(x - 2, y - 12, size + 4, 24);
      ctx.globalAlpha = .93;
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 6);
      ctx.lineTo(x + size, y - 6);
      ctx.lineTo(x + size - 5, y + 6);
      ctx.lineTo(x, y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff8ff';
      ctx.fillRect(x + 8, y - 3, Math.max(2, size - 16), 2);
    }

    for (let lane = 0; lane < pads.length; lane += 1) {
      const age = time - round.pulses[lane];
      pads[lane].toggleAttribute('data-lit', age < .13);
      if (age >= .42) continue;

      const center = (lane + .5) * laneWidth;
      const color = colors[lane];
      ctx.globalAlpha = .6 * (1 - age / .42) ** 2;
      ctx.fillStyle = color;
      ctx.fillRect(lane * laneWidth + 2, target - 19, laneWidth - 4, 38);
      if (page.dataset.motion === 'on') {
        const size = 9 + age * 130;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(center, target, size, 0, Math.PI * 2);
        ctx.stroke();
        for (let point = 0; point < 12; point += 1) {
          const angle = point * 2.4 + lane;
          const distance = size * (.65 + (point % 4) * .23);
          ctx.fillRect(center + Math.cos(angle) * distance, target + Math.sin(angle) * distance, 2.5, 2.5);
        }
      }
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (time < beat * 3) {
      ctx.fillStyle = '#f9e9ff';
      ctx.font = '800 ' + Math.min(72, height * .24) + 'px Inter, system-ui';
      ctx.fillText(String(3 - Math.floor(time / beat)), width / 2, height * .35);
    } else if (round.judgment && time - round.judgedAt < .46) {
      ctx.globalAlpha = Math.min(1, (.46 - time + round.judgedAt) * 5);
      ctx.fillStyle = { perfect: '#fff3fd', good: '#84e5ff', miss: '#ff9eae' }[round.judgment];
      ctx.font = '800 ' + Math.min(32, height * .115) + 'px Inter, system-ui';
      ctx.fillText(language[round.judgment], width / 2, height * .52);
      ctx.globalAlpha = 1;
    }
  }

  function elapsed() {
    return round.useAudio ? audio.currentTime : (performance.now() - round.startedAt) / 1000;
  }

  function judge(time, result) {
    round.judgedAt = time;
    round.judgment = result;
  }

  function markMisses(time) {
    let missed = false;
    while (round.firstPending < round.notes.length) {
      const note = round.notes[round.firstPending];
      if (note.pending && time - note.time <= hitWindow) break;
      if (note.pending) missed = true;
      round.firstPending += 1;
    }

    if (missed) {
      round.combo = 0;
      judge(time, 'miss');
      updateHud();
    }
  }

  function hit(lane) {
    if (!round?.playing) return;
    const time = elapsed();
    markMisses(time);
    let bestNote;
    let error = hitWindow;
    for (let index = round.firstPending; index < round.notes.length; index += 1) {
      const note = round.notes[index];
      if (note.time - time > hitWindow) break;
      const distance = Math.abs(note.time - time);
      if (note.pending && note.lane === lane && distance <= error) {
        bestNote = note;
        error = distance;
      }
    }

    round.pulses[lane] = time;
    if (!bestNote) return;

    bestNote.pending = false;
    const perfect = error <= perfectWindow;
    round.score += perfect ? 300 : 100;
    round.combo += 1;
    round.maxCombo = Math.max(round.maxCombo, round.combo);
    judge(time, perfect ? 'perfect' : 'good');
    updateHud();
  }

  function stopRound() {
    cancelAnimationFrame(frame);
    audio.pause();
    round = null;
    setPads(false);
    start.disabled = false;
  }

  function finishRound() {
    const { score, maxCombo } = round;
    const record = score > best;
    if (record) {
      best = score;
      savePreference('wko-rhythm-best', String(best));
    }
    const accuracy = numbers.format(Math.round(score / (chart.length * 300) * 1000) / 10);
    bestDisplay.textContent = numbers.format(best);
    stopRound();
    const result = language.accuracy + ' ' + accuracy + '% · ' + language.bestCombo + ' ×' + maxCombo;
    showPrompt(record ? language.record : language.result, result, language.retry);
    start.focus({ preventScroll: true });
  }

  function render() {
    const time = elapsed();
    markMisses(time);
    progress.style.transform = 'scaleX(' + Math.min(1, time / duration) + ')';
    if (time >= duration) {
      finishRound();
      return;
    }
    drawBoard(time);
    frame = requestAnimationFrame(render);
  }

  async function startRound() {
    if (round) return;
    const current = {
      notes: chart.map(note => ({ ...note, pending: true })),
      score: 0,
      combo: 0,
      maxCombo: 0,
      firstPending: 0,
      pulses: pads.map(() => -Infinity),
      playing: false,
    };
    round = current;
    updateHud();
    progress.style.transform = 'scaleX(0)';
    start.disabled = true;
    start.textContent = language.loading;
    audio.currentTime = 0;

    let timeout;
    current.useAudio = await Promise.race([
      audio.play().then(() => true, () => false),
      new Promise(resolve => { timeout = setTimeout(() => resolve(false), 2200); }),
    ]);
    clearTimeout(timeout);
    if (round !== current || !dialog.open) return;
    if (!current.useAudio) audio.pause();

    current.startedAt = performance.now();
    current.playing = true;
    prompt.hidden = true;
    setPads(true);
    pads[0].focus({ preventScroll: true });
    frame = requestAnimationFrame(render);
  }

  launch.addEventListener('click', () => {
    const locale = page.lang === 'en' ? 'en' : 'ru';
    language = labels[locale];
    numbers = new Intl.NumberFormat(locale);
    updateHud();
    progress.style.transform = 'scaleX(0)';
    showPrompt(language.ready, language.instructions, language.begin);
    page.classList.add('rhythm-open');
    dialog.showModal();
    resize();
    start.focus({ preventScroll: true });

    if (audio.preload === 'none') {
      audio.preload = 'auto';
      audio.load();
    }
  });

  dialog.addEventListener('close', () => {
    stopRound();
    page.classList.remove('rhythm-open');
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !round) return;
    stopRound();
    showPrompt(language.interrupted, language.instructions, language.retry);
  });

  mute.addEventListener('click', () => {
    muted = !muted;
    savePreference('wko-rhythm-muted', String(muted));
    applyMute();
  });

  start.addEventListener('click', startRound);
  document.addEventListener('keydown', event => {
    if (!round?.playing || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const lane = keyCodes.indexOf(event.code);
    if (lane === -1) return;
    event.preventDefault();
    hit(lane);
  });
  pads.forEach((pad, lane) => {
    pad.addEventListener('pointerdown', event => {
      if (event.button === 0) hit(lane);
    });
    pad.addEventListener('click', event => {
      if (event.detail === 0) hit(lane);
    });
  });

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  applyMute();
  launch.hidden = false;
})();
