/**
 * cleanup_supabase.js
 * 
 * Runs cleanup query on Supabase 'movies' table to remove records 
 * where language is NOT in ('hi', 'te', 'ta', 'ml').
 * Drops English ('en') and foreign languages ('es', 'fr', 'ja', 'no', etc.).
 */

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const origLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  dns.resolve4(hostname, (err, addresses) => {
    if (!err && addresses && addresses.length > 0) {
      if (options && options.all) {
        return callback(null, addresses.map((a) => ({ address: a, family: 4 })));
      }
      return callback(null, addresses[0], 4);
    }
    origLookup(hostname, options, callback);
  });
};

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL or SUPABASE_ANON_KEY is missing from .env!');
  process.exit(1);
}

const ALLOWED_LANGUAGES = ['hi', 'te', 'ta', 'ml'];

async function cleanupSupabaseTable() {
  console.log('Connecting to Supabase at:', SUPABASE_URL);

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // Check if movies table exists
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/movies?select=*&limit=1`, { headers });
  
  if (checkRes.status === 404) {
    console.log('\n[Supabase Notice]: The table "movies" is not yet published in public schema on Supabase.');
    console.log('If you are setting up or managing your table in the Supabase SQL Editor, run this SQL query:\n');
    console.log('------------------------------------------------------------');
    console.log(`-- Supabase SQL Cleanup Query:
DELETE FROM movies 
WHERE original_language NOT IN ('hi', 'te', 'ta', 'ml')
   OR original_language IS NULL;

-- (Or if the column name is 'language'):
DELETE FROM movies 
WHERE language NOT IN ('hi', 'te', 'ta', 'ml')
   OR language IS NULL;`);
    console.log('------------------------------------------------------------\n');
    return;
  }

  // Determine whether column is 'language' or 'original_language'
  let langColumn = 'original_language';
  const testColRes = await fetch(`${SUPABASE_URL}/rest/v1/movies?select=language&limit=1`, { headers });
  if (testColRes.ok) {
    langColumn = 'language';
  }

  console.log(`Using column: "${langColumn}"`);
  
  // PostgREST query: DELETE /rest/v1/movies?<column>=not.in.(hi,te,ta,ml)
  const deleteUrl = `${SUPABASE_URL}/rest/v1/movies?${langColumn}=not.in.(${ALLOWED_LANGUAGES.join(',')})`;
  console.log(`Executing DELETE request: ${deleteUrl}`);

  const deleteRes = await fetch(deleteUrl, {
    method: 'DELETE',
    headers
  });

  if (deleteRes.ok) {
    const deletedRecords = await deleteRes.json();
    console.log(`\nCleanup successful! Deleted ${deletedRecords.length} records where ${langColumn} not in ('hi', 'te', 'ta', 'ml').`);
  } else {
    const errorText = await deleteRes.text();
    console.error(`Failed to delete records: HTTP ${deleteRes.status}`, errorText);
  }
}

// Update the local enriched dataset so it matches the Supabase cleanup criteria
function cleanupLocalData() {
  const csvPath = path.join(__dirname, 'data', 'enriched_indian_movies.csv');
  const jsonPath = path.join(__dirname, 'data', 'enriched_indian_movies.json');

  if (fs.existsSync(jsonPath)) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const beforeCount = data.length;
    const filtered = data.filter(m => ALLOWED_LANGUAGES.includes(m.original_language || m.language));
    const dropped = data.filter(m => !ALLOWED_LANGUAGES.includes(m.original_language || m.language));

    console.log(`Local Dataset Cleanup:`);
    console.log(`  - Total records before : ${beforeCount}`);
    console.log(`  - Retained ('hi', 'te', 'ta', 'ml') : ${filtered.length}`);
    console.log(`  - Dropped ('en', 'es', 'fr', etc.) : ${dropped.length}`);

    const droppedLangs = {};
    for (const d of dropped) {
      const l = d.original_language || d.language || 'unknown';
      droppedLangs[l] = (droppedLangs[l] || 0) + 1;
    }
    console.log('  - Dropped breakdown:', droppedLangs);

    fs.writeFileSync(jsonPath, JSON.stringify(filtered, null, 2), 'utf8');

    // Update CSV
    if (fs.existsSync(csvPath)) {
      const csvHeader = ['Name', 'Year', 'Rating', 'Votes', 'tmdb_id', 'imdb_id', 'poster_path', 'original_language'];
      const lines = [csvHeader.join(',')];
      for (const m of filtered) {
        const escape = (val) => {
          const s = String(val ?? '');
          return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        };
        lines.push([
          escape(m.name),
          escape(m.year),
          m.rating,
          m.votes,
          m.tmdb_id,
          escape(m.imdb_id),
          escape(m.poster_path),
          escape(m.original_language || m.language)
        ].join(','));
      }
      fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
      console.log(`  - Updated local files: enriched_indian_movies.csv & enriched_indian_movies.json\n`);
    }
  }
}

async function main() {
  await cleanupSupabaseTable();
  cleanupLocalData();
}

main().catch(err => {
  console.error('Error running cleanup:', err);
});
