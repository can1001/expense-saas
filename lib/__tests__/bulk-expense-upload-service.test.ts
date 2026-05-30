/**
 * 지출결의서 일괄 업로드 서비스 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import {
  parseExpenseExcelBuffer,
  validateRows,
  groupRows,
  executeBulkUpload,
  parseDate,
  type ExcelRow,
} from '../services/bulk-expense-upload-service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn() },
    expense: { create: vi.fn() },
    $transaction: vi.fn(),
    budgetDetail: { findFirst: vi.fn() },
    departmentBudgetDetail: { findFirst: vi.fn() },
  },
}));

vi.mock('../services/budget-lookup-service', () => ({
  lookupBudgetHierarchy: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { lookupBudgetHierarchy } from '../services/budget-lookup-service';

const mockLookup = vi.mocked(lookupBudgetHierarchy);
const mockUserFindMany = vi.mocked(prisma.user.findMany);
const mockTransaction = vi.mocked(prisma.$transaction);

/** 테스트용 행 ‐ 모든 필수 필드 기본값 채운 헬퍼 */
function makeRow(overrides: Partial<ExcelRow> = {}): ExcelRow {
  return {
    committee: '교육위원회',
    department: '기획팀',
    budgetCategory: '사역지원비',
    budgetSubcategory: '기획비',
    budgetDetail: '아웃팅비',
    description: '회의 후 식사',
    unitPrice: 10000,
    quantity: 5,
    requestDate: '2026-05-15',
    applicantName: '홍길동',
    bankName: '우리은행',
    accountNumber: '1002-123-456789',
    accountHolder: '홍길동',
    ...overrides,
  };
}

describe('parseDate', () => {
  it('문자열을 Date로 파싱한다', () => {
    const d = parseDate('2026-05-15');
    expect(d).toBeInstanceOf(Date);
    expect(d?.getUTCFullYear()).toBe(2026);
  });

  it('Date 객체는 그대로 반환한다', () => {
    const input = new Date('2026-05-15');
    expect(parseDate(input)).toBe(input);
  });

  it('Excel 시리얼(숫자)을 Date로 파싱한다', () => {
    // Excel 시리얼 45797 = 2025-05-15 부근 (1899-12-30 기준)
    const d = parseDate(45797);
    expect(d).toBeInstanceOf(Date);
  });

  it('null/undefined/빈문자열은 null 반환', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('')).toBeNull();
  });

  it('파싱 불가 문자열은 null 반환', () => {
    expect(parseDate('not-a-date')).toBeNull();
  });
});

describe('validateRows', () => {
  it('정상 행은 에러 없음', () => {
    const errors = validateRows([makeRow()]);
    expect(errors).toEqual([]);
  });

  it('필수 컬럼 누락 시 에러 (행번호=2부터)', () => {
    const errors = validateRows([makeRow({ budgetCategory: undefined, description: undefined })]);
    expect(errors).toHaveLength(2);
    expect(errors[0].rowNumber).toBe(2);
    expect(errors.map((e) => e.field)).toEqual(expect.arrayContaining(['budgetCategory', 'description']));
  });

  it('위원회/사역팀 누락 시 에러', () => {
    const errors = validateRows([makeRow({ committee: undefined, department: undefined })]);
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.field)).toEqual(expect.arrayContaining(['committee', 'department']));
  });

  it('unitPrice가 0 이하면 에러', () => {
    const errors = validateRows([makeRow({ unitPrice: 0 }), makeRow({ unitPrice: -100 })]);
    expect(errors).toHaveLength(2);
    expect(errors[0].field).toBe('unitPrice');
    expect(errors[1].rowNumber).toBe(3);
  });

  it('quantity가 0 이하면 에러', () => {
    const errors = validateRows([makeRow({ quantity: 0 })]);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('quantity');
  });

  it('requestDate 파싱 실패 시 에러', () => {
    const errors = validateRows([makeRow({ requestDate: 'invalid-date' })]);
    expect(errors.some((e) => e.field === 'requestDate')).toBe(true);
  });

  it('expenseDate 파싱 실패 시 에러 (선택 필드여도 값 있으면 검사)', () => {
    const errors = validateRows([makeRow({ expenseDate: 'invalid' })]);
    expect(errors.some((e) => e.field === 'expenseDate')).toBe(true);
  });

  it('여러 행의 에러는 각 rowNumber로 분리', () => {
    const errors = validateRows([
      makeRow(),
      makeRow({ bankName: undefined }),
      makeRow({ accountHolder: undefined }),
    ]);
    expect(errors).toHaveLength(2);
    expect(errors[0].rowNumber).toBe(3);
    expect(errors[1].rowNumber).toBe(4);
  });
});

describe('groupRows', () => {
  it('groupId 동일하면 한 그룹으로 묶임', () => {
    const groups = groupRows([
      makeRow({ groupId: 1, description: 'A' }),
      makeRow({ groupId: 1, description: 'B' }),
      makeRow({ groupId: 2, description: 'C' }),
    ]);
    expect(groups.size).toBe(2);
    expect(groups.get('1')).toHaveLength(2);
    expect(groups.get('2')).toHaveLength(1);
  });

  it('groupId 없으면 각 행이 별도 그룹', () => {
    const groups = groupRows([makeRow(), makeRow(), makeRow()]);
    expect(groups.size).toBe(3);
  });

  it('groupId 숫자/문자열 혼합도 같은 키로 처리', () => {
    const groups = groupRows([
      makeRow({ groupId: 1 }),
      makeRow({ groupId: '1' }),
    ]);
    expect(groups.size).toBe(1);
    expect(groups.get('1')).toHaveLength(2);
  });
});

describe('executeBulkUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookup.mockResolvedValue({
      committee: '교육위원회',
      department: '기획팀',
      budgetCategory: '사역지원비',
      budgetSubcategory: '기획비',
      budgetDetailId: 'bd-1',
    });
    mockUserFindMany.mockResolvedValue([
      { id: 'user-1', username: '홍길동' },
    ] as never);
  });

  it('dry-run: DB 변경 없이 preview/errors 반환', async () => {
    const result = await executeBulkUpload([makeRow(), makeRow({ groupId: 2 })], { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.preview).toHaveLength(2);
    expect(result.totalExpenses).toBe(2);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('dry-run: preview에 committee/department/금액 정확히 채워짐', async () => {
    const result = await executeBulkUpload([makeRow()], { dryRun: true });
    expect(result.preview![0]).toMatchObject({
      committee: '교육위원회',
      department: '기획팀',
      applicantName: '홍길동',
      itemsCount: 1,
      requestAmount: 50000,
    });
  });

  it('예산 조회 실패 → budgetError', async () => {
    mockLookup.mockResolvedValue(null);
    const result = await executeBulkUpload([makeRow()], { dryRun: true });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('예산 정보를 찾을 수 없습니다');
  });

  it('청구인 매칭 실패 → 에러 (admin 폴백 없음)', async () => {
    mockUserFindMany.mockResolvedValue([]);
    const result = await executeBulkUpload([makeRow({ applicantName: '없는사람' })], { dryRun: true });
    expect(result.errors.some((e) => e.field === 'applicantName')).toBe(true);
    expect(result.errors[0].message).toContain('없는사람');
  });

  it('입력 위원회가 자동 도출과 다르면 교차 검증 에러', async () => {
    const result = await executeBulkUpload(
      [makeRow({ committee: '오타위원회' })],
      { dryRun: true }
    );
    expect(result.errors.some((e) => e.field === 'committee')).toBe(true);
    expect(result.errors[0].message).toContain('오타위원회');
    expect(result.errors[0].message).toContain('교육위원회');
  });

  it('입력 사역팀이 자동 도출과 다르면 교차 검증 에러', async () => {
    const result = await executeBulkUpload(
      [makeRow({ department: '다른부서' })],
      { dryRun: true }
    );
    expect(result.errors.some((e) => e.field === 'department')).toBe(true);
    expect(result.errors[0].message).toContain('다른부서');
  });

  it('입력 위원회/사역팀이 자동 도출과 일치하면 통과', async () => {
    const result = await executeBulkUpload(
      [makeRow({ committee: '교육위원회', department: '기획팀' })],
      { dryRun: true }
    );
    expect(result.errors).toEqual([]);
    expect(result.preview).toHaveLength(1);
  });

  it('commit: 정상 트랜잭션으로 생성 → createdIds 반환', async () => {
    mockTransaction.mockImplementation(async (cb: unknown) => {
      const tx = {
        expense: {
          create: vi.fn()
            .mockResolvedValueOnce({ id: 'exp-1' })
            .mockResolvedValueOnce({ id: 'exp-2' }),
        },
      };
      return (cb as (tx: unknown) => Promise<unknown>)(tx);
    });

    const result = await executeBulkUpload(
      [makeRow(), makeRow({ groupId: 2 })],
      { dryRun: false }
    );

    expect(result.errors).toEqual([]);
    expect(result.createdIds).toEqual(['exp-1', 'exp-2']);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('commit: 에러 있으면 트랜잭션 진입조차 안 함', async () => {
    mockLookup.mockResolvedValue(null);
    const result = await executeBulkUpload([makeRow()], { dryRun: false });
    expect(result.createdIds).toBeUndefined();
    expect(result.errors).toHaveLength(1);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('commit: 트랜잭션 내 1건 실패 시 전체 throw (롤백)', async () => {
    mockTransaction.mockImplementation(async (cb: unknown) => {
      const tx = {
        expense: {
          create: vi.fn()
            .mockResolvedValueOnce({ id: 'exp-1' })
            .mockRejectedValueOnce(new Error('DB 제약 위반')),
        },
      };
      return (cb as (tx: unknown) => Promise<unknown>)(tx);
    });

    await expect(
      executeBulkUpload([makeRow(), makeRow({ groupId: 2 })], { dryRun: false })
    ).rejects.toThrow('DB 제약 위반');
  });

  it('groupId 동일한 여러 행 → 1개 expense + 여러 items', async () => {
    let capturedData: { items: { create: unknown[] } } | undefined;
    mockTransaction.mockImplementation(async (cb: unknown) => {
      const tx = {
        expense: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            capturedData = data;
            return { id: 'exp-1' };
          }),
        },
      };
      return (cb as (tx: unknown) => Promise<unknown>)(tx);
    });

    await executeBulkUpload(
      [
        makeRow({ groupId: 1, description: 'A', unitPrice: 1000, quantity: 2 }),
        makeRow({ groupId: 1, description: 'B', unitPrice: 500, quantity: 3 }),
      ],
      { dryRun: false }
    );

    expect((capturedData!.items.create as unknown[]).length).toBe(2);
  });
});

describe('parseExpenseExcelBuffer', () => {
  async function makeBuffer(headers: string[], rows: unknown[][]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(headers);
    rows.forEach((r) => ws.addRow(r));
    const ab = await wb.xlsx.writeBuffer();
    return Buffer.from(ab as ArrayBuffer);
  }

  it('헤더와 데이터 행을 읽어 ExcelRow 배열 반환', async () => {
    const buf = await makeBuffer(
      ['committee', 'department', 'budgetCategory', 'budgetSubcategory', 'budgetDetail', 'description', 'unitPrice', 'quantity', 'requestDate', 'applicantName', 'bankName', 'accountNumber', 'accountHolder'],
      [['교육위원회', '기획팀', '사역지원비', '기획비', '아웃팅비', '회의 후 식사', 10000, 5, '2026-05-15', '홍길동', '우리은행', '1002-123-456789', '홍길동']]
    );
    const rows = await parseExpenseExcelBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].budgetCategory).toBe('사역지원비');
    expect(rows[0].committee).toBe('교육위원회');
    expect(rows[0].unitPrice).toBe(10000);
  });

  it('빈 행은 건너뛴다', async () => {
    const buf = await makeBuffer(
      ['budgetCategory', 'budgetSubcategory'],
      [['A', 'B'], [null, null], ['', ''], ['C', 'D']]
    );
    const rows = await parseExpenseExcelBuffer(buf);
    expect(rows).toHaveLength(2);
  });

  it('정식 헤더만 매칭 (오타/대소문자/위험 키 무시)', async () => {
    const buf = await makeBuffer(
      ['BudgetCategory', 'unitPrice', '__proto__'],
      [['ignored', 999, 'attack']]
    );
    const rows = await parseExpenseExcelBuffer(buf);
    // 대소문자 다른 키는 매칭 안 됨
    expect(rows[0].budgetCategory).toBeUndefined();
    // 정식 키는 매칭
    expect(rows[0].unitPrice).toBe(999);
    // 프로토타입 오염 방지 — __proto__ 헤더는 무시되어 Object.prototype 영향 없음
    expect(({} as Record<string, unknown>).__proto__).not.toBe('attack');
  });
});
