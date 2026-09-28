/**
 * update_omdb_ratings.js
 * 
 * Updates movie ratings in data/enriched_indian_movies.csv with live,
 * genuine IMDb ratings using the OMDb API.
 * 
 * Features:
 * - Reads OMDB_API_KEY from .env
 * - Parses data/enriched_indian_movies.csv
 * - Queries OMDb API for each movie's imdb_id with rate-limit pacing (100ms delay)
 * - Retains existing rating if OMDb returns 'N/A' or if request fails
 * - Overwrites data/enriched_indian_movies.csv preserving original column structure
 * - Synchronizes data/enriched_indian_movies.json as well
 * - Logs detailed progress and final summary
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
  // If DNS override fails, fallback to default Node DNS
}

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OMDB_API_KEY = process.env.OMDB_API_KEY;
if (!OMDB_API_KEY) {
  console.error('Error: OMDB_API_KEY is not defined in .env file!');
  process.exit(1);
}

const CSV_FILE_PATH = path.resolve(__dirname, 'data/enriched_indian_movies.csv');
const JSON_FILE_PATH = path.resolve(__dirname, 'data/enriched_indian_movies.json');

const REQUEST_DELAY_MS = 100;
const REQUEST_TIMEOUT_MS = 8000;

// Helper to pause execution
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Standard RFC-4180 CSV parser
 */
function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      currentVal = '';
      if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== '')) {
      rows.push(currentRow);
    }
  }
  return rows;
}

/**
 * Helper to escape CSV cell values
 */
function formatCSVField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Fetches IMDb rating from OMDb API with 1 retry
 */
async function fetchOmdbRating(imdbId) {
  const url = 'http://www.omdbapi.com/';
  const params = { i: imdbId, apikey: OMDB_API_KEY };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await axios.get(url, {
        params,
        timeout: REQUEST_TIMEOUT_MS
      });

      const data = response.data;
      if (data && data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A') {
        const parsed = parseFloat(data.imdbRating);
        if (!isNaN(parsed)) {
          return {
            success: true,
            rating: data.imdbRating.trim(),
            votes: data.imdbVotes ? data.imdbVotes.replace(/,/g, '') : null
          };
        }
      }
      // OMDb responded but rating is N/A or Response is False
      return { success: false, reason: data?.Error || 'Rating N/A' };
    } catch (err) {
      if (attempt === 1) {
        await sleep(250);
      } else {
        return { success: false, reason: err.message };
      }
    }
  }
  return { success: false, reason: 'Request failed after retry' };
}

async function main() {
  console.log('====================================================');
  console.log('    OMDb Live Rating Update Pipeline (CineScale)    ');
  console.log('====================================================');

  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`Error: CSV file not found at ${CSV_FILE_PATH}`);
    process.exit(1);
  }

  console.log(`Reading CSV from: ${CSV_FILE_PATH}`);
  const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
  const rows = parseCSV(csvContent);

  if (rows.length < 2) {
    console.error('Error: CSV file contains no data rows.');
    process.exit(1);
  }

  const headers = rows[0];
  console.log(`Headers found: ${headers.join(', ')}`);

  const nameIdx = headers.findIndex((h) => h.toLowerCase() === 'name' || h.toLowerCase() === 'title');
  const ratingIdx = headers.findIndex((h) => h.toLowerCase() === 'rating' || h.toLowerCase() === 'imdb_rating');
  const imdbIdIdx = headers.findIndex((h) => h.toLowerCase() === 'imdb_id');

  if (ratingIdx === -1) {
    console.error('Error: Could not find Rating or imdb_rating column in CSV header!');
    process.exit(1);
  }
  if (imdbIdIdx === -1) {
    console.error('Error: Could not find imdb_id column in CSV header!');
    process.exit(1);
  }

  const totalMovies = rows.length - 1;
  console.log(`Loaded ${totalMovies} movies to process from CSV.`);
  console.log(`Target Rating Column: "${headers[ratingIdx]}" (index ${ratingIdx})`);
  console.log(`Target IMDb ID Column: "${headers[imdbIdIdx]}" (index ${imdbIdIdx})`);
  console.log(`Rate limit delay: ${REQUEST_DELAY_MS}ms per request\n`);

  let updatedCount = 0;
  let fallbackCount = 0;
  let changedCount = 0;
  const sampleChanges = [];

  const startTime = Date.now();

  for (let i = 1; i <= totalMovies; i++) {
    const row = rows[i];
    const movieName = nameIdx !== -1 ? row[nameIdx] : `Movie #${i}`;
    const imdbId = row[imdbIdIdx]?.trim();
    const oldRating = row[ratingIdx]?.trim();

    if (!imdbId || !imdbId.startsWith('tt')) {
      fallbackCount++;
      continue;
    }

    const result = await fetchOmdbRating(imdbId);

    if (result.success) {
      updatedCount++;
      const newRating = result.rating;

      if (newRating !== oldRating) {
        changedCount++;
        if (sampleChanges.length < 8) {
          sampleChanges.push({
            name: movieName,
            imdbId,
            oldRating,
            newRating
          });
        }
      }

      // Overwrite rating in row
      row[ratingIdx] = newRating;
    } else {
      fallbackCount++;
      // Retain existing oldRating
    }

    // Pacing delay
    await sleep(REQUEST_DELAY_MS);

    // Progress logging every 50 records or on the last record
    if (i % 50 === 0 || i === totalMovies) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const percent = ((i / totalMovies) * 100).toFixed(1);
      console.log(
        `[${percent}%] Processed ${i}/${totalMovies} movies | Updated: ${updatedCount} | Fallbacks: ${fallbackCount} | Elapsed: ${elapsed}s`
      );
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  // Write updated CSV back
  console.log('\nWriting updated data back to CSV...');
  const updatedCsvLines = [headers.join(',')];
  for (let i = 1; i <= totalMovies; i++) {
    const formattedRow = rows[i].map(formatCSVField);
    updatedCsvLines.push(formattedRow.join(','));
  }
  fs.writeFileSync(CSV_FILE_PATH, updatedCsvLines.join('\n'), 'utf8');
  console.log(`Successfully overwritten: ${CSV_FILE_PATH}`);

  // Synchronize JSON if it exists
  if (fs.existsSync(JSON_FILE_PATH)) {
    try {
      console.log('Synchronizing data/enriched_indian_movies.json...');
      const jsonData = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));
      // Build a map of imdb_id -> rating
      const ratingMap = new Map();
      for (let i = 1; i <= totalMovies; i++) {
        const id = rows[i][imdbIdIdx];
        const r = parseFloat(rows[i][ratingIdx]);
        if (id && !isNaN(r)) {
          ratingMap.set(id, r);
        }
      }
      for (const item of jsonData) {
        if (item.imdb_id && ratingMap.has(item.imdb_id)) {
          item.rating = ratingMap.get(item.imdb_id);
        }
      }
      fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(jsonData, null, 2), 'utf8');
      console.log(`Successfully updated: ${JSON_FILE_PATH}`);
    } catch (err) {
      console.warn('Note: Could not update JSON file:', err.message);
    }
  }

  // Print Final Summary
  console.log('\n====================================================');
  console.log('            OMDb RATING UPDATE SUMMARY              ');
  console.log('====================================================');
  console.log(`Total Movies in CSV     : ${totalMovies}`);
  console.log(`Successfully Updated    : ${updatedCount} rows`);
  console.log(`Retained Fallbacks      : ${fallbackCount} rows`);
  console.log(`Ratings Value Shifted   : ${changedCount} movies`);
  console.log(`Total Duration          : ${durationSec}s`);
  console.log('====================================================');

  if (sampleChanges.length > 0) {
    console.log('\nSample Live Rating Changes:');
    sampleChanges.forEach((s) => {
      console.log(`  - "${s.name}" (${s.imdbId}): ${s.oldRating} -> ${s.newRating}`);
    });
  }
  console.log('\nAll done!\n');
}

main().catch((err) => {
  console.error('Fatal error during OMDb rating update:', err);
  process.exit(1);
});
