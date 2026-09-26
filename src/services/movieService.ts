import { supabase } from './supabase';
import { Language, Movie } from '../types/game';
import fallbackMovies from '../data/moviesFallback.json';

// Fisher-Yates array shuffle helper
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Fetches a randomized batch of 50 movies matching selectedLanguage.
 * Queries Supabase first; if table is empty or offline, falls back to local curated dataset.
 */
export async function fetchMoviePool(language: Language): Promise<Movie[]> {
  try {
    const { data, error } = await supabase
      .from('movies')
      .select('title, year, imdb_rating, poster_path, language')
      .eq('language', language);

    if (!error && data && data.length > 0) {
      console.log(`[Supabase] Loaded ${data.length} movies for language '${language}'.`);
      const shuffled = shuffleArray(data as Movie[]);
      return shuffled.slice(0, 50);
    }

    if (error) {
      console.warn('[Supabase] Query error, using local fallback:', error.message);
    }
  } catch (err) {
    console.warn('[Supabase] Connection failed, using local fallback:', err);
  }

  // Graceful Fallback from local dataset
  const filteredFallback = (fallbackMovies as Movie[]).filter(
    (m) => m.language === language
  );
  console.log(`[Fallback] Loaded ${filteredFallback.length} local movies for language '${language}'.`);
  const shuffledFallback = shuffleArray(filteredFallback);
  return shuffledFallback.slice(0, 50);
}

/**
 * Reads high score for language from localStorage
 */
export function getHighScore(language?: Language): number {
  try {
    const key = language ? `cine_scale_highscore_${language}` : 'cine_scale_highscore';
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Persists high score to localStorage
 */
export function saveHighScore(score: number, language?: Language): void {
  try {
    const key = language ? `cine_scale_highscore_${language}` : 'cine_scale_highscore';
    const current = getHighScore(language);
    if (score > current) {
      localStorage.setItem(key, score.toString());
      // Also update overall high score
      const globalCurrent = getHighScore();
      if (score > globalCurrent) {
        localStorage.setItem('cine_scale_highscore', score.toString());
      }
    }
  } catch (err) {
    console.error('Failed to save high score:', err);
  }
}
