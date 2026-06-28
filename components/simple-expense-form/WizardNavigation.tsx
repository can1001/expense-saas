/**
 * 마법사 네비게이션 컴포넌트
 * 스텝 인디케이터 표시
 */

'use client';

import { Check } from 'lucide-react';

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
}

export default function WizardNavigation({
  currentStep,
  totalSteps,
  stepTitles,
}: WizardNavigationProps) {
  return (
    <div className="py-4">
      {/* 스텝 인디케이터 */}
      <div className="flex items-center justify-center">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;

          return (
            <div key={stepNumber} className="flex items-center">
              {/* 스텝 원 */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors
                    ${isCompleted ? 'bg-green-500 text-white' : ''}
                    ${isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100' : ''}
                    ${isUpcoming ? 'bg-gray-200 text-gray-500' : ''}
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    stepNumber
                  )}
                </div>
                {/* 스텝 타이틀 */}
                <span
                  className={`
                    mt-2 text-xs font-medium whitespace-nowrap
                    ${isCurrent ? 'text-blue-600' : 'text-gray-500'}
                  `}
                >
                  {stepTitles[index]}
                </span>
              </div>

              {/* 연결선 */}
              {stepNumber < totalSteps && (
                <div
                  className={`
                    w-16 md:w-24 h-1 mx-2 rounded-full transition-colors
                    ${stepNumber < currentStep ? 'bg-green-500' : 'bg-gray-200'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 현재 스텝 설명 (모바일용) */}
      <p className="text-center text-sm text-gray-500 mt-4 md:hidden">
        {currentStep}/{totalSteps} 단계: {stepTitles[currentStep - 1]}
      </p>
    </div>
  );
}
