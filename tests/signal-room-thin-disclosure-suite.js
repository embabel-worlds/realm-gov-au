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

/** The readable form of an amount, matching the control's own grammar. */
function compact(v) {
  if (v >= 1e9) return String(v / 1e9) + 'b';
  if (v >= 1e6) return String(v / 1e6) + 'm';
  if (v >= 1e3) return String(v / 1e3) + 'k';
  return String(v);
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
  // `20000000` is not a number a reader can check at a glance. The Atlas solved this already, so the
  // same control is used here: readable text in, a hidden numeric out.
  check('it defaults to a READABLE 20m, not 20000000', (await input.inputValue()) === '20m', await input.inputValue());
  check('and carries the parsed value for the query', (await page.locator('#thin-threshold-value').inputValue()) === '20000000');
  check('it offers a $ prefix rather than making the reader type one',
    (await page.locator('.thin-controls .money-prefix').innerText()) === '$');
  check('it suggests round amounts', (await page.locator('#thin-threshold-options option').count()) >= 5);
  check('it is labelled for a screen reader',
    (await page.locator('label[for="thin-threshold"]').count()) === 1 &&
    (await input.getAttribute('aria-describedby')) === 'thin-threshold-help');

  console.log('\n== the amount control reads what a human types ==');
  for (const [typed, want] of [['5m', '5000000'], ['1.1b', '1100000000'], ['750k', '750000'],
                               ['20,000,000', '20000000'], ['$3m', '3000000']]) {
    await input.fill(typed);
    await input.evaluate(el => el.blur());
    await page.waitForTimeout(80);
    check(`"${typed}" parses to ${want}`, (await page.locator('#thin-threshold-value').inputValue()) === want,
      await page.locator('#thin-threshold-value').inputValue());
  }
  await input.fill('not a number');
  await page.waitForTimeout(80);
  check('nonsense is flagged rather than silently treated as zero',
    (await input.getAttribute('aria-invalid')) === 'true');
  check('and the last good value is retained for the query',
    (await page.locator('#thin-threshold-value').inputValue()) === '3000000');
  await input.fill('12m');
  await input.press('ArrowUp');
  await page.waitForTimeout(80);
  check('arrow-up steps by $5m in readable form', (await input.inputValue()) === '17m', await input.inputValue());
  await input.press('ArrowDown');
  await page.waitForTimeout(80);
  check('and arrow-down steps back', (await input.inputValue()) === '12m', await input.inputValue());
  await input.fill('20m');
  await input.evaluate(el => el.blur());

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
    // Typed the way a reader types it — this also proves the parse feeds the actual query.
    await input.fill(compact(value));
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

  console.log('\n== rows are ordered by money, biggest first ==');
  // This screen answers "which LARGE commitments say almost nothing", so amount descending is the
  // order a reader scans and the one that decides which rows survive the 40-row cut. It used to sort
  // by SIGNAL COUNT first, so a $2m notice with two signals outranked a $200m notice with one.
  // The amount is the <strong> in the row's HEADER line; the second <strong> per row is the quoted
  // description. Selecting both interleaved nulls through the list and made the order unreadable.
  const amounts = await page.locator('#pane-disclosure .ground > div:first-child > strong').evaluateAll(els =>
    els.map(e => e.textContent.trim())
       .map(t => {
         const m = t.replace(/[$,\s]/g, '').match(/^([\d.]+)([KMB])?$/i);
         if (!m) return NaN;
         const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
         return Number(m[1]) * mult;
       }));
  check('every row shows a parseable amount', amounts.length > 1 && amounts.every(n => isFinite(n)),
    JSON.stringify(amounts.slice(0, 5)));
  const descending = amounts.every((n, i) => i === 0 || amounts[i - 1] >= n);
  check('and they descend', descending, JSON.stringify(amounts));
  check('the first row really is the largest', amounts[0] === Math.max(...amounts),
    `first=${amounts[0]} max=${Math.max(...amounts)}`);

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

  console.log('\n== the progress indicator is not squashed into a grid cell ==');
  // beginOperation() injects <embabel-operation-state> into WHICHEVER container is loading, and
  // #signals is a 12-column grid — so without an explicit span the element becomes a 1-of-12 grid
  // ITEM: a narrow box against the left edge, reporting a scan of the whole window. Reproduced by
  // injecting exactly as the app does, rather than racing a demo scan that finishes in milliseconds.
  const geom = await page.evaluate(() => {
    const c = document.getElementById('signals');
    c.innerHTML = '<embabel-operation-state id="probe"></embabel-operation-state>';
    const el = document.getElementById('probe');
    const cs = getComputedStyle(el);
    return {
      elWidth: el.getBoundingClientRect().width,
      containerWidth: c.getBoundingClientRect().width,
      display: cs.display,
      left: el.getBoundingClientRect().left - c.getBoundingClientRect().left,
    };
  });
  check('it spans the full width of the grid it is injected into',
    geom.elWidth > geom.containerWidth * 0.95,
    `${Math.round(geom.elWidth)}px inside ${Math.round(geom.containerWidth)}px`);
  check('it starts at the container edge, not indented into a column',
    Math.abs(geom.left) < 2, `left offset ${Math.round(geom.left)}px`);
  check('it is a block, not an inline custom element of intrinsic width', geom.display === 'block', geom.display);
  // The same rule must not distort the non-grid containers the same function also targets.
  const paneGeom = await page.evaluate(() => {
    const c = document.getElementById('pane-disclosure');
    const el = document.createElement('embabel-operation-state');
    c.appendChild(el);
    const r = el.getBoundingClientRect(), cr = c.getBoundingClientRect();
    el.remove();
    return { elWidth: r.width, containerWidth: cr.width };
  });
  check('and still fills a NON-grid container',
    paneGeom.elWidth > paneGeom.containerWidth * 0.95,
    `${Math.round(paneGeom.elWidth)}px inside ${Math.round(paneGeom.containerWidth)}px`);

  console.log('\n== the default search window is the last WEEK ==');
  // Loaded WITHOUT ?demo, because demo mode overwrites the window with the baked slice — the default
  // is only observable on a normal load. The clock is frozen so the assertion is exact rather than
  // "about seven days", and so it cannot pass by accident on any particular day.
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dpage = await dctx.newPage();
  await dpage.addInitScript(day => {
    const Real = Date;
    const [y, m, d] = day.split('-').map(Number);
    const fixed = new Real(y, m - 1, d, 12, 0, 0);
    function Fake(...args) { return args.length ? new Real(...args) : new Real(fixed.getTime()); }
    Fake.prototype = Real.prototype; Fake.now = () => fixed.getTime();
    Fake.parse = Real.parse; Fake.UTC = Real.UTC;
    window.Date = Fake;
  }, '2026-08-04');
  await dpage.goto(`http://localhost:${port}/signal-room.html`, { waitUntil: 'domcontentloaded' });
  await dpage.waitForTimeout(300);
  const dFrom = await dpage.locator('#from').inputValue();
  const dTo = await dpage.locator('#to').inputValue();
  check('it ends today', dTo === '2026-08-04', dTo);
  check('and starts seven days earlier, not one', dFrom === '2026-07-28', dFrom);
  await dctx.close();

  console.log('\n== console cleanliness ==');
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await page.screenshot({ path: path.join(__dirname, 'signal-room-thin.png'), fullPage: true }).catch(() => {});
  await browser.close();
  srv.close();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) { console.log('\nfailures:'); failures.forEach(f => console.log('  - ' + f)); }
  process.exit(failed ? 1 : 0);
})();
