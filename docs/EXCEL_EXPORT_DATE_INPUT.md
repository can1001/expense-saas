# 엑셀 다운로드 시 지출일자 입력 기능

## 개요

지출결의서 목록 페이지(`/expenses`)에서 엑셀 다운로드 시 사용자가 지출일자를 직접 입력할 수 있도록 기능을 추가합니다.

---

## 현재 동작

### 기존 로직
- 엑셀의 "날짜" 컬럼에는 `expenseDate`(지출일자)가 있으면 사용, 없으면 `requestDate`(청구일자) 사용
- 사용자가 날짜를 수정할 수 없음

### 문제점
- 지출결의서 작성 시 `expenseDate`가 비어 있는 경우가 많음
- 웹 교적 시스템에 업로드할 때 실제 지출일자가 필요한 경우가 있음

---

## 요구사항

1. 엑셀 다운로드 버튼 클릭 시 날짜 입력 모달/팝업 표시
2. 사용자가 지출일자를 선택 또는 입력
3. 입력된 날짜가 엑셀의 모든 항목에 적용됨

---

## 구현 방안

### UI 설계

#### Option A: 모달 다이얼로그
```
┌─────────────────────────────────────┐
│   엑셀 다운로드                      │
├─────────────────────────────────────┤
│                                     │
│   지출일자: [2025-12-28    📅]      │
│                                     │
│   ☐ 모든 항목에 동일 날짜 적용       │
│   ☑ 각 항목의 기존 날짜 유지         │
│                                     │
├─────────────────────────────────────┤
│          [취소]  [다운로드]          │
└─────────────────────────────────────┘
```

#### Option B: 인라인 날짜 선택 (간단 버전)
```
[엑셀 다운로드 ▼]
  └─ 📅 지출일자: [2025-12-28] [다운로드]
```

### 선택: Option A (모달 다이얼로그)
- 더 명확한 UX 제공
- 추가 옵션 확장 가능성

---

## 상세 설계

### 1. 새로운 State 추가

```typescript
// app/expenses/page.tsx
const [showExportModal, setShowExportModal] = useState(false);
const [exportDate, setExportDate] = useState<string>('');
const [useSameDate, setUseSameDate] = useState(true);
```

### 2. 모달 컴포넌트 생성

```typescript
// components/ExcelExportModal.tsx
interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (date: string | null, useSameDate: boolean) => void;
  selectedCount: number;
}
```

### 3. API 파라미터 확장

```
GET /api/expenses/export/excel
  Query params:
  - ids: 지출결의서 ID 목록
  - status: 상태 필터
  - expenseDate: 사용자 지정 지출일자 (YYYY-MM-DD)
  - useSameDate: true면 모든 항목에 expenseDate 적용
```

### 4. 엑셀 생성 로직 수정

```typescript
// lib/excel-export.ts
export function expenseToExcelRows(
  expense: ExpenseForExcel,
  overrideDate?: Date  // 사용자 지정 날짜
): ExcelRow[] {
  const rows: ExcelRow[] = [];
  const date = overrideDate || expense.expenseDate || expense.requestDate;
  // ...
}
```

---

## 구현 순서

1. [ ] `components/ExcelExportModal.tsx` 컴포넌트 생성
2. [ ] `app/expenses/page.tsx`에 모달 State 및 핸들러 추가
3. [ ] `/api/expenses/export/excel` API에 `expenseDate` 파라미터 처리 추가
4. [ ] `lib/excel-export.ts`에 날짜 오버라이드 로직 추가
5. [ ] 테스트

---

## 컴포넌트 상세

### ExcelExportModal.tsx

```typescript
'use client';

import { useState } from 'react';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: { date: string | null; useSameDate: boolean }) => void;
  selectedCount: number;
  isExporting: boolean;
}

export function ExcelExportModal({
  isOpen,
  onClose,
  onExport,
  selectedCount,
  isExporting,
}: ExcelExportModalProps) {
  const [date, setDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [useSameDate, setUseSameDate] = useState(true);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport({
      date: useSameDate ? date : null,
      useSameDate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">
          엑셀 다운로드
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          {selectedCount}건의 지출결의서를 내보냅니다.
        </p>

        {/* 날짜 옵션 */}
        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={useSameDate}
              onChange={() => setUseSameDate(true)}
            />
            <span>모든 항목에 동일 날짜 적용</span>
          </label>

          {useSameDate && (
            <div className="ml-6">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border rounded px-3 py-2"
              />
            </div>
          )}

          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!useSameDate}
              onChange={() => setUseSameDate(false)}
            />
            <span>각 항목의 기존 날짜 유지</span>
          </label>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            disabled={isExporting}
          >
            취소
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            disabled={isExporting}
          >
            {isExporting ? '다운로드 중...' : '다운로드'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## API 수정

### /api/expenses/export/excel/route.ts

```typescript
// 추가 쿼리 파라미터
const expenseDateParam = searchParams.get('expenseDate');
const useSameDateParam = searchParams.get('useSameDate');

// 사용자 지정 날짜
const overrideDate = expenseDateParam ? new Date(expenseDateParam) : undefined;
const useSameDate = useSameDateParam === 'true';

// 엑셀 생성 시 날짜 전달
const buffer = generateExcelBuffer(expensesForExcel, useSameDate ? overrideDate : undefined);
```

---

## 예상 결과

### 시나리오 1: 모든 항목에 동일 날짜 적용
- 사용자가 2025-12-28 선택
- 엑셀의 모든 행의 "날짜" 컬럼에 2025-12-28 적용

### 시나리오 2: 기존 날짜 유지
- 각 지출결의서의 expenseDate 또는 requestDate 사용
- 현재 동작과 동일

---

## 테스트 시나리오

1. 지출결의서 3건 선택 후 엑셀 다운로드 클릭
2. 모달에서 "모든 항목에 동일 날짜 적용" 선택
3. 날짜를 2025-12-28로 설정
4. 다운로드 클릭
5. 엑셀 파일 확인 - 모든 행의 날짜가 2025-12-28인지 확인

---

## 참고

- 기존 문서: `docs/EXCEL_EXPORT_SPEC.md`
- 관련 파일:
  - `app/expenses/page.tsx`
  - `app/api/expenses/export/excel/route.ts`
  - `lib/excel-export.ts`
