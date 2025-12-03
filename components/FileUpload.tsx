'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (selectedFiles.length === 0) return;

    // 최대 파일 개수 체크
    if (files.length + selectedFiles.length > maxFiles) {
      alert(`최대 ${maxFiles}개까지 업로드 가능합니다.`);
      return;
    }

    setUploading(true);
    setUploadProgress(`0 / ${selectedFiles.length} 업로드 중...`);

    try {
      const uploadedFiles: UploadedFile[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(`${i + 1} / ${selectedFiles.length} 업로드 중...`);

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

        uploadedFiles.push(uploadedFile);
      }

      const newFiles = [...files, ...uploadedFiles];
      setFiles(newFiles);
      onChange?.(newFiles);

      // 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || '파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* 업로드 버튼 */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={disabled || uploading || files.length >= maxFiles}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
            disabled || uploading || files.length >= maxFiles
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          영수증 이미지 추가
        </label>
        <span className="ml-3 text-sm text-gray-500">
          ({files.length} / {maxFiles})
        </span>
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
            <div
              key={file.publicId}
              className="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              {/* 이미지 미리보기 */}
              <div className="relative w-full h-40 bg-gray-100">
                <Image
                  src={file.secureUrl}
                  alt={file.fileName}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              </div>

              {/* 파일 정보 */}
              <div className="p-2">
                <p className="text-xs text-gray-700 truncate" title={file.fileName}>
                  {file.fileName}
                </p>
                <p className="text-xs text-gray-500">{formatFileSize(file.fileSize)}</p>
              </div>

              {/* 삭제 버튼 */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md"
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
            </div>
          ))}
        </div>
      )}

      {/* 안내 문구 */}
      {files.length === 0 && !uploading && (
        <p className="text-sm text-gray-500">
          영수증 이미지를 업로드해주세요 (선택사항)
        </p>
      )}
    </div>
  );
}
