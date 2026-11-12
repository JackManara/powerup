// Builds the static site into docs/ (the folder GitHub Pages serves).
// Run with: node build.mjs
// Prices, the contact email, founders and stations all come from src/site.config.json.
import { readFileSync, writeFileSync, rmSync, cpSync, mkdirSync } from 'node:fs';

const cfg = JSON.parse(readFileSync('src/site.config.json', 'utf8'));
const p = cfg.pricing;

const NAV = [
  ['rent.html', 'How it works'],
  ['locations.html', 'Locations'],
  ['venues.html', 'Partners'],
  ['help.html', 'FAQ'],
  ['contact.html', 'Contact'],
];

const PAGES = [
  { file: 'index.html', title: 'PowerUp | Portable charger rental at UMiami', desc: 'Rent a portable charger from a PowerUp station on the University of Miami campus, charge on the move, and return it at any station.' },
  { file: 'rent.html', title: 'How it works and pricing | PowerUp', desc: 'How to find, scan, charge and return a PowerUp portable charger, plus pricing.' },
  { file: 'locations.html', title: 'Planned locations | PowerUp', desc: 'Planned PowerUp charger stations on the University of Miami Coral Gables campus.' },
  { file: 'venues.html', title: 'Partner with us | PowerUp', desc: 'Host a PowerUp charger station at your venue and earn a share of every rental, or help launch PowerUp with your student organization.' },
  { file: 'help.html', title: 'FAQ | PowerUp', desc: 'Answers to common questions about renting a PowerUp portable charger.' },
  { file: 'contact.html', title: 'Contact and founders | PowerUp', desc: 'Contact PowerUp and meet the founders.' },
  { file: '404.html', title: 'Page not found | PowerUp', desc: 'This page is out of battery.' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n) => `$${n}`;

const priceTag = p.isProposed
  ? '<span class="tag">Proposed pricing</span>'
  : '';

const emailBlock = cfg.contact.isPlaceholder
  ? `<span class="email-text">${esc(cfg.contact.email)}</span> <span class="tag">Temporary address</span>`
  : `<a class="email-text" href="mailto:${esc(cfg.contact.email)}">${esc(cfg.contact.email)}</a>`;

const appLink = cfg.appUrl
  ? `<a class="btn btn-ghost" href="${esc(cfg.appUrl)}"><span>Try the app prototype</span></a>`
  : '';

const header = (file) => `
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="logo-link" href="index.html" aria-label="PowerUp home">
      <img src="assets/img/logo-192.png" srcset="assets/img/logo-192.png 1x, assets/img/logo-384.png 2x" width="88" height="88" alt="PowerUp logo">
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      <ul>
        ${NAV.map(([href, label]) => `<li><a href="${href}"${href === file ? ' aria-current="page"' : ''}>${label}</a></li>`).join('\n        ')}
      </ul>
    </nav>
    <div class="scroll-battery" aria-hidden="true"><span class="scroll-battery-fill"></span></div>
  </div>
</header>`;

const footer = `
<footer class="site-footer">
  <div class="wrap footer-grid">
    <a class="footer-logo" href="index.html" aria-label="PowerUp home">
      <img src="assets/img/logo-192.png" width="112" height="112" alt="PowerUp logo" loading="lazy">
    </a>
    <nav aria-label="Footer">
      <ul class="footer-nav">
        <li><a href="index.html">Home</a></li>
        ${NAV.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('\n        ')}
      </ul>
    </nav>
    <div class="footer-contact">
      <p class="footer-tagline">Portable charging, wherever campus life takes you.</p>
      <p>${emailBlock}</p>
      <p>${esc(cfg.contact.location)}</p>
    </div>
  </div>
  <div class="wrap footer-note">
    <p>PowerUp is a student startup concept created for BTE 210 at the University of Miami. Stations shown are planned locations. PowerUp is not affiliated with or endorsed by the University of Miami.</p>
  </div>
</footer>`;

const stationList = cfg.stations.map((s) => `
        <li class="station" id="${s.id}" data-station="${s.id}" data-type="${esc(s.type)}">
          <button type="button" class="station-btn" aria-pressed="false">
            <span class="station-name">${esc(s.name)}</span>
            <span class="station-meta">${esc(s.type)} · ${esc(s.area)} · Planned</span>
          </button>
          <p class="station-why">${esc(s.why)}</p>
        </li>`).join('');

const mapPins = cfg.stations.map((s) => `
          <g class="pin" data-station="${s.id}" data-type="${esc(s.type)}" transform="translate(${s.x} ${s.y})" tabindex="0" role="button" aria-label="${esc(s.name)}, planned station">
            <circle class="pin-hit" r="30"></circle>
            <circle class="pin-halo" r="20"></circle>
            <circle class="pin-dot" r="15"></circle>
            <path class="pin-bolt" d="M2-9-6.5 1.6h5.2L-2 9 6.5-1.6H1.3z"></path>
            <text class="pin-name" y="-24">${esc(s.name.startsWith('Herbert') ? 'Wellness' : s.name.split(' ')[0])}</text>
          </g>`).join('');

const stationFilters = ['All', ...new Set(cfg.stations.map((s) => s.type))].map((t, i) =>
  `<button type="button" class="filter" data-filter="${esc(t)}" aria-pressed="${i === 0}">${esc(t)}</button>`).join('\n        ');

const stationLinks = cfg.stations.map((s) => `
        <li><a href="locations.html#${s.id}"><span>${esc(s.name)}</span><span class="row-meta">${esc(s.type)}</span></a></li>`).join('');

const founders = cfg.founders.map((f) => `<li>${esc(f)}</li>`).join('\n        ');

const tokens = {
  PRICE_TAG: priceTag,
  HOURLY: money(p.hourly),
  MAX_HOURS: p.maxHours,
  MAX_CHARGE: money(p.hourly * p.maxHours),
  LATE_HOURLY: money(p.lateHourly),
  LATE_HOURS: p.lateMaxHours,
  LATE_CAP: money(p.lateHourly * p.lateMaxHours),
  CALC_MAX_HOURS: p.maxHours + p.lateMaxHours,
  APP_MONTHLY: money(p.appMonthly),
  FREE_MINUTES: p.studentFreeMinutes,
  STATION_COUNT: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][cfg.stations.length] ?? cfg.stations.length,
  STATION_LIST: stationList,
  MAP_PINS: mapPins,
  STATION_FILTERS: stationFilters,
  STATION_LINKS: stationLinks,
  FOUNDERS: founders,
  EMAIL_BLOCK: emailBlock,
  LOCATION: esc(cfg.contact.location),
  APP_LINK: appLink,
};

rmSync('docs', { recursive: true, force: true });
mkdirSync('docs', { recursive: true });
cpSync('src/assets', 'docs/assets', { recursive: true });

const browserConfig = {
  pricing: p,
  contact: { email: cfg.contact.email, isPlaceholder: cfg.contact.isPlaceholder },
};

for (const page of PAGES) {
  let body = readFileSync(`src/pages/${page.file}`, 'utf8');
  for (const [k, v] of Object.entries(tokens)) body = body.replaceAll(`{{${k}}}`, v);
  const leftover = body.match(/{{\w+}}/);
  if (leftover) throw new Error(`Unknown token ${leftover[0]} in ${page.file}`);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.desc)}">
<meta name="theme-color" content="#010E2E">
<link rel="icon" type="image/png" href="assets/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&display=swap">
<link rel="stylesheet" href="assets/css/styles.css">
<script>document.documentElement.classList.add('js');</script>
</head>
<body>
${header(page.file)}
<main id="main">
${body}
</main>
${footer}
<script>window.POWERUP = ${JSON.stringify(browserConfig)};</script>
<script src="assets/js/main.js" defer></script>
</body>
</html>
`;
  writeFileSync(`docs/${page.file}`, html);
}
writeFileSync('docs/.nojekyll', '');
console.log(`Built ${PAGES.length} pages into docs/`);
