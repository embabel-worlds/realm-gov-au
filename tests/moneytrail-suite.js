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
  check('eight question cards', (await page.locator('.qcard').count()) === 8);
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
  check('parliament tier renders', /parliamentary record/i.test(dd));
  check('parliament mentions fenced as not-evidence', /mentions, not evidence/i.test(dd));
  check('parliament silence doubly qualified', /cannot be concluded from an empty result/i.test(dd));
  check('parliament CN-id search phrase disclosed', /CN4118426/.test(dd));

  console.log('\n== out of scope ==');
  await page.fill('#chat-input', 'what is the weather in sydney'); await page.click('#chat-send');
  await page.waitForTimeout(900);
  const oos = await page.locator('#ask-stamp').innerText();
  check('refuses rather than guessing', /no built-in panel matches|contract registers only/i.test(oos));

  console.log('\n== big money, thin disclosure ==');
  await page.click('#tab-ask'); await page.waitForTimeout(300);
  await page.fill('#chat-input', 'which big contracts tell the public almost nothing about what is being bought');
  await page.click('#chat-send'); await page.waitForTimeout(1200);
  check('opaque panel appears inline', await page.locator('#opaque-card').isVisible());
  const opText = await page.locator('#op-result').innerText();
  check('description shown verbatim in quotes', /\u201c.+\u201d|“.+”/.test(opText));
  check('deterministic signal named', /adds nothing by construction|under 60 characters|repeats the title|no description/i.test(opText));
  check('fenced as disclosure, not wrongdoing', /never a finding of wrongdoing/i.test(opText));
  check('model layer honestly absent in demo', /needs a running world|unavailable in the standalone demo/i.test(opText));


  console.log('\n== the parliamentary record ==');
  await page.click('#tab-ask'); await page.waitForTimeout(300);
  await page.fill('#chat-input', 'Was Snowy Hydro raised in Senate Estimates this year?');
  await page.click('#chat-send'); await page.waitForTimeout(1200);
  check('parliament panel appears inline', await page.locator('#parliament-card').isVisible());
  check('the venue is not mistaken for the subject', (await page.locator('#pl-phrase').inputValue()) === 'Snowy Hydro');
  const plText = await page.locator('#pl-result').innerText();
  check('results grouped by record class', /Senate Estimates transcripts/i.test(plText) && /Chamber Hansard/i.test(plText));
  check('real baked estimates hits render', /Economics Legislation Committee/.test(plText));
  check('mentions fenced as never-evidence', /never evidence about a contract/i.test(plText));
  check('QoN gap keeps the conclusion qualified', /cannot be concluded/i.test(plText));
  check('a verbatim transcript excerpt renders quoted, with speakers', /“Senator ROBERTS/.test(plText) && /Dr Mayfield/.test(plText));
  check('the model reading is never faked in demo', !/judgment, not transcript/i.test(plText));

  // The semantic-index affordance: offered on estimates hits, honest about needing a world in demo.
  check('index button offered on estimates hits', (await page.locator('#pl-index').count()) === 1);
  await page.click('#pl-index'); await page.waitForTimeout(400);
  const plStamp = await page.locator('#pl-stamp').innerText();
  check('demo indexing says it needs a running world', /needs a running world/i.test(plStamp));

  // ANY topic, not just Capitalised entities: a lowercase policy phrase must route and extract.
  await page.fill('#chat-input', 'what has parliament discussed about immigration detention?');
  await page.click('#chat-send'); await page.waitForTimeout(900);
  check('a lowercase topic routes to parliament', await page.locator('#parliament-card').isVisible());
  check('the topic itself is the phrase', (await page.locator('#pl-phrase').inputValue()) === 'immigration detention');
  await page.fill('#chat-input', 'what was said about robodebt in senate estimates?');
  await page.click('#chat-send'); await page.waitForTimeout(900);
  check('a trailing venue clause is trimmed off the topic', (await page.locator('#pl-phrase').inputValue()) === 'robodebt');

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
