'use client';

import { useState } from 'react';
import Image from 'next/image';
import { SPINNER_MD, FLEX_CENTER } from '@/lib/constants/styles';

export interface ImagePreviewFile {
  id?: string;
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
}

interface ImagePreviewProps {
  file: ImagePreviewFile;
  onRemove?: () => void;
  disabled?: boolean;
  showDetails?: boolean;
}

export default function ImagePreview({
  file,
  onRemove,
  disabled = false,
  showDetails = true,
}: ImagePreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isPdf =
    file.format?.toLowerCase() === 'pdf' ||
    file.fileName?.toLowerCase().endsWith('.pdf');

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow group">
      {/* 미리보기 (이미지/PDF) */}
      <div className="relative w-full h-40 bg-gray-100">
        {isPdf ? (
          <a
            href={file.secureUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center h-full text-red-600 hover:bg-gray-50 transition-colors"
            onClick={(e) => e.stopPropagation()}
            title="새 탭에서 PDF 열기"
          >
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="mt-2 text-xs font-semibold">PDF</span>
          </a>
        ) : hasError ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className={`absolute inset-0 ${FLEX_CENTER} bg-gray-100`}>
                <div className={SPINNER_MD}></div>
              </div>
            )}
            <Image
              src={file.secureUrl}
              alt={file.fileName}
              fill
              className={`object-cover transition-opacity ${
                isLoading ? 'opacity-0' : 'opacity-100'
              } ${!disabled ? 'cursor-pointer' : ''}`}
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              onClick={() => !disabled && setIsExpanded(true)}
            />
          </>
        )}
      </div>

      {/* 파일 정보 */}
      {showDetails && (
        <div className="p-2">
          <p
            className="text-xs text-gray-700 truncate"
            title={file.fileName}
          >
            {file.fileName}
          </p>
          <p className="text-xs text-gray-500">{formatFileSize(file.fileSize)}</p>
          {file.width && file.height && (
            <p className="text-xs text-gray-400">
              {file.width} × {file.height}
            </p>
          )}
        </div>
      )}

      {/* 삭제 버튼 */}
      {!disabled && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md opacity-0 group-hover:opacity-100"
          title="삭제"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* 확대 모달 */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="relative max-w-7xl max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div className="relative w-full h-full">
              <Image
                src={file.secureUrl}
                alt={file.fileName}
                width={file.width || 1200}
                height={file.height || 800}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-4 rounded-b-lg">
              <p className="text-sm font-medium">{file.fileName}</p>
              <p className="text-xs text-gray-300">
                {formatFileSize(file.fileSize)}
                {file.width && file.height && ` • ${file.width} × ${file.height}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

