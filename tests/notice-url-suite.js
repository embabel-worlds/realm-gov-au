// Guards the AusTender record link, in every lens that builds one.
//
//   node tests/notice-url-suite.js
//
// Two things this exists for.
//
// 1. THE SHAPE. `awards[0].id` is 'CN4250495-<32 hex>' and that hex is AusTender's own record id,
//    so /Cn/Show/<hyphenated> opens the notice. The keyword-search URL every lens used before only
//    ever landed the reader on a results page. Both shapes were fetched live on 2026-08-03; the
//    canonical case below is the verified pair.
//
// 2. THE FALLBACK, which matters more than the happy path. A wrong id under /Cn/Show returns
//    **HTTP 200 with a ~19KB error page**, not a 404 — measured. So a malformed awardId must fall
//    back to the search rather than mint a plausible-looking URL that silently shows the reader an
//    error page. That is the assertion to keep if any other is ever dropped.
//
// The helper is inlined in each lens because a lens script is self-contained, so the risk is DRIFT:
// fourteen copies that quietly stop agreeing. This extracts every copy and runs all cases against
// all of them.
const fs = require('fs');
const path = require('path');

const LENS_DIR = path.resolve(__dirname, '../lenses');
// The helper now lives in APPS as well: a view returns awardId and the app renders the link, where
// the lens used to. Same drift risk, so the same guard covers both directories.
const APP_DIR = path.resolve(__dirname, '../apps');
// Two spellings, one body: `const noticeUrl = (awardId, cnId) => {…}` in a lens script and
// `function noticeUrl(awardId, cnId) {…}` in an app. Extraction is BRACE-MATCHED rather than regex:
// a non-greedy pattern stopped at the first inner `}` and produced an unparseable fragment.
const SIGNATURES = [
  { re: /const noticeUrl = \(awardId, cnId\) => \{/, wrap: (body) => `const noticeUrl = (awardId, cnId) => {${body}}` },
  { re: /function noticeUrl\(awardId, cnId\) \{/, wrap: (body) => `function noticeUrl(awardId, cnId) {${body}}` },
];

/** The helper's BODY (between its braces) and a runnable form of it, or null when absent. */
function extractHelper(text) {
  for (const sig of SIGNATURES) {
    const m = sig.re.exec(text);
    if (!m) continue;
    let depth = 0;
    const open = m.index + m[0].length - 1;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          const body = text.slice(open + 1, i);
          return { body, source: sig.wrap(body) };
        }
      }
    }
  }
  return null;
}

const CASES = [
  { awardId: 'CN4250495-020ad237632c48d2bbe40a0d720ec009', cnId: 'CN4250495',
    want: 'https://www.tenders.gov.au/Cn/Show/020ad237-632c-48d2-bbe4-0a0d720ec009',
    why: 'the live-verified pair resolves to the record' },
  { awardId: null, cnId: 'CN4256861',
    want: 'https://www.tenders.gov.au/Search/KeywordSearch?keyword=CN4256861',
    why: 'no awardId (a row cached before the projection existed) falls back to the search' },
  { awardId: '', cnId: 'CN4256861',
    want: 'https://www.tenders.gov.au/Search/KeywordSearch?keyword=CN4256861',
    why: 'an empty awardId is not an awardId' },
  { awardId: 'CN1-deadbeef', cnId: 'CN1',
    want: 'https://www.tenders.gov.au/Search/KeywordSearch?keyword=CN1',
    why: 'a SHORT hex must not mint a /Cn/Show that 200s onto an error page' },
  { awardId: 'CN2-' + 'f'.repeat(33), cnId: 'CN2',
    want: 'https://www.tenders.gov.au/Search/KeywordSearch?keyword=CN2',
    why: 'a LONG hex must not either' },
  { awardId: 'nohyphen', cnId: 'CN3',
    want: 'https://www.tenders.gov.au/Search/KeywordSearch?keyword=CN3',
    why: 'an awardId in an unexpected shape falls back rather than guessing' },
  { awardId: null, cnId: null,
    want: 'https://www.tenders.gov.au/Search/KeywordSearch?keyword=',
    why: 'neither present still yields a URL, never the string "undefined"' },
];

let passed = 0, failed = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) { passed++; } else { failed++; failures.push(name + (detail ? ' — ' + detail : '')); }
  if (!ok) console.log('  FAIL ' + name + (detail ? ' — ' + detail : ''));
}

const files = [
  ...fs.readdirSync(LENS_DIR).filter(f => f.endsWith('.yml')).sort().map(f => ({ dir: LENS_DIR, f })),
  ...fs.readdirSync(APP_DIR).filter(f => f.endsWith('.html')).sort().map(f => ({ dir: APP_DIR, f })),
];
const withHelper = [];
const users = [];
for (const { dir, f } of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  if (/noticeUrl\(/.test(text)) users.push(f);
  const h = extractHelper(text);
  if (h) withHelper.push({ file: f, source: h.source, body: h.body });
}

console.log(`\n== every lens that CALLS the helper also DEFINES it ==`);
const defined = new Set(withHelper.map(h => h.file));
for (const f of users) check(`${f} defines the helper it calls`, defined.has(f));
check('at least the known callers are covered', users.length >= 14, `found ${users.length}`);
console.log(`  ${users.length} lens(es) build a record link, ${withHelper.length} define the helper`);

console.log(`\n== the shape, in every copy ==`);
for (const { file, source } of withHelper) {
  let fn;
  try {
    // eslint-disable-next-line no-new-func
    fn = new Function(`${source}\n; return noticeUrl;`)();
  } catch (e) {
    check(`${file}: the helper parses`, false, e.message);
    continue;
  }
  let bad = 0;
  for (const c of CASES) {
    const got = fn(c.awardId, c.cnId);
    if (got !== c.want) { bad++; check(`${file}: ${c.why}`, false, `got ${got}`); }
  }
  if (!bad) { passed++; console.log(`  ok   ${file} — all ${CASES.length} cases`); }
}

console.log(`\n== no copy has drifted from any other ==`);
// DRIFT, tested by BEHAVIOUR rather than by text. A lens script and an app legitimately spell the
// same logic differently — arrow function and template literals in one, function declaration and
// concatenation in the other — so comparing normalised source fights idiom and proves nothing about
// what the copies DO. Instead: every copy must agree with every other on every input, including
// shapes no case above covers.
const AGREEMENT_INPUTS = [
  ...CASES.map((c) => [c.awardId, c.cnId]),
  ['CN9-' + 'a'.repeat(32), 'CN9'],
  ['CN9-' + 'A'.repeat(32), 'CN9'],
  ['-' + 'b'.repeat(32), 'CN10'],
  ['CN11-', 'CN11'],
  [undefined, undefined],
  ['CN12-' + 'c'.repeat(31), 'CN12'],
  ['CN13-' + '0'.repeat(32), 'CN13 with spaces'],
];
const fns = withHelper.map((h) => ({
  file: h.file,
  // eslint-disable-next-line no-new-func
  fn: new Function(`${h.source}\n; return noticeUrl;`)(),
}));
let disagreements = 0;
for (const [awardId, cnId] of AGREEMENT_INPUTS) {
  const outs = fns.map((x) => ({ file: x.file, out: x.fn(awardId, cnId) }));
  const distinct = new Set(outs.map((o) => o.out));
  if (distinct.size > 1) {
    disagreements++;
    check(`all copies agree for awardId=${JSON.stringify(awardId)}`, false,
      outs.filter((o, i, a) => o.out !== a[0].out).map((o) => `${o.file}→${o.out}`).join(', '));
  }
}
check(`all ${fns.length} copies agree on all ${AGREEMENT_INPUTS.length} inputs`, disagreements === 0);

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) { console.log('\nfailures:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(failed ? 1 : 0);
