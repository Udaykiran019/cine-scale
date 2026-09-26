import React from 'react';
import { Language } from '../types/game';

interface LandingViewProps {
  selectedLanguage: Language;
  highScore: number;
  isLoading: boolean;
  onPlay: () => void;
  onBackToHome: () => void;
}

const INDUSTRY_NAMES: Record<Language, { name: string; lang: string }> = {
  hi: { name: 'Bollywood', lang: 'Hindi' },
  te: { name: 'Tollywood', lang: 'Telugu' },
  ta: { name: 'Kollywood', lang: 'Tamil' },
  ml: { name: 'Mollywood', lang: 'Malayalam' }
};

export const LandingView: React.FC<LandingViewProps> = ({
  selectedLanguage,
  highScore,
  isLoading,
  onPlay,
  onBackToHome
}) => {
  const currentIndustry = INDUSTRY_NAMES[selectedLanguage];

  return (
    <div className="min-h-screen w-full bg-[#FACC15] text-black flex flex-col items-center justify-between px-6 py-10 relative overflow-hidden select-none">
      {/* Top Header / Back link */}
      <header className="w-full max-w-4xl flex items-center justify-between z-10">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 bg-white text-black font-extrabold text-xs md:text-sm px-4 py-2 rounded-lg border-2 border-black shadow-[3px_3px_0px_#000000] hover:shadow-[5px_5px_0px_#000000] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000000] transition-all cursor-pointer"
        >
          <span>←</span> Back to Industries
        </button>

        <div className="flex items-center gap-3">
          <span className="bg-black text-white font-black text-xs md:text-sm px-4 py-2 rounded-lg shadow-[3px_3px_0px_rgba(0,0,0,0.25)] uppercase tracking-wider">
            {currentIndustry.name} ({currentIndustry.lang})
          </span>
          {highScore > 0 && (
            <span className="bg-white text-black font-black text-xs md:text-sm px-4 py-2 rounded-lg border-2 border-black shadow-[3px_3px_0px_#000000]">
              Best: {highScore}
            </span>
          )}
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="w-full max-w-2xl flex flex-col items-center text-center my-auto py-8 z-10">
        {/* Game Logo Centered */}
        <div className="w-full max-w-md mb-8 flex justify-center">
          <img
            src="/logo.svg"
            alt="Cine-Scale Logo"
            className="w-80 md:w-96 drop-shadow-[0_12px_24px_rgba(0,0,0,0.2)] hover:scale-105 transition-transform duration-200"
          />
        </div>

        {/* Bold Text */}
        <h1 className="text-3xl md:text-5xl font-black text-black tracking-tight leading-tight mb-4 uppercase">
          Guess which movie has a higher rating on IMDb
        </h1>

        {/* Subtext */}
        <p className="text-base md:text-xl font-bold text-black/80 max-w-lg mb-10">
          A game of higher or lower using IMDb movie rating stats.
        </p>

        {/* White 'Play!' button with offset black drop shadow */}
        <button
          onClick={onPlay}
          disabled={isLoading}
          className="group relative inline-flex items-center justify-center gap-3 bg-white text-black text-2xl md:text-3xl font-black px-12 py-5 rounded-2xl border-3 border-black shadow-[6px_6px_0px_#000000] hover:shadow-[10px_10px_0px_#000000] hover:-translate-x-1 hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0px_#000000] transition-all duration-150 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center gap-3">
              <svg className="animate-spin h-6 w-6 text-black" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading Movies...
            </span>
          ) : (
            <>
              <span>Play!</span>
              <span className="text-2xl group-hover:translate-x-1.5 transition-transform">▶</span>
            </>
          )}
        </button>
      </main>

      {/* Subtle Bottom watermark */}
      <footer className="text-black/60 text-xs font-bold font-mono tracking-widest uppercase z-10">
        IMDb Rating Comparison • Cine-Scale 2026
      </footer>

      {/* Decorative background grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: 'radial-gradient(#000 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px'
        }}
      />
    </div>
  );
};
