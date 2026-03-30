'use client';

import React from 'react';

export type PrintMode = 'expense' | 'receipt' | 'both';

interface PrintOptionsSelectorProps {
  value: PrintMode;
  onChange: (mode: PrintMode) => void;
  disabled?: boolean;
}

const options: { value: PrintMode; label: string; description: string }[] = [
  { value: 'expense', label: '지출결의서만', description: '앞면만 인쇄' },
  { value: 'receipt', label: '영수증만', description: '뒷면만 인쇄' },
  { value: 'both', label: '양면', description: '앞면 + 뒷면' },
];

export default function PrintOptionsSelector({
  value,
  onChange,
  disabled = false,
}: PrintOptionsSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option.value}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all
            min-h-[44px]
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${
              value === option.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }
          `}
        >
          <input
            type="radio"
            name="printMode"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            disabled={disabled}
            className="sr-only"
          />
          <span
            className={`
              w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
              ${
                value === option.value
                  ? 'border-blue-500'
                  : 'border-gray-400'
              }
            `}
          >
            {value === option.value && (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            )}
          </span>
          <div className="flex flex-col">
            <span className="font-medium text-sm">{option.label}</span>
            <span className="text-xs text-gray-500">{option.description}</span>
          </div>
        </label>
      ))}
    </div>
  );
}
