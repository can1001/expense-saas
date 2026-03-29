'use client';

import { useState, useEffect, useRef, useCallback, RefObject } from 'react';

interface MemoTooltipProps {
  examples: string[];
  favorites?: string[];
  isOpen: boolean;
  onSelect: (example: string) => void;
  onClose: () => void;
  onToggleFavorite?: (memo: string) => void;
  isFavorite?: (memo: string) => boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  loading?: boolean;
}

export default function MemoTooltip({
  examples,
  favorites = [],
  isOpen,
  onSelect,
  onClose,
  onToggleFavorite,
  isFavorite,
  inputRef,
  loading = false,
}: MemoTooltipProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 즐겨찾기와 예제를 합친 목록 (즐겨찾기가 먼저, 중복 제거)
  const allItems = [...favorites, ...examples.filter((e) => !favorites.includes(e))];
  const totalItems = allItems.length;

  // 선택 인덱스 초기화
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
    }
  }, [isOpen, examples, favorites]);

  // 키보드 이벤트 처리
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || totalItems === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalItems);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
          e.preventDefault();
          if (allItems[selectedIndex]) {
            onSelect(allItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          onClose();
          break;
      }
    },
    [isOpen, totalItems, allItems, selectedIndex, onSelect, onClose]
  );

  // 키보드 이벤트 리스너 등록
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.addEventListener('keydown', handleKeyDown);
    return () => input.removeEventListener('keydown', handleKeyDown);
  }, [inputRef, handleKeyDown]);

  // 외부 클릭 감지
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, inputRef]);

  // 선택 항목이 뷰포트에 보이도록 스크롤
  useEffect(() => {
    if (!isOpen || !tooltipRef.current) return;
    const selectedElement = tooltipRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  // 즐겨찾기 토글 핸들러 (이벤트 버블링 방지)
  const handleToggleFavorite = (e: React.MouseEvent, memo: string) => {
    e.stopPropagation();
    onToggleFavorite?.(memo);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={tooltipRef}
      className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
    >
      {/* 헤더 */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
        <span className="text-xs font-medium text-gray-600">적요 선택</span>
        <span className="text-xs text-gray-400 ml-2">↑↓ 이동, Enter 선택, ESC 닫기</span>
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="px-3 py-4 text-center text-sm text-gray-500">
          <div className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
          로딩 중...
        </div>
      )}

      {/* 즐겨찾기 섹션 */}
      {!loading && favorites.length > 0 && (
        <div className="border-b border-gray-100">
          <div className="px-3 py-1.5 bg-yellow-50 text-xs font-medium text-yellow-700 flex items-center gap-1">
            <span>★</span>
            <span>즐겨찾기</span>
          </div>
          <ul>
            {favorites.map((memo, index) => (
              <li
                key={`fav-${index}`}
                data-index={index}
                onClick={() => onSelect(memo)}
                className={`px-3 py-2 cursor-pointer text-sm transition-colors flex items-center justify-between group ${
                  index === selectedIndex
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={index === selectedIndex ? 'font-medium' : ''}>
                  {index === selectedIndex && '▸ '}
                  {memo}
                </span>
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={(e) => handleToggleFavorite(e, memo)}
                    className="text-yellow-500 hover:text-yellow-600 opacity-70 group-hover:opacity-100 transition-opacity"
                    title="즐겨찾기 해제"
                  >
                    ★
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 예제 목록 */}
      {!loading && examples.length === 0 && favorites.length === 0 && (
        <div className="px-3 py-4 text-center text-sm text-gray-500">
          등록된 예제가 없습니다.
        </div>
      )}

      {!loading && examples.length > 0 && (
        <div>
          {favorites.length > 0 && (
            <div className="px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-500">
              예제
            </div>
          )}
          <ul className="py-1">
            {examples
              .filter((e) => !favorites.includes(e))
              .map((example, idx) => {
                const actualIndex = favorites.length + idx;
                const isSelected = actualIndex === selectedIndex;
                const isFav = isFavorite?.(example) ?? false;
                return (
                  <li
                    key={idx}
                    data-index={actualIndex}
                    onClick={() => onSelect(example)}
                    className={`px-3 py-2 cursor-pointer text-sm transition-colors flex items-center justify-between group ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className={isSelected ? 'font-medium' : ''}>
                      {isSelected && '▸ '}
                      {example}
                    </span>
                    {onToggleFavorite && (
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(e, example)}
                        className={`${
                          isFav
                            ? 'text-yellow-500 hover:text-yellow-600'
                            : 'text-gray-300 hover:text-yellow-500'
                        } opacity-70 group-hover:opacity-100 transition-opacity`}
                        title={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                      >
                        {isFav ? '★' : '☆'}
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}
