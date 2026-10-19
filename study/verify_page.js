/* Render the page headless, capture any script error, screenshot it at phone and desktop
   widths, probe for horizontal overflow, walk every tour step, and print what the page shows.

   node study/verify_page.js [outdir] */
const { chromium } = require('/home/bolgac/projects/minimalist-workout-app/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'docs', 'index.html');
const OUT = process.argv[2] || path.resolve(__dirname, '..', 'data', 'shots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let fail = false;
  for (const [name, w, h] of [['w1536', 1536, 960], ['w1280', 1280, 800], ['w390', 390, 844], ['w375', 375, 812]]) {
    const errors = [];
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.goto(PAGE + '?tour=off', { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const overflow = await page.evaluate(() => {
      const de = document.documentElement, bad = [];
      if (de.scrollWidth > de.clientWidth + 1) {
        document.querySelectorAll('*').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.right > de.clientWidth + 1 && r.width > 0) {
            let ok = el;
            while (ok && ok !== document.body) {
              const st = getComputedStyle(ok);
              if (st.overflowX === 'auto' || st.overflowX === 'scroll') return;
              ok = ok.parentElement;
            }
            bad.push(el.tagName + (el.id ? '#' + el.id : '') + ' right=' + Math.round(r.right));
          }
        });
      }
      return { sw: de.scrollWidth, cw: de.clientWidth, bad: bad.slice(0, 8) };
    });
    if (overflow.sw > overflow.cw + 1) { console.log(`${name}: OVERFLOW ${overflow.sw} > ${overflow.cw}`, overflow.bad); fail = true; }
    else console.log(`${name}: no horizontal overflow`);
    const check = await page.evaluate(() => document.documentElement.getAttribute('data-selfcheck'));
    console.log(`${name}: self-check ${check}`);
    if (check !== 'pass') fail = true;
    await page.screenshot({ path: path.join(OUT, `${name}-first.png`) });
    await page.screenshot({ path: path.join(OUT, `${name}-full.png`), fullPage: true });
    for (const id of ['#answer', '#act1', '#act2', '#act3', '#act4']) {
      const el = await page.$(id);
      await el.screenshot({ path: path.join(OUT, `${name}-${id.slice(1)}.png`) });
    }
    // walk the tour
    const steps = await page.evaluate(() => window.__tour.steps);
    for (let i = 0; i < steps; i++) {
      await page.evaluate(i => window.__tour.go(i), i);
      await page.waitForTimeout(900);
      const g = await page.evaluate(() => {
        const hl = document.querySelector('.tour-hl').getBoundingClientRect();
        const card = document.querySelector('.tour-card').getBoundingClientRect();
        return { hlTop: Math.round(hl.top), hlH: Math.round(hl.height), cardTop: Math.round(card.top), cardBottom: Math.round(card.bottom), vh: innerHeight, title: document.querySelector('.tour-card .tk').textContent };
      });
      const cardOverHl = g.cardTop < g.hlTop + g.hlH - 4 && g.cardTop > g.hlTop;
      console.log(`${name} tour ${i + 1}: ${g.title} hl ${g.hlTop}+${g.hlH} card ${g.cardTop}..${g.cardBottom} of ${g.vh}${g.hlTop < -4 ? ' HL ABOVE VIEW' : ''}${cardOverHl ? ' (card beside or over)' : ''}`);
      if (i === 2 || i === 5) await page.screenshot({ path: path.join(OUT, `${name}-tour${i + 1}.png`) });
    }
    if (errors.length) { console.log(`${name} ERRORS:`, errors); fail = true; }
    if (name === 'w1280') {
      const printed = await page.evaluate(() => ({
        dek: document.querySelector('#dek').innerText,
        q: Array.from(document.querySelectorAll('#qgrid div')).map(d => d.innerText.replace(/\n/g, ' | ')),
        tiles: document.querySelector('#blufstat').innerText.replace(/\n/g, ' | '),
        verdicts: Array.from(document.querySelectorAll('.verdict')).map(v => v.innerText)
      }));
      fs.writeFileSync(path.join(OUT, 'printed.json'), JSON.stringify(printed, null, 1));
    }
    await ctx.close();
  }
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
