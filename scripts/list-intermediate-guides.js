const db = require('../src/lib/db');

async function main(){
  try{
    // Fetch a large page to include most items; includeGuides true so Guides table is considered
    const items = await db.findArticles({ where: {}, take: 1000, includeGuides: true });
    if (!items || !items.length){
      console.log('No articles returned from DB.');
      return;
    }
    const hasIntermediate = (item) => {
      if (!item) return false;
      const raw = item.tags || item.tag || item.tags_list || item.tagList || item.tagsString || item.labels;
      if (!raw) return false;
      if (Array.isArray(raw)) return raw.map(t=>String(t||'').toLowerCase()).includes('intermediate');
      if (typeof raw === 'string') return raw.split(',').map(t=>t.trim().toLowerCase()).includes('intermediate');
      return String(raw).trim().toLowerCase() === 'intermediate';
    }
    const intermediate = items.filter(hasIntermediate);
    console.log(`Found ${intermediate.length} article(s) with 'Intermediate' tag:`);
    intermediate.forEach(a=>{
      console.log('-', a.id, '-', a.title || a.slug || '(no title)', '-', a.slug || '', '-', Array.isArray(a.tags)?a.tags.join(', '):a.tags);
    });
  }catch(e){
    console.error('Error querying DB:', e && e.message); 
    process.exit(1);
  }
}

main();
