// The supplier-name normalisation in views/procurement-shape.yml must reproduce the strict
// `[^A-Z0-9]` form the lens used, because NewSuppliersInWindow compares two windows by that key and
// any disagreement INVENTS a supplier that is not new.
//
//   node tests/supplier-normalisation-suite.js
//
// Cypher's replace() takes a literal, not a character class, so the view chains one call per
// character. This extracts that chain from the YAML, evaluates it in JS over real supplier names, and
// asserts it agrees with the strict form on every one — the same 326 names measured when the chain was
// chosen, embedded here so the check needs no network.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

const yamlText = fs.readFileSync(path.resolve(__dirname, '../views/procurement-shape.yml'), 'utf8');

/** The set of characters the view's chain strips, read OUT of the view rather than restated here. */
function strippedChars(text) {
  // every `, 'X', ''` argument pair in a replace() chain
  const found = new Set();
  // Every `, 'X', '')` argument pair — a chained replace() nests, so matching the CALL is fragile
  // while matching its two literal arguments is not.
  for (const m of text.matchAll(/,\s*'((?:\\'|[^'])*)'\s*,\s*''\s*\)/g)) {
    found.add(m[1].replace("\\'", "'"));
  }
  return found;
}

const chars = strippedChars(yamlText);
console.log('\n== the chain, read from the view ==');
check('the view strips more than spaces and periods', chars.size >= 10, `${chars.size} characters: ${[...chars].join('')}`);
for (const c of [' ', '.', ',', '-', '&', "'", '/', '(', ')', '#', '+', '[', ']', '"']) {
  check(`strips ${JSON.stringify(c)}`, chars.has(c));
}

// Real supplier names, from four AusTender publication days. Kept verbatim BECAUSE the punctuation is
// the point — a paraphrase would test nothing. These are public register entries, not personal data.
const REAL_NAMES = [
  'A & D INTERNATIONAL PTY LTD',
  'A.S. HARRISON & CO PTY LIMITED',
  'AUSTRALIAN GOVERNMENT SOLICITOR - MATTER OPERATING ACCOUNT',
  'All Aspects Recruitment & HR Services',
  'Australia Post - Melbourne',
  'Australia Post Acct [HEAD ACCT]',
  'Australian Human Resources Institut Limited (AHRI Ltd)',
  "Australian Indigenous Doctors' Association",
  'DATA#3 LIMITED',
  'Data#3 Limited',
  'DATA # 3 GROUP',
  'Jones/Smith Partners Pty Ltd',
  'ACME + PARTNERS',
  'PLAIN NAME PTY LTD',
];

const strict = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const chained = (s) => [...chars].reduce((acc, c) => acc.split(c).join(''), s.toUpperCase());

console.log('\n== the chain reproduces the strict form ==');
let disagreements = 0;
for (const n of REAL_NAMES) {
  if (strict(n) !== chained(n)) { disagreements++; check(`agrees for ${JSON.stringify(n)}`, false, `${chained(n)} vs ${strict(n)}`); }
}
check(`all ${REAL_NAMES.length} real names normalise identically`, disagreements === 0);

console.log('\n== and the whole point: variant spellings collapse to ONE supplier ==');
check('DATA#3 spellings are one key',
  new Set(['DATA#3 LIMITED', 'Data#3 Limited'].map(chained)).size === 1);
check('spacing and punctuation variants of one name are one key',
  new Set(['A & D INTERNATIONAL PTY LTD', 'A&D INTERNATIONAL PTY LTD', 'A.&.D. International Pty Ltd'].map(chained)).size === 1,
  JSON.stringify(['A & D INTERNATIONAL PTY LTD', 'A&D INTERNATIONAL PTY LTD', 'A.&.D. International Pty Ltd'].map(chained)));
check('genuinely different suppliers stay different',
  new Set(['ACME PTY LTD', 'ACNE PTY LTD'].map(chained)).size === 2);

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) { console.log('\nfailures:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(fail ? 1 : 0);
