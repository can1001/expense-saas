'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import ImagePreview, { ImagePreviewFile } from './ImagePreview';
import { uploadFiles, removeFile, FileServiceError } from '@/lib/services/file-service';
import { FILE_VALIDATION } from '@/lib/constants/file-validation';
import { UploadedFile } from '@/lib/types';
import { SPINNER_BLUE } from '@/lib/constants/styles';

export type { UploadedFile };

interface FileUploadProps {
  expenseId?: string; // 기존 지출결의서 수정 시
  initialFiles?: UploadedFile[];
  onChange?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export default function FileUpload({
  expenseId,
  initialFiles = [],
  onChange,
  maxFiles = FILE_VALIDATION.MAX_FILES,
  disabled = false,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // initialFiles가 변경되면 files 상태 업데이트
  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  const handleFiles = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      // 최대 파일 개수 체크
      if (files.length + acceptedFiles.length > maxFiles) {
        alert(`최대 ${maxFiles}개까지 업로드 가능합니다.`);
        return;
      }

      setUploading(true);
      setUploadProgress(`${acceptedFiles.length}개 파일 업로드 중...`);

      try {
        // 병렬 업로드 실행
        const { succeeded, failed } = await uploadFiles(acceptedFiles, expenseId);

        // 성공한 파일들을 상태에 추가
        if (succeeded.length > 0) {
          const newFiles = [...files, ...succeeded];
          setFiles(newFiles);
          onChange?.(newFiles);
        }

        // 실패한 파일들에 대한 알림
        if (failed.length > 0) {
          const failedFileNames = failed.map(f => f.file.name).join(', ');
          const errorMessages = failed
            .map(f => {
              const error = f.error;
              if (error instanceof FileServiceError) {
                return `${f.file.name}: ${error.message}`;
              }
              return `${f.file.name}: 업로드 실패`;
            })
            .join('\n');

          alert(`다음 파일 업로드에 실패했습니다:\n${errorMessages}`);
        }

        // 성공 메시지
        if (succeeded.length > 0 && failed.length === 0) {
          setUploadProgress(`${succeeded.length}개 파일 업로드 완료`);
          setTimeout(() => setUploadProgress(''), 2000);
        }
      } catch (error: any) {
        console.error('Upload error:', error);
        alert(error.message || '파일 업로드에 실패했습니다.');
      } finally {
        setUploading(false);
        if (uploadProgress.includes('중...')) {
          setUploadProgress('');
        }
      }
    },
    [files, maxFiles, expenseId, onChange, uploadProgress]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      handleFiles(acceptedFiles);
    },
    [handleFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': FILE_VALIDATION.ALLOWED_EXTENSIONS,
    },
    maxSize: FILE_VALIDATION.MAX_FILE_SIZE,
    disabled: disabled || uploading || files.length >= maxFiles,
    multiple: true,
  });

  const handleRemoveFile = async (index: number) => {
    const fileToRemove = files[index];

    if (!confirm('이 파일을 삭제하시겠습니까?')) {
      return;
    }

    try {
      // 파일 서비스를 사용하여 삭제
      await removeFile(fileToRemove, expenseId);

      const newFiles = files.filter((_, i) => i !== index);
      setFiles(newFiles);
      onChange?.(newFiles);
    } catch (error: any) {
      console.error('Delete error:', error);
      const errorMessage =
        error instanceof FileServiceError ? error.message : '파일 삭제에 실패했습니다.';
      alert(errorMessage);
    }
  };

  return (
    <div className="space-y-4">
      {/* 드래그 앤 드롭 영역 */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }
          ${
            disabled || uploading || files.length >= maxFiles
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-2">
          <svg
            className={`w-12 h-12 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          {isDragActive ? (
            <p className="text-blue-600 font-medium">여기에 파일을 놓아주세요</p>
          ) : (
            <>
              <p className="text-gray-700 font-medium">
                파일을 드래그하여 놓거나 클릭하여 선택하세요
              </p>
              <p className="text-sm text-gray-500">
                이미지 파일만 업로드 가능 (최대 {FILE_VALIDATION.MAX_FILE_SIZE / 1024 / 1024}MB, {maxFiles}개까지)
              </p>
            </>
          )}
        </div>
      </div>

      {/* 업로드 진행 상태 */}
      {uploading && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className={SPINNER_BLUE}></div>
          <span>{uploadProgress}</span>
        </div>
      )}

      {/* 업로드된 파일 목록 */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file, index) => (
            <ImagePreview
              key={file.publicId || file.id || index}
              file={file as ImagePreviewFile}
              onRemove={() => handleRemoveFile(index)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* 파일 개수 표시 */}
      {files.length > 0 && (
        <p className="text-sm text-gray-500 text-center">
          업로드된 파일: {files.length} / {maxFiles}
        </p>
      )}

      {/* 안내 문구 */}
      {files.length === 0 && !uploading && (
        <p className="text-sm text-gray-500 text-center">
          영수증 이미지를 업로드해주세요 (선택사항)
        </p>
      )}
    </div>
  );
}
