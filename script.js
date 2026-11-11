const root = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = themeToggle.querySelector('.theme-label');
const effectsToggle = document.getElementById('effects-toggle');
const langToggle = document.getElementById('lang-toggle');
const portraitButton = document.querySelector('.portrait-frame');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const themeColor = document.querySelector('meta[name="theme-color"]');
const descriptions = [...document.querySelectorAll(
  'meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]'
)];
const pageTitle = document.title;
const description = descriptions[0].content;
const translatedElements = [...document.querySelectorAll('[data-i18n]')].map((element) => ({
  element,
  russian: element.textContent,
}));
const copyButtons = document.querySelectorAll('[data-copy]');
const discordCopy = document.querySelector('[data-copy="discord-name"]');
const status = document.getElementById('toast');

const english = {
  intro: 'Developer, streamer, and osu!standard player.',
  telegram: 'Message me on Telegram',
  copyNick: 'Copy nickname',
  effects: 'Effects',
  directory: 'Find me online',
  contact: 'Contacts and code',
  media: 'Streams and videos',
  games: 'Gaming',
  backToTop: 'Back to top',
  visits: 'Visits in this browser:',
  title: 'wineikoo — personal page',
  description: 'wineikoo — developer, streamer, and osu!standard player. Contacts, streams, videos, and gaming profiles.',
};

const messages = {
  ru: {
    blueTheme: 'Синяя тема',
    pinkTheme: 'Розовая тема',
    burst: 'Запустить вспышку',
    discordCopy: 'Скопировать имя в Discord',
    copied: 'Скопировано:',
    manual: 'Скопируйте вручную:',
    rainbowOn: 'Радужная тема включена',
    rainbowOff: 'Радужная тема выключена',
  },
  en: {
    blueTheme: 'Blue theme',
    pinkTheme: 'Pink theme',
    burst: 'Trigger a burst',
    discordCopy: 'Copy Discord username',
    copied: 'Copied:',
    manual: 'Copy manually:',
    rainbowOn: 'Rainbow theme on',
    rainbowOff: 'Rainbow theme off',
  },
};

function readPreference(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

const savedLanguage = readPreference('wko-lang');
let language = savedLanguage === 'ru' || savedLanguage === 'en'
  ? savedLanguage
  : (navigator.language.toLowerCase().startsWith('en') ? 'en' : 'ru');
let theme = readPreference('wko-theme') === 'blue' ? 'blue' : 'pink';
let motionPreference = readPreference('wko-motion');
let statusTimer;

function updateThemeLabel() {
  const { blueTheme, pinkTheme } = messages[language];
  themeLabel.textContent = theme === 'blue' ? pinkTheme : blueTheme;
}

function applyLanguage() {
  const isEnglish = language === 'en';
  root.lang = language;
  document.title = isEnglish ? english.title : pageTitle;

  for (const { element, russian } of translatedElements) {
    element.textContent = isEnglish ? english[element.dataset.i18n] : russian;
  }
  for (const element of descriptions) {
    element.content = isEnglish ? english.description : description;
  }

  langToggle.lang = isEnglish ? 'ru' : 'en';
  langToggle.textContent = isEnglish ? 'RU' : 'EN';
  langToggle.setAttribute('aria-label', isEnglish ? 'Переключить на русский' : 'Switch to English');
  discordCopy.setAttribute('aria-label', messages[language].discordCopy);
  discordCopy.title = messages[language].discordCopy;
  portraitButton.setAttribute('aria-label', messages[language].burst);
  portraitButton.title = messages[language].burst;
  updateThemeLabel();
}

function applyTheme() {
  const isBlue = theme === 'blue';
  root.dataset.theme = theme;
  themeColor.content = isBlue ? '#0b1126' : '#10091b';
  updateThemeLabel();
}

function applyMotion() {
  const enabled = motionPreference === 'on' || (motionPreference !== 'off' && !reducedMotion.matches);
  root.dataset.motion = enabled ? 'on' : 'off';
  effectsToggle.setAttribute('aria-pressed', String(enabled));
}

function showStatus(text) {
  clearTimeout(statusTimer);
  status.replaceChildren(text);
  status.setAttribute('data-visible', '');
  statusTimer = setTimeout(() => status.removeAttribute('data-visible'), 2800);
}

themeToggle.addEventListener('click', () => {
  theme = theme === 'blue' ? 'pink' : 'blue';
  savePreference('wko-theme', theme);
  applyTheme();
});

effectsToggle.addEventListener('click', () => {
  motionPreference = root.dataset.motion === 'on' ? 'off' : 'on';
  savePreference('wko-motion', motionPreference);
  applyMotion();
});
reducedMotion.addEventListener('change', applyMotion);

langToggle.addEventListener('click', () => {
  language = language === 'ru' ? 'en' : 'ru';
  savePreference('wko-lang', language);
  status.removeAttribute('data-visible');
  applyLanguage();
});

for (const button of copyButtons) {
  const source = document.getElementById(button.dataset.copy);
  button.addEventListener('click', async () => {
    const nickname = source.textContent.trim();
    try {
      await navigator.clipboard.writeText(nickname);
      showStatus(`${messages[language].copied} ${nickname}`);
    } catch {
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(source);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      showStatus(`${messages[language].manual} ${nickname}`);
    }
  });
  button.hidden = false;
}

const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let sequencePosition = 0;

window.addEventListener('keydown', (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === konami[sequencePosition]) {
    sequencePosition += 1;
  } else {
    sequencePosition = key === konami[0] ? 1 : 0;
  }

  if (sequencePosition === konami.length) {
    sequencePosition = 0;
    const rainbow = root.classList.toggle('rainbow');
    showStatus(rainbow ? messages[language].rainbowOn : messages[language].rainbowOff);
  }
});

const previousVisits = Number(readPreference('wko-views'));
const visits = Number.isSafeInteger(previousVisits) && previousVisits >= 0 && previousVisits < Number.MAX_SAFE_INTEGER
  ? previousVisits + 1
  : 1;

if (savePreference('wko-views', String(visits))) {
  document.getElementById('visit-count').textContent = String(visits);
  document.getElementById('visits').hidden = false;
}

applyTheme();
applyLanguage();
applyMotion();
themeToggle.hidden = false;
langToggle.hidden = false;
