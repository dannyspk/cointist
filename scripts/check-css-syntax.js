const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '..', 'public', 'styles', 'learnby-path.min.css');

try {
  const s = fs.readFileSync(p, 'utf8');
  const errors = [];

  if (s.indexOf('```') !== -1) errors.push("Found code-fence sequence '```' in file");

  const openComments = (s.match(/\/\*/g) || []).length;
  const closeComments = (s.match(/\*\//g) || []).length;
  if (openComments !== closeComments) errors.push(`Unbalanced comment markers: /* = ${openComments}, */ = ${closeComments}`);

  let brace = 0, paren = 0;
  let inSingle = false, inDouble = false, escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (inSingle || inDouble) continue;
    if (ch === '{') brace++;
    if (ch === '}') brace--;
    if (brace < 0) { errors.push(`Unexpected '}' at index ${i}`); break; }
    if (ch === '(') paren++;
    if (ch === ')') paren--;
    if (paren < 0) { errors.push(`Unexpected ')' at index ${i}`); break; }
  }

  if (brace !== 0) errors.push(`Unbalanced braces: { } balance = ${brace}`);
  if (paren !== 0) errors.push(`Unbalanced parentheses: ( ) balance = ${paren}`);

  if (errors.length) {
    console.log('INVALID');
    errors.forEach(e => console.log('- ' + e));
    process.exit(2);
  }

  console.log('VALID');
  process.exit(0);

} catch (err) {
  console.error('ERROR', err.message);
  process.exit(3);
}
