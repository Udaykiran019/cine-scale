import React, { useState, useEffect } from 'react';
import { ViewState, Language, Movie } from './types/game';
import { fetchMoviePool, getHighScore, saveHighScore } from './services/movieService';
import { HomeView } from './views/HomeView';
import { LandingView } from './views/LandingView';
import { PlayingView } from './views/PlayingView';
import { GameOverView } from './views/GameOverView';

export const App: React.FC = () => {
  // Navigation & Core State
  const [viewState, setViewState] = useState<ViewState>('home');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('hi');
  const [highScore, setHighScore] = useState<number>(0);
  const [score, setScore] = useState<number>(0);

  // Movie Pool & Game State
  const [moviePool, setMoviePool] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [movieA, setMovieA] = useState<Movie | null>(null);
  const [movieB, setMovieB] = useState<Movie | null>(null);

  // Animation & Feedback State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [revealedRatingB, setRevealedRatingB] = useState<number | null>(null);
  const [lastGuessCorrect, setLastGuessCorrect] = useState<boolean | null>(null);

  // Sync high score on initial load and language change
  useEffect(() => {
    const saved = getHighScore(selectedLanguage);
    setHighScore(saved);
  }, [selectedLanguage]);

  // Handle Industry Selection from Home View
  const handleSelectIndustry = (lang: Language) => {
    setSelectedLanguage(lang);
    setViewState('landing');
  };

  // Start Playing: Fetch 50-movie batch and draw Movie A and Movie B
  const handleStartPlaying = async () => {
    setIsLoading(true);
    try {
      const pool = await fetchMoviePool(selectedLanguage);
      if (pool.length < 2) {
        alert('Not enough movies available for this language. Please try another industry.');
        setIsLoading(false);
        return;
      }

      setMoviePool(pool);
      setMovieA(pool[0]);
      setMovieB(pool[1]);
      setCurrentIndex(2); // Next movie to draw will be index 2
      setScore(0);
      setRevealedRatingB(null);
      setLastGuessCorrect(null);
      setIsEvaluating(false);
      setViewState('playing');
    } catch (err) {
      console.error('Failed to load movie pool:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Higher / Lower Guess
  const handleGuess = (isHigher: boolean) => {
    if (!movieA || !movieB || isEvaluating) return;

    setIsEvaluating(true);
    setRevealedRatingB(movieB.imdb_rating);

    const isCorrect = isHigher
      ? movieB.imdb_rating >= movieA.imdb_rating
      : movieB.imdb_rating <= movieA.imdb_rating;

    setLastGuessCorrect(isCorrect);

    if (isCorrect) {
      const nextScore = score + 1;
      setScore(nextScore);

      if (nextScore > highScore) {
        setHighScore(nextScore);
        saveHighScore(nextScore, selectedLanguage);
      }

      // Transition after brief reveal
      setTimeout(() => {
        // Slide Movie B into Movie A position
        setMovieA(movieB);

        // Draw next movie from existing local 50-movie pool without refetching
        let nextIdx = currentIndex;
        if (nextIdx >= moviePool.length) {
          nextIdx = 0; // Wrap around if pool exhausted
        }

        setMovieB(moviePool[nextIdx]);
        setCurrentIndex(nextIdx + 1);
        setRevealedRatingB(null);
        setLastGuessCorrect(null);
        setIsEvaluating(false);
      }, 1200);
    } else {
      // Wrong guess -> transition to gameover
      setTimeout(() => {
        saveHighScore(score, selectedLanguage);
        setIsEvaluating(false);
        setViewState('gameover');
      }, 1200);
    }
  };

  // Navigation callbacks
  const handleBackToHome = () => {
    setViewState('home');
  };

  const handlePlayAgain = () => {
    handleStartPlaying();
  };

  return (
    <div className="min-h-screen w-full font-sans">
      {viewState === 'home' && (
        <HomeView onSelectIndustry={handleSelectIndustry} />
      )}

      {viewState === 'landing' && (
        <LandingView
          selectedLanguage={selectedLanguage}
          highScore={highScore}
          isLoading={isLoading}
          onPlay={handleStartPlaying}
          onBackToHome={handleBackToHome}
        />
      )}

      {viewState === 'playing' && movieA && movieB && (
        <PlayingView
          movieA={movieA}
          movieB={movieB}
          score={score}
          highScore={highScore}
          onGuess={handleGuess}
          onBackToHome={handleBackToHome}
          isEvaluating={isEvaluating}
          revealedRatingB={revealedRatingB}
          lastGuessCorrect={lastGuessCorrect}
        />
      )}

      {viewState === 'gameover' && (
        <GameOverView
          score={score}
          highScore={highScore}
          selectedLanguage={selectedLanguage}
          onPlayAgain={handlePlayAgain}
          onChangeIndustry={handleBackToHome}
        />
      )}
    </div>
  );
};
