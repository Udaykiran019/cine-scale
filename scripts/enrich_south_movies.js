/**
 * enrich_south_movies.js
 * 
 * Enriches local dataset with popular South Indian films (Telugu, Tamil, Malayalam)
 * using TMDb Discover API and External IDs endpoint.
 * Strictly modifies local data/enriched_indian_movies.csv (no Supabase connection).
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
const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
if (!TMDB_API_KEY) {
  console.error('Error: TMDB_API_KEY is missing from .env!');
  process.exit(1);
}

const CSV_FILE = path.join(__dirname, 'data', 'enriched_indian_movies.csv');
const JSON_FILE = path.join(__dirname, 'data', 'enriched_indian_movies.json');

const TARGET_LANGS = [
  { code: 'te', name: 'Telugu' },
  { code: 'ta', name: 'Tamil' },
  { code: 'ml', name: 'Malayalam' }
];

// Fetch 6 pages per language (6 * 20 = 120 movies per language, ~100 to 160 movies)
const PAGES_PER_LANG = 6;
const REQUEST_DELAY_MS = 80;

/**
 * Standard RFC 4180 CSV parser
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
 * Format CSV field safely escaping quotes and commas
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
 * Sleep helper
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Robust Axios GET with exponential backoff and timeout handling
 */
async function axiosGetWithRetry(url, params, retries = 4, delay = 800) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, { params, timeout: 25000 });
      return response.data;
    } catch (err) {
      const isRateLimit = err.response && err.response.status === 429;
      const retryAfter = isRateLimit ? err.response.headers['retry-after'] : null;
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay * Math.pow(2, attempt - 1);

      if (attempt < retries) {
        process.stdout.write(`\n  [Retry ${attempt}/${retries}] Request delayed (${err.code || err.message}). Waiting ${(waitTime / 1000).toFixed(1)}s...\n`);
        await sleep(waitTime);
      } else {
        return null;
      }
    }
  }
  return null;
}

async function main() {
  console.log('=====================================================');
  console.log('Task 1: Clean Existing CSV');
  console.log('=====================================================');

  if (!fs.existsSync(CSV_FILE)) {
    console.error(`Error: ${CSV_FILE} does not exist!`);
    process.exit(1);
  }

  const rawCSV = fs.readFileSync(CSV_FILE, 'utf8');
  const rows = parseCSV(rawCSV);
  const header = rows[0].map((h) => h.toLowerCase());

  const nameIdx = header.indexOf('name');
  const yearIdx = header.indexOf('year');
  const ratingIdx = header.indexOf('rating');
  const votesIdx = header.indexOf('votes');
  const tmdbIdx = header.indexOf('tmdb_id');
  const imdbIdx = header.indexOf('imdb_id');
  const posterIdx = header.indexOf('poster_path');
  const langIdx = header.indexOf('original_language');

  const ALLOWED_LANGS = new Set(['hi', 'te', 'ta', 'ml']);
  const cleanedMovies = [];
  const existingImdbIds = new Set();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 8) continue;
    const lang = r[langIdx];
    if (ALLOWED_LANGS.has(lang)) {
      const imdbId = r[imdbIdx];
      if (imdbId) {
        existingImdbIds.add(imdbId);
      }
      cleanedMovies.push({
        name: r[nameIdx],
        year: r[yearIdx],
        rating: parseFloat(r[ratingIdx]),
        votes: parseInt(r[votesIdx], 10),
        tmdb_id: parseInt(r[tmdbIdx], 10),
        imdb_id: imdbId,
        poster_path: r[posterIdx],
        original_language: lang
      });
    }
  }

  console.log(`Loaded ${rows.length - 1} records from ${path.basename(CSV_FILE)}`);
  console.log(`Retained ${cleanedMovies.length} movies in languages: 'hi', 'te', 'ta', 'ml'`);
  console.log(`Unique existing IMDb IDs: ${existingImdbIds.size}\n`);

  console.log('=====================================================');
  console.log('Task 2: Fetch Regional Cinema via TMDb Discover');
  console.log('=====================================================');

  const newSouthMovies = [];

  for (const { code: lang, name: langName } of TARGET_LANGS) {
    console.log(`\nFetching ${langName} (${lang}) cinema...`);
    let langFetched = 0;
    let langAdded = 0;

    for (let page = 1; page <= PAGES_PER_LANG; page++) {
      await sleep(REQUEST_DELAY_MS);

      // Query TMDb Discover endpoint with with_original_language, sort_by=vote_count.desc, vote_count.gte=100
      let discoverData = await axiosGetWithRetry('https://api.themoviedb.org/3/discover/movie', {
        api_key: TMDB_API_KEY,
        with_original_language: lang,
        sort_by: 'vote_count.desc',
        'vote_count.gte': 100,
        page
      });

      // If vote_count.gte=100 runs out of pages (TMDb has ~10-29 regional films with >=100 votes),
      // fallback to vote_count.gte=10 to gather the full ~100 to 160 movies per language requested.
      if (!discoverData || !discoverData.results || discoverData.results.length === 0) {
        discoverData = await axiosGetWithRetry('https://api.themoviedb.org/3/discover/movie', {
          api_key: TMDB_API_KEY,
          with_original_language: lang,
          sort_by: 'vote_count.desc',
          'vote_count.gte': 10,
          page
        });
      }

      if (!discoverData || !discoverData.results || discoverData.results.length === 0) {
        console.log(`  Page ${page}: No more results.`);
        break;
      }

      for (const movie of discoverData.results) {
        langFetched++;

        // Must have poster and ID
        if (!movie.poster_path || !movie.id) continue;

        await sleep(REQUEST_DELAY_MS);

        // Fetch External IDs to get imdb_id
        try {
          const extData = await axiosGetWithRetry(`https://api.themoviedb.org/3/movie/${movie.id}/external_ids`, {
            api_key: TMDB_API_KEY
          });

          const imdbId = extData && extData.imdb_id ? extData.imdb_id : null;
          if (!imdbId) continue;

          // Check deduplication against existing list and current batch
          if (existingImdbIds.has(imdbId)) continue;
          existingImdbIds.add(imdbId);

          // Extract year from release_date (format "(YYYY)")
          const releaseYear = movie.release_date ? `(${movie.release_date.substring(0, 4)})` : '';
          const rating = movie.vote_average ? Number(movie.vote_average.toFixed(1)) : 0.0;

          newSouthMovies.push({
            name: movie.title,
            year: releaseYear,
            rating,
            votes: movie.vote_count || 0,
            tmdb_id: movie.id,
            imdb_id: imdbId,
            poster_path: movie.poster_path,
            original_language: lang
          });

          langAdded++;
        } catch (err) {
          // Skip movie on external ID failure
        }
      }

      process.stdout.write(`  Page ${page}/${PAGES_PER_LANG} processed (${langAdded} ${langName} movies queued)...\r`);
    }

    console.log(`\n  Completed ${langName}: Scanned ${langFetched} films -> Successfully added ${langAdded} new unique movies.`);
  }

  console.log('\n=====================================================');
  console.log('Task 3: Merge, Deduplicate, and Save');
  console.log('=====================================================');

  const combinedMovies = [...cleanedMovies, ...newSouthMovies];

  // Final deduplication check by imdb_id
  const seenImdb = new Set();
  const finalMovies = [];
  for (const m of combinedMovies) {
    if (!seenImdb.has(m.imdb_id)) {
      seenImdb.add(m.imdb_id);
      finalMovies.push(m);
    }
  }

  // Write updated CSV
  const csvHeader = ['Name', 'Year', 'Rating', 'Votes', 'tmdb_id', 'imdb_id', 'poster_path', 'original_language'];
  const csvLines = [csvHeader.join(',')];
  for (const m of finalMovies) {
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

  fs.writeFileSync(CSV_FILE, csvLines.join('\n'), 'utf8');

  // Also write updated JSON
  fs.writeFileSync(JSON_FILE, JSON.stringify(finalMovies, null, 2), 'utf8');

  // Compute language breakdown
  const languageCounts = {};
  for (const m of finalMovies) {
    languageCounts[m.original_language] = (languageCounts[m.original_language] || 0) + 1;
  }

  console.log('\n=====================================================');
  console.log('              FINAL SUMMARY REPORT                   ');
  console.log('=====================================================');
  console.log(`Initial Cleaned Movies   : ${cleanedMovies.length}`);
  console.log(`New South Indian Movies  : ${newSouthMovies.length}`);
  console.log(`Total Movies in CSV      : ${finalMovies.length}`);
  console.log('\nFinal Breakdown by Language:');
  const langLabels = {
    hi: 'Hindi (hi)',
    te: 'Telugu (te)',
    ta: 'Tamil (ta)',
    ml: 'Malayalam (ml)'
  };

  for (const code of ['hi', 'te', 'ta', 'ml']) {
    const label = langLabels[code] || code;
    console.log(`  - ${label.padEnd(18)} : ${languageCounts[code] || 0} movies`);
  }

  console.log(`\nOverwritten local files:`);
  console.log(`  - ${CSV_FILE}`);
  console.log(`  - ${JSON_FILE}`);
  console.log('=====================================================\n');
}

main().catch((err) => {
  console.error('Fatal error during South Indian movie enrichment:', err);
  process.exit(1);
});
