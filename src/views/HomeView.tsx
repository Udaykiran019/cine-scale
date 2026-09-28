import React from 'react';
import { Language, Industry } from '../types/game';

interface HomeViewProps {
  onSelectIndustry: (lang: Language) => void;
}

const INDUSTRIES: Industry[] = [
  {
    id: 'hi',
    name: 'Bollywood',
    languageName: 'Hindi Cinema',
    tagline: 'The vibrant heart of Hindi blockbusters',
    accentColor: 'bg-rose-500 text-white',
    hoverColor: 'hover:bg-rose-600'
  },
  {
    id: 'te',
    name: 'Tollywood',
    languageName: 'Telugu Cinema',
    tagline: 'Epic spectacles, mass action & grandeur',
    accentColor: 'bg-amber-500 text-black',
    hoverColor: 'hover:bg-amber-600'
  },
  {
    id: 'ta',
    name: 'Kollywood',
    languageName: 'Tamil Cinema',
    tagline: 'Pioneering storytelling & intense cinema',
    accentColor: 'bg-blue-600 text-white',
    hoverColor: 'hover:bg-blue-700'
  },
  {
    id: 'ml',
    name: 'Mollywood',
    languageName: 'Malayalam Cinema',
    tagline: 'Realistic masterpieces & ground-breaking plots',
    accentColor: 'bg-emerald-600 text-white',
    hoverColor: 'hover:bg-emerald-700'
  }
];

export const HomeView: React.FC<HomeViewProps> = ({ onSelectIndustry }) => {
  return (
    <div className="min-h-screen w-full bg-[#1e1e24] text-white flex flex-col items-center justify-center px-4 py-12">
      {/* Navigation Header / Game Logo */}
      <header className="w-full max-w-2xl flex flex-col items-center justify-center mb-8 px-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
          <img
            src="/logo.svg"
            alt="Higher or Lower: Indian Cinema Edition"
            className="w-48 sm:w-64 md:w-80 drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)] hover:scale-105 transition-transform duration-200"
          />
        </div>
        <h1 className="text-lg md:text-xl font-black uppercase tracking-tight text-yellow-400 text-center flex flex-wrap justify-center items-center gap-1">
          Higher or Lower: Indian Cinema Edition
        </h1>
      </header>

      {/* Centered Heading */}
      <div className="text-center max-w-xl mb-10">
        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white mb-2">
          Choose a higher or lower game to play
        </h2>
        <p className="text-zinc-400 text-sm md:text-base font-medium">
          Select an Indian film industry to test your IMDb rating instincts.
        </p>
      </div>

      {/* Four Styled Buttons with Hard Drop Shadows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        {INDUSTRIES.map((industry) => (
          <button
            key={industry.id}
            onClick={() => onSelectIndustry(industry.id)}
            className="group relative flex flex-col items-start p-6 bg-white text-black rounded-xl border-3 border-black shadow-[6px_6px_0px_#000000] hover:shadow-[8px_8px_0px_#FACC15] hover:-translate-x-1 hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0px_#000000] transition-all duration-150 cursor-pointer text-left"
          >
            <div className="flex items-center justify-between w-full mb-3">
              <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border-2 border-black shadow-[2px_2px_0px_#000] ${industry.accentColor}`}>
                {industry.languageName}
              </span>
              <span className="text-xl font-black text-black group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-black mb-1">
              {industry.name}
            </h2>
            <p className="text-xs md:text-sm font-semibold text-zinc-600 line-clamp-2">
              {industry.tagline}
            </p>
          </button>
        ))}
      </div>

      {/* Footer Info */}
      <div className="mt-12 text-center text-xs text-zinc-500 font-mono tracking-wider">
        POWERED BY TMDB & IMDB DATA • BUILT FOR CINEPHILES
      </div>
    </div>
  );
};
