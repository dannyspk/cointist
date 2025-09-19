#!/usr/bin/env node
/**
 * Query upserted articles using Prisma.
 * Usage:
 *   DATABASE_URL='...' node scripts/query-upserted.js           # reads IDs from latest tmp/pipeline-summary-*.json
 *   DATABASE_URL='...' node scripts/query-upserted.js --ids=123,124
 *   DATABASE_URL='...' node scripts/query-upserted.js 123 124
 */

const fs = require('fs')
const path = require('path')
const argv = require('minimist')(process.argv.slice(2))

async function main(){
  const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_RAW || process.env.DATABASE
  if(!DATABASE_URL){
    console.error('Missing DATABASE_URL environment variable. Set it before running this script.');
    process.exit(1)
  }

  // determine IDs
  let ids = []
  if (argv.ids) {
    ids = String(argv.ids).split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n))
  } else if (argv._ && argv._.length) {
    ids = argv._.map(s => Number(s)).filter(n => Number.isInteger(n))
  } else {
    // find latest pipeline-summary file in tmp/
    const TMP = path.join(process.cwd(),'tmp')
    if (!fs.existsSync(TMP)){
      console.error('No tmp/ directory found and no IDs provided.'); process.exit(1)
    }
    const files = fs.readdirSync(TMP).filter(f => f.startsWith('pipeline-summary-') && f.endsWith('.json'))
    if (!files.length){ console.error('No pipeline-summary files found in tmp/ and no IDs provided.'); process.exit(1) }
    // choose newest by mtime
    const sorted = files.map(f=>({ f, m: fs.statSync(path.join(TMP,f)).mtimeMs })).sort((a,b)=>b.m-a.m)
    const latest = sorted[0].f
    const data = JSON.parse(fs.readFileSync(path.join(TMP, latest),'utf8'))
    if (!data || !Array.isArray(data.items) || !data.items.length){ console.error('Latest pipeline summary has no items.'); process.exit(1) }
    ids = data.items.map(it => Number(it.id)).filter(n => Number.isInteger(n))
  }

  if (!ids.length){ console.error('No valid IDs to query. Provide --ids or positional ids or ensure pipeline summary exists.'); process.exit(1) }

  // Lazy-require Prisma (same approach as project)
  let PrismaClient
  try{
    PrismaClient = require('@prisma/client').PrismaClient
  }catch(e){ console.error('Missing @prisma/client dependency. Run: npm install @prisma/client'); process.exit(1) }

  const prisma = new PrismaClient()
  try{
    const rows = await prisma.article.findMany({ where: { id: { in: ids } }, select: { id:true, slug:true, title:true, published:true, publishedAt:true, coverImage:true, thumbnail:true } })
    console.log(JSON.stringify({ queried: ids, found: rows.length, rows }, null, 2))
  }catch(e){ console.error('Query failed', e && e.message || e); process.exit(1) }
  finally{ await prisma.$disconnect() }
}

main().catch(e=>{ console.error(e && e.message || e); process.exit(1) })
