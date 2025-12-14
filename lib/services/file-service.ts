/**
 * 파일 서비스 레이어
 *
 * 파일 업로드/삭제 관련 API 호출을 캡슐화하여
 * 컴포넌트와 API 로직을 분리
 */

import { UploadedFile } from '@/lib/types';

/**
 * Cloudinary 업로드 응답
 */
interface CloudinaryUploadResponse {
  success: boolean;
  data: {
    publicId: string;
    url: string;
    secureUrl: string;
    format: string;
    width: number;
    height: number;
    bytes: number;
    fileName: string;
  };
}

/**
 * 첨부파일 API 응답
 */
interface AttachmentResponse {
  id: string;
  expenseId: string;
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  createdAt: string;
}

/**
 * 파일 삭제 응답
 */
interface DeleteResponse {
  success: boolean;
  message: string;
  cloudinaryDeleted?: boolean;
  attachmentId?: string;
  publicId?: string;
}

/**
 * 서비스 에러 클래스
 */
export class FileServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'FileServiceError';
  }
}

/**
 * Cloudinary에 파일 업로드
 */
export async function uploadToCloudinary(file: File): Promise<CloudinaryUploadResponse['data']> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new FileServiceError(
      error.error || '파일 업로드 실패',
      response.status,
      error
    );
  }

  const data: CloudinaryUploadResponse = await response.json();
  return data.data;
}

/**
 * Cloudinary에서 이미지 삭제
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  const response = await fetch('/api/upload/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new FileServiceError(
      error.error || '파일 삭제 실패',
      response.status,
      error
    );
  }
}

/**
 * DB에 첨부파일 정보 추가
 */
export async function createAttachment(
  expenseId: string,
  fileData: Omit<UploadedFile, 'id'>
): Promise<AttachmentResponse> {
  const response = await fetch(`/api/expenses/${expenseId}/attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fileData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new FileServiceError(
      error.error || '첨부파일 추가 실패',
      response.status,
      error
    );
  }

  return await response.json();
}

/**
 * 첨부파일 목록 조회
 */
export async function getAttachments(expenseId: string): Promise<AttachmentResponse[]> {
  const response = await fetch(`/api/expenses/${expenseId}/attachments`);

  if (!response.ok) {
    const error = await response.json();
    throw new FileServiceError(
      error.error || '첨부파일 목록 조회 실패',
      response.status,
      error
    );
  }

  return await response.json();
}

/**
 * 첨부파일 삭제 (DB + Cloudinary)
 */
export async function deleteAttachment(
  expenseId: string,
  attachmentId: string
): Promise<DeleteResponse> {
  const response = await fetch(
    `/api/expenses/${expenseId}/attachments/${attachmentId}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new FileServiceError(
      error.error || '첨부파일 삭제 실패',
      response.status,
      error
    );
  }

  return await response.json();
}

/**
 * 파일 업로드 전체 프로세스 (Cloudinary + DB)
 *
 * @param file - 업로드할 파일
 * @param expenseId - 지출결의서 ID (옵션)
 * @returns 업로드된 파일 정보
 */
export async function uploadFile(
  file: File,
  expenseId?: string
): Promise<UploadedFile> {
  // 1. Cloudinary에 업로드
  const cloudinaryData = await uploadToCloudinary(file);

  const uploadedFile: UploadedFile = {
    publicId: cloudinaryData.publicId,
    url: cloudinaryData.url,
    secureUrl: cloudinaryData.secureUrl,
    format: cloudinaryData.format,
    fileName: cloudinaryData.fileName,
    fileSize: cloudinaryData.bytes,
    width: cloudinaryData.width,
    height: cloudinaryData.height,
  };

  // 2. expenseId가 있으면 DB에도 저장
  if (expenseId) {
    try {
      const savedAttachment = await createAttachment(expenseId, uploadedFile);
      uploadedFile.id = savedAttachment.id;
    } catch (error) {
      // DB 저장 실패 시 Cloudinary에서 삭제 시도
      try {
        await deleteFromCloudinary(uploadedFile.publicId);
      } catch (cleanupError) {
        console.error('Failed to cleanup Cloudinary file:', cleanupError);
      }
      throw error;
    }
  }

  return uploadedFile;
}

/**
 * 여러 파일을 병렬로 업로드
 *
 * @param files - 업로드할 파일 배열
 * @param expenseId - 지출결의서 ID (옵션)
 * @returns 업로드된 파일 정보 배열과 실패한 파일 정보
 */
export async function uploadFiles(
  files: File[],
  expenseId?: string
): Promise<{
  succeeded: UploadedFile[];
  failed: Array<{ file: File; error: Error }>;
}> {
  const results = await Promise.allSettled(
    files.map(file => uploadFile(file, expenseId))
  );

  const succeeded: UploadedFile[] = [];
  const failed: Array<{ file: File; error: Error }> = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      succeeded.push(result.value);
    } else {
      failed.push({
        file: files[index],
        error: result.reason,
      });
    }
  });

  return { succeeded, failed };
}

/**
 * 파일 삭제 (DB 저장 여부에 따라 자동 판단)
 *
 * @param file - 삭제할 파일 정보
 * @param expenseId - 지출결의서 ID (DB 저장된 경우 필수)
 */
export async function removeFile(
  file: UploadedFile,
  expenseId?: string
): Promise<void> {
  // DB에 저장된 파일이면 DB에서도 삭제
  if (expenseId && file.id) {
    await deleteAttachment(expenseId, file.id);
  } else {
    // DB에 저장되지 않은 파일은 Cloudinary에서만 삭제
    await deleteFromCloudinary(file.publicId);
  }
}
