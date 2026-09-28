import React from 'react';
import { Language } from '../types/game';

interface GameOverViewProps {
  score: number;
  highScore: number;
  selectedLanguage: Language;
  onPlayAgain: () => void;
  onChangeIndustry: () => void;
}

const INDUSTRY_NAMES: Record<Language, string> = {
  hi: 'Bollywood',
  te: 'Tollywood',
  ta: 'Kollywood',
  ml: 'Mollywood'
};

export const GameOverView: React.FC<GameOverViewProps> = ({
  score,
  highScore,
  selectedLanguage,
  onPlayAgain,
  onChangeIndustry
}) => {
  const isNewHighScore = score > 0 && score >= highScore;
  const industryName = INDUSTRY_NAMES[selectedLanguage];

  return (
    <div className="min-h-screen w-full bg-[#18181b] text-white flex flex-col items-center justify-center px-4 py-12 select-none">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        {/* Game Logo & Title */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <img
            src="/logo.svg"
            alt="Clapperboard Icon"
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-lg shrink-0"
          />
          <span className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white text-center sm:text-left leading-tight">
            Higher or Lower: <span className="text-yellow-400 block sm:inline">Indian Cinema Edition</span>
          </span>
        </div>

        {/* Game Over Title Badge */}
        <div className="bg-rose-500 text-white font-black text-xs md:text-sm uppercase tracking-widest px-4 py-1.5 rounded-full border-2 border-black shadow-[3px_3px_0px_#000] mb-4">
          Game Over • {industryName}
        </div>

        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-white mb-6">
          You Scored: <span className="text-yellow-400">{score}</span>
        </h1>

        {/* Score Card Box */}
        <div className="bg-white text-black w-full p-6 rounded-2xl border-3 border-black shadow-[8px_8px_0px_#000000] mb-8">
          <div className="flex justify-around items-center divide-x-2 divide-zinc-200">
            <div className="flex flex-col items-center flex-1">
              <span className="text-xs uppercase font-extrabold text-zinc-500 tracking-wider">
                Final Score
              </span>
              <span className="text-4xl font-black text-black mt-1">
                {score}
              </span>
            </div>

            <div className="flex flex-col items-center flex-1">
              <span className="text-xs uppercase font-extrabold text-zinc-500 tracking-wider">
                Best Score
              </span>
              <span className="text-4xl font-black text-amber-500 mt-1">
                {highScore}
              </span>
            </div>
          </div>

          {isNewHighScore && (
            <div className="mt-4 pt-4 border-t-2 border-zinc-100 flex items-center justify-center gap-2 text-emerald-600 font-black text-sm uppercase tracking-wider">
              <span>★</span> New Personal Best! <span>★</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-4 w-full">
          <button
            onClick={onPlayAgain}
            className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-black text-xl font-black rounded-xl border-3 border-black shadow-[5px_5px_0px_#000000] hover:shadow-[7px_7px_0px_#000000] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_#000000] transition-all cursor-pointer uppercase tracking-wider"
          >
            Play Again
          </button>

          <button
            onClick={onChangeIndustry}
            className="w-full py-3.5 bg-white hover:bg-zinc-100 text-black text-sm font-extrabold rounded-xl border-2 border-black shadow-[4px_4px_0px_#000000] hover:shadow-[6px_6px_0px_#000000] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000000] transition-all cursor-pointer uppercase tracking-wider"
          >
            Choose Another Industry
          </button>
        </div>
      </div>
    </div>
  );
};
