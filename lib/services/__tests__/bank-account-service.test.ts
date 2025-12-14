/**
 * 은행 계좌 서비스 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSavedBankAccounts,
  getDefaultBankAccount,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  setDefaultAccount,
  BankAccountServiceError,
} from '../bank-account-service';
import type { SavedBankAccount } from '@/lib/schemas/bank-account-schema';

// Mock fetch globally
global.fetch = vi.fn();

describe('BankAccountServiceError', () => {
  it('creates error with message only', () => {
    const error = new BankAccountServiceError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('BankAccountServiceError');
    expect(error.statusCode).toBeUndefined();
    expect(error.originalError).toBeUndefined();
  });

  it('creates error with status code', () => {
    const error = new BankAccountServiceError('Test error', 404);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(404);
  });

  it('creates error with original error', () => {
    const originalError = new Error('Original');
    const error = new BankAccountServiceError('Test error', 500, originalError);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.originalError).toBe(originalError);
  });
});

describe('getSavedBankAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns accounts on successful fetch', async () => {
    const mockAccounts: SavedBankAccount[] = [
      {
        id: '1',
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
        nickname: '주거래',
        isDefault: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: '2',
        bankName: '신한은행',
        accountNumber: '9876-5432-1012',
        accountHolder: '김철수',
        nickname: null,
        isDefault: false,
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    const result = await getSavedBankAccounts();
    expect(result).toEqual(mockAccounts);
    expect(global.fetch).toHaveBeenCalledWith('/api/bank-accounts');
  });

  it('returns empty array when accounts is undefined', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await getSavedBankAccounts();
    expect(result).toEqual([]);
  });

  it('throws BankAccountServiceError on 404 response', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    try {
      await getSavedBankAccounts();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(BankAccountServiceError);
      expect((error as BankAccountServiceError).message).toBe('Not found');
      expect((error as BankAccountServiceError).statusCode).toBe(404);
    }
  });

  it('throws BankAccountServiceError with default message on error response without error field', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    try {
      await getSavedBankAccounts();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(BankAccountServiceError);
      expect((error as BankAccountServiceError).message).toBe('계좌 목록 조회에 실패했습니다.');
    }
  });

  it('throws BankAccountServiceError when response.json() fails', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    });

    try {
      await getSavedBankAccounts();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(BankAccountServiceError);
      expect((error as BankAccountServiceError).message).toBe('계좌 목록 조회에 실패했습니다.');
    }
  });

  it('handles network error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    await expect(getSavedBankAccounts()).rejects.toThrow(BankAccountServiceError);
    await expect(getSavedBankAccounts()).rejects.toThrow('계좌 목록 조회에 실패했습니다.');

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('re-throws BankAccountServiceError as-is', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    });

    let caughtError: BankAccountServiceError | null = null;
    try {
      await getSavedBankAccounts();
    } catch (error) {
      caughtError = error as BankAccountServiceError;
    }

    expect(caughtError).toBeInstanceOf(BankAccountServiceError);
    expect(caughtError?.statusCode).toBe(403);
    expect(caughtError?.message).toBe('Forbidden');
  });
});

describe('getDefaultBankAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default account when one exists', async () => {
    const mockAccounts: SavedBankAccount[] = [
      {
        id: '1',
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
        nickname: null,
        isDefault: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: '2',
        bankName: '신한은행',
        accountNumber: '9876-5432-1012',
        accountHolder: '김철수',
        nickname: '기본 계좌',
        isDefault: true,
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    const result = await getDefaultBankAccount();
    expect(result).toEqual(mockAccounts[1]);
  });

  it('returns null when no default account exists', async () => {
    const mockAccounts: SavedBankAccount[] = [
      {
        id: '1',
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
        nickname: null,
        isDefault: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    const result = await getDefaultBankAccount();
    expect(result).toBeNull();
  });

  it('returns null when no accounts exist', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    });

    const result = await getDefaultBankAccount();
    expect(result).toBeNull();
  });
});

describe('createBankAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates account successfully', async () => {
    const inputData = {
      bankName: '우리은행',
      accountNumber: '1234-5678-9012',
      accountHolder: '홍길동',
      nickname: '주거래',
      isDefault: true,
    };

    const mockResponse: SavedBankAccount = {
      id: '1',
      ...inputData,
      nickname: '주거래',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await createBankAccount(inputData);
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith('/api/bank-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputData),
    });
  });

  it('throws BankAccountServiceError on validation error', async () => {
    const inputData = {
      bankName: '',
      accountNumber: '1234-5678-9012',
      accountHolder: '홍길동',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Validation error' }),
    });

    try {
      await createBankAccount(inputData);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(BankAccountServiceError);
      expect((error as BankAccountServiceError).message).toBe('Validation error');
    }
  });

  it('throws BankAccountServiceError with default message on error without error field', async () => {
    const inputData = {
      bankName: '우리은행',
      accountNumber: '1234-5678-9012',
      accountHolder: '홍길동',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    try {
      await createBankAccount(inputData);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(BankAccountServiceError);
      expect((error as BankAccountServiceError).message).toBe('계좌 저장에 실패했습니다.');
    }
  });
});

describe('updateBankAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates account successfully', async () => {
    const updateData = {
      nickname: '새로운 별명',
      isDefault: true,
    };

    const mockResponse: SavedBankAccount = {
      id: '1',
      bankName: '우리은행',
      accountNumber: '1234-5678-9012',
      accountHolder: '홍길동',
      nickname: '새로운 별명',
      isDefault: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await updateBankAccount('1', updateData);
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith('/api/bank-accounts/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });
  });

  it('throws BankAccountServiceError on 404 not found', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Account not found' }),
    });

    try {
      await updateBankAccount('999', {});
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(BankAccountServiceError);
      expect((error as BankAccountServiceError).message).toBe('Account not found');
    }
  });

  it('throws BankAccountServiceError with default message on error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    try {
      await updateBankAccount('1', {});
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(BankAccountServiceError);
      expect((error as BankAccountServiceError).message).toBe('계좌 수정에 실패했습니다.');
    }
  });
});

describe('deleteBankAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes account successfully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await expect(deleteBankAccount('1')).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith('/api/bank-accounts/1', {
      method: 'DELETE',
    });
  });

  it('throws BankAccountServiceError on 404 not found', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Account not found' }),
    });

    try {
      await deleteBankAccount('999');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(BankAccountServiceError);
      expect((error as BankAccountServiceError).message).toBe('Account not found');
    }
  });

  it('throws BankAccountServiceError with default message on error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    try {
      await deleteBankAccount('1');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(BankAccountServiceError);
      expect((error as BankAccountServiceError).message).toBe('계좌 삭제에 실패했습니다.');
    }
  });
});

describe('setDefaultAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets account as default successfully', async () => {
    const mockResponse: SavedBankAccount = {
      id: '1',
      bankName: '우리은행',
      accountNumber: '1234-5678-9012',
      accountHolder: '홍길동',
      nickname: null,
      isDefault: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await setDefaultAccount('1');
    expect(result).toEqual(mockResponse);
    expect(result.isDefault).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('/api/bank-accounts/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    });
  });

  it('throws error when setting default fails', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    });

    try {
      await setDefaultAccount('1');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(BankAccountServiceError);
      expect((error as BankAccountServiceError).message).toBe('Server error');
    }
  });
});
