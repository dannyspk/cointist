// Usage: node scripts/fetchArticlesByTag.js Intermediate
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const tag = process.argv[2] || 'Intermediate';

(async () => {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .contains('tags', [tag]);

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  if (!data || !data.length) {
    console.log(`No articles found with tag: ${tag}`);
    process.exit(0);
  }

  console.log(`Articles with tag '${tag}':`);
  data.forEach(a => {
    console.log(`- ${a.title} (id: ${a.id})`);
  });
})();