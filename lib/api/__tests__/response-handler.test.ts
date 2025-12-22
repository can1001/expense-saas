/**
 * API 응답 핸들러 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiSuccess,
  apiPaginatedSuccess,
  apiCreated,
  apiError,
  apiNotFound,
  apiValidationError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
  calculatePagination,
} from '../response-handler';

describe('response-handler', () => {
  // Mock Date for consistent timestamps
  const mockDate = new Date('2025-01-01T00:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('apiSuccess', () => {
    it('should return success response with data', async () => {
      const data = { id: '1', name: 'Test' };
      const response = apiSuccess(data);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.code).toBe('SUCCESS');
      expect(json.data).toEqual(data);
      expect(json.timestamp).toBe('2025-01-01T00:00:00.000Z');
      expect(json.message).toBeUndefined();
    });

    it('should include message when provided', async () => {
      const data = { id: '1' };
      const response = apiSuccess(data, { message: '조회 성공' });
      const json = await response.json();

      expect(json.message).toBe('조회 성공');
    });

    it('should use custom code when provided', async () => {
      const data = { id: '1' };
      const response = apiSuccess(data, { code: 'CUSTOM_SUCCESS' });
      const json = await response.json();

      expect(json.code).toBe('CUSTOM_SUCCESS');
    });

    it('should use custom status when provided', async () => {
      const data = { id: '1' };
      const response = apiSuccess(data, { status: 202 });

      expect(response.status).toBe(202);
    });

    it('should handle array data', async () => {
      const data = [{ id: '1' }, { id: '2' }];
      const response = apiSuccess(data);
      const json = await response.json();

      expect(json.data).toEqual(data);
      expect(json.data.length).toBe(2);
    });

    it('should handle null data', async () => {
      const response = apiSuccess(null);
      const json = await response.json();

      expect(json.data).toBeNull();
    });
  });

  describe('apiPaginatedSuccess', () => {
    const pagination = {
      page: 1,
      limit: 10,
      total: 100,
      totalPages: 10,
      hasNext: true,
      hasPrev: false,
    };

    it('should return paginated success response', async () => {
      const data = [{ id: '1' }, { id: '2' }];
      const response = apiPaginatedSuccess(data, pagination);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.code).toBe('SUCCESS');
      expect(json.data).toEqual(data);
      expect(json.meta?.pagination).toEqual(pagination);
    });

    it('should include message when provided', async () => {
      const data = [{ id: '1' }];
      const response = apiPaginatedSuccess(data, pagination, { message: '목록 조회' });
      const json = await response.json();

      expect(json.message).toBe('목록 조회');
    });

    it('should use custom code when provided', async () => {
      const data = [{ id: '1' }];
      const response = apiPaginatedSuccess(data, pagination, { code: 'LIST_SUCCESS' });
      const json = await response.json();

      expect(json.code).toBe('LIST_SUCCESS');
    });

    it('should handle empty array', async () => {
      const response = apiPaginatedSuccess([], { ...pagination, total: 0, totalPages: 0 });
      const json = await response.json();

      expect(json.data).toEqual([]);
    });
  });

  describe('apiCreated', () => {
    it('should return 201 status with CREATED code', async () => {
      const data = { id: '1', name: 'New Item' };
      const response = apiCreated(data);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.code).toBe('CREATED');
      expect(json.data).toEqual(data);
    });

    it('should include message when provided', async () => {
      const data = { id: '1' };
      const response = apiCreated(data, { message: '생성 완료' });
      const json = await response.json();

      expect(json.message).toBe('생성 완료');
    });

    it('should use custom code when provided', async () => {
      const data = { id: '1' };
      const response = apiCreated(data, { code: 'EXPENSE_CREATED' });
      const json = await response.json();

      expect(json.code).toBe('EXPENSE_CREATED');
    });
  });

  describe('apiError', () => {
    it('should return error response with defaults', async () => {
      const response = apiError('오류가 발생했습니다.');
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.code).toBe('ERROR');
      expect(json.message).toBe('오류가 발생했습니다.');
      expect(json.error?.type).toBe('UNKNOWN');
      expect(json.error?.message).toBe('오류가 발생했습니다.');
    });

    it('should use custom type and code', async () => {
      const response = apiError('에러', { type: 'VALIDATION', code: 'INVALID_INPUT' });
      const json = await response.json();

      expect(json.error?.type).toBe('VALIDATION');
      expect(json.code).toBe('INVALID_INPUT');
    });

    it('should use custom status', async () => {
      const response = apiError('에러', { status: 400 });

      expect(response.status).toBe(400);
    });

    it('should include details when provided', async () => {
      const details = { field: 'email', reason: 'invalid format' };
      const response = apiError('에러', { details });
      const json = await response.json();

      expect(json.error?.details).toEqual(details);
    });

    it('should include fields when provided', async () => {
      const fields = [
        { fieldName: 'email', message: '이메일 형식이 올바르지 않습니다.' },
        { fieldName: 'name', message: '이름은 필수입니다.' },
      ];
      const response = apiError('검증 오류', { fields });
      const json = await response.json();

      expect(json.error?.fields).toEqual(fields);
      expect(json.error?.fields?.length).toBe(2);
    });

    it('should not include fields when empty array', async () => {
      const response = apiError('에러', { fields: [] });
      const json = await response.json();

      expect(json.error?.fields).toBeUndefined();
    });

    it('should not include details when undefined', async () => {
      const response = apiError('에러');
      const json = await response.json();

      expect(json.error?.details).toBeUndefined();
    });
  });

  describe('apiNotFound', () => {
    it('should return 404 with default message', async () => {
      const response = apiNotFound();
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.code).toBe('NOT_FOUND');
      expect(json.message).toBe('리소스를 찾을 수 없습니다.');
      expect(json.error?.type).toBe('NOT_FOUND');
    });

    it('should use custom message', async () => {
      const response = apiNotFound('지출결의서를 찾을 수 없습니다.');
      const json = await response.json();

      expect(json.message).toBe('지출결의서를 찾을 수 없습니다.');
    });
  });

  describe('apiValidationError', () => {
    it('should return 400 with validation error', async () => {
      const response = apiValidationError('입력값이 올바르지 않습니다.');
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.error?.type).toBe('VALIDATION');
    });

    it('should include field errors', async () => {
      const fields = [{ fieldName: 'amount', message: '금액은 0보다 커야 합니다.' }];
      const response = apiValidationError('검증 실패', fields);
      const json = await response.json();

      expect(json.error?.fields).toEqual(fields);
    });
  });

  describe('apiUnauthorized', () => {
    it('should return 401 with default message', async () => {
      const response = apiUnauthorized();
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.code).toBe('UNAUTHORIZED');
      expect(json.message).toBe('인증이 필요합니다.');
      expect(json.error?.type).toBe('UNAUTHORIZED');
    });

    it('should use custom message', async () => {
      const response = apiUnauthorized('로그인이 필요합니다.');
      const json = await response.json();

      expect(json.message).toBe('로그인이 필요합니다.');
    });
  });

  describe('apiForbidden', () => {
    it('should return 403 with default message', async () => {
      const response = apiForbidden();
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.code).toBe('FORBIDDEN');
      expect(json.message).toBe('접근 권한이 없습니다.');
      expect(json.error?.type).toBe('FORBIDDEN');
    });

    it('should use custom message', async () => {
      const response = apiForbidden('관리자만 접근 가능합니다.');
      const json = await response.json();

      expect(json.message).toBe('관리자만 접근 가능합니다.');
    });
  });

  describe('apiServerError', () => {
    it('should return 500 with default message', async () => {
      const response = apiServerError();
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.code).toBe('SERVER_ERROR');
      expect(json.message).toBe('서버 오류가 발생했습니다.');
      expect(json.error?.type).toBe('SERVER_ERROR');
    });

    it('should use custom message', async () => {
      const response = apiServerError('데이터베이스 연결 실패');
      const json = await response.json();

      expect(json.message).toBe('데이터베이스 연결 실패');
    });

    it('should include details', async () => {
      const details = { originalError: 'Connection timeout' };
      const response = apiServerError('DB 오류', details);
      const json = await response.json();

      expect(json.error?.details).toEqual(details);
    });
  });

  describe('calculatePagination', () => {
    it('should calculate pagination for first page', () => {
      const result = calculatePagination(1, 10, 100);

      expect(result).toEqual({
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: true,
        hasPrev: false,
      });
    });

    it('should calculate pagination for middle page', () => {
      const result = calculatePagination(5, 10, 100);

      expect(result).toEqual({
        page: 5,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should calculate pagination for last page', () => {
      const result = calculatePagination(10, 10, 100);

      expect(result).toEqual({
        page: 10,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: false,
        hasPrev: true,
      });
    });

    it('should handle single page', () => {
      const result = calculatePagination(1, 10, 5);

      expect(result).toEqual({
        page: 1,
        limit: 10,
        total: 5,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should handle empty result', () => {
      const result = calculatePagination(1, 10, 0);

      expect(result).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should handle partial last page', () => {
      const result = calculatePagination(1, 10, 15);

      expect(result).toEqual({
        page: 1,
        limit: 10,
        total: 15,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
    });
  });
});
