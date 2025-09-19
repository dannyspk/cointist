// Simple serverless subscribe endpoint.
// Stores submissions in `data/subscribers.csv` on the server filesystem.

import fs from 'fs'
import path from 'path'

function isEmail(e){
  if (!e) return false
  try{ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim()) }catch(e){return false}
}

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try{
    const body = req.body || {}
    const email = body.email && String(body.email).trim()
    if (!isEmail(email)) return res.status(400).json({ error: 'Invalid email' })

    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    const file = path.join(dataDir, 'subscribers.csv')

    const line = `${new Date().toISOString()},${email}\n`
    fs.appendFileSync(file, line, { encoding: 'utf8' })

    return res.status(200).json({ success: true })
  }catch(err){
    console.error('subscribe API error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
