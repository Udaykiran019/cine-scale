/**
 * sync_supabase_ratings.js
 * 
 * Synchronizes Supabase 'movies' table with the updated ratings from 
 * data/enriched_indian_movies.csv using a Wipe & Re-seed strategy.
 * 
 * Task 1: Configuration & CSV Parsing (csv-parser)
 * Task 2: Database Sync Strategy (Wipe existing rows & map schema columns)
 * Task 3: Batch Insertion & Validation
 */

const dns = require('dns');
try {
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
} catch {
  // Fallback to default Node DNS
}

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

// Task 1: Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL or SUPABASE_ANON_KEY is not defined in .env!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const CSV_FILE = path.join(__dirname, 'data', 'enriched_indian_movies.csv');
const FALLBACK_JSON_FILE = path.join(__dirname, 'src', 'data', 'moviesFallback.json');
const BATCH_SIZE = 100;

/**
 * Reads and parses data/enriched_indian_movies.csv using csv-parser
 * Maps rows to match the Supabase 'movies' schema:
 * - title (string)
 * - year (number | null)
 * - imdb_rating (number)
 * - poster_path (string | null)
 * - language (string)
 */
function readAndParseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const movies = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const cleanYear = parseInt((row.Year || '').replace(/\D/g, ''), 10) || null;
        const rating = parseFloat(row.Rating || row.imdb_rating) || 0.0;
        const lang = (row.original_language || row.language || '').trim();

        movies.push({
          title: row.Name ? row.Name.trim() : (row.title ? row.title.trim() : ''),
          year: cleanYear,
          imdb_rating: rating,
          poster_path: row.poster_path ? row.poster_path.trim() : null,
          language: lang
        });
      })
      .on('end', () => resolve(movies))
      .on('error', (err) => reject(err));
  });
}

async function main() {
  console.log('=====================================================');
  console.log('     Supabase Movies Sync Pipeline (Wipe & Re-seed)   ');
  console.log('=====================================================');
  console.log('Target URL   :', SUPABASE_URL);
  console.log('Target Table : movies');
  console.log('Source CSV   :', CSV_FILE, '\n');

  if (!fs.existsSync(CSV_FILE)) {
    console.error(`Error: Source CSV not found at ${CSV_FILE}`);
    process.exit(1);
  }

  // Parse CSV
  console.log('Task 1: Parsing CSV dataset...');
  const records = await readAndParseCSV(CSV_FILE);
  console.log(`Successfully parsed ${records.length} movies from CSV.`);

  if (records.length === 0) {
    console.warn('Warning: No movie records found in CSV to seed. Aborting.');
    return;
  }

  console.log('\nSample record to seed:');
  console.log(records[0]);

  // Task 2: Database Sync Strategy (Wipe existing rows)
  console.log('\nTask 2: Wiping existing rows from Supabase movies table...');
  const { error: wipeError } = await supabase
    .from('movies')
    .delete()
    .neq('id', 0);

  if (wipeError) {
    console.error('Error wiping movies table:', wipeError.message);
    process.exit(1);
  }
  console.log('Existing rows successfully wiped from movies table.');

  // Task 3: Batch Insertion
  console.log('\nTask 3: Batch inserting mapped records into movies table...');
  const totalBatches = Math.ceil(records.length / BATCH_SIZE);
  let totalUploaded = 0;
  const errors = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    try {
      const { error: insertError } = await supabase
        .from('movies')
        .insert(batch);

      if (insertError) {
        errors.push({ batch: batchNum, message: insertError.message });
        console.error(`[Batch ${batchNum}/${totalBatches}] Insert Error:`, insertError.message);
      } else {
        totalUploaded += batch.length;
        console.log(`[Batch ${batchNum}/${totalBatches}] Inserted ${batch.length} movies (Progress: ${totalUploaded}/${records.length})`);
      }
    } catch (err) {
      errors.push({ batch: batchNum, message: err.message });
      console.error(`[Batch ${batchNum}/${totalBatches}] Exception:`, err.message);
    }
  }

  // Verify database count
  const { count: finalCount, error: countError } = await supabase
    .from('movies')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`\nVerified database row count: ${finalCount} movies.`);
  }

  // Synchronize client-side fallback dataset
  if (fs.existsSync(FALLBACK_JSON_FILE) && totalUploaded > 0) {
    try {
      fs.writeFileSync(FALLBACK_JSON_FILE, JSON.stringify(records), 'utf8');
      console.log('Client-side fallback (src/data/moviesFallback.json) synchronized successfully.');
    } catch (err) {
      console.warn('Note: Could not update fallback JSON:', err.message);
    }
  }

  // Final Summary Report
  console.log('\n=====================================================');
  console.log('                   FINAL REPORT                      ');
  console.log('=====================================================');
  console.log(`Total Movies Parsed       : ${records.length}`);
  console.log(`Total Successfully Seeded : ${totalUploaded}`);
  console.log(`Failed Insertions         : ${records.length - totalUploaded}`);
  if (errors.length > 0) {
    console.log(`Errors Encountered        : ${errors.length}`);
  }
  console.log('=====================================================');

  if (totalUploaded === records.length) {
    console.log(`\n🎉 Success! All ${totalUploaded} movies were successfully seeded into Supabase with live IMDb ratings!\n`);
  } else {
    console.warn(`\n⚠️ Seeding finished with ${totalUploaded} out of ${records.length} movies uploaded.\n`);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
