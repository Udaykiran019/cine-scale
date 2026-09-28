/**
 * enrich_movies.js
 * 
 * Task 2: API Enrichment (with Language Tracking & Authentication)
 * - Loads environment variables via dotenv (TMDB_API_KEY)
 * - Iterates through the filtered popular Indian movies
 * - Pings TMDb Search API with Name and Year
 * - Extracts poster_path, tmdb_id, and original_language from first search result
 * - Pings TMDb External IDs endpoint to fetch imdb_id
 * - Drops rows where poster or ID cannot be found
 * - Saves enriched data to CSV and JSON formats
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

const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  console.error('Error: TMDB_API_KEY is not defined in .env file!');
  process.exit(1);
}

// Input and output file paths
const INPUT_CSV = path.join(__dirname, 'data', 'cleaned_indian_movies.csv');
const OUTPUT_CSV = path.join(__dirname, 'data', 'enriched_indian_movies.csv');
const OUTPUT_JSON = path.join(__dirname, 'data', 'enriched_indian_movies.json');

// Configuration for API requests
const CONCURRENCY_LIMIT = 5;
const REQUEST_DELAY_MS = 60;
const MAX_RETRIES = 3;

/**
 * Standard CSV parser (handles commas within quotes)
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
 * Fetch wrapper with exponential backoff and rate limit handling
 */
async function fetchWithRetry(url, retries = MAX_RETRIES, delay = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        // Rate limited
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay * attempt;
        await new Promise((res) => setTimeout(res, waitTime));
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((res) => setTimeout(res, delay * attempt));
    }
  }
  return null;
}

/**
 * Fetch movie search and external IDs from TMDb
 */
async function enrichMovie(movie) {
  const { name, year, rating, votes } = movie;
  const cleanYear = (year || '').replace(/\D/g, '');

  // 1. Ping TMDb Search API using Name and Year
  let searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}`;
  if (cleanYear) {
    searchUrl += `&year=${cleanYear}`;
  }

  let searchData = await fetchWithRetry(searchUrl);

  // Fallback: If 0 results with year, retry search without year
  if ((!searchData || !searchData.results || searchData.results.length === 0) && cleanYear) {
    const fallbackUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}`;
    searchData = await fetchWithRetry(fallbackUrl);
  }

  if (!searchData || !searchData.results || searchData.results.length === 0) {
    return { dropped: true, reason: 'Movie not found on TMDb' };
  }

  // Extract from the first search result
  const firstResult = searchData.results[0];
  const tmdb_id = firstResult.id;
  const poster_path = firstResult.poster_path;
  const original_language = firstResult.original_language;

  // Drop if poster or TMDb ID cannot be found
  if (!poster_path || !tmdb_id) {
    return { dropped: true, reason: 'Missing poster_path or tmdb_id' };
  }

  // 2. Ping TMDb External IDs endpoint using TMDb ID to fetch imdb_id
  const extUrl = `https://api.themoviedb.org/3/movie/${tmdb_id}/external_ids?api_key=${TMDB_API_KEY}`;
  const extData = await fetchWithRetry(extUrl);
  const imdb_id = extData && extData.imdb_id ? extData.imdb_id : null;

  // Drop if ID cannot be found
  if (!imdb_id) {
    return { dropped: true, reason: 'Missing imdb_id' };
  }

  return {
    dropped: false,
    data: {
      name,
      year,
      rating: parseFloat(rating),
      votes: parseInt(votes, 10),
      tmdb_id,
      imdb_id,
      poster_path,
      original_language
    }
  };
}

/**
 * Worker pool to process movies concurrently with rate limiting
 */
async function processAllMovies(movies) {
  const enriched = [];
  const dropped = [];
  const languageCounts = {};

  let index = 0;
  const total = movies.length;

  async function worker() {
    while (index < total) {
      const currentIndex = index++;
      const movie = movies[currentIndex];

      try {
        const result = await enrichMovie(movie);
        if (result.dropped) {
          dropped.push({ name: movie.name, year: movie.year, reason: result.reason });
        } else {
          enriched.push(result.data);
          const lang = result.data.original_language || 'unknown';
          languageCounts[lang] = (languageCounts[lang] || 0) + 1;
        }
      } catch (err) {
        dropped.push({ name: movie.name, year: movie.year, reason: err.message });
      }

      // Small delay between requests to be respectful of rate limits
      await new Promise((res) => setTimeout(res, REQUEST_DELAY_MS));

      // Progress reporting
      const processed = enriched.length + dropped.length;
      if (processed % 50 === 0 || processed === total) {
        process.stdout.write(`Progress: ${processed}/${total} processed (${enriched.length} enriched, ${dropped.length} dropped)...\r`);
      }
    }
  }

  console.log(`Starting enrichment for ${total} movies with concurrency=${CONCURRENCY_LIMIT}...`);
  const workers = Array.from({ length: CONCURRENCY_LIMIT }, () => worker());
  await Promise.all(workers);
  console.log('\nEnrichment complete!');

  return { enriched, dropped, languageCounts };
}

async function main() {
  if (!fs.existsSync(INPUT_CSV)) {
    console.error(`Input file not found at: ${INPUT_CSV}`);
    process.exit(1);
  }

  console.log(`Reading movies from: ${INPUT_CSV}`);
  const csvContent = fs.readFileSync(INPUT_CSV, 'utf8');
  const rows = parseCSV(csvContent);

  if (rows.length < 2) {
    console.error('CSV file has no data rows!');
    process.exit(1);
  }

  const header = rows[0].map((h) => h.toLowerCase());
  const nameIdx = header.indexOf('name');
  const yearIdx = header.indexOf('year');
  const ratingIdx = header.indexOf('rating');
  const votesIdx = header.indexOf('votes');

  if (nameIdx === -1 || yearIdx === -1 || ratingIdx === -1 || votesIdx === -1) {
    console.error('CSV does not have required columns: Name, Year, Rating, Votes');
    process.exit(1);
  }

  const movies = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 4) continue;
    movies.push({
      name: r[nameIdx],
      year: r[yearIdx],
      rating: r[ratingIdx],
      votes: r[votesIdx]
    });
  }

  console.log(`Found ${movies.length} movies to enrich.`);

  const startTime = Date.now();
  const { enriched, dropped, languageCounts } = await processAllMovies(movies);
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  // Write enriched CSV
  const csvHeader = ['Name', 'Year', 'Rating', 'Votes', 'tmdb_id', 'imdb_id', 'poster_path', 'original_language'];
  const csvLines = [csvHeader.join(',')];
  for (const m of enriched) {
    csvLines.push(
      [
        formatCSVField(m.name),
        formatCSVField(m.year),
        m.rating,
        m.votes,
        m.tmdb_id,
        formatCSVField(m.imdb_id),
        formatCSVField(m.poster_path),
        formatCSVField(m.original_language)
      ].join(',')
    );
  }
  fs.writeFileSync(OUTPUT_CSV, csvLines.join('\n'), 'utf8');

  // Write enriched JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(enriched, null, 2), 'utf8');

  console.log('\n========================================');
  console.log('           ENRICHMENT SUMMARY           ');
  console.log('========================================');
  console.log(`Total Movies Processed : ${movies.length}`);
  console.log(`Successfully Enriched  : ${enriched.length}`);
  console.log(`Dropped (Missing Data) : ${dropped.length}`);
  console.log(`Total Time Taken       : ${durationSec}s`);
  console.log('\nLanguage Distribution:');
  const sortedLangs = Object.entries(languageCounts).sort((a, b) => b[1] - a[1]);
  for (const [lang, count] of sortedLangs) {
    console.log(`  - ${lang.padEnd(6)}: ${count} movies`);
  }

  if (dropped.length > 0) {
    console.log(`\nSample Dropped Movies (first 5):`);
    dropped.slice(0, 5).forEach((d) => console.log(`  - ${d.name} (${d.year}): ${d.reason}`));
  }

  console.log(`\nOutput Files:`);
  console.log(`  - CSV  : ${OUTPUT_CSV}`);
  console.log(`  - JSON : ${OUTPUT_JSON}`);
}

main().catch((err) => {
  console.error('Fatal error during enrichment:', err);
  process.exit(1);
});
