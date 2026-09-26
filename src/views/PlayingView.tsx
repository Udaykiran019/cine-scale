import React, { useState, useEffect } from 'react';
import { Movie } from '../types/game';

interface PlayingViewProps {
  movieA: Movie;
  movieB: Movie;
  score: number;
  highScore: number;
  onGuess: (isHigher: boolean) => void;
  onBackToHome: () => void;
  isEvaluating?: boolean;
  revealedRatingB?: number | null;
  lastGuessCorrect?: boolean | null;
}

export const PlayingView: React.FC<PlayingViewProps> = ({
  movieA,
  movieB,
  score,
  highScore,
  onGuess,
  onBackToHome,
  isEvaluating = false,
  revealedRatingB = null,
  lastGuessCorrect = null
}) => {
  const [selectedGuess, setSelectedGuess] = useState<'higher' | 'lower' | null>(null);
  const [rollingRating, setRollingRating] = useState<number>(0);
  const [isRollFinished, setIsRollFinished] = useState<boolean>(false);

  // TMDb Image URL generator with fallback
  const getPosterUrl = (posterPath: string | null) => {
    if (!posterPath) {
      return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1280&q=80';
    }
    return `https://image.tmdb.org/t/p/w1280${posterPath}`;
  };

  // Reset local state when movies change
  useEffect(() => {
    if (!isEvaluating) {
      setSelectedGuess(null);
      setRollingRating(0);
      setIsRollFinished(false);
    }
  }, [movieA, movieB, isEvaluating]);

  // Rolling counter animation: runs smoothly when revealedRatingB is provided
  // Live reference timing: duration is 800ms within the 1200ms evaluation window
  useEffect(() => {
    if (revealedRatingB === null || !isEvaluating) {
      setRollingRating(0);
      setIsRollFinished(false);
      return;
    }

    const duration = 750; // Rolling duration in ms
    const startTime = performance.now();
    let animationFrameId: number;

    const animateRoll = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Interpolate from 0.0 to target rating
      const current = progress * revealedRatingB;
      setRollingRating(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animateRoll);
      } else {
        setRollingRating(revealedRatingB);
        setIsRollFinished(true);
      }
    };

    animationFrameId = requestAnimationFrame(animateRoll);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [revealedRatingB, isEvaluating]);

  const handleButtonClick = (isHigher: boolean) => {
    if (isEvaluating) return;
    setSelectedGuess(isHigher ? 'higher' : 'lower');
    onGuess(isHigher);
  };

  // Determine active border state on Right Pane (Movie B)
  const getBorderClass = () => {
    if (!isEvaluating || selectedGuess === null) return 'border-transparent';
    if (!isRollFinished) {
      // While number is rolling: 10px solid white border
      return 'border-white';
    }
    // After roll finishes: live reference colors (#00d85a for correct, #f14242 for wrong)
    return lastGuessCorrect ? 'border-[#00d85a]' : 'border-[#f14242]';
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white flex flex-col md:flex-row select-none font-geologica">
      {/* Top Left: Exit & High Score Counter */}
      <div className="absolute top-3 left-3 md:top-4 md:left-4 z-40 flex items-center gap-2 md:gap-3">
        <button
          onClick={onBackToHome}
          className="bg-black/80 hover:bg-black text-white font-bold text-xs px-3 py-1.5 rounded border border-white/30 backdrop-blur-md shadow-[2px_2px_0px_#000000] transition cursor-pointer"
          title="Exit to Main Menu"
        >
          ✕ Menu
        </button>
        <div className="game-score game-score--highscore is-active text-white text-sm md:text-base font-semibold drop-shadow-[0_0_2px_#000]">
          High score: <span className="font-bold text-yellow-400">{highScore}</span>
        </div>
      </div>

      {/* Top Right: Current Score */}
      <div className="absolute top-3 right-3 md:top-4 md:right-4 z-40">
        <div className="game-score game-score--current-score is-active text-white text-sm md:text-base font-semibold drop-shadow-[0_0_2px_#000]">
          Score: <span className="font-bold text-yellow-400">{score}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 50/50 Split Screen: Left Half (Movie A)                                   */}
      {/* ========================================================================= */}
      <div className="relative w-full md:w-1/2 h-1/2 md:h-full flex flex-col items-center justify-center p-4 md:px-[72px] md:py-4 lg:px-[88px] overflow-hidden">
        {/* Background Poster Image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 filter brightness-95"
          style={{ backgroundImage: `url("${getPosterUrl(movieA.poster_path)}")` }}
        />

        {/* Darkening Overlay (opacity 0.4 matching live reference .playfield-pane:after) */}
        <div className="absolute inset-0 bg-black opacity-45 pointer-events-none" />

        {/* Content Container (Layer 2, centered) */}
        <div className="relative z-20 flex flex-col items-center text-center max-w-lg w-full">
          {/* Movie Title Heading (playfield-pane__heading) */}
          <h2
            className={`bg-white text-black font-bold px-4 py-2 md:px-5 md:py-2.5 shadow-[6px_6px_0px_#000000] text-xl md:text-[30px] lg:text-[32px] leading-tight tracking-tight uppercase line-clamp-2 transition-transform duration-400 ${
              isEvaluating ? '-translate-y-3 md:-translate-y-5' : ''
            }`}
          >
            "{movieA.title}"
          </h2>

          {/* Subheading / Year (playfield-pane__sub-heading) */}
          {movieA.year && (
            <h4
              className={`bg-black text-white font-semibold px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-base tracking-[1px] mt-2 text-center transition-transform duration-400 ${
                isEvaluating ? '-translate-y-3 md:-translate-y-5' : ''
              }`}
            >
              {String(movieA.year).startsWith('(') ? movieA.year : `(${movieA.year})`}
            </h4>
          )}

          <p className="text-xs md:text-sm uppercase font-bold tracking-widest text-zinc-300 mt-4 mb-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            has an IMDb rating of
          </p>

          {/* Rating Counter Display (playfield-pane__counter) */}
          <div className="relative px-5 py-2 md:px-7 md:py-3.5 bg-black text-white text-3xl md:text-[44px] lg:text-[48px] font-black tracking-[6px] md:tracking-[8px] shadow-[6px_6px_0px_#000000] border-2 border-black inline-flex items-center justify-center overflow-hidden">
            {/* Subtle top/bottom gradient overlay for rolling odometer vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/70 pointer-events-none" />
            <span className="relative z-10">{movieA.imdb_rating.toFixed(1)}</span>
          </div>
        </div>

        {/* Bottom Left Image Credit */}
        <div className="absolute bottom-2 left-4 md:bottom-3 md:left-4 z-20 text-[11px] text-white/50 underline pointer-events-none">
          Image: TMDb
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Center Circular Badge ("or" / Correct Tick / Wrong Cross)                 */}
      {/* ========================================================================= */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[60px] h-[60px] md:w-[116px] md:h-[116px] rounded-full flex items-center justify-center font-black transition-all duration-400 shadow-[0_4px_25px_rgba(0,0,0,0.8)] pointer-events-none ${
          !isEvaluating || !isRollFinished
            ? 'bg-white text-black text-2xl md:text-[46px]'
            : lastGuessCorrect
            ? 'bg-[#00d85a] text-white'
            : 'bg-[#f14242] text-white'
        }`}
      >
        {!isEvaluating || !isRollFinished ? (
          <span className="playfield-badge__text lowercase">or</span>
        ) : lastGuessCorrect ? (
          /* Live Reference SVG Tick */
          <svg
            role="img"
            aria-label="Correct"
            className="w-7 h-7 md:w-14 md:h-14 fill-white animate-scale-up-bounce"
            viewBox="0 0 58.5 45"
          >
            <path d="M.675 24.75a2.175 2.175 0 0 1 0-3.15l3.15-3.15a2.175 2.175 0 0 1 3.15 0l.225.225L19.575 31.95a1.088 1.088 0 0 0 1.575 0L51.3.675h.225a2.175 2.175 0 0 1 3.15 0l3.15 3.15a2.175 2.175 0 0 1 0 3.15l-36 37.35a2.175 2.175 0 0 1-3.15 0l-17.55-18.9z" />
          </svg>
        ) : (
          /* Live Reference SVG Cross */
          <svg
            role="img"
            aria-label="Wrong"
            className="w-6 h-6 md:w-11 md:h-11 fill-white animate-scale-up-bounce"
            viewBox="0 0 44 44"
          >
            <path d="M3.415 43.436L.788 40.81a1.813 1.813 0 0 1 0-2.626c6.5-6.745 11.7-12.047 15.861-16.211a340.823 340.823 0 0 1-3.183-3.306L.566 6.228v-.187a1.813 1.813 0 0 1 0-2.626L3.193.787a1.815 1.815 0 0 1 2.626 0c6.746 6.5 12.049 11.7 16.212 15.861 1.232-1.2 2.329-2.257 3.305-3.183L37.775.565h.187a1.813 1.813 0 0 1 2.626 0l2.628 2.626a1.816 1.816 0 0 1 0 2.626c-6.5 6.746-11.7 12.048-15.861 16.212a341.07 341.07 0 0 1 3.184 3.307l12.9 12.437v.187a1.854 1.854 0 0 1 .564 1.314 1.85 1.85 0 0 1-.564 1.313l-2.626 2.627a1.813 1.813 0 0 1-2.626 0c-6.745-6.5-12.047-11.7-16.21-15.86-1.232 1.2-2.33 2.258-3.308 3.184l-12.437 12.9h-.187a1.851 1.851 0 0 1-1.314.564 1.847 1.847 0 0 1-1.316-.566z" />
          </svg>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 50/50 Split Screen: Right Half (Movie B)                                  */}
      {/* ========================================================================= */}
      <div className="relative w-full md:w-1/2 h-1/2 md:h-full flex flex-col items-center justify-center p-4 md:px-[72px] md:py-4 lg:px-[88px] overflow-hidden">
        {/* Background Poster Image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 filter brightness-95"
          style={{ backgroundImage: `url("${getPosterUrl(movieB.poster_path)}")` }}
        />

        {/* Darkening Overlay (opacity 0.4 matching live reference) */}
        <div className="absolute inset-0 bg-black opacity-45 pointer-events-none" />

        {/* Selection / Feedback 10px Border (.playfield-pane.is-selected / is-correct / is-wrong) */}
        <div
          className={`absolute inset-0 pointer-events-none z-10 transition-colors duration-400 border-[10px] ${getBorderClass()}`}
        />

        {/* Content Container (Layer 2, centered) */}
        <div className="relative z-20 flex flex-col items-center text-center max-w-lg w-full">
          {/* Movie Title Heading (playfield-pane__heading) */}
          <h2
            className={`bg-white text-black font-bold px-4 py-2 md:px-5 md:py-2.5 shadow-[6px_6px_0px_#000000] text-xl md:text-[30px] lg:text-[32px] leading-tight tracking-tight uppercase line-clamp-2 transition-transform duration-400 ${
              isEvaluating ? '-translate-y-3 md:-translate-y-5' : ''
            }`}
          >
            "{movieB.title}"
          </h2>

          {/* Subheading / Year (playfield-pane__sub-heading) */}
          {movieB.year && (
            <h4
              className={`bg-black text-white font-semibold px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-base tracking-[1px] mt-2 text-center transition-transform duration-400 ${
                isEvaluating ? '-translate-y-3 md:-translate-y-5' : ''
              }`}
            >
              {String(movieB.year).startsWith('(') ? movieB.year : `(${movieB.year})`}
            </h4>
          )}

          <p className="text-xs md:text-sm uppercase font-bold tracking-widest text-zinc-300 mt-4 mb-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            has an IMDb rating
          </p>

          {/* If Rating is Revealed (Evaluation Phase: Rolling Odometer Counter) */}
          {isEvaluating && revealedRatingB !== null ? (
            <div className="flex flex-col items-center animate-slide-up mt-2">
              <div
                className={`relative px-5 py-2 md:px-7 md:py-3.5 bg-black text-3xl md:text-[44px] lg:text-[48px] font-black tracking-[6px] md:tracking-[8px] shadow-[6px_6px_0px_#000000] border-2 border-black inline-flex items-center justify-center overflow-hidden transition-colors duration-300 ${
                  !isRollFinished
                    ? 'text-white'
                    : lastGuessCorrect
                    ? 'text-[#00d85a]'
                    : 'text-[#f14242]'
                }`}
              >
                {/* Odometer Vignette Gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/70 pointer-events-none" />
                <span className="relative z-10">{rollingRating.toFixed(1)}</span>
              </div>

              {/* Status Outcome Badge */}
              {isRollFinished && (
                <span
                  className={`text-xs md:text-sm font-black uppercase tracking-wider mt-3 px-3 py-1 rounded shadow-md animate-scale-up-bounce ${
                    lastGuessCorrect ? 'bg-[#00d85a] text-black' : 'bg-[#f14242] text-white'
                  }`}
                >
                  {lastGuessCorrect ? '✓ Correct' : '✗ Wrong'}
                </span>
              )}
            </div>
          ) : (
            /* Higher or Lower Neo-Brutalist Selection Buttons */
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full justify-center mt-2 max-w-xs sm:max-w-md">
              <button
                onClick={() => handleButtonClick(true)}
                disabled={isEvaluating}
                className="group relative flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-[#161616] text-base md:text-lg font-black px-6 py-3 rounded-lg border-2 border-black shadow-[5px_5px_0px_#000000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase"
              >
                <span>Higher</span>
                <span className="text-emerald-600 text-lg group-hover:-translate-y-0.5 transition-transform">
                  ▲
                </span>
              </button>

              <button
                onClick={() => handleButtonClick(false)}
                disabled={isEvaluating}
                className="group relative flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-[#161616] text-base md:text-lg font-black px-6 py-3 rounded-lg border-2 border-black shadow-[5px_5px_0px_#000000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase"
              >
                <span>Lower</span>
                <span className="text-rose-600 text-lg group-hover:translate-y-0.5 transition-transform">
                  ▼
                </span>
              </button>
            </div>
          )}

          <p className="text-[11px] md:text-xs font-semibold text-zinc-300 mt-4 tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            compared to "{movieA.title}"
          </p>
        </div>

        {/* Bottom Right Image Credit */}
        <div className="absolute bottom-2 right-4 md:bottom-3 md:right-4 z-20 text-[11px] text-white/50 underline pointer-events-none">
          Image: TMDb
        </div>
      </div>
    </div>
  );
};
