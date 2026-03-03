/**
 * 오프라인 첨부파일 저장소
 * IndexedDB에 파일 Blob 저장
 */

import { v4 as uuidv4 } from 'uuid';
import { getDB } from './index';
import type { OfflineAttachment, OfflineAttachmentStatus } from './types';

// 첨부파일 크기 제한 (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// 허용되는 MIME 타입
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/**
 * 오프라인 첨부파일 저장
 */
export async function saveOfflineAttachment(
  expenseLocalId: string,
  file: File
): Promise<OfflineAttachment> {
  // 파일 크기 검증
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `파일 크기가 너무 큽니다. 최대 ${MAX_FILE_SIZE / 1024 / 1024}MB까지 허용됩니다.`
    );
  }

  // MIME 타입 검증
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('지원하지 않는 파일 형식입니다.');
  }

  const db = getDB();
  const now = Date.now();

  // File을 Blob으로 변환 (이미 Blob이지만 명시적으로)
  const blob = new Blob([await file.arrayBuffer()], { type: file.type });

  const attachment: OfflineAttachment = {
    localId: uuidv4(),
    expenseLocalId,
    blob,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    status: 'pending',
    createdAt: now,
  };

  await db.attachments.add(attachment);

  return attachment;
}

/**
 * 여러 첨부파일 저장
 */
export async function saveOfflineAttachments(
  expenseLocalId: string,
  files: File[]
): Promise<OfflineAttachment[]> {
  const results: OfflineAttachment[] = [];

  for (const file of files) {
    try {
      const attachment = await saveOfflineAttachment(expenseLocalId, file);
      results.push(attachment);
    } catch (error) {
      console.error(`[OfflineAttachment] 저장 실패: ${file.name}`, error);
      // 개별 파일 실패는 건너뛰고 계속 진행
    }
  }

  return results;
}

/**
 * localId로 첨부파일 조회
 */
export async function getOfflineAttachment(
  localId: string
): Promise<OfflineAttachment | undefined> {
  const db = getDB();
  return db.attachments.get(localId);
}

/**
 * 지출결의서의 모든 첨부파일 조회
 */
export async function getAttachmentsByExpense(
  expenseLocalId: string
): Promise<OfflineAttachment[]> {
  const db = getDB();
  return db.attachments.where('expenseLocalId').equals(expenseLocalId).toArray();
}

/**
 * 첨부파일 삭제
 */
export async function deleteOfflineAttachment(localId: string): Promise<boolean> {
  const db = getDB();
  await db.attachments.delete(localId);
  return true;
}

/**
 * 지출결의서의 모든 첨부파일 삭제
 */
export async function deleteAttachmentsByExpense(
  expenseLocalId: string
): Promise<number> {
  const db = getDB();
  return db.attachments.where('expenseLocalId').equals(expenseLocalId).delete();
}

/**
 * 첨부파일 상태 업데이트
 */
export async function updateAttachmentStatus(
  localId: string,
  status: OfflineAttachmentStatus,
  uploadResult?: OfflineAttachment['uploadResult'],
  errorMessage?: string
): Promise<void> {
  const db = getDB();
  const existing = await db.attachments.get(localId);

  if (!existing) return;

  await db.attachments.update(localId, {
    status,
    uploadResult: uploadResult || existing.uploadResult,
    errorMessage,
  });
}

/**
 * 업로드 대기 중인 첨부파일 조회
 */
export async function getPendingAttachments(): Promise<OfflineAttachment[]> {
  const db = getDB();
  return db.attachments.where('status').equals('pending').toArray();
}

/**
 * 첨부파일을 File 객체로 변환
 */
export function attachmentToFile(attachment: OfflineAttachment): File {
  return new File([attachment.blob], attachment.fileName, {
    type: attachment.mimeType,
  });
}

/**
 * 첨부파일을 Data URL로 변환 (미리보기용)
 */
export async function attachmentToDataUrl(
  attachment: OfflineAttachment
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(attachment.blob);
  });
}

/**
 * 이미지 첨부파일 썸네일 생성 (미리보기용)
 */
export async function createThumbnail(
  attachment: OfflineAttachment,
  maxWidth: number = 200,
  maxHeight: number = 200
): Promise<string | null> {
  // 이미지가 아니면 null 반환
  if (!attachment.mimeType.startsWith('image/')) {
    return null;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(attachment.blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // 비율 계산
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      // Canvas에 그리기
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * 총 첨부파일 용량 계산
 */
export async function getTotalAttachmentSize(): Promise<number> {
  const db = getDB();
  const attachments = await db.attachments.toArray();
  return attachments.reduce((sum, att) => sum + att.fileSize, 0);
}

/**
 * 오래된 업로드 완료 첨부파일 정리
 */
export async function cleanupUploadedAttachments(
  daysToKeep: number = 7
): Promise<number> {
  const db = getDB();
  const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

  const oldAttachments = await db.attachments
    .where('status')
    .equals('uploaded')
    .and((att) => att.createdAt < cutoffTime)
    .toArray();

  for (const att of oldAttachments) {
    await db.attachments.delete(att.localId);
  }

  return oldAttachments.length;
}
