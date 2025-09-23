// POST /api/webhook-publish
// Validate with header 'x-publish-secret' matching process.env.PUBLISH_WEBHOOK_SECRET
import { promises as fs } from 'fs'

export default async function handler(req, res){
  try{
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const secret = req.headers['x-publish-secret'] || req.query.secret
    if (!secret || secret !== process.env.PUBLISH_WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' })

    // Run generators programmatically: require scripts and call main logic where possible
    // We'll import the generator code by executing the Node scripts in-process.
    const exec = require('child_process').exec
    const cwd = process.cwd()

    function runCmd(cmd){
      return new Promise((resolve, reject)=>{
        exec(cmd, { cwd, env: process.env }, (err, stdout, stderr)=>{
          if (err) return reject({ err, stdout, stderr })
          resolve({ stdout, stderr })
        })
      })
    }

    // Run local generators (they will use Supabase env vars during build environment)
    try{
      await runCmd('node scripts/generate-sitemap-news.js')
      await runCmd('node scripts/generate-sitemap-index.js')
    }catch(e){
      console.error('Generators failed', e)
      return res.status(500).json({ ok: false, error: 'Generators failed', detail: String(e && e.err && e.err.message || e) })
    }

    // Optionally upload to GCS if configured (use @google-cloud/storage)
    const bucketName = process.env.GCS_BUCKET
    const serviceKey = process.env.GCS_SERVICE_ACCOUNT_KEY
    if (bucketName && serviceKey) {
      try{
        const { Storage } = require('@google-cloud/storage')
        const storage = new Storage({ credentials: JSON.parse(serviceKey) })
        const bucket = storage.bucket(bucketName)
        const files = ['sitemap-news.xml', 'sitemap_index.xml']
        for (const f of files){
          const localPath = `public/${f}`
          const file = bucket.file(f)
          await file.save(await fs.readFile(localPath, 'utf8'), { contentType: 'application/xml', resumable: false, metadata: { cacheControl: 'public, max-age=600' } })
          try{ await file.makePublic() }catch(e){}
        }
      }catch(e){ console.error('GCS upload failed', e) }
    }

    return res.status(200).json({ ok: true })
  }catch(e){ console.error(e); return res.status(500).json({ ok: false, error: 'Internal error' }) }
}
