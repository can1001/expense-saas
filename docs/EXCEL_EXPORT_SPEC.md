# 지출결의서 엑셀 다운로드 기능 명세

## 개요

웹 교적 시스템에 지출 내역을 등록하기 위한 엑셀 양식 다운로드 기능입니다.
"지출재정" 탭 형식에 맞춰 지출결의서 데이터를 엑셀로 내보냅니다.

---

## 엑셀 양식 구조

### 컬럼 정의

| 순서 | 컬럼명 | 필수 | 설명 | 매핑 |
|------|--------|------|------|------|
| A | 항 | O | 예산 항목 (대분류) | `budgetCategory` |
| B | 목 | O | 예산 목 (중분류) | `budgetSubcategory` |
| C | 세목 | O | 예산 세목 (소분류) | `ExpenseItem.budgetDetail` |
| D | 세세목 | - | 세세목 (선택) | 빈값 또는 `description`에서 추출 |
| E | 지급방법 | - | 지급 방식 | 고정값: "이체" |
| F | 예금주 | O | 계좌 예금주 | `accountHolder` |
| G | 은행 | O | 은행명 | `bankName` |
| H | 계좌번호 | O | 계좌번호 | `accountNumber` |
| I | 금액 | O | 지출 금액 | `ExpenseItem.amount` |
| J | 날짜 | O | 지출 일자 | `expenseDate` 또는 `requestDate` |
| K | 메모 | - | 적요/비고 | `ExpenseItem.description` |

### 예시 데이터

```
항          목            세목          세세목    지급방법    예금주      은행    계좌번호        금액      날짜        메모
예배비      강사사례비    강사사례비              헌금        홍길동      우리    123-45-6789     100000    2011.9.26   세미나
구입비C     사무용품C     품목1C                                                                  20000     2011.9.26   프린트종이1박스
```

---

## 데이터 매핑

### 지출결의서 → 엑셀 매핑

| 엑셀 컬럼 | Expense 필드 | ExpenseItem 필드 | 변환 규칙 |
|-----------|--------------|------------------|-----------|
| 항 | `budgetCategory` | - | 그대로 사용 |
| 목 | `budgetSubcategory` | - | 그대로 사용 |
| 세목 | - | `budgetDetail` | 그대로 사용 |
| 세세목 | - | - | 빈값 |
| 지급방법 | - | - | "이체" (고정) |
| 예금주 | `accountHolder` | - | 그대로 사용 |
| 은행 | `bankName` | - | 그대로 사용 |
| 계좌번호 | `accountNumber` | - | 그대로 사용 |
| 금액 | - | `amount` | 숫자 형식 |
| 날짜 | `expenseDate` / `requestDate` | - | YYYY.M.D 형식 |
| 메모 | - | `description` | 그대로 사용 |

### 날짜 형식 변환

```typescript
// 입력: 2025-12-28T00:00:00.000Z
// 출력: 2025.12.28
function formatDateForExcel(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}.${month}.${day}`;
}
```

---

## 구현 방안

### 1. 라이브러리 선택

**추천: `xlsx` (SheetJS)**
```bash
npm install xlsx
```

또는 **`exceljs`**
```bash
npm install exceljs
```

### 2. API 엔드포인트

```
GET /api/expenses/export/excel
  - Query params:
    - ids: 내보낼 지출결의서 ID 목록 (쉼표 구분)
    - status: 상태 필터 (APPROVED_FINAL만 내보내기 등)
    - startDate: 시작일
    - endDate: 종료일
```

### 3. 클라이언트 구현

```typescript
// 엑셀 다운로드 버튼 클릭 핸들러
async function handleExportExcel(expenseIds: string[]) {
  const response = await fetch(
    `/api/expenses/export/excel?ids=${expenseIds.join(',')}`
  );

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `지출재정_${formatDate(new Date())}.xlsx`;
  a.click();
}
```

---

## 엑셀 생성 로직

### 서버 사이드 코드 (예시)

```typescript
import * as XLSX from 'xlsx';

interface ExcelRow {
  항: string;
  목: string;
  세목: string;
  세세목: string;
  지급방법: string;
  예금주: string;
  은행: string;
  계좌번호: string;
  금액: number;
  날짜: string;
  메모: string;
}

function generateExcel(expenses: ExpenseWithItems[]): Buffer {
  const rows: ExcelRow[] = [];

  for (const expense of expenses) {
    for (const item of expense.items) {
      rows.push({
        항: expense.budgetCategory,
        목: expense.budgetSubcategory,
        세목: item.budgetDetail,
        세세목: '',
        지급방법: '이체',
        예금주: expense.accountHolder,
        은행: expense.bankName,
        계좌번호: expense.accountNumber,
        금액: item.amount,
        날짜: formatDateForExcel(expense.expenseDate || expense.requestDate),
        메모: item.description,
      });
    }
  }

  // 워크북 생성
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // 컬럼 너비 설정
  worksheet['!cols'] = [
    { wch: 15 },  // 항
    { wch: 15 },  // 목
    { wch: 15 },  // 세목
    { wch: 10 },  // 세세목
    { wch: 10 },  // 지급방법
    { wch: 10 },  // 예금주
    { wch: 10 },  // 은행
    { wch: 15 },  // 계좌번호
    { wch: 12 },  // 금액
    { wch: 12 },  // 날짜
    { wch: 30 },  // 메모
  ];

  // "지출재정" 시트로 추가
  XLSX.utils.book_append_sheet(workbook, worksheet, '지출재정');

  // Buffer로 반환
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
```

---

## UI 위치

### 1. 지출결의서 목록 페이지 (`/expenses`)

- 체크박스로 여러 건 선택 후 "엑셀 다운로드" 버튼
- 전체 선택 기능

```
[체크] | 번호 | 청구인 | 금액 | 상태 | 날짜
[x]   | 001  | 홍길동 | 100,000 | 최종승인 | 2025.12.28
[x]   | 002  | 김철수 | 50,000  | 최종승인 | 2025.12.27

[엑셀 다운로드] 버튼
```

### 2. 지출결의서 상세 페이지 (`/expenses/[id]`)

- 개별 지출결의서에 "엑셀 다운로드" 버튼 추가

### 3. 결재함 페이지 (`/approvals`)

- 최종 승인된 건만 필터링하여 다운로드

---

## 필터 옵션

### 다운로드 대상 조건

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| 상태 | APPROVED_FINAL만 내보내기 | true |
| 기간 | 특정 기간 내 지출결의서 | 전체 |
| 위원회 | 특정 위원회만 | 전체 |
| 부서 | 특정 부서만 | 전체 |

---

## 파일명 규칙

```
지출재정_{시작일}_{종료일}.xlsx
지출재정_2025-12-01_2025-12-31.xlsx

// 단건인 경우
지출재정_{청구인}_{청구일}.xlsx
지출재정_홍길동_2025-12-28.xlsx
```

---

## 구현 순서

1. [ ] `xlsx` 또는 `exceljs` 패키지 설치
2. [ ] `/api/expenses/export/excel` API 엔드포인트 생성
3. [ ] 엑셀 생성 유틸리티 함수 작성 (`lib/excel-export.ts`)
4. [ ] 목록 페이지에 체크박스 및 다운로드 버튼 추가
5. [ ] 상세 페이지에 다운로드 버튼 추가
6. [ ] 테스트 및 검증

---

## 참고 사항

### 기존 시스템과의 차이점

| 항목 | 현재 시스템 | 엑셀 양식 |
|------|------------|-----------|
| 예산 구조 | 5단계 (위원회/부서/항/목/세목) | 4단계 (항/목/세목/세세목) |
| 지급방법 | 없음 | 필요 (이체 고정) |
| 날짜 형식 | ISO 8601 | YYYY.M.D |

### 주의사항

- 최종 승인(APPROVED_FINAL) 상태의 지출결의서만 내보내기 권장
- 지출일자(`expenseDate`)가 없으면 청구일자(`requestDate`) 사용
- 여러 항목(items)이 있는 지출결의서는 항목별로 각각 행 생성
