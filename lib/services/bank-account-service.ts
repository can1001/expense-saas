/**
 * 은행 계좌 서비스 레이어
 *
 * API 호출을 캡슐화하여 컴포넌트와 API 로직을 분리
 */

import {
  SavedBankAccount,
  SavedBankAccountInput,
  UpdateBankAccountInput,
} from '@/lib/schemas/bank-account-schema';

/**
 * 서비스 에러 클래스
 */
export class BankAccountServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'BankAccountServiceError';
  }
}

/**
 * 저장된 은행 계좌 목록 조회
 */
export async function getSavedBankAccounts(): Promise<SavedBankAccount[]> {
  const response = await fetch('/api/bank-accounts');

  if (!response.ok) {
    const error = await response.json();
    throw new BankAccountServiceError(
      error.error || '계좌 목록 조회에 실패했습니다.',
      response.status,
      error
    );
  }

  const data = await response.json();
  return data.accounts;
}

/**
 * 기본 계좌 조회
 */
export async function getDefaultBankAccount(): Promise<SavedBankAccount | null> {
  const accounts = await getSavedBankAccounts();
  return accounts.find((account) => account.isDefault) || null;
}

/**
 * 새 은행 계좌 생성
 */
export async function createBankAccount(
  data: SavedBankAccountInput
): Promise<SavedBankAccount> {
  const response = await fetch('/api/bank-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new BankAccountServiceError(
      error.error || '계좌 저장에 실패했습니다.',
      response.status,
      error
    );
  }

  return await response.json();
}

/**
 * 은행 계좌 수정
 */
export async function updateBankAccount(
  id: string,
  data: UpdateBankAccountInput
): Promise<SavedBankAccount> {
  const response = await fetch(`/api/bank-accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new BankAccountServiceError(
      error.error || '계좌 수정에 실패했습니다.',
      response.status,
      error
    );
  }

  return await response.json();
}

/**
 * 은행 계좌 삭제
 */
export async function deleteBankAccount(id: string): Promise<void> {
  const response = await fetch(`/api/bank-accounts/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new BankAccountServiceError(
      error.error || '계좌 삭제에 실패했습니다.',
      response.status,
      error
    );
  }
}

/**
 * 기본 계좌 설정
 */
export async function setDefaultAccount(id: string): Promise<SavedBankAccount> {
  return updateBankAccount(id, { isDefault: true });
}
