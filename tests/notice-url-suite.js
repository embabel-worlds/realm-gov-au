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
const HELPER = /const noticeUrl = \(awardId, cnId\) => \{[\s\S]*?\n\s*\};/;

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

const files = fs.readdirSync(LENS_DIR).filter(f => f.endsWith('.yml')).sort();
const withHelper = [];
const users = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(LENS_DIR, f), 'utf8');
  if (/noticeUrl\(/.test(text)) users.push(f);
  const m = text.match(HELPER);
  if (m) withHelper.push({ file: f, source: m[0] });
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
    fn = new Function(`${source}; return noticeUrl;`)();
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
const shapes = new Set(withHelper.map(h => h.source.replace(/\s+/g, ' ')));
check('all copies are byte-identical once whitespace is normalised', shapes.size === 1,
  `${shapes.size} distinct implementations across ${withHelper.length} files`);

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) { console.log('\nfailures:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(failed ? 1 : 0);
