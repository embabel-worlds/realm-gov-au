// Thorough offline regression for the Money Trail app: every tab, every panel, every route,
// plus the honesty invariants (a stamp on every result, no raw "[object Object]", no console
// errors anywhere). Run against `python3 -m http.server` in the apps dir.
const { chromium } = require('playwright');

const BASE = 'http://localhost:8765/moneytrail.html?demo=1';
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1200 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('console: ' + m.text().slice(0, 120)); });

  console.log('\n== landing ==');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check('Ask tab is the landing', await page.locator('#pane-ask').isVisible());
  check('Browse hidden until asked for', await page.locator('#pane-explore').isHidden());
  check('six question cards', (await page.locator('.qcard').count()) === 6);
  check('no fake chat log', (await page.locator('.chat-log').count()) === 0);

  console.log('\n== tabs ==');
  for (const [tab, pane] of [['tab-explore', 'pane-explore'], ['tab-lenses', 'pane-lenses'], ['tab-how', 'pane-how'], ['tab-ask', 'pane-ask']]) {
    await page.click('#' + tab); await page.waitForTimeout(350);
    check(tab + ' shows ' + pane, await page.locator('#' + pane).isVisible());
  }

  console.log('\n== routed questions (result must appear inline, with a stamp) ==');
  const routes = [
    ['how did contracts avoid open tender', 'grounds-card'],
    ['where does the money go', 'moneyby-card'],
    ['what is spent on weapons and software', 'moneyby-card'],
    ['which contracts grew the most', 'league-card'],
    ['tell me about CN3942784', 'passport-card'],
    ['is IBM Australia a lobbying client', 'lobby-card'],
    ["what are IBM's largest contracts", 'search-card'],
    ['what is the Defence portfolio buying', 'themes-card'],
  ];
  for (const [q, card] of routes) {
    await page.click('#tab-ask'); await page.waitForTimeout(200);
    await page.fill('#chat-input', q); await page.click('#chat-send');
    await page.waitForTimeout(1500);
    const stamp = await page.locator('#ask-stamp').innerText();
    const inline = await page.locator('#ask-result > section').count();
    const cardId = await page.locator('#ask-result > section').getAttribute('id');
    check('"' + q.slice(0, 34) + '" → ' + card, inline === 1 && cardId === card, 'got ' + cardId);
    check('  ...stamp quotes the question', stamp.includes(q.slice(0, 20)));
    check('  ...stamp reports an outcome', /Ran|→/.test(stamp) && !/…$/.test(stamp.trim()));
  }

  console.log('\n== charts and honesty ==');
  await page.fill('#chat-input', 'where does the money go'); await page.click('#chat-send');
  await page.waitForTimeout(1600);
  check('donuts render', (await page.locator('#ask-result svg.donut').count()) >= 2);
  check('legend names every slice', (await page.locator('#ask-result .legend .lrow').count()) >= 8);
  check('sector cut is marked a model judgment', (await page.locator('#ask-result .judged .jlabel').count()) >= 1);
  const moneyText = await page.locator('#ask-result').innerText();
  check('no [object Object] leaked', !moneyText.includes('[object Object]'));
  check('limits are shown', /Values are commitments/.test(moneyText));

  await page.fill('#chat-input', 'which contracts grew the most'); await page.click('#chat-send');
  await page.waitForTimeout(1500);
  const leagueText = await page.locator('#ask-result').innerText();
  check('league says commitments, not budget', /NOT a budget overrun/.test(leagueText));
  check('negative growth kept with its sign', /-\d+(\.\d+)?%/.test(leagueText));

  await page.fill('#chat-input', 'tell me about CN4118426'); await page.click('#chat-send');
  await page.waitForTimeout(1500);
  const ppText = await page.locator('#ask-result').innerText();
  check('the needle renders', /repaid to department/i.test(ppText));
  check('no electorate/MP on the passport', !/Division of|\(ALP\)|\(LIB\)/.test(ppText));

  console.log('\n== deep dive tiers ==');
  await page.click('#dd-go'); await page.waitForTimeout(900);
  const dd = await page.locator('#dd-result').innerText();
  check('press tier is fenced as not-evidence', /NOT evidence about this contract/i.test(dd));
  check('search phrase basis disclosed', /JUDGMENT by this lens/i.test(dd));

  console.log('\n== out of scope ==');
  await page.fill('#chat-input', 'what is the weather in sydney'); await page.click('#chat-send');
  await page.waitForTimeout(900);
  const oos = await page.locator('#ask-stamp').innerText();
  check('refuses rather than guessing', /no built-in panel matches|contract registers only/i.test(oos));

  console.log('\n== progress banner (idle structure) ==');
  // The banner only SHOWS during live scans (demo mode never fetches), but its structure is
  // load-bearing for the progress JS — a renamed id silently degrades every live scan to a
  // bare spinner, so pin the contract here.
  check('busy banner hidden when idle', await page.locator('#busy').isHidden());
  for (const id of ['busy-label', 'busy-detail', 'busy-fill', 'busy-expect', 'busy-elapsed']) {
    check('#' + id + ' exists', (await page.locator('#' + id).count()) === 1);
  }
  check('progress track present', (await page.locator('#busy .track').count()) === 1);

  console.log('\n== console cleanliness ==');
  check('no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log('\n' + '='.repeat(58));
  console.log('PASS ' + pass + '   FAIL ' + fail);
  if (failures.length) { console.log('\nFailures:'); failures.forEach(f => console.log('  - ' + f)); }
  process.exit(fail ? 1 : 0);
})();
