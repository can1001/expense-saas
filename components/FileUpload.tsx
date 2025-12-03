'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import ImagePreview, { ImagePreviewFile } from './ImagePreview';

export interface UploadedFile {
  id?: string; // DB에 저장된 경우 ID
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
}

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
  maxFiles = 10,
  disabled = false,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // initialFiles가 변경되면 files 상태 업데이트
  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  const uploadFile = async (file: File): Promise<UploadedFile> => {
    // 파일을 Cloudinary에 업로드
    const formData = new FormData();
    formData.append('file', file);

    const uploadResponse = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.error || '파일 업로드 실패');
    }

    const uploadData = await uploadResponse.json();

    const uploadedFile: UploadedFile = {
      publicId: uploadData.data.publicId,
      url: uploadData.data.url,
      secureUrl: uploadData.data.secureUrl,
      format: uploadData.data.format,
      fileName: uploadData.data.fileName,
      fileSize: uploadData.data.bytes,
      width: uploadData.data.width,
      height: uploadData.data.height,
    };

    // expenseId가 있으면 DB에도 저장
    if (expenseId) {
      const attachResponse = await fetch(`/api/expenses/${expenseId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadedFile),
      });

      if (attachResponse.ok) {
        const savedAttachment = await attachResponse.json();
        uploadedFile.id = savedAttachment.id;
      }
    }

    return uploadedFile;
  };

  const handleFiles = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      // 최대 파일 개수 체크
      if (files.length + acceptedFiles.length > maxFiles) {
        alert(`최대 ${maxFiles}개까지 업로드 가능합니다.`);
        return;
      }

      setUploading(true);
      setUploadProgress(`0 / ${acceptedFiles.length} 업로드 중...`);

      try {
        const uploadedFiles: UploadedFile[] = [];

        for (let i = 0; i < acceptedFiles.length; i++) {
          const file = acceptedFiles[i];
          setUploadProgress(`${i + 1} / ${acceptedFiles.length} 업로드 중...`);

          try {
            const uploadedFile = await uploadFile(file);
            uploadedFiles.push(uploadedFile);
          } catch (error: any) {
            console.error(`Failed to upload ${file.name}:`, error);
            alert(`${file.name} 업로드 실패: ${error.message}`);
          }
        }

        if (uploadedFiles.length > 0) {
          const newFiles = [...files, ...uploadedFiles];
          setFiles(newFiles);
          onChange?.(newFiles);
        }
      } catch (error: any) {
        console.error('Upload error:', error);
        alert(error.message || '파일 업로드에 실패했습니다.');
      } finally {
        setUploading(false);
        setUploadProgress('');
      }
    },
    [files, maxFiles, expenseId, onChange]
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
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    disabled: disabled || uploading || files.length >= maxFiles,
    multiple: true,
  });

  const handleRemoveFile = async (index: number) => {
    const fileToRemove = files[index];

    if (!confirm('이 파일을 삭제하시겠습니까?')) {
      return;
    }

    try {
      // expenseId가 있고 DB에 저장된 파일이면 DB에서도 삭제
      if (expenseId && fileToRemove.id) {
        const deleteResponse = await fetch(
          `/api/expenses/${expenseId}/attachments/${fileToRemove.id}`,
          { method: 'DELETE' }
        );

        if (!deleteResponse.ok) {
          throw new Error('파일 삭제 실패');
        }
      } else {
        // DB에 저장되지 않은 파일은 Cloudinary에서만 삭제
        const deleteResponse = await fetch('/api/upload/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: fileToRemove.publicId }),
        });

        if (!deleteResponse.ok) {
          throw new Error('파일 삭제 실패');
        }
      }

      const newFiles = files.filter((_, i) => i !== index);
      setFiles(newFiles);
      onChange?.(newFiles);
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(error.message || '파일 삭제에 실패했습니다.');
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
                이미지 파일만 업로드 가능 (최대 5MB, {maxFiles}개까지)
              </p>
            </>
          )}
        </div>
      </div>

      {/* 업로드 진행 상태 */}
      {uploading && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
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
