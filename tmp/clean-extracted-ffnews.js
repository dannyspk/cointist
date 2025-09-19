const fs = require('fs')
const path = require('path')
const infile = path.join(__dirname, 'source-for-rephrase-ffnews-2.txt')
const outfile = path.join(__dirname, 'source-for-rephrase-ffnews-2-clean.txt')
let s = fs.readFileSync(infile,'utf8')
// remove header lines that the extractor adds
s = s.replace(/^Source:.*\nSelector:.*\n\n/s, '')
// remove common share/link prompts
s = s.replace(/Share this post:\s*Share on LinkedIn[\s\S]*?(?=BingX,|People In This Post|$)/g, '')
// truncate at People In This Post or Companies In This Post markers
const trunc = s.search(/\b(People In This Post|Companies In This Post)\b/)
if(trunc !== -1) s = s.slice(0, trunc).trim()
// normalize whitespace and fix spaces after punctuation
s = s.replace(/\s+\n?/g,' ').replace(/\s+([,.!?;:])/g,'$1').trim()
// ensure paragraphs: split on double sentence breaks we joined and add two newlines after sentences that look like paragraph breaks
s = s.replace(/\s{2,}/g,'\n\n')
fs.writeFileSync(outfile, s, 'utf8')
console.log('Wrote cleaned file to', outfile)
