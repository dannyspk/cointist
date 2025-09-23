const path = require('path')
async function run(slug){
  try{
    const modPath = path.join(process.cwd(),'pages','guides','[slug].js')
    const mod = require(modPath)
    if (typeof mod.getServerSideProps !== 'function') return console.error('no getServerSideProps')
    const res = await mod.getServerSideProps({ params: { slug } })
    console.log('metaDescription:', (res && res.props && res.props.article && res.props.article.metaDescription) || (res && res.props && res.props.article && res.props.article.excerpt) || '<none>')
  }catch(e){
    console.error('error', e)
  }
}
run(process.argv[2] || 'stablecoins-payments')
