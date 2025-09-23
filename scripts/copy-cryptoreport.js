const fs = require('fs');
const path = require('path');
const src = path.join(process.cwd(),'public','assets','cryptoreporrtt.webp');
const dest = path.join(process.cwd(),'public','assets','cryptoreport.webp');
if (!fs.existsSync(src)){
  console.error('Source does not exist:', src);
  process.exit(1);
}
fs.copyFileSync(src,dest);
console.log('Copied', src, '->', dest);
