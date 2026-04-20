'use client';

import { useState, useCallback } from 'react';
import FlashCard from './FlashCard';

export interface FlashcardItem {
  id: string;
  question: string;
  answer: string;
  explanation?: string;
}

interface FlashcardStudyProps {
  cards: FlashcardItem[];
  title?: string;
  onComplete?: (results: StudyResult[]) => void;
  onClose?: () => void;
  colorTheme?: {
    gradient: string;
    gradientBg: string;
    bgLight: string;
    textColor: string;
  };
}

interface StudyResult {
  cardId: string;
  isCorrect: boolean;
}

const defaultTheme = {
  gradient: 'from-blue-400 via-indigo-400 to-blue-500',
  gradientBg: 'from-blue-500 via-indigo-500 to-blue-600',
  bgLight: 'bg-blue-50',
  textColor: 'text-blue-600',
};

export default function FlashcardStudy({
  cards,
  title = '플래시카드 학습',
  onComplete,
  onClose,
  colorTheme = defaultTheme,
}: FlashcardStudyProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<StudyResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const currentCard = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;
  const correctCount = results.filter((r) => r.isCorrect).length;
  const incorrectCount = results.filter((r) => !r.isCorrect).length;

  const handleFlip = useCallback(() => {
    setIsFlipped(!isFlipped);
  }, [isFlipped]);

  const handleAnswer = useCallback(
    (isCorrect: boolean) => {
      const newResult: StudyResult = {
        cardId: currentCard.id,
        isCorrect,
      };

      const newResults = [...results, newResult];
      setResults(newResults);

      if (currentIndex < cards.length - 1) {
        // Move to next card
        setTimeout(() => {
          setCurrentIndex(currentIndex + 1);
          setIsFlipped(false);
        }, 300);
      } else {
        // Study complete
        setIsComplete(true);
        onComplete?.(newResults);
      }
    },
    [currentCard, currentIndex, cards.length, results, onComplete]
  );

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
      // Remove the last result if going back
      setResults(results.slice(0, -1));
    }
  }, [currentIndex, results]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults([]);
    setIsComplete(false);
  }, []);

  // Complete Screen
  if (isComplete) {
    const percentage = Math.round((correctCount / cards.length) * 100);
    const emoji = percentage >= 80 ? '🎉' : percentage >= 60 ? '👍' : '💪';

    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">학습 완료</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-8xl mb-6">{emoji}</div>

          <h3 className="text-3xl font-bold text-gray-900 mb-2">학습 완료!</h3>
          <p className="text-gray-500 mb-8">총 {cards.length}개의 카드를 학습했습니다</p>

          {/* Score Circle */}
          <div className="relative w-40 h-40 mb-8">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="#e5e7eb"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="url(#gradient)"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${percentage * 4.4} 440`}
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-bold text-gray-900">{percentage}%</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mb-10">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <span className="text-green-600 font-bold">{correctCount}</span>
              </div>
              <span className="text-sm text-gray-500">정답</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <span className="text-red-600 font-bold">{incorrectCount}</span>
              </div>
              <span className="text-sm text-gray-500">오답</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className={`px-6 py-3 bg-gradient-to-r ${colorTheme.gradient} text-white font-semibold rounded-xl shadow-lg hover:opacity-90 transition-opacity`}
            >
              다시 학습하기
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${colorTheme.gradient} rounded-full transition-all duration-300`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-600 min-w-[60px] text-right">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>

        {/* Score */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xs font-bold">{correctCount}</span>
            </div>
            <span className="text-xs text-gray-500">정답</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-xs font-bold">{incorrectCount}</span>
            </div>
            <span className="text-xs text-gray-500">오답</span>
          </div>
        </div>
      </div>

      {/* Card Area */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <FlashCard
          front={currentCard.question}
          back={
            <div>
              <div>{currentCard.answer}</div>
              {currentCard.explanation && (
                <p className="text-sm text-gray-500 mt-4 font-normal">
                  {currentCard.explanation}
                </p>
              )}
            </div>
          }
          isFlipped={isFlipped}
          onFlip={handleFlip}
          colorTheme={colorTheme}
        />
      </div>

      {/* Bottom Actions */}
      <div className="flex-shrink-0 px-4 py-6 bg-white/80 backdrop-blur-sm border-t border-gray-100">
        {isFlipped ? (
          // Answer buttons (shown when card is flipped)
          <div className="space-y-3">
            <p className="text-center text-sm text-gray-500 mb-4">정답을 알고 있었나요?</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleAnswer(false)}
                className="flex-1 py-4 bg-red-50 text-red-600 font-semibold rounded-2xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                몰랐어요
              </button>
              <button
                onClick={() => handleAnswer(true)}
                className="flex-1 py-4 bg-green-50 text-green-600 font-semibold rounded-2xl hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                알고 있었어요
              </button>
            </div>
          </div>
        ) : (
          // Navigation (shown when card is not flipped)
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className={`px-5 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                currentIndex === 0
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              이전
            </button>

            <button
              onClick={handleFlip}
              className={`px-8 py-3 bg-gradient-to-r ${colorTheme.gradient} text-white font-semibold rounded-xl shadow-lg hover:opacity-90 transition-opacity`}
            >
              정답 보기
            </button>

            <div className="w-20" /> {/* Spacer for balance */}
          </div>
        )}
      </div>
    </div>
  );
}
