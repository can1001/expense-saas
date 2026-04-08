# 재정보고서 기능 (Account Report)

재정보고서 엑셀 파일을 업로드하여 데이터를 관리하고 시각화하는 기능입니다.

## 개요

### 목적
- 분기별 재정보고서 데이터 관리
- 수입/지출 현황 시각화
- 전년 대비 비교 분석

### 주요 기능
- **업로드**: 당해년도/전년도 재정보고서 엑셀 파일 업로드
- **조회**: 연도/분기별 재정 현황 대시보드
- **비교**: 전년 대비 수입/지출 비교 분석

## 파일 구조

| 파일 | 용도 |
|------|------|
| `app/admin/account-report/page.tsx` | 재정보고서 조회 대시보드 |
| `app/admin/account-report/upload/page.tsx` | 파일 업로드 페이지 |
| `app/api/admin/account-report/route.ts` | 조회 API (GET) |
| `app/api/admin/account-report/upload/route.ts` | 업로드 API (POST) |
| `lib/account-report-parser.ts` | Excel 파싱 라이브러리 |

## 데이터베이스 스키마

### AccountReport (메인 테이블)

```prisma
model AccountReport {
  id               String            @id @default(cuid())
  year             Int               // 연도 (2024, 2025 등)
  quarter          Int               // 분기 (1~4)
  reportType       AccountReportType // CURRENT_YEAR | PREVIOUS_YEAR
  originalFileName String            // 원본 파일명
  uploadedAt       DateTime          // 업로드 시각
  uploadedBy       String?           // 업로드한 사용자 ID
  summaryData      Json?             // 수지개황 JSON

  incomeItems      AccountReportIncome[]
  expenseItems     AccountReportExpense[]

  @@unique([year, quarter, reportType])
}
```

### AccountReportIncome (수입 항목)

```prisma
model AccountReportIncome {
  id               String  @id @default(cuid())
  reportId         String
  itemName         String  // 항목명 (예: 주헌금, 십일조)
  parentItemName   String? // 상위 항목명 (계층 구조용)
  level            Int     // 계층 레벨 (1: 대분류, 2: 중분류)
  budgetAmount     Int     // 예산액
  cumulativeAmount Int     // 누계
  currentAmount    Int     // 당기
  executionRate    Float   // 대비(%) = (누계/예산액)*100
  sortOrder        Int     // 정렬 순서
}
```

### AccountReportExpense (지출 항목)

```prisma
model AccountReportExpense {
  id               String  @id @default(cuid())
  reportId         String
  itemName         String  // 항목명 (예: 교역자사례비)
  parentItemName   String? // 상위 항목명
  level            Int     // 계층 레벨
  budgetAmount     Int     // 예산액
  cumulativeAmount Int     // 누계
  currentAmount    Int     // 당기
  executionRate    Float   // 대비(%)
  sortOrder        Int     // 정렬 순서
}
```

## 기능 상세

### 업로드 기능

**URL**: `/admin/account-report/upload`

#### 지원 파일 형식
- `.xlsx` (표준 Excel 파일)
- `.xls` (HTML 형식으로 저장된 Excel 파일)

#### Dry-run 모드
업로드 전 파일 검증만 수행하여 결과를 미리 확인할 수 있습니다.
- `dryRun=true`: 파싱 및 검증만 수행, 저장 안 함
- `dryRun=false`: 실제 데이터베이스 저장

#### 검증 로직
- 수입/지출 항목 합계와 요약 데이터 비교
- **5% 오차 허용**: 초과 시 경고 표시 (저장은 가능)
- 누락된 테이블 감지

### 조회 기능

**URL**: `/admin/account-report`

#### 필터 옵션
- 연도 선택 (전년/당해/내년)
- 분기 선택 (1~4분기)
- 전년비교 토글

#### 대시보드 구성
1. **요약 카드**: 수입 총계, 지출 총계, 차기 이월
2. **차트**:
   - 수입 구성 (파이 차트)
   - 지출 예산 vs 실적 (복합 차트)
   - 전년 대비 비교 (막대 차트)
3. **테이블**:
   - 수지개황 (당기/누계)
   - 수입부 상세
   - 지출부 상세

## API 명세

### GET /api/admin/account-report

재정보고서 조회

#### 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `year` | number | N | 연도 (기본: 현재 연도) |
| `quarter` | number | N | 분기 (기본: 1) |
| `compare` | string | N | 전년 비교 여부 ("true" / "false") |

#### 응답

```json
{
  "success": true,
  "data": {
    "year": 2025,
    "quarter": 1,
    "currentYear": {
      "id": "cuid",
      "fileName": "재정보고서_2025_1Q.xlsx",
      "uploadedAt": "2025-04-01T00:00:00Z",
      "summary": {
        "current": {
          "previousCarryover": 10000000,
          "totalIncome": 50000000,
          "totalExpense": 40000000,
          "difference": 10000000,
          "nextCarryover": 20000000
        },
        "cumulative": { ... }
      },
      "incomeItems": [...],
      "expenseItems": [...]
    },
    "previousYear": { ... },
    "comparison": {
      "summary": {
        "totalIncome": { "current": 50000000, "previous": 45000000, "diff": 5000000, "diffRate": 11.1 },
        "totalExpense": { ... },
        "nextCarryover": { ... }
      },
      "income": [...],
      "expense": [...]
    }
  }
}
```

### POST /api/admin/account-report/upload

재정보고서 업로드

#### 요청 (FormData)
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `currentYearFile` | File | N | 당해년도 파일 |
| `previousYearFile` | File | N | 전년도 파일 |
| `year` | string | N | 연도 (기본: 현재 연도) |
| `quarter` | string | N | 분기 (기본: 1) |
| `dryRun` | string | N | 검증만 수행 ("true" / "false") |

> 최소 하나의 파일(currentYearFile 또는 previousYearFile)이 필요합니다.

#### 응답 (Dry-run)

```json
{
  "success": true,
  "message": "검증이 완료되었습니다.",
  "code": "VALIDATION_SUCCESS",
  "data": {
    "dryRun": true,
    "year": 2025,
    "quarter": 1,
    "currentYear": {
      "fileName": "재정보고서.xlsx",
      "incomeItems": 15,
      "expenseItems": 25,
      "summary": { ... },
      "warnings": ["수입 항목 누계 합계 오차율이 3.2%입니다."]
    }
  }
}
```

#### 응답 (실제 업로드)

```json
{
  "success": true,
  "message": "재정보고서가 성공적으로 업로드되었습니다.",
  "code": "UPLOAD_SUCCESS",
  "data": {
    "dryRun": false,
    "year": 2025,
    "quarter": 1,
    "currentYear": {
      "fileName": "재정보고서.xlsx",
      "incomeItems": 15,
      "expenseItems": 25
    }
  }
}
```

## Excel 파싱 로직

### 지원 입력 형식
1. **HTML 형식 .xls**: Excel에서 "웹 페이지"로 저장한 파일
2. **표준 .xlsx**: 일반 Excel 파일 (xlsx 라이브러리 사용)

### 테이블 구조 요구사항

파일에는 최소 6개의 테이블이 포함되어야 합니다:

| 순서 | 테이블 내용 |
|------|-------------|
| 1 | "1. 수지개황" 제목 |
| 2 | 요약 (구분, 전기이월, 수입총계, 지출총계, 차액, 차기이월) |
| 3 | "2. 수입부" 제목 |
| 4 | 수입 상세 (항목, 예산액, 누계, 당기, 대비%) |
| 5 | "3. 지출부" 제목 |
| 6 | 지출 상세 (항목, 예산액, 누계, 당기, 대비%) |

### 파싱 규칙

#### 금액 파싱
- 콤마(,), 공백, 원화 기호(₩, 원) 제거
- 정수로 변환

#### 퍼센트 파싱
- % 기호 제거
- 소수점 유지

#### 계층 레벨 감지
- **레벨 1**: 들여쓰기 없음 (대분류)
- **레벨 2**: 4칸 이상 들여쓰기 (중분류)

#### 병합 셀 처리
- `colspan` 속성 인식
- 병합된 셀은 빈 문자열로 채움

### 검증 규칙

```typescript
// 수입/지출 항목 합계와 요약 데이터 비교
// 레벨 1 항목의 누계 합계 vs 요약의 누계 총계
const errorRate = Math.abs(itemTotal - summaryTotal) / summaryTotal * 100;

if (errorRate > 5) {
  // 5% 초과: 경고 (저장은 허용)
  warnings.push(`오차율이 ${errorRate.toFixed(2)}%로 5%를 초과합니다.`);
}
```

## 사용 예시

### 1. 파일 업로드 (검증)

```bash
curl -X POST /api/admin/account-report/upload \
  -F "currentYearFile=@재정보고서_2025_1Q.xlsx" \
  -F "year=2025" \
  -F "quarter=1" \
  -F "dryRun=true"
```

### 2. 파일 업로드 (실제 저장)

```bash
curl -X POST /api/admin/account-report/upload \
  -F "currentYearFile=@재정보고서_2025_1Q.xlsx" \
  -F "previousYearFile=@재정보고서_2024_1Q.xlsx" \
  -F "year=2025" \
  -F "quarter=1" \
  -F "dryRun=false"
```

### 3. 조회 (전년 비교 포함)

```bash
curl "/api/admin/account-report?year=2025&quarter=1&compare=true"
```

## 제한사항

1. **인증 없음**: 현재 API는 인증 없이 접근 가능
2. **레벨 2 항목**: 대시보드에서 레벨 1(대분류)만 표시, 레벨 2(중분류)는 DB에 저장되지만 UI에서 미표시
3. **동시 업로드**: 동시에 여러 파일 업로드 시 트랜잭션 충돌 가능
4. **파일 크기**: 대용량 파일 처리 시 타임아웃 발생 가능
5. **Excel 형식**: 복잡한 수식이나 매크로가 포함된 파일은 파싱 실패 가능

## 관련 파일

- `prisma/schema.prisma`: 데이터베이스 스키마 정의 (949-1038행)
- `components/charts/`: 차트 컴포넌트 (BarChart, PieChart, LineChart, ComposedChart)
- `lib/api/response-handler.ts`: API 응답 핸들러 유틸리티
