// Offline browser regression for the PROMOTED thin-disclosure section of the Signal Room.
//
//   node tests/signal-room-thin-disclosure-suite.js
//
// The app ships a `?demo` mode that renders every lens from moneytrail-demo-data.json, so this
// needs no runtime, no login and no network — the real buttons, the real threshold control and the
// real renderer, driven against baked rows.
//
// What this exists to protect: "which large commitments tell the taxpayer nothing" used to be the
// fifth tab of an evidence drawer, behind a click nobody makes unless they already know to look.
// It is now a section of its own with its own threshold. If it ever slides back into the tabs, or
// loses its caveats, or stops honouring the threshold, these tests fail.
const path = require('path');
const http = require('http');
const fs = require('fs');

const PW_DIRS = [
  process.env.PLAYWRIGHT_DIR,
  path.resolve(__dirname, '../../assistant/uit/node_modules/playwright'),
  'playwright',
].filter(Boolean);
let chromium;
for (const dir of PW_DIRS) {
  try { chromium = require(dir).chromium; break; } catch (e) { /* next */ }
}
if (!chromium) {
  console.error('playwright not found. Set PLAYWRIGHT_DIR (the me repo has an install in uit/).');
  process.exit(2);
}

let passed = 0, failed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) { passed++; console.log('  ok   ' + name); }
  else { failed++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
function serve(dir) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.listen(0, () => resolve({ srv, port: srv.address().port }));
  });
}

(async () => {
  const { srv, port } = await serve(path.resolve(__dirname, '../apps'));
  const BASE = `http://localhost:${port}/signal-room.html?demo`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1200 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/404|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 160));
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  console.log('\n== it is prominent, not buried ==');
  const section = page.locator('#thin-section');
  check('the section exists', await section.count() === 1);
  check('and is visible without opening anything', await section.isVisible());
  check('it is NOT a tab in the evidence drawer',
    await page.locator('.desk-tab[data-tab="disclosure"]').count() === 0,
    'a promoted section plus a tab means two entry points and one stale result');
  check('it sits ABOVE the evidence drawer', await page.evaluate(() => {
    const thin = document.getElementById('thin-section');
    const desk = document.querySelector('section.desk');
    return !!thin && !!desk && (thin.compareDocumentPosition(desk) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }));
  const heading = (await page.locator('#thin-heading').innerText()).toLowerCase();
  check('its heading says what it is in plain words', /say almost nothing|thin/.test(heading), heading);

  console.log('\n== the threshold is configurable, and defaults to $20m ==');
  const input = page.locator('#thin-threshold');
  check('a threshold control exists', await input.count() === 1);
  check('it defaults to 20,000,000', (await input.inputValue()) === '20000000', await input.inputValue());
  check('it is a number field with a sane step',
    (await input.getAttribute('type')) === 'number' && (await input.getAttribute('step')) === '1000000');
  check('it is labelled for a screen reader',
    (await page.locator('label[for="thin-threshold"]').count()) === 1);

  console.log('\n== honesty travels with it ==');
  const caveat = await page.locator('#thin-caveat').innerText();
  check('says it measures what was published, not what was procured', /what was published/i.test(caveat), caveat);
  check('says lawful confidentiality exists', /lawful confidentiality/i.test(caveat), caveat);
  check('does not call it wrongdoing', /not evidence of wrongdoing|never evidence|not evidence/i.test(caveat), caveat);
  check('no risk score language anywhere in the section',
    !/risk score|risk rating|risk level/i.test(await section.innerText()));

  console.log('\n== it runs, and the threshold is what it runs with ==');
  // The demo fixture's largest baked commitments sit under $20m, so a $20m run legitimately finds
  // nothing. Every comparison below is therefore anchored on a threshold that DOES return rows —
  // an earlier version of this test compared 0 with 0 three times and reported four passes.
  async function runAt(value) {
    await input.fill(String(value));
    await page.locator('#thin-run').click();
    await page.waitForTimeout(1500);
    return {
      rows: await page.locator('#pane-disclosure .ground').count(),
      text: await page.locator('#pane-disclosure').innerText(),
      links: await page.locator('#pane-disclosure a.source-link').evaluateAll(els => els.map(e => e.href)),
    };
  }

  const low = await runAt(1000000);
  check('the screen actually produces rows', low.rows > 0, `rows=${low.rows}`);
  check('it reports a threshold total', /over threshold/i.test(low.text), low.text.slice(0, 120));
  check('each row shows the description VERBATIM with its length',
    /entire description \(\d+ chars\)/i.test(low.text), low.text.slice(0, 200));
  check('each row is labelled as a factual signal, not a verdict',
    /Factual ·/.test(low.text), low.text.slice(0, 200));

  const high = await runAt(500000000);
  check('raising the threshold removes rows', high.rows < low.rows, `1m=${low.rows} 500m=${high.rows}`);
  check('and an empty result explains itself rather than showing a blank box',
    /no thin-disclosure signal was found/i.test(high.text), high.text.slice(-160));

  const back = await runAt(1000000);
  check('lowering it brings them back — the control re-runs, it does not cache',
    back.rows === low.rows, `first=${low.rows} again=${back.rows}`);

  console.log('\n== the record link goes to the record ==');
  check('every row carries a link', back.links.length === back.rows, `links=${back.links.length} rows=${back.rows}`);
  // /Cn/Show/<uuid> is the notice itself; KeywordSearch only lands the reader on a results page.
  // Demo rows carry no awardId, so the search fallback is the CORRECT shape here — this asserts a
  // working route either way, and that no row falls through to '#'.
  check('no link is a dead placeholder', back.links.every(h => !h.endsWith('#')), back.links[0]);
  check('every link is a real tenders.gov.au route',
    back.links.every(h => /tenders\.gov\.au\/(Cn\/Show\/|Search\/KeywordSearch)/.test(h)), back.links[0]);
  check('links open in a new tab',
    await page.locator('#pane-disclosure a.source-link').first().getAttribute('target') === '_blank');

  console.log('\n== console cleanliness ==');
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await page.screenshot({ path: path.join(__dirname, 'signal-room-thin.png'), fullPage: true }).catch(() => {});
  await browser.close();
  srv.close();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) { console.log('\nfailures:'); failures.forEach(f => console.log('  - ' + f)); }
  process.exit(failed ? 1 : 0);
})();
