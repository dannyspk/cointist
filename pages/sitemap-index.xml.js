// Temporary redirect to support requests using a hyphenated sitemap filename.
export async function getServerSideProps(){
  return {
    redirect: {
      destination: '/sitemap_index.xml',
      permanent: true
    }
  }
}

export default function SitemapIndexRedirect(){ return null }
