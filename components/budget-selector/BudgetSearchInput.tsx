'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Search, X, Loader2, Star } from 'lucide-react';
import { useBudgetSearch, BudgetSearchResult } from './hooks/useBudgetSearch';

interface BudgetSearchInputProps {
  departmentId?: string;
  onSelect: (item: BudgetSearchResult) => void;
  isFavorite?: (id: string) => boolean;
  onToggleFavorite?: (item: BudgetSearchResult) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function BudgetSearchInput({
  departmentId,
  onSelect,
  isFavorite,
  onToggleFavorite,
  placeholder = '계정과목 검색 (예: 회의비, 출장)',
  disabled = false,
}: BudgetSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { query, setQuery, results, isLoading, error, clearResults } = useBudgetSearch({
    departmentId,
  });

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 결과가 있으면 드롭다운 열기
  useEffect(() => {
    if (results.length > 0) {
      setIsOpen(true);
    }
  }, [results]);

  const handleSelect = (item: BudgetSearchResult) => {
    onSelect(item);
    clearResults();
    setIsOpen(false);
  };

  const handleClear = () => {
    clearResults();
    inputRef.current?.focus();
  };

  // Enter 키 입력 시 form submit 방지
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // 검색 결과가 1개면 자동 선택
      if (results.length === 1) {
        handleSelect(results[0]);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-3 pl-10 pr-10 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />

        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
        ) : query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* 검색 결과 드롭다운 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {error ? (
            <div className="px-4 py-3 text-sm text-red-500">{error}</div>
          ) : results.length === 0 && query.length >= 1 && !isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              검색 결과가 없습니다
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.id}
                className="flex items-center border-b border-gray-100 last:border-0 hover:bg-gray-50"
              >
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="flex-1 px-4 py-3 text-left"
                >
                  <div className="font-medium text-gray-900">{item.detail}</div>
                  <div className="text-sm text-gray-500">{item.fullPath}</div>
                  {item.managerName && (
                    <div className="text-xs text-blue-600 mt-0.5">
                      담당: {item.managerName}
                    </div>
                  )}
                </button>
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item);
                    }}
                    className="p-2 mr-2 hover:bg-gray-100 rounded-full"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        isFavorite?.(item.id)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
