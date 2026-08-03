// Offline browser regression for the citizen-facing NDIS Public Record app.
//
//   node tests/ndis-public-record-suite.js
//
// The public app is normally served behind an identity provider, so the runtime is stubbed before
// the page loads. The test exercises the real buttons and renderers with representative envelopes.
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
  console.error('playwright not found. Set PLAYWRIGHT_DIR.');
  process.exit(2);
}

let passed = 0, failed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) { passed++; console.log('  ok   ' + name); }
  else { failed++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

function serve(dir) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'content-type': path.extname(file) === '.html' ? 'text/html' : 'text/plain' });
        res.end(data);
      });
    });
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

const fixtures = {
  diff: {
    kind: 'au-register-diff', status: 'COMPLETE',
    watch: { latestExtract: '2026-08-01' },
    headline: { removedWhileInForce: 2, note: 'Two actions left before their published end date; the register does not say why.' },
    removedWhileInForce: [
      { name: 'A Person', register: 'Banning order', state: 'VIC', effectiveFrom: '2026-01-10', leftRegisterBetween: '2026-07-01 and 2026-08-01', publishedUntil: '2027-01-01', citesRules: [], statedBasis: null, commissionNarrative: 'On 5 January 2026 a banning order was made under section 73ZN.' },
      { name: 'A Provider Ltd', register: 'Revocation', leftRegisterBetween: '2026-07-01 and 2026-08-01', publishedUntil: 'open-ended', citesRules: ['audit obligation'], statedBasis: 'On the basis that an audit requirement was not met.' },
    ],
  },
  names: {
    kind: 'au-register-names', status: 'COMPLETE', extractDate: '2026-08-01',
    headline: { crossSubjectOrganisations: 1 },
    enforcementShape: { complianceNotices: 100, citingSection73JAuditObligation: 93, shareCitingAuditObligation: 93, daysWith20OrMoreNotices: 2, noticesIssuedInThoseWaves: 91, shareOfNoticesInWaves: 91 },
    crossSubject: [{ organisation: 'A Connected Provider Ltd', distinctSubjects: 2, subjectsOtherThanSelf: 1,
      mentionedBy: [
        { subject: 'A Person', register: 'Banning order', quote: 'The Commission narrative names A Connected Provider Ltd.' },
        { subject: 'A Connected Provider Ltd', register: 'Revocation', quote: 'The provider registration was revoked.' },
      ] }],
  },
  views: {
    NdisWorkforceFlip: [{ provider: 'Workforce Example Ltd', abn: '11111111111', registrationStatus: 'Voluntarily Revoked Merged', labourShareFy23Pct: 94, labourShareFy24Pct: 17, serviceRevenueFy23: 15000000, serviceRevenueFy24: 18000000, employeeExpensesFy23: 14100000, employeeExpensesFy24: 3060000, fteFy23: 45, fteFy24: 36 }],
    NdisMoneyLeavesUnspecified: [{ provider: 'Expenses Example Inc', abn: '22222222222', registrationStatus: 'Registered', serviceRevenueFy24: 10000000, totalExpensesFy24: 9800000, otherExpensesSharePct: 92, otherExpensesFy24: 9000000, employeeExpensesFy24: 500000, fteFy24: 9 }],
    NdisRevenueSurgeWithoutStaff: [{ provider: 'Growth Example Ltd', abn: '33333333333', registrationStatus: 'Voluntarily Revoked No Longer Operating', serviceRevenueFy23: 1000000, serviceRevenueFy24: 4200000, revenueMultiple: 4.2, fteFy23: 5, fteFy24: 5 }],
    NdisSelfContradictingFiling: [{ provider: 'Star Health Group Limited', abn: '74711038580', registrationStatus: 'Voluntarily Revoked No Longer Operating', contradiction: 'employee expenses reported with zero FTE staff', revenueGovernmentFy24: 1000000, revenueTotalFy24: 20000000, employeeExpensesFy24: 12500000, fteFy24: 0 }],
    NdisPersonPressTrail: [{ person: 'A Person', phrase: '"A Person" NDIS', title: 'A reported NDIS matter', url: 'https://example.test/report', snippet: 'A Person was named in reporting about an NDIS matter.', age: '2 months ago' }],
  },
};

(async () => {
  const { server, port } = await serve(path.resolve(__dirname, '../apps'));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(data => {
    window.embabel = {
      createRunner: () => ({
        lens: async id => ({ data: id === 'au-register-diff' ? data.diff : data.names }),
        view: async id => ({ data: { rows: data.views[id] || [] } }),
      }),
      progress: { label: () => {} },
    };
  }, fixtures);

  const url = `http://localhost:${port}/ndis-public-record.html?demo=1`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(200);

  console.log('\n== first read ==');
  check('title identifies the NDIS public record', /NDIS Public Record/.test(await page.title()));
  check('four headline findings are visible', await page.locator('.impact').count() === 4);
  check('page starts with content rather than empty queries', await page.locator('.impact .number').first().isVisible());
  check('there is no analyst-style tab strip', await page.locator('[role="tablist"]').count() === 0);
  check('every investigative section explains both sides', await page.locator('.explain.means').count() === 4 && await page.locator('.explain.not').count() === 4);
  const body = await page.locator('body').innerText();
  check('plainly says the records do not prove fraud', /cannot, by themselves, prove.*fraud/i.test(body));
  check('the ledger gap is not called a fraud estimate', /not a fraud estimate/i.test(body));
  check('the four headline numbers cannot be mistaken for one total', /Do not add these numbers together/i.test(body));
  check('source links are present', await page.locator('.source[href*="data.gov.au"]').count() === 2);

  console.log('\n== live register changes ==');
  await page.locator('[data-action="changes"]').click();
  await page.waitForSelector('#changes-result .card');
  check('durable removals render as cards', await page.locator('#changes-result .card').count() === 2);
  check('a missing explanation is called a public gap', /public gap/i.test(await page.locator('#changes-result').innerText()));
  check('the live source vintage is displayed', /2026-08-01/.test(await page.locator('#changes-result').innerText()));
  const person = page.locator('#changes-result .card').filter({ has: page.locator('h3', { hasText: /^A Person$/ }) });
  check('a person card links to the official NDIS search', /ndiscommission\.gov\.au/.test(await person.locator('a:has-text("Search current NDIS register")').getAttribute('href')));
  await person.locator('summary').click();
  check('a person can open the last published narrative', /section 73ZN/.test(await person.innerText()));
  await person.locator('[data-person-press]').click();
  await page.waitForSelector('#press-0 .press-item');
  check('press is run as a separate per-person query', /Press search.*A Person.*NDIS/is.test(await person.innerText()));
  check('press results include a source link and snippet', /reported NDIS matter/.test(await person.innerText()) && await person.locator('#press-0 a[href="https://example.test/report"]').count() === 1);
  check('the name-collision caveat stays beside press results', /not proof this is the same person/i.test(await person.innerText()));

  console.log('\n== register context and connections ==');
  await page.locator('[data-action="register"]').first().click();
  await page.waitForSelector('#connections-result .card');
  check('batch context renders percentages', /93%/.test(await page.locator('#enforcement-result').innerText()));
  check('connected names render with quoted context', /Commission narrative names/.test(await page.locator('#connections-result').innerText()));
  check('one register call updates both citizen questions', await page.locator('[data-action="register"]:has-text("Live register loaded")').count() === 2);

  console.log('\n== accounting observations ==');
  await page.locator('[data-action="money"]').click();
  await page.waitForSelector('#money-result .card');
  check('four different arithmetic screens render', await page.locator('#money-result .card').count() === 4);
  check('each card explains why it is shown', await page.locator('#money-result .why').count() === 4);
  check('no horizontal table was introduced', await page.locator('#money-result table').count() === 0);
  check('money is formatted for a general reader', /\$15M/.test(await page.locator('#money-result').innerText()));
  const star = page.locator('#money-result .card').filter({ hasText: 'Star Health Group Limited' });
  check('a provider card links to its ACNC search', /search=74711038580/.test(await star.locator('a:has-text("Open ACNC filings")').getAttribute('href')));
  check('a provider card links to its exact ABN Lookup record', /abn=74711038580/.test(await star.locator('a:has-text("Verify the ABN")').getAttribute('href')));
  check('the bulk filing source is linked', /data\.gov\.au/.test(await star.locator('a:has-text("Source dataset")').getAttribute('href')));
  await star.locator('summary').click();
  check('the exact employee-expense value is available on drill-in', /\$12\.5M/.test(await star.innerText()));
  check('the zero-FTE field is available beside it', /FTE FY24\s+0/i.test(await star.innerText()));
  check('voluntary revocation is prominent before drill-in', /ACNC registration status: Voluntarily Revoked No Longer Operating/i.test(await star.innerText()));
  check('revocation changes the interpretation in plain English', /historical filing.*registration was later revoked/i.test(await star.innerText()));
  check('registered charities also show their status', /ACNC registration status: Registered/i.test(await page.locator('#money-result').innerText()));
  check('the result summary counts distinct revoked charities', /distinct charities.*carry a revoked ACNC registration status/i.test(await page.locator('#money-result .result-head').innerText()));
  check('revoked entities are separated from the current review queue', /Historical filings from revoked charities/i.test(await page.locator('#money-result').innerText()) && await page.locator('#money-result .historical-cards').count() === 1);

  console.log('\n== narrow screen ==');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('the page has no horizontal overflow at phone width', overflow <= 1, `overflow=${overflow}px`);
  check('impact findings stack into one column', await page.locator('.impact-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length === 1));
  await page.screenshot({ path: path.join(__dirname, 'ndis-public-record.png'), fullPage: true }).catch(() => {});

  console.log('\n== snapshot fallback ==');
  const bare = await context.newPage();
  await bare.addInitScript(() => { try { delete window.embabel; } catch (e) { window.embabel = undefined; } });
  await bare.goto(url, { waitUntil: 'domcontentloaded' });
  await bare.locator('[data-action="changes"]').click();
  await bare.waitForTimeout(100);
  check('the verified snapshot remains when the runtime is unavailable', await bare.locator('.impact').count() === 4);
  check('a live-refresh failure is explained in the page', /runtime is unavailable/i.test(await bare.locator('#notice').innerText()));
  await bare.close();

  console.log('\n== browser cleanliness ==');
  check('no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) failures.forEach(f => console.log('  - ' + f));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
