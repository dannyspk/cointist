const fs = require('fs');
const path = require('path');

function walk(dir){
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file){
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(walk(file));
    else results.push(file);
  });
  return results;
}

const root = process.cwd();
const files = walk(root).filter(f => f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.tsx'));
let bad = [];
for(const f of files){
  const content = fs.readFileSync(f, 'utf8');
  const bt = (content.match(/`/g) || []).length;
  if (bt % 2 !== 0) bad.push({file: f, backticks: bt});
}
if (bad.length === 0){
  console.log('No files with unbalanced backticks found.');
  process.exit(0);
}
console.log('Files with odd backtick counts:');
bad.forEach(b => console.log(b.backticks, b.file));
process.exit(0);
