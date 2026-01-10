'use client';

import { useState, useEffect, useRef, useCallback, RefObject } from 'react';

interface MemoTooltipProps {
  examples: string[];
  isOpen: boolean;
  onSelect: (example: string) => void;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  loading?: boolean;
}

export default function MemoTooltip({
  examples,
  isOpen,
  onSelect,
  onClose,
  inputRef,
  loading = false,
}: MemoTooltipProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 선택 인덱스 초기화
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
    }
  }, [isOpen, examples]);

  // 키보드 이벤트 처리
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || examples.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % examples.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + examples.length) % examples.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (examples[selectedIndex]) {
            onSelect(examples[selectedIndex]);
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
    [isOpen, examples, selectedIndex, onSelect, onClose]
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

  if (!isOpen) return null;

  return (
    <div
      ref={tooltipRef}
      className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
    >
      {/* 헤더 */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
        <span className="text-xs font-medium text-gray-600">적요 예제</span>
        <span className="text-xs text-gray-400 ml-2">↑↓ 이동, Enter 선택, ESC 닫기</span>
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="px-3 py-4 text-center text-sm text-gray-500">
          <div className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
          로딩 중...
        </div>
      )}

      {/* 예제 목록 */}
      {!loading && examples.length === 0 && (
        <div className="px-3 py-4 text-center text-sm text-gray-500">
          등록된 예제가 없습니다.
        </div>
      )}

      {!loading && examples.length > 0 && (
        <ul className="py-1">
          {examples.map((example, index) => (
            <li
              key={index}
              data-index={index}
              onClick={() => onSelect(example)}
              className={`px-3 py-2 cursor-pointer text-sm transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className={index === selectedIndex ? 'font-medium' : ''}>
                {index === selectedIndex && '▸ '}
                {example}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
