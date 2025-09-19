#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = process.cwd();
const sqlPath = path.join(ROOT, 'tmp', 'update-image-urls.sql');

if (!fs.existsSync(sqlPath)) {
  console.error('SQL file not found:', sqlPath);
  process.exit(2);
}

const sql = fs.readFileSync(sqlPath, 'utf8');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Please set DATABASE_URL environment variable to run this script.');
  process.exit(2);
}

(async function(){
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('Connected, executing SQL...');
    await client.query(sql);
    console.log('SQL executed successfully. Review and commit if needed.');
    await client.end();
    process.exit(0);
  } catch (e) {
    console.error('Failed to execute SQL:', e.message);
    try { await client.end(); } catch (er) {}
    process.exit(2);
  }
})();
