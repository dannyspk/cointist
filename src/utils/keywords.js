// Simple keyword extractor for article titles
// - Removes punctuation, lowercases, splits on whitespace
// - Filters common stopwords
// - Returns top N keywords by frequency and length

const STOPWORDS = new Set([
  'a','an','the','and','or','for','with','to','of','in','on','at','by','from','is','are','was','were','be','as','that','this','these','those','it','its','but','if','then','so','than','into','over','about','after','before','up','down','out','new'
])

function tokenize(text){
  if (!text) return []
  // remove punctuation (keep unicode letters/numbers and spaces)
  const cleaned = String(text).replace(/[\u2018\u2019\u201c\u201d']/g, "").replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
  return cleaned.split(/\s+/).map(t=>t.trim().toLowerCase()).filter(Boolean)
}

function extractKeywords(title, opts = {}){
  const { max = 5, minLength = 3 } = opts
  const tokens = tokenize(title)
  const counts = new Map()
  for (const t of tokens){
    if (STOPWORDS.has(t)) continue
    if (t.length < minLength) continue
    // ignore pure numeric tokens
    if (/^\d+$/.test(t)) continue
    counts.set(t, (counts.get(t) || 0) + 1)
  }
  // sort by frequency then length
  const sorted = Array.from(counts.entries()).sort((a,b)=>{
    if (b[1] !== a[1]) return b[1] - a[1]
    return b[0].length - a[0].length
  }).map(([k])=>k)

  // fallback: include longer tokens from original token list if none found
  if (sorted.length === 0){
    const fallback = tokens.filter(t=>t.length >= minLength && !STOPWORDS.has(t))
    return Array.from(new Set(fallback)).slice(0, max)
  }

  return sorted.slice(0, max)
}

module.exports = { extractKeywords }
