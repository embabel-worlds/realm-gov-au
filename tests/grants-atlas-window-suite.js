// The Grants Atlas default date window.
//
//   node tests/grants-atlas-window-suite.js
//
// The default is ONE month back to today. It was two, which meant every reader who pressed the
// button without touching the controls pulled twice the export they wanted — slower, and a wider
// claim than most questions need.
//
// The clock is FROZEN per case, because the interesting part is not "roughly a month" but the
// month-end clamp: 31 March minus one month is 31 February. The offset is applied to the month and
// the day clamped to that month's length, so it must land on 28 February (2026 is not a leap year)
// rather than rolling forward into March. A test that ran against the real clock would pass all
// month long and fail silently on the 29th, 30th and 31st.
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
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  ok   ' + name); }
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

// [frozen local date, expected from, expected to, why this date]
const CASES = [
  ['2026-08-04', '2026-07-04', '2026-08-04', 'an ordinary day: same day-of-month, one month back'],
  ['2026-03-31', '2026-02-28', '2026-03-31', '31 Feb does not exist — clamp to 28, never roll into March'],
  ['2026-03-30', '2026-02-28', '2026-03-30', '30 Feb does not exist either'],
  ['2024-03-31', '2024-02-29', '2024-03-31', 'a LEAP year clamps to 29, not 28'],
  ['2026-01-15', '2025-12-15', '2026-01-15', 'January steps back across the year boundary'],
  ['2026-01-31', '2025-12-31', '2026-01-31', 'and does so with a 31-day target month intact'],
];

(async () => {
  const { srv, port } = await serve(path.resolve(__dirname, '../apps'));
  const browser = await chromium.launch();
  const errors = [];

  for (const [frozen, wantFrom, wantTo, why] of CASES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${frozen}: ${e.message}`));
    // Freeze `new Date()` with no arguments to local midnight on the frozen day, delegating every
    // other construction so date maths inside the app still works.
    await page.addInitScript(day => {
      const Real = Date;
      const [y, m, d] = day.split('-').map(Number);
      const fixed = new Real(y, m - 1, d, 12, 0, 0);
      function Fake(...args) {
        if (!args.length) return new Real(fixed.getTime());
        return new Real(...args);
      }
      Fake.prototype = Real.prototype;
      Fake.now = () => fixed.getTime();
      Fake.parse = Real.parse;
      Fake.UTC = Real.UTC;
      window.Date = Fake;
    }, frozen);

    await page.goto(`http://localhost:${port}/grants-atlas.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    const from = await page.locator('#from').inputValue();
    const to = await page.locator('#to').inputValue();
    check(`${frozen}: ${why}`, from === wantFrom && to === wantTo, `got ${from} → ${to}, wanted ${wantFrom} → ${wantTo}`);
    if (frozen === '2026-08-04') {
      // The window must never open into the future, whatever the default is.
      check('neither input can be set past today', (await page.locator('#from').getAttribute('max')) === frozen &&
        (await page.locator('#to').getAttribute('max')) === frozen);
      // A one-month default should read as roughly a month in the hint the reader sees, and must not
      // be described with the two-month wording it used to imply.
      const hint = await page.locator('#range-hint, .range-hint, [id*="hint"]').first().innerText().catch(() => '');
      const days = Number((hint.match(/(\d+)\s+inclusive days/) || [])[1] || 0);
      check('the hint states a window of about one month', days >= 28 && days <= 32, `hint said ${days} days: "${hint.slice(0, 80)}"`);
    }
    await ctx.close();
  }

  check('no page errors on any frozen date', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  srv.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) { console.log('\nfailures:'); failures.forEach(f => console.log('  - ' + f)); }
  process.exit(failed ? 1 : 0);
})();
