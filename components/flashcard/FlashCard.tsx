'use client';

import { useState } from 'react';

interface FlashCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  isFlipped?: boolean;
  onFlip?: () => void;
  colorTheme?: {
    gradient: string;
    bgLight: string;
    textColor: string;
  };
}

const defaultTheme = {
  gradient: 'from-blue-400 via-indigo-400 to-blue-500',
  bgLight: 'bg-blue-50',
  textColor: 'text-blue-600',
};

export default function FlashCard({
  front,
  back,
  isFlipped = false,
  onFlip,
  colorTheme = defaultTheme,
}: FlashCardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false);

  const flipped = onFlip ? isFlipped : internalFlipped;

  const handleClick = () => {
    if (onFlip) {
      onFlip();
    } else {
      setInternalFlipped(!internalFlipped);
    }
  };

  return (
    <div
      className="w-full aspect-[3/4] max-w-sm mx-auto cursor-pointer perspective-1000"
      onClick={handleClick}
      style={{ perspective: '1000px' }}
    >
      <div
        className="relative w-full h-full transition-transform duration-500 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front Side */}
        <div
          className="absolute inset-0 w-full h-full rounded-3xl shadow-xl overflow-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${colorTheme.gradient}`} />
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />

          {/* Decorative elements */}
          <div className="absolute top-4 right-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
          <div className="absolute bottom-8 left-4 w-12 h-12 bg-white/10 rounded-full blur-lg" />
          <div className="absolute top-1/4 left-8 text-white/20 text-2xl">✦</div>

          <div className="relative h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="absolute top-4 left-4 px-3 py-1 bg-white/20 rounded-full">
              <span className="text-white/80 text-xs font-medium">질문</span>
            </div>

            <div className="text-white text-xl sm:text-2xl font-bold leading-relaxed">
              {front}
            </div>

            <div className="absolute bottom-6 flex items-center gap-2 text-white/60 text-sm">
              <span>탭하여 정답 보기</span>
              <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </div>

        {/* Back Side */}
        <div
          className="absolute inset-0 w-full h-full rounded-3xl shadow-xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="absolute inset-0 bg-white" />

          {/* Top accent */}
          <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${colorTheme.gradient}`} />

          <div className="relative h-full flex flex-col items-center justify-center p-6 text-center">
            <div className={`absolute top-4 left-4 px-3 py-1 ${colorTheme.bgLight} rounded-full`}>
              <span className={`${colorTheme.textColor} text-xs font-medium`}>정답</span>
            </div>

            <div className="text-gray-800 text-xl sm:text-2xl font-bold leading-relaxed">
              {back}
            </div>

            <div className="absolute bottom-6 flex items-center gap-2 text-gray-400 text-sm">
              <span>탭하여 질문 보기</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
