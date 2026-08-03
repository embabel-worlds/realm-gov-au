// Regression for the NDIS Intelligence portal, in two halves — because the app is served behind an
// external identity provider whose "Sign In" is a LINK, not a password form, so no browser test can
// authenticate against a live deployment (measured: the login page has zero input elements):
//
//   1. THE APP, offline. A static server serves apps/, the runtime is STUBBED via addInitScript, and
//      the real click path renders fixture rows. This tests the renderer and the honesty invariants
//      deterministically, plus graceful behaviour with no runtime at all.
//   2. THE DATA, live. Each of the five views is invoked over REST with basic auth (which the API
//      accepts even though the browser flow does not) and must return rows. A tab whose view has
//      silently stopped returning anything is the failure mode this realm exists to prevent.
//
//   node tests/ndis-intelligence-suite.js                 # both halves
//   SKIP_LIVE=1 node tests/ndis-intelligence-suite.js     # app only, no running world needed
//
// Playwright lives in the `me` repo's uit/; node resolves `require` from the SCRIPT's directory, so
// it is found explicitly below. Override with PLAYWRIGHT_DIR.
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
  try { chromium = require(dir).chromium; break; } catch (e) { /* try the next */ }
}
if (!chromium) {
  console.error('playwright not found. Set PLAYWRIGHT_DIR (the me repo has an install in uit/).');
  process.exit(2);
}

const APPS_DIR = path.resolve(__dirname, '../apps');
const API = process.env.EMBABEL_URL || 'http://localhost:8042';
const USER = process.env.EMBABEL_USER || 'rod';
const PASS = process.env.EMBABEL_PASS || 'test';

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

const TABS = [
  { key: 'new', label: 'What appeared', view: 'NdisNewEnforcement', caveat: /INTERVAL between two extracts/i,
    fixture: [{ actionType: 'ER - Banning Order', subject: 'A Person', abn: '', state: 'VIC',
                effectiveFrom: '2026-07-10', publishedUntil: '', statesABasis: false,
                instrumentCited: 'not cited', commissionNarrative: 'On 23 June 2026 a banning order was made under section 73ZN…' }] },
  { key: 'waves', label: 'How enforcement is shaped', view: 'NdisEnforcementWaves', caveat: /weak evidence about that provider/i,
    fixture: [{ effectiveDay: '2026-01-30', notices: 775, citingAuditObligation: 775 }] },
  { key: 'opacity', label: 'How it explains itself', view: 'NdisRegisterOpacity', caveat: /PUBLISHING PRACTICE/i,
    fixture: [{ actionType: 'ER - Banning Order', rows: 780, statingABasis: 26, statingABasisPct: 3.0,
                citingCriminalHistory: 47, citingFraudOrFalsification: 6 }] },
  { key: 'flip', label: 'Workforce flip', view: 'NdisWorkforceFlip', caveat: /NOT evidence of sham contracting/i,
    fixture: [{ provider: 'A Provider Ltd', abn: '11111111111', serviceRevenueFy23: 15337183,
                serviceRevenueFy24: 18547142, labourShareFy23Pct: 94, labourShareFy24Pct: 17,
                fteFy23: 45, fteFy24: 36, relatedPartyDeclared: 'y' }] },
  { key: 'passthrough', label: 'Money leaving unspecified', view: 'NdisMoneyLeavesUnspecified', caveat: /ONE government-revenue line/i,
    fixture: [{ provider: 'B Provider Inc', abn: '22222222222', serviceRevenueFy24: 19927223,
                otherExpensesFy24: 18973138, otherExpensesSharePct: 94, employeeExpensesFy24: 1129737,
                fteFy24: 9.2, relatedPartyDeclared: 'n' }] },
];

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

async function invokeView(name) {
  const res = await fetch(`${API}/api/v1/views/${name}/invoke`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64'),
    },
    body: JSON.stringify({ args: {} }),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* leave null */ }
  const data = json && json.data !== undefined ? json.data : json;
  const rows = Array.isArray(data) ? data : (data && Array.isArray(data.rows) ? data.rows : []);
  return { status: json && json.status, rows };
}

(async () => {
  const { srv, port } = await serve(APPS_DIR);
  const BASE = `http://localhost:${port}/ndis-intelligence.html`;
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/404|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 140));
  });

  // Stub the runtime BEFORE the app's own script runs. The real runtime 404s off-platform, so
  // without a stub the app must degrade gracefully — asserted separately below.
  await page.addInitScript(fixtures => {
    window.embabel = {
      runner: { view: async (name) => ({ status: 'COMPLETE', data: { rows: fixtures[name] || [] } }) },
      progress: { label: () => {} },
    };
  }, TABS.reduce((acc, t) => { acc[t.view] = t.fixture; return acc; }, {}));

  console.log('\n== structure ==');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  check('title names the subject', /NDIS Intelligence/.test(await page.title()));
  check('five tabs, one per view', (await page.locator('.tab').count()) === 5);
  check('first pane visible', await page.locator('#pane-new').isVisible());
  check('other panes hidden until selected', await page.locator('#pane-waves').isHidden());
  check('runtime script requested from the platform', (await page.locator('script[src*="apps-runtime"]').count()) === 1);
  const manifest = await page.locator('script[type="application/embabel-app+json"]').innerText();
  check('manifest declares exactly the five views',
    TABS.every(t => manifest.includes(t.view)) && JSON.parse(manifest).requires.views.length === 5);
  check('manifest declares the realm', /gov-au/.test(manifest));

  console.log('\n== honesty invariants ==');
  const body = await page.locator('body').innerText();
  check('every tab carries a caveat', (await page.locator('.caveat').count()) === 5);
  check('says nothing is an allegation', /(nothing here is|is not) an allegation about any provider/i.test(body));
  check('money is never called expenditure', /never verified expenditure/i.test(body));
  check('names its sources', /data\.gov\.au/i.test(body));
  check('no risk score anywhere', !/risk score|risk rating|risk level/i.test(body));
  check('self-reporting is disclosed', /self-reported/i.test(body));

  console.log('\n== tab switching ==');
  for (const t of TABS) {
    await page.locator(`[data-tab="${t.key}"]`).click();
    await page.waitForTimeout(80);
    check(`${t.label}: pane shows`, await page.locator(`#pane-${t.key}`).isVisible());
    check(`${t.label}: tab marked selected`, (await page.locator(`[data-tab="${t.key}"]`).getAttribute('aria-selected')) === 'true');
    check(`${t.label}: carries its own caveat`, t.caveat.test(await page.locator(`#pane-${t.key} .caveat`).innerText()));
    check(`${t.label}: exactly one pane visible`, (await page.locator('.pane:visible').count()) === 1);
  }

  console.log('\n== rendering (real click path, fixture rows) ==');
  for (const t of TABS) {
    await page.locator(`[data-tab="${t.key}"]`).click();
    await page.locator(`#pane-${t.key} .run`).click();
    await page.waitForSelector(`#result-${t.key} table tbody tr`, { timeout: 15000 }).catch(() => {});
    const rows = await page.locator(`#result-${t.key} table tbody tr`).count();
    check(`${t.view}: renders a row`, rows === 1, `rows=${rows}`);
    const cells = await page.locator(`#result-${t.key} table tbody td`).allInnerTexts();
    check(`${t.view}: no [object Object] leaked`, !cells.some(c => c.includes('[object')));
    check(`${t.view}: no undefined or NaN leaked`, !cells.some(c => /\bundefined\b|\bNaN\b/.test(c)));
    check(`${t.view}: blank values render as a dash`, !cells.some(c => c.trim() === ''));
    check(`${t.view}: row count is stated`, /\d/.test(await page.locator(`#result-${t.key} .count`).innerText()));
  }

  console.log('\n== formatting the numbers a reader would quote ==');
  await page.locator('[data-tab="opacity"]').click();
  const opacity = await page.locator('#result-opacity table tbody').innerText();
  check('a percentage is formatted as one', /3\.0%/.test(opacity), opacity.replace(/\s+/g, ' ').slice(0, 120));
  await page.locator('[data-tab="flip"]').click();
  const flip = await page.locator('#result-flip table tbody').innerText();
  check('money is formatted as compact AUD', /\$1[5-9](\.\d)?M/i.test(flip), flip.replace(/\s+/g, ' ').slice(0, 120));

  console.log('\n== quoting the row without misreading it ==');
  await page.locator('[data-tab="flip"]').click();
  const flipCells = await page.locator('#result-flip table tbody td').allInnerTexts();
  check('an ABN is grouped 2-3-3-3 as it is quoted', flipCells.some(c => c.trim() === '11 111 111 111'), flipCells.join(' | '));
  check('a related-party letter renders as a word', flipCells.some(c => /^(yes|no)$/i.test(c.trim())), flipCells.join(' | '));
  check('one row is counted in the singular', /\b1 provider\b/.test(await page.locator('#result-flip .count').innerText()));
  const numHeaders = await page.locator('#result-flip th.num').count();
  check('numeric headers are right-aligned with their values', numHeaders === 3, `th.num=${numHeaders}`);
  // A metric read across two years is ONE fact and belongs in one cell — two columns per metric
  // pushed the table off the card's right edge and the last column read as truncated data.
  const pairs = await page.locator('#result-flip td.pair').allInnerTexts();
  check('each two-year metric is one cell showing both years', pairs.length === 3, `pairs=${pairs.length}`);
  check('and both years are present with a direction', pairs.every(c => /\S+\s*\u2192\s*\S+/.test(c)), pairs.join(' | '));
  check('the flip table now fits without clipping',
    await page.locator('#result-flip .scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 2),
    await page.locator('#result-flip .scroll').evaluate(el => el.scrollWidth + ' vs ' + el.clientWidth));
  const headAlign = await page.locator('#result-flip th.num').first().evaluate(el => getComputedStyle(el).textAlign);
  check('and that alignment actually computes to right', headAlign === 'right', headAlign);
  check('the identity column is the widest, not the narrowest',
    await page.locator('#result-flip td.name').first().evaluate(el => el.getBoundingClientRect().width >= 180));
  const caveatWeight = await page.locator('#pane-flip .caveat b').count();
  check('the caveat emphasises its operative clauses structurally', caveatWeight >= 2, `bolded=${caveatWeight}`);
  check('the caveat separates its distinct claims', (await page.locator('#pane-flip .caveat span').count()) >= 2);

  console.log('\n== more than one row ==');
  const many = await ctx.newPage();
  await many.addInitScript(fixture => {
    window.embabel = {
      runner: { view: async () => ({ status: 'COMPLETE', data: { rows: [fixture, Object.assign({}, fixture, { abn: '22 222 222 222', provider: 'C Provider Pty Ltd' })] } }) },
      progress: { label: () => {} },
    };
  }, TABS.find(t => t.key === 'flip').fixture[0]);
  await many.goto(BASE, { waitUntil: 'domcontentloaded' });
  await many.locator('[data-tab="flip"]').click();
  await many.locator('#pane-flip .run').click();
  await many.waitForSelector('#result-flip table tbody tr');
  check('two rows are counted in the plural', /\b2 providers\b/.test(await many.locator('#result-flip .count').innerText()),
    await many.locator('#result-flip .count').innerText());
  check('a table wider than its card can be scrolled rather than clipped',
    await many.locator('#result-flip .scroll').evaluate(el => getComputedStyle(el).overflowX === 'auto'));
  await many.close();

  console.log('\n== off-screen content announces itself ==');
  // The eight-column narrative table cannot fit a narrow window, and on macOS the scrollbar stays
  // hidden until you scroll — so without a cue the clipped column reads as corrupt data. Tested at
  // the width where it bites, not at the desk-monitor width where everything fits.
  const narrowCtx = await browser.newContext({ viewport: { width: 820, height: 900 } });
  const narrow = await narrowCtx.newPage();
  await narrow.addInitScript(rows => {
    window.embabel = { runner: { view: async () => ({ status: 'COMPLETE', data: { rows: rows } }) }, progress: { label: () => {} } };
  }, TABS.find(t => t.key === 'new').fixture);
  await narrow.goto(BASE, { waitUntil: 'domcontentloaded' });
  await narrow.locator('#pane-new .run').click();
  await narrow.waitForSelector('#result-new table tbody tr');
  const proseScroll = narrow.locator('#result-new .scroll');
  check('the narrative table really is wider than its card in a narrow window',
    await proseScroll.evaluate(el => el.scrollWidth > el.clientWidth + 2),
    await proseScroll.evaluate(el => el.scrollWidth + ' vs ' + el.clientWidth));
  check('so it shows a scroll cue', await narrow.locator('#result-new .scrollwrap.more').count() === 1);
  check('and the cue names the direction', /scroll/i.test(await narrow.locator('#result-new .more-hint').innerText()));
  // Overlaying matters: the first attempt put the fade in the container's BACKGROUND layer, where
  // the rows painted over it and the reviewer could not see it at all. An absolutely-positioned
  // pseudo-element paints above static in-flow content, so assert both the position and that it
  // has faded in (after the transition, not during it).
  await narrow.waitForTimeout(250);
  const cueStyle = await narrow.locator('#result-new .scrollwrap').evaluate(el => {
    const s = getComputedStyle(el, '::after');
    return { position: s.position, opacity: s.opacity, pointerEvents: s.pointerEvents };
  });
  check('the cue overlays the rows rather than sitting behind them', cueStyle.position === 'absolute', JSON.stringify(cueStyle));
  check('the cue is actually visible', cueStyle.opacity === '1', JSON.stringify(cueStyle));
  check('and it never swallows a click', cueStyle.pointerEvents === 'none', JSON.stringify(cueStyle));
  check('nothing is off-screen to the left before scrolling', await narrow.locator('#result-new .scrollwrap.less').count() === 0);
  const clearance = await narrow.locator('#result-new').evaluate(el => {
    const hint = el.querySelector('.more-hint').getBoundingClientRect();
    const lastRow = el.querySelector('tbody tr:last-child').getBoundingClientRect();
    return hint.top - lastRow.bottom;
  });
  check('the hint sits clear of the last row, not inside it', clearance >= 0, `clearance=${clearance}px`);
  // Screenshot BEFORE scrolling: taken after, it showed a legitimately-clipped identity column and
  // read as a rendering defect.
  await narrow.screenshot({ path: path.join(__dirname, 'ndis-intelligence-narrow.png'), fullPage: true }).catch(() => {});
  await proseScroll.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await narrow.waitForTimeout(250);
  check('the cue clears at the end of the table', await narrow.locator('#result-new .scrollwrap.more').count() === 0);
  // Scrolled right, the PROVIDER column is the one off-screen — a right-only cue loses exactly the
  // column that says whose row this is.
  check('and a left cue appears for the identity column now off-screen',
    await narrow.locator('#result-new .scrollwrap.less').count() === 1);
  check('the left cue names its direction', /scroll/i.test(await narrow.locator('#result-new .less-hint').innerText()));
  await narrow.screenshot({ path: path.join(__dirname, 'ndis-intelligence-narrow-scrolled.png'), fullPage: true }).catch(() => {});
  await narrowCtx.close();

  console.log('\n== degrades without the runtime ==');
  const bare = await ctx.newPage();
  await bare.addInitScript(() => { try { delete window.embabel; } catch (e) { window.embabel = undefined; } });
  await bare.goto(BASE, { waitUntil: 'domcontentloaded' });
  await bare.locator('#pane-new .run').click();
  await bare.waitForTimeout(400);
  const noticeText = await bare.locator('#notice').innerText().catch(() => '');
  check('says the runtime is unavailable rather than failing silently', /runtime is unavailable/i.test(noticeText), noticeText);
  await bare.close();

  console.log('\n== console cleanliness ==');
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await page.screenshot({ path: path.join(__dirname, 'ndis-intelligence.png'), fullPage: true }).catch(() => {});
  await browser.close();
  srv.close();

  if (!process.env.SKIP_LIVE) {
    console.log('\n== the data, live (each view must still return rows) ==');
    for (const t of TABS) {
      try {
        const { status, rows } = await invokeView(t.view);
        check(`${t.view}: live view returns rows`, rows.length > 0, `status=${status} rows=${rows.length}`);
      } catch (e) {
        check(`${t.view}: live view returns rows`, false, String((e && e.message) || e));
      }
    }
  } else {
    console.log('\n(live half skipped)');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) { console.log('\nfailures:'); failures.forEach(f => console.log('  - ' + f)); }
  process.exit(fail ? 1 : 0);
})();
