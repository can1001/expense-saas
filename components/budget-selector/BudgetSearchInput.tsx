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
  placeholder = '계정과목 (예: 성례비, 교육교재비)',
  disabled = false,
}: BudgetSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { query, setQuery, results, isLoading, error, clearResults } = useBudgetSearch({
    departmentId,
  });

  // 결과가 변경되면 선택 인덱스 초기화
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

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

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = prev < results.length - 1 ? prev + 1 : prev;
          // 선택된 항목이 보이도록 스크롤
          scrollToItem(next);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          scrollToItem(next);
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        } else if (results.length === 1) {
          // 선택된 항목이 없고 결과가 1개면 자동 선택
          handleSelect(results[0]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // 선택된 항목으로 스크롤
  const scrollToItem = (index: number) => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      if (items[index]) {
        items[index].scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const listboxId = 'budget-search-listbox';

  return (
    <div ref={containerRef} className="relative" role="combobox" aria-expanded={isOpen} aria-haspopup="listbox" aria-owns={listboxId}>
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
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={selectedIndex >= 0 ? `budget-option-${selectedIndex}` : undefined}
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
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="검색 결과"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto"
        >
          {error ? (
            <div className="px-4 py-3 text-sm text-red-500" role="alert">{error}</div>
          ) : results.length === 0 && query.length >= 1 && !isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500" role="status">
              검색 결과가 없습니다
            </div>
          ) : (
            results.map((item, index) => (
              <div
                key={item.id}
                id={`budget-option-${index}`}
                role="option"
                aria-selected={selectedIndex === index}
                className={`flex items-center border-b border-gray-100 last:border-0 cursor-pointer ${
                  selectedIndex === index ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex-1 px-4 py-3 min-h-[44px]">
                  <div className="font-medium text-gray-900">{item.detail}</div>
                  <div className="text-sm text-gray-500">{item.fullPath}</div>
                  {item.managerName && (
                    <div className="text-xs text-blue-600 mt-0.5">
                      담당: {item.managerName}
                    </div>
                  )}
                </div>
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item);
                    }}
                    className="p-2 mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded-full"
                    aria-label={isFavorite?.(item.id) ? `${item.detail} 즐겨찾기 해제` : `${item.detail} 즐겨찾기 추가`}
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
