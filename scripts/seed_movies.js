/**
 * seed_movies.js
 * 
 * Reads data/enriched_indian_movies.csv using csv-parser and inserts 
 * records into the Supabase 'movies' table using @supabase/supabase-js.
 * 
 * Columns mapped:
 * - title       <- Name
 * - year        <- Year (parsed as 4-digit integer)
 * - imdb_rating <- Rating (parsed as float)
 * - poster_path <- poster_path
 * - language    <- original_language
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
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

// Validate environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL or SUPABASE_ANON_KEY is not defined in .env!');
  process.exit(1);
}

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CSV_FILE = path.join(__dirname, 'data', 'enriched_indian_movies.csv');
const BATCH_SIZE = 100;

async function parseCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const movies = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        // Map columns to match Supabase movies table
        const cleanYear = parseInt((row.Year || '').replace(/\D/g, ''), 10) || null;
        const rating = parseFloat(row.Rating) || 0.0;

        movies.push({
          title: row.Name ? row.Name.trim() : '',
          year: cleanYear,
          imdb_rating: rating,
          poster_path: row.poster_path ? row.poster_path.trim() : null,
          language: (row.original_language || row.language || '').trim()
        });
      })
      .on('end', () => resolve(movies))
      .on('error', (err) => reject(err));
  });
}

async function seedMovies() {
  console.log('=====================================================');
  console.log('Task 1: Setup and Configuration');
  console.log('=====================================================');
  console.log('Supabase URL  :', SUPABASE_URL);
  console.log('Supabase Key  :', SUPABASE_ANON_KEY.substring(0, 15) + '...');
  console.log('Target Table  : movies\n');

  console.log('=====================================================');
  console.log('Task 2: Parse and Seed');
  console.log('=====================================================');

  if (!fs.existsSync(CSV_FILE)) {
    console.error(`Error: File not found at ${CSV_FILE}`);
    process.exit(1);
  }

  console.log(`Reading and parsing ${CSV_FILE} with csv-parser...`);
  const records = await parseCSVFile(CSV_FILE);
  console.log(`Parsed ${records.length} movie records from CSV.`);

  if (records.length === 0) {
    console.warn('No records to insert!');
    return;
  }

  console.log('\nSample record to insert:');
  console.log(records[0]);
  console.log('');

  // Wipe existing rows to prevent duplicates
  console.log('Wiping existing rows from Supabase movies table...');
  const { error: wipeError } = await supabase.from('movies').delete().neq('id', 0);
  if (wipeError) {
    console.error('Error wiping movies table:', wipeError.message);
  } else {
    console.log('Existing records wiped successfully.');
  }

  // Batch insert
  let totalUploaded = 0;
  const errors = [];
  const totalBatches = Math.ceil(records.length / BATCH_SIZE);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    try {
      const { data, error } = await supabase.from('movies').insert(batch);

      if (error) {
        errors.push({ batch: batchNum, message: error.message, code: error.code, details: error.details });
        console.error(`[Batch ${batchNum}/${totalBatches}] Insertion Error:`, error.message);
      } else {
        totalUploaded += batch.length;
        console.log(`[Batch ${batchNum}/${totalBatches}] Uploaded ${batch.length} movies (Total: ${totalUploaded}/${records.length})`);
      }
    } catch (err) {
      errors.push({ batch: batchNum, message: err.message });
      console.error(`[Batch ${batchNum}/${totalBatches}] Unexpected Error:`, err.message);
    }
  }

  console.log('\n=====================================================');
  console.log('Task 3: Validation and Logging');
  console.log('=====================================================');

  if (errors.length > 0) {
    console.error(`\nEncountered ${errors.length} batch error(s) during upload:`);
    const uniqueErrors = Array.from(new Set(errors.map((e) => `${e.code ? '[' + e.code + '] ' : ''}${e.message}`)));
    uniqueErrors.forEach((msg) => console.error(`  - ${msg}`));

    if (uniqueErrors.some((msg) => msg.includes('row-level security'))) {
      console.log('\n-------------------------------------------------------------');
      console.log('ACTION REQUIRED: Supabase Row-Level Security (RLS) is blocking inserts.');
      console.log('Run ONE of the following queries in the Supabase SQL Editor:');
      console.log('');
      console.log('Option A (Recommended for Seeding): Disable RLS on the table:');
      console.log('  ALTER TABLE movies DISABLE ROW LEVEL SECURITY;');
      console.log('');
      console.log('Option B: Create an insert policy for anonymous users:');
      console.log('  CREATE POLICY "Allow anon insert" ON movies FOR INSERT TO anon WITH CHECK (true);');
      console.log('-------------------------------------------------------------\n');
    }
  }

  // Final summary
  console.log('\n=====================================================');
  console.log('                  FINAL REPORT                       ');
  console.log('=====================================================');
  console.log(`Total Movies Parsed       : ${records.length}`);
  console.log(`Successfully Uploaded     : ${totalUploaded}`);
  console.log(`Failed / Blocked Movies   : ${records.length - totalUploaded}`);
  if (totalUploaded === records.length) {
    console.log(`\n🎉 Success! All ${totalUploaded} movies were successfully uploaded to Supabase!`);
  } else if (totalUploaded > 0) {
    console.log(`\n⚠️ Partial Success: ${totalUploaded} out of ${records.length} movies uploaded.`);
  } else {
    console.log(`\n❌ 0 movies were uploaded due to database permission/RLS restrictions.`);
  }
  console.log('=====================================================\n');
}

seedMovies().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
