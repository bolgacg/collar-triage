/* Render the page, take every visible string including chart labels, tooltips and the tour,
   and list hyphenated words, dashes, arrows and banned phrasing.  node study/check_copy.js */
const { chromium } = require('/home/bolgac/projects/minimalist-workout-app/node_modules/playwright');
const path = require('path');
const PAGE = 'file://' + path.resolve(__dirname, '..', 'docs', 'index.html');
const KEEP = new Set(['collar-triage', 'Rheinland-Pfalz', 'e-obs', 'Halter', 'no-fault-founds', '6-10', 'All-Star',
  'Baden-Baden', 'Bruchsal', 'Les', 'Montoliu', 'Ejea', 'Hostalets']);
const BANNED = ['passionate', 'delve', 'leverage', 'seamless', 'cutting-edge', 'testament', 'it is worth noting',
  'in the world of', 'robust', 'crucial', 'pivotal', 'underscore', 'landscape', 'boasts', 'serves as', 'stands as',
  'game-changer', 'unlock', 'empower', 'journey', 'the data says', 'the data shows', 'knows', 'lives in', 'goes to die',
  'honest', 'not just', 'in summary', 'overall,'];
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto(PAGE + '?tour=off', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const text = await page.evaluate(() => {
    const parts = [document.body.innerText];
    document.querySelectorAll('svg text').forEach(t => parts.push(t.textContent));
    document.querySelectorAll('[title],[aria-label]').forEach(e => parts.push(e.getAttribute('title') || '', e.getAttribute('aria-label') || ''));
    // the tour cards and the tooltips are built on demand, so read their sources too
    parts.push(Array.from(document.scripts).map(s => s.src ? '' : s.textContent).join(' '));
    return parts.join('\n');
  });
  const tourText = require('fs').readFileSync(path.resolve(__dirname, '..', 'docs', 'app.js'), 'utf8')
    .match(/'[^'\n]{12,}'/g).map(s => s.slice(1, -1)).join('\n');
  const all = text + '\n' + tourText;
  const words = {};
  (all.replace(/\S*(github\.io|github\.com|https?:\/\/|www\.)\S*/g, ' ').match(/[A-Za-zÀ-ÿ0-9]+(?:-[A-Za-zÀ-ÿ0-9]+)+/g) || [])
    .filter(w => !KEEP.has(w) && !/^\d{4}-\d{2}(-\d{2})?$/.test(w) && !/^\d+-\d+$/.test(w)).forEach(w => words[w] = (words[w] || 0) + 1);
  console.log('hyphenated:', Object.keys(words).sort().map(w => w + (words[w] > 1 ? ' x' + words[w] : '')).join('; ') || 'none');
  const dashes = all.match(/.{0,30}[—–→←⇒].{0,30}/g) || [];
  console.log('dashes and arrows:', dashes.length ? dashes : 'none');
  const low = all.toLowerCase();
  console.log('banned:', BANNED.filter(b => low.includes(b)).join(', ') || 'none');
  await browser.close();
})();
