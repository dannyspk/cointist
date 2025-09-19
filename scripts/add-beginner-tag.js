#!/usr/bin/env node
// Add 'Beginner' tag to Guides rows that don't have 'Intermediate' or 'Advanced'
// Dry-run by default. Use --apply to perform updates.

const argv = require('minimist')(process.argv.slice(2))
const { createClient } = require('@supabase/supabase-js')

const SUPA_URL = process.env.SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in environment.')
  process.exit(2)
}

const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

const DRY = !(argv.apply || argv.a)
const LIMIT = Number(argv.limit || argv.l || 1000)

function normalizeTags(raw){
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(t => String(t).trim()).filter(Boolean)
  if (typeof raw === 'string'){
    const s = raw.trim()
    // JSON array
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))){
      try { const parsed = JSON.parse(s); return normalizeTags(parsed); } catch (e) {}
    }
    // comma separated
    return s.split(',').map(t => String(t || '').trim()).filter(Boolean)
  }
  // fallback single value
  return [String(raw).trim()].filter(Boolean)
}

function includesTag(tagsArr, target){
  if (!Array.isArray(tagsArr)) return false
  const low = tagsArr.map(t => String(t || '').trim().toLowerCase())
  return low.includes(String(target).toLowerCase())
}

async function run(){
  console.log(`${DRY ? 'DRY-RUN' : 'APPLY'}: scanning Guides (limit=${LIMIT})`)
  try{
    const { data, error } = await supa.from('Guides').select('*').limit(LIMIT)
    if (error) throw error
    if (!data || !data.length){ console.log('No Guides rows found.'); return }
    let inspected = 0
    let toUpdate = []
    for (const row of data){
      inspected++
      const tagsRaw = row.tags || row.tag || row.tags_list || row.tagsString || row.labels || null
      const tags = normalizeTags(tagsRaw)
      const hasIntermediate = includesTag(tags, 'Intermediate')
      const hasAdvanced = includesTag(tags, 'Advanced')
      const hasBeginner = includesTag(tags, 'Beginner')
      if (hasIntermediate || hasAdvanced) continue
      if (hasBeginner) continue
      // candidate for adding Beginner
      const newTags = [...tags, 'Beginner']
      toUpdate.push({ id: row.id, title: row.title || row.slug || row.name || '', currentTags: tags, newTags })
    }

    console.log(`Inspected ${inspected} rows. Candidates to add 'Beginner': ${toUpdate.length}`)
    if (!toUpdate.length) return
    // show sample
    console.log('Sample candidates:')
    console.log(toUpdate.slice(0,10).map(x => ({ id: x.id, title: x.title, newTags: x.newTags })).slice(0,10))

    if (DRY){
      console.log('\nDry-run complete. Rerun with --apply to perform updates.')
      return
    }

    // perform updates
    let updated = 0
    for (const it of toUpdate){
      try{
        const upd = { tags: it.newTags }
        const { data: res, error: updErr } = await supa.from('Guides').update(upd).eq('id', it.id).select()
        if (updErr){ console.error('Update failed for id', it.id, updErr); continue }
        updated++
        console.log('Updated id', it.id, 'title=', it.title)
      }catch(e){ console.error('Exception updating id', it.id, e && e.message) }
    }
    console.log(`Finished. Updated ${updated} rows.`)
  }catch(e){
    console.error('Fatal', e && (e.message || e))
    process.exit(1)
  }
}

run()
