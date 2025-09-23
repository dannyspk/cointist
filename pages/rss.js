// Minimal RSS placeholder. If you prefer an actual feed, replace this with dynamic generation.
import { NextApiResponse } from 'next'
export default function RssPlaceholder(){
  return null
}

export async function getServerSideProps({ res }){
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Cointist — Updates</title><link>https://cointist.net/</link><description>Placeholder RSS feed</description></channel></rss>`
  if (res) {
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=59')
    res.statusCode = 200
    res.end(xml)
    return { props: {} }
  }
  return { props: {} }
}
