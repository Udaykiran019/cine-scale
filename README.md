# CineScale 🎬

A 'Higher or Lower' IMDb rating game built for Indian cinema — covering Bollywood (Hindi), Tollywood (Telugu), Kollywood (Tamil), and Mollywood (Malayalam).

The core loop is simple: you're given two movies side-by-side, and you have to guess whether the second movie has a higher or lower IMDb rating than the first. Get it right, your streak increments and the next challenger rolls in. Get it wrong, game over.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React
- **Backend / Database**: Supabase (PostgreSQL)
- **Data & Ingestion**: Python (Pandas), Node.js (Axios, csv-parser), TMDb API

---

## What's Built So Far

### 1. Data Cleaning & TMDb Enrichment Pipeline
- **Raw filtering (`prepare_data.py`)**: Took a raw Indian cinema dataset (~15k entries), cleaned up missing ratings, stripped extraneous metadata (actors, directors, runtime), and filtered for movies with at least 5,000 votes to ensure recognizable titles.
- **TMDb API enrichment (`enrich_movies.js`, `enrich_south_movies.js`)**: Queried TMDb search endpoints to match movie titles and release years, pulled high-res poster paths, verified IMDb IDs, and tagged the original language (`hi`, `te`, `ta`, `ml`) to split titles cleanly into their respective industries.

### 2. Supabase Database & Seeding
- Created a `movies` table in Supabase indexed by `language`.
- Wrote a batch loader (`seed_movies.js`) to insert the cleaned and enriched dataset into Supabase with duplicate deduplication.
- Added a standalone fallback dataset (`moviesFallback.json`) in the client bundle so the game keeps working offline or if Supabase rate limits hit.

### 3. Split-Screen Game UI
- **Batch Hydration**: When an industry is picked, the app fetches a batch of 50 randomized movies in one request instead of querying every turn. Movies are shuffled via Fisher-Yates and fed sequentially.
- **Rolling Number Animation**: Used `requestAnimationFrame` for a smooth rolling counter effect when revealing Movie B's IMDb rating before transitioning to the next card.
- **State & Feedback**: Visual color flashes (emerald for correct, red/crimson for wrong), persistent streak/high score tracking in `localStorage`, and responsive layout for mobile and desktop screens.

---

## Project Structure

```text
cine-scale/
├── data/                    # Cleaned and enriched movie CSVs & JSON
├── public/                  # Static assets
├── resources/               # Brand & SVG assets
├── src/
│   ├── assets/              # Icons & vectors
│   ├── data/                # Offline fallback movie dataset
│   ├── services/            # Supabase client & movie service (fetch, shuffle, scoring)
│   ├── types/               # TypeScript interfaces & types
│   ├── views/               # Screen views (Home, Landing, Playing, GameOver)
│   ├── App.tsx              # Root component & game state machine
│   └── index.css            # Tailwind & custom keyframe styling
├── prepare_data.py          # Initial dataset filtering script (pandas)
├── enrich_movies.js         # TMDb poster and metadata enrichment script
├── enrich_south_movies.js   # Regional cinema enrichment script
├── seed_movies.js           # Supabase database seeder
├── vite.config.mts          # Vite build config
└── package.json
```

---

## Getting Started Locally

### 1. Clone the repo
```bash
git clone https://github.com/Udaykiran019/cine-scale.git
cd cine-scale
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env` file in the root directory (you can copy `.env.example`):
```bash
cp .env.example .env
```

Fill in your Supabase project credentials:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Optional (only needed if running TMDb enrichment scripts):
TMDB_API_KEY=your_tmdb_api_key
```

> **Note:** If you don't have a Supabase project set up yet, the frontend automatically falls back to the bundled local dataset (`src/data/moviesFallback.json`), so you can still run and play right away.

### 4. Start the dev server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Database Seeding & Pipeline Scripts (Optional)

If you want to re-run the data pipeline or seed your own Supabase instance:

```bash
# Filter raw dataset by vote count
python prepare_data.py

# Enrich with TMDb posters & IDs
npm run enrich

# Enrich South Indian cinema titles specifically
npm run enrich:south

# Seed records to Supabase
npm run seed
```

---

## Next Steps / Roadmap
- Add a mixed "All-India" mode where industries cross over.
- Daily challenge mode with fixed seeds.
- Multiplayer / 1v1 turn-based mode.
