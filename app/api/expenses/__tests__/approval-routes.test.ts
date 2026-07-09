/**
 * 결재 관련 API 라우트 통합 테스트
 *
 * 테스트 대상:
 * - POST /api/expenses/[id]/submit - 제출
 * - POST /api/expenses/[id]/approve - 승인
 * - POST /api/expenses/[id]/reject - 반려
 * - POST /api/expenses/[id]/withdraw - 회수
 * - GET /api/expenses/[id]/approval - 결재선 조회
 * - PUT /api/expenses/[id]/approval - 결재선 수정
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setMockUser, resetMockUser } from '@/test/setup';

// Mock Prisma - use factory function to avoid hoisting issues
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    approvalLine: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    approvalStep: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    approvalLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    budgetMaster: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock approval-line-service
vi.mock('@/lib/services/approval-line-service', () => ({
  calculateApprovalLineForExpense: vi.fn(),
}));

// Import route handlers after mocking
import { POST as submitPOST } from '../[id]/submit/route';
import { POST as approvePOST } from '../[id]/approve/route';
import { POST as rejectPOST } from '../[id]/reject/route';
import { POST as withdrawPOST } from '../[id]/withdraw/route';
import { GET as approvalGET, PUT as approvalPUT } from '../[id]/approval/route';
import { prisma } from '@/lib/prisma';
import { calculateApprovalLineForExpense } from '@/lib/services/approval-line-service';

describe('Approval API Routes', () => {
  const mockPrisma = prisma as any;
  const mockCalculateApprovalLine = calculateApprovalLineForExpense as ReturnType<typeof vi.fn>;

  const mockUser = {
    id: 'user-1',
    tenantId: 'test-tenant-id',
    userid: 'testuser',
    username: '테스트유저',
    role: 'admin',
    roleId: 'test-role-id',
    department: null,
    canApprove: true,
    canManageExpense: true,
    canAccessAdmin: true,
    canExportData: true,
    canRegisterUsers: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(mockUser);

    // Default mock for calculateApprovalLineForExpense
    mockCalculateApprovalLine.mockResolvedValue({
      managerId: 'manager-id',
      managerName: '김재정',
      managerEmail: 'manager@church.org',
      isDirectApproval: false,
      totalSteps: 2,
      steps: [
        {
          stepNumber: 1,
          stepName: '팀장',
          approverName: '김재정',
          approverEmail: 'manager@church.org',
          role: '담당자',
          isAutoApproved: false,
        },
        {
          stepNumber: 2,
          stepName: '회계',
          approverName: '박회계',
          approverEmail: 'accountant@church.org',
          role: '회계',
          isAutoApproved: false,
        },
      ],
    });
  });

  afterEach(() => {
    resetMockUser();
  });

  // ========================================
  // POST /api/expenses/[id]/submit - 제출
  // ========================================
  describe('POST /api/expenses/[id]/submit', () => {
    it('should submit expense and create approval line successfully', async () => {
      const expenseId = 'test-expense-id';
      const mockExpense = {
        id: expenseId,
        status: 'DRAFT',
        committee: '기획위원회',
        department: '재정팀',
        budgetCategory: '사무행정비',
        budgetSubcategory: '회의비',
        requestAmount: 300000,
        applicantName: '홍길동',
        requestDate: new Date('2025-01-15'),
        tenantId: 'test-tenant-id',
        items: [
          {
            id: 'item-1',
            budgetDetail: '회의비',
            description: '팀 회의',
            unitPrice: 10000,
            quantity: 30,
            amount: 300000,
            order: 1,
          },
        ],
        approvalLine: null,
      };

      const mockUpdatedExpense = {
        ...mockExpense,
        status: 'PENDING',
        submittedAt: new Date(),
        approvalLine: {
          id: 'approval-line-id',
          currentStep: 1,
          totalSteps: 2,
          steps: [
            {
              id: 'step-1',
              stepNumber: 1,
              stepName: '팀장',
              approverName: '김재정',
              status: 'PENDING',
            },
            {
              id: 'step-2',
              stepNumber: 2,
              stepName: '회계',
              approverName: '박회계',
              status: 'PENDING',
            },
          ],
        },
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.budgetMaster.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          approvalLine: {
            create: vi.fn().mockResolvedValue(mockUpdatedExpense.approvalLine),
            delete: vi.fn().mockResolvedValue(null),
          },
          expense: {
            update: vi.fn().mockResolvedValue(mockUpdatedExpense),
          },
          approvalLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const request = new NextRequest('http://localhost/api/expenses/test-expense-id/submit', {
        method: 'POST',
        body: JSON.stringify({
          signature: {
            type: 'signature',
            data: 'data:image/png;base64,mock-signature-data',
          },
        }),
      });

      const params = Promise.resolve({ id: expenseId });
      const response = await submitPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('제출되었습니다');
      expect(mockPrisma.expense.findUnique).toHaveBeenCalledWith({
        where: { id: expenseId },
        include: expect.objectContaining({
          items: true,
          approvalLine: expect.any(Object),
        }),
      });
    });

    it('should return 404 if expense not found', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/expenses/invalid-id/submit', {
        method: 'POST',
      });

      const params = Promise.resolve({ id: 'invalid-id' });
      const response = await submitPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('찾을 수 없습니다');
    });

    it('should return 400 if expense already submitted', async () => {
      const mockExpense = {
        id: 'test-id',
        status: 'PENDING',
        committee: '기획위원회',
        department: '재정팀',
        budgetCategory: '사무행정비',
        budgetSubcategory: '회의비',
        requestAmount: 300000,
        applicantName: '홍길동',
        tenantId: 'test-tenant-id',
        items: [],
        approvalLine: null,
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = new NextRequest('http://localhost/api/expenses/test-id/submit', {
        method: 'POST',
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await submitPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('이미 제출된');
    });

    it('should auto-approve steps when applicant is the approver (전결 처리)', async () => {
      // 재정팀장(신창국)이 작성한 경우:
      // - 1차 팀장(신창국): 전결 처리
      // - 2차 회계(윤운문): 대기
      // - 3차 재정팀장(신창국): 대기 (2차 승인 후 전결 처리됨)
      const expenseId = 'test-id';
      const mockExpense = {
        id: expenseId,
        status: 'DRAFT',
        committee: '기획위원회',
        department: '재정팀',
        budgetCategory: '사무행정비',
        budgetSubcategory: '회의비',
        requestAmount: 300000,
        applicantName: '신창국', // 재정팀장 (팀장도 본인)
        requestDate: new Date('2025-01-15'),
        tenantId: 'test-tenant-id',
        items: [
          {
            id: 'item-1',
            budgetDetail: '회의비',
            description: '팀 회의',
            unitPrice: 10000,
            quantity: 30,
            amount: 300000,
            order: 1,
          },
        ],
        approvalLine: null,
      };

      const mockUpdatedExpense = {
        ...mockExpense,
        status: 'APPROVED_STEP_1', // 1차만 전결되고 2차 대기
        submittedAt: new Date(),
        approvalLine: {
          id: 'approval-line-id',
          currentStep: 2,
          totalSteps: 3,
          steps: [
            {
              id: 'step-1',
              stepNumber: 1,
              stepName: '팀장',
              approverName: '신창국',
              status: 'APPROVED', // 전결
            },
            {
              id: 'step-2',
              stepNumber: 2,
              stepName: '회계',
              approverName: '윤운문',
              status: 'PENDING', // 대기
            },
            {
              id: 'step-3',
              stepNumber: 3,
              stepName: '재정팀장',
              approverName: '신창국',
              status: 'PENDING', // 대기 (2차 승인 후 전결 처리됨)
            },
          ],
        },
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      // Mock approval line for auto-approve scenario (담당자 = 재정팀장)
      mockCalculateApprovalLine.mockResolvedValue({
        managerId: 'manager-id',
        managerName: '신창국',
        managerEmail: 'cfo@church.org',
        isDirectApproval: true,
        totalSteps: 3,
        steps: [
          {
            stepNumber: 1,
            stepName: '팀장(전결)',
            approverName: '신창국',
            approverEmail: 'cfo@church.org',
            role: '담당자',
            isAutoApproved: true,
          },
          {
            stepNumber: 2,
            stepName: '회계',
            approverName: '윤운문',
            approverEmail: 'accountant@church.org',
            role: '회계',
            isAutoApproved: false,
          },
          {
            stepNumber: 3,
            stepName: '재정팀장',
            approverName: '신창국',
            approverEmail: 'cfo@church.org',
            role: '재정팀장',
            isAutoApproved: false,
          },
        ],
      });

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          approvalLine: {
            create: vi.fn().mockResolvedValue(mockUpdatedExpense.approvalLine),
            delete: vi.fn().mockResolvedValue(null),
          },
          expense: {
            update: vi.fn().mockResolvedValue(mockUpdatedExpense),
          },
          approvalLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const request = new NextRequest('http://localhost/api/expenses/test-id/submit', {
        method: 'POST',
        body: JSON.stringify({
          signature: {
            type: 'signature',
            data: 'data:image/png;base64,mock-signature-data',
          },
        }),
      });

      const params = Promise.resolve({ id: expenseId });
      const response = await submitPOST(request, { params });
      const data = await response.json();

      // 성공적으로 제출되어야 함 (전결 처리)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  // ========================================
  // POST /api/expenses/[id]/approve - 승인
  // ========================================
  describe('POST /api/expenses/[id]/approve', () => {
    // 승인 테스트용 사용자 (결재선의 approverName과 일치해야 함)
    const mockApprover = {
      ...mockUser,
      id: 'approver-1',
      userid: 'approver',
      username: '김재정', // 결재선의 1단계 승인자 이름과 일치
    };

    it('should approve expense at current step successfully', async () => {
      // 결재선의 1단계 승인자로 설정
      setMockUser(mockApprover);

      const expenseId = 'test-expense-id';
      const mockExpense = {
        id: expenseId,
        status: 'PENDING',
        tenantId: 'test-tenant-id',
        applicantSignatureType: 'signature',
        applicantSignatureData: 'data:image/png;base64,mock-signature-data',
        approvalLine: {
          id: 'approval-line-id',
          currentStep: 1,
          totalSteps: 2,
          steps: [
            {
              id: 'step-1',
              stepNumber: 1,
              stepName: '팀장',
              approverName: '김재정',
              approverEmail: 'manager@church.org',
              status: 'PENDING',
            },
            {
              id: 'step-2',
              stepNumber: 2,
              stepName: '회계',
              approverName: '박회계',
              status: 'PENDING',
            },
          ],
        },
      };

      const mockUpdatedExpense = {
        ...mockExpense,
        status: 'APPROVED_STEP_1',
        approvalLine: {
          ...mockExpense.approvalLine,
          currentStep: 2,
        },
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          approvalStep: {
            update: vi.fn().mockResolvedValue({}),
          },
          approvalLine: {
            update: vi.fn().mockResolvedValue({}),
          },
          expense: {
            update: vi.fn().mockResolvedValue(mockUpdatedExpense),
          },
          approvalLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const request = new NextRequest('http://localhost/api/expenses/test-expense-id/approve', {
        method: 'POST',
        body: JSON.stringify({
          approverName: '김재정',
          comment: '승인합니다',
        }),
      });

      const params = Promise.resolve({ id: expenseId });
      const response = await approvePOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('승인되었습니다');
      expect(data.isComplete).toBe(false);
    });

    it('should complete approval on final step', async () => {
      // 3단계 승인자(이재무)로 설정
      setMockUser({ ...mockApprover, username: '이재무' });

      const expenseId = 'test-expense-id';
      const mockExpense = {
        id: expenseId,
        status: 'APPROVED_STEP_2',
        tenantId: 'test-tenant-id',
        applicantSignatureType: 'signature',
        applicantSignatureData: 'data:image/png;base64,mock-signature-data',
        approvalLine: {
          id: 'approval-line-id',
          currentStep: 3,
          totalSteps: 3,
          steps: [
            {
              id: 'step-1',
              stepNumber: 1,
              stepName: '팀장',
              approverName: '김재정',
              status: 'APPROVED',
            },
            {
              id: 'step-2',
              stepNumber: 2,
              stepName: '회계',
              approverName: '박회계',
              status: 'APPROVED',
            },
            {
              id: 'step-3',
              stepNumber: 3,
              stepName: '재정팀장',
              approverName: '이재무',
              approverEmail: 'cfo@church.org',
              status: 'PENDING',
            },
          ],
        },
      };

      const mockUpdatedExpense = {
        ...mockExpense,
        status: 'APPROVED_FINAL',
        approvedAt: new Date(),
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          approvalStep: {
            update: vi.fn().mockResolvedValue({}),
          },
          approvalLine: {
            update: vi.fn().mockResolvedValue({}),
          },
          expense: {
            update: vi.fn().mockResolvedValue(mockUpdatedExpense),
          },
          approvalLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const request = new NextRequest('http://localhost/api/expenses/test-expense-id/approve', {
        method: 'POST',
        body: JSON.stringify({
          approverName: '이재무',
          comment: '최종 승인',
        }),
      });

      const params = Promise.resolve({ id: expenseId });
      const response = await approvePOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('최종 승인');
      expect(data.isComplete).toBe(true);
    });

    it('should return 403 if user is not the designated approver', async () => {
      // 결재선에 지정되지 않은 사용자로 설정
      setMockUser({ ...mockApprover, username: '다른사용자' });

      const expenseId = 'test-expense-id';
      const mockExpense = {
        id: expenseId,
        status: 'PENDING',
        tenantId: 'test-tenant-id',
        applicantSignatureType: 'signature',
        applicantSignatureData: 'data:image/png;base64,mock-signature-data',
        approvalLine: {
          id: 'approval-line-id',
          currentStep: 1,
          totalSteps: 2,
          steps: [
            {
              id: 'step-1',
              stepNumber: 1,
              stepName: '팀장',
              approverName: '김재정',
              status: 'PENDING',
            },
          ],
        },
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = new NextRequest('http://localhost/api/expenses/test-id/approve', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await approvePOST(request, { params });
      const data = await response.json();

      // 결재선에 지정된 승인자가 아니므로 403 반환
      expect(response.status).toBe(403);
      expect(data.error).toBeDefined();
    });

    it('should return 404 if expense not found', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/expenses/invalid-id/approve', {
        method: 'POST',
        body: JSON.stringify({ approverName: '김재정' }),
      });

      const params = Promise.resolve({ id: 'invalid-id' });
      const response = await approvePOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('찾을 수 없습니다');
    });

    it('should return 400 if approval line not created', async () => {
      const mockExpense = {
        id: 'test-id',
        status: 'DRAFT',
        tenantId: 'test-tenant-id',
        approvalLine: null,
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = new NextRequest('http://localhost/api/expenses/test-id/approve', {
        method: 'POST',
        body: JSON.stringify({ approverName: '김재정' }),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await approvePOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('결재선이 생성되지 않았습니다');
    });

    it('should return 400 if expense status is not approvable', async () => {
      const mockExpense = {
        id: 'test-id',
        status: 'APPROVED',
        tenantId: 'test-tenant-id',
        approvalLine: {
          id: 'approval-line-id',
          currentStep: 2,
          totalSteps: 2,
          steps: [],
        },
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = new NextRequest('http://localhost/api/expenses/test-id/approve', {
        method: 'POST',
        body: JSON.stringify({ approverName: '김재정' }),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await approvePOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('승인할 수 없는 상태');
    });

    it('should return 403 if approver is not the designated person', async () => {
      // 결재선에 지정되지 않은 사용자로 설정
      setMockUser({ ...mockApprover, username: '홍길동' });

      const mockExpense = {
        id: 'test-id',
        status: 'PENDING',
        tenantId: 'test-tenant-id',
        applicantSignatureType: 'signature',
        applicantSignatureData: 'data:image/png;base64,mock-signature-data',
        approvalLine: {
          id: 'approval-line-id',
          currentStep: 1,
          totalSteps: 2,
          steps: [
            {
              id: 'step-1',
              stepNumber: 1,
              stepName: '팀장',
              approverName: '김재정',
              status: 'PENDING',
            },
          ],
        },
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = new NextRequest('http://localhost/api/expenses/test-id/approve', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await approvePOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('김재정');
    });
  });

  // ========================================
  // POST /api/expenses/[id]/reject - 반려
  // ========================================
  describe('POST /api/expenses/[id]/reject', () => {
    // 반려 테스트용 사용자 (결재선의 approverName과 일치해야 함)
    const mockRejecter = {
      ...mockUser,
      id: 'rejecter-1',
      userid: 'rejecter',
      username: '김재정', // 결재선의 1단계 승인자 이름과 일치
    };

    it('should reject expense successfully', async () => {
      // 결재선의 1단계 승인자로 설정
      setMockUser(mockRejecter);

      const expenseId = 'test-expense-id';
      const mockExpense = {
        id: expenseId,
        status: 'PENDING',
        tenantId: 'test-tenant-id',
        approvalLine: {
          id: 'approval-line-id',
          currentStep: 1,
          totalSteps: 2,
          steps: [
            {
              id: 'step-1',
              stepNumber: 1,
              stepName: '팀장',
              approverName: '김재정',
              approverEmail: 'manager@church.org',
              status: 'PENDING',
            },
          ],
        },
      };

      const mockUpdatedExpense = {
        ...mockExpense,
        status: 'REJECTED',
        rejectedAt: new Date(),
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          approvalStep: {
            update: vi.fn().mockResolvedValue({}),
          },
          expense: {
            update: vi.fn().mockResolvedValue(mockUpdatedExpense),
          },
          approvalLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const request = new NextRequest('http://localhost/api/expenses/test-expense-id/reject', {
        method: 'POST',
        body: JSON.stringify({
          approverName: '김재정',
          comment: '예산 초과로 반려합니다',
        }),
      });

      const params = Promise.resolve({ id: expenseId });
      const response = await rejectPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('반려되었습니다');
    });

    it('should return 403 if user is not the designated approver for rejection', async () => {
      // 결재선에 지정되지 않은 사용자로 설정
      setMockUser({ ...mockRejecter, username: '다른사용자' });

      const expenseId = 'test-expense-id';
      const mockExpense = {
        id: expenseId,
        status: 'PENDING',
        tenantId: 'test-tenant-id',
        approvalLine: {
          id: 'approval-line-id',
          currentStep: 1,
          totalSteps: 2,
          steps: [
            {
              id: 'step-1',
              stepNumber: 1,
              stepName: '팀장',
              approverName: '김재정',
              status: 'PENDING',
            },
          ],
        },
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = new NextRequest('http://localhost/api/expenses/test-id/reject', {
        method: 'POST',
        body: JSON.stringify({ comment: '반려 사유' }),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await rejectPOST(request, { params });
      const data = await response.json();

      // 결재선에 지정된 승인자가 아니므로 403 반환
      expect(response.status).toBe(403);
      expect(data.error).toBeDefined();
    });

    it('should return 400 if comment not provided', async () => {
      const request = new NextRequest('http://localhost/api/expenses/test-id/reject', {
        method: 'POST',
        body: JSON.stringify({ approverName: '김재정' }),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await rejectPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('반려 사유를 입력해주세요');
    });

    it('should return 400 if comment is empty string', async () => {
      const request = new NextRequest('http://localhost/api/expenses/test-id/reject', {
        method: 'POST',
        body: JSON.stringify({ approverName: '김재정', comment: '   ' }),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await rejectPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('반려 사유를 입력해주세요');
    });
  });

  // ========================================
  // POST /api/expenses/[id]/withdraw - 회수
  // ========================================
  describe('POST /api/expenses/[id]/withdraw', () => {
    // 회수 테스트용 사용자 (지출결의서의 applicantName과 일치해야 함)
    const mockApplicant = {
      ...mockUser,
      id: 'applicant-1',
      userid: 'applicant',
      username: '홍길동', // 지출결의서의 작성자 이름과 일치
    };

    it('should withdraw expense successfully from PENDING status', async () => {
      // 작성자로 설정
      setMockUser(mockApplicant);

      const expenseId = 'test-expense-id';
      const mockExpense = {
        id: expenseId,
        status: 'PENDING',
        applicantName: '홍길동',
        tenantId: 'test-tenant-id',
        approvalLine: {
          id: 'approval-line-id',
          currentStep: 1,
          totalSteps: 2,
          steps: [
            {
              id: 'step-1',
              stepNumber: 1,
              status: 'PENDING',
            },
          ],
        },
      };

      const mockUpdatedExpense = {
        ...mockExpense,
        status: 'WITHDRAWN',
        submittedAt: null,
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          expense: {
            update: vi.fn().mockResolvedValue(mockUpdatedExpense),
          },
          approvalStep: {
            updateMany: vi.fn().mockResolvedValue({}),
          },
          approvalLine: {
            update: vi.fn().mockResolvedValue({}),
          },
          approvalLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const request = new NextRequest('http://localhost/api/expenses/test-expense-id/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          applicantName: '홍길동',
          comment: '내용 수정이 필요하여 회수합니다',
        }),
      });

      const params = Promise.resolve({ id: expenseId });
      const response = await withdrawPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('회수되었습니다');
    });

    it('should withdraw expense successfully from APPROVED_STEP_1 status', async () => {
      // 작성자로 설정
      setMockUser(mockApplicant);

      const expenseId = 'test-expense-id';
      const mockExpense = {
        id: expenseId,
        status: 'APPROVED_STEP_1',
        applicantName: '홍길동',
        tenantId: 'test-tenant-id',
        approvalLine: {
          id: 'approval-line-id',
          currentStep: 2,
          totalSteps: 3,
          steps: [],
        },
      };

      const mockUpdatedExpense = {
        ...mockExpense,
        status: 'WITHDRAWN',
        submittedAt: null,
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          expense: {
            update: vi.fn().mockResolvedValue(mockUpdatedExpense),
          },
          approvalStep: {
            updateMany: vi.fn().mockResolvedValue({}),
          },
          approvalLine: {
            update: vi.fn().mockResolvedValue({}),
          },
          approvalLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const request = new NextRequest('http://localhost/api/expenses/test-expense-id/withdraw', {
        method: 'POST',
        body: JSON.stringify({ applicantName: '홍길동' }),
      });

      const params = Promise.resolve({ id: expenseId });
      const response = await withdrawPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 403 if user is not the applicant', async () => {
      // 다른 사용자로 설정
      setMockUser({ ...mockApplicant, username: '다른사용자' });

      const expenseId = 'test-expense-id';
      const mockExpense = {
        id: expenseId,
        status: 'PENDING',
        applicantName: '홍길동',
        tenantId: 'test-tenant-id',
        approvalLine: { id: 'approval-line-id', steps: [] },
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = new NextRequest('http://localhost/api/expenses/test-id/withdraw', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await withdrawPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('작성자만 회수할 수 있습니다');
    });

    it('should return 404 if expense not found', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/expenses/invalid-id/withdraw', {
        method: 'POST',
        body: JSON.stringify({ applicantName: '홍길동' }),
      });

      const params = Promise.resolve({ id: 'invalid-id' });
      const response = await withdrawPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('찾을 수 없습니다');
    });

    it('should return 400 if expense status is not withdrawable', async () => {
      // 작성자로 설정
      setMockUser(mockApplicant);
      const mockExpense = {
        id: 'test-id',
        status: 'APPROVED', // 승인 완료된 문서는 회수 불가
        applicantName: '홍길동',
        tenantId: 'test-tenant-id',
        approvalLine: { id: 'approval-line-id', steps: [] },
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = new NextRequest('http://localhost/api/expenses/test-id/withdraw', {
        method: 'POST',
        body: JSON.stringify({ applicantName: '홍길동' }),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await withdrawPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('회수할 수 없는 상태');
    });
  });

  // ========================================
  // GET /api/expenses/[id]/approval - 결재선 조회
  // ========================================
  describe('GET /api/expenses/[id]/approval', () => {
    it('should get approval line successfully', async () => {
      const expenseId = 'test-expense-id';
      const mockExpense = {
        id: expenseId,
        status: 'PENDING',
        applicantName: '홍길동',
        requestAmount: 300000,
        submittedAt: new Date(),
        approvedAt: null,
        rejectedAt: null,
        tenantId: 'test-tenant-id',
        approvalLine: {
          id: 'approval-line-id',
          currentStep: 1,
          totalSteps: 2,
          steps: [
            {
              id: 'step-1',
              stepNumber: 1,
              stepName: '팀장',
              approverName: '김재정',
              status: 'PENDING',
            },
            {
              id: 'step-2',
              stepNumber: 2,
              stepName: '회계',
              approverName: '박회계',
              status: 'PENDING',
            },
          ],
        },
      };

      const mockLogs = [
        {
          id: 'log-1',
          action: 'SUBMIT',
          actorName: '홍길동',
          createdAt: new Date(),
        },
      ];

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.approvalLog.findMany.mockResolvedValue(mockLogs);

      const request = new NextRequest('http://localhost/api/expenses/test-expense-id/approval', {
        method: 'GET',
      });

      const params = Promise.resolve({ id: expenseId });
      const response = await approvalGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.expense).toBeTruthy();
      expect(data.approvalLine).toBeTruthy();
      expect(data.logs).toHaveLength(1);
      expect(mockPrisma.approvalLog.findMany).toHaveBeenCalledWith({
        where: { expenseId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return 404 if expense not found', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/expenses/invalid-id/approval', {
        method: 'GET',
      });

      const params = Promise.resolve({ id: 'invalid-id' });
      const response = await approvalGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('찾을 수 없습니다');
    });
  });

  // ========================================
  // PUT /api/expenses/[id]/approval - 결재선 수정
  // ========================================
  describe('PUT /api/expenses/[id]/approval', () => {
    // 결재선 수정 테스트용 사용자 (지출결의서의 applicantName과 일치해야 함)
    const mockApprovalLineModifier = {
      ...mockUser,
      id: 'modifier-1',
      userid: 'modifier',
      username: '홍길동', // 지출결의서의 작성자 이름과 일치
    };

    it('should modify approval line successfully in DRAFT status', async () => {
      // 작성자로 설정
      setMockUser(mockApprovalLineModifier);

      const expenseId = 'test-expense-id';
      const mockExpense = {
        id: expenseId,
        status: 'DRAFT',
        applicantName: '홍길동',
        tenantId: 'test-tenant-id',
        approvalLine: null,
      };

      const newSteps = [
        {
          stepNumber: 1,
          stepName: '팀장',
          approverName: '김재정',
          approverEmail: 'manager@church.org',
          approverTitle: '팀장',
          isRequired: true,
          isParallel: false,
        },
        {
          stepNumber: 2,
          stepName: '회계',
          approverName: '박회계',
          approverEmail: 'accountant@church.org',
          approverTitle: '회계',
          isRequired: true,
          isParallel: false,
        },
      ];

      const mockNewApprovalLine = {
        id: 'new-approval-line-id',
        currentStep: 1,
        totalSteps: 2,
        steps: newSteps.map((step, idx) => ({
          id: `step-${idx + 1}`,
          ...step,
          status: 'PENDING',
        })),
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          approvalLine: {
            create: vi.fn().mockResolvedValue(mockNewApprovalLine),
          },
          approvalLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const request = new NextRequest('http://localhost/api/expenses/test-expense-id/approval', {
        method: 'PUT',
        body: JSON.stringify({
          actorName: '홍길동',
          steps: newSteps,
        }),
      });

      const params = Promise.resolve({ id: expenseId });
      const response = await approvalPUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('결재선이 수정되었습니다');
    });

    it('should return 400 if steps not provided', async () => {
      const request = new NextRequest('http://localhost/api/expenses/test-id/approval', {
        method: 'PUT',
        body: JSON.stringify({ actorName: '홍길동' }),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await approvalPUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('결재 단계 정보가 필요합니다');
    });

    it('should return 400 if steps is empty array', async () => {
      const request = new NextRequest('http://localhost/api/expenses/test-id/approval', {
        method: 'PUT',
        body: JSON.stringify({ actorName: '홍길동', steps: [] }),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await approvalPUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('결재 단계 정보가 필요합니다');
    });

    it('should return 403 if status is not DRAFT', async () => {
      const mockExpense = {
        id: 'test-id',
        status: 'PENDING',
        applicantName: '홍길동',
        tenantId: 'test-tenant-id',
        approvalLine: { id: 'approval-line-id', steps: [] },
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = new NextRequest('http://localhost/api/expenses/test-id/approval', {
        method: 'PUT',
        body: JSON.stringify({
          actorName: '홍길동',
          steps: [
            {
              stepNumber: 1,
              stepName: '팀장',
              approverName: '김재정',
              isRequired: true,
            },
          ],
        }),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await approvalPUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('제출 후에는 결재선을 수정할 수 없습니다');
    });

    it('should return 403 if actor is not the applicant', async () => {
      const mockExpense = {
        id: 'test-id',
        status: 'DRAFT',
        applicantName: '홍길동',
        tenantId: 'test-tenant-id',
        approvalLine: null,
      };

      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = new NextRequest('http://localhost/api/expenses/test-id/approval', {
        method: 'PUT',
        body: JSON.stringify({
          actorName: '김철수', // 다른 사람
          steps: [
            {
              stepNumber: 1,
              stepName: '팀장',
              approverName: '김재정',
              isRequired: true,
            },
          ],
        }),
      });

      const params = Promise.resolve({ id: 'test-id' });
      const response = await approvalPUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('작성자만 결재선을 수정할 수 있습니다');
    });
  });
});
