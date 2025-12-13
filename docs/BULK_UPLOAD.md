# 지출결의서 일괄 업로드 가이드

## 개요

Excel 파일을 통해 여러 지출결의서를 한 번에 업로드할 수 있습니다.
`category`, `subcategory`, `detail` 정보로 BudgetMaster에서 `committee`, `department`를 자동으로 조회합니다.

## 사용법

### 1. 템플릿 생성

```bash
npm run generate-template
```

`templates/bulk-upload-template.xlsx` 파일이 생성됩니다.

### 2. 데이터 입력

템플릿 파일의 "업로드데이터" 시트에 데이터를 입력합니다.

### 3. 검증 (Dry Run)

실제 저장 전에 데이터를 검증합니다.

```bash
npm run bulk-upload -- ./templates/bulk-upload-template.xlsx --dry-run
```

### 4. 실제 업로드

```bash
npm run bulk-upload -- ./your-file.xlsx
```

## Excel 파일 형식

### 필수 컬럼

| 컬럼 | 설명 | 예시 |
|------|------|------|
| `category` | 예산(항) | 사역지원비 |
| `subcategory` | 예산(목) | 기획비 |
| `detail` | 예산(세목) | 아웃팅비 |
| `description` | 적요 | 기획팀 회의 후 식사 |
| `unitPrice` | 단가 | 10000 |
| `quantity` | 수량 | 5 |
| `requestDate` | 청구일자 | 2024-12-01 |
| `applicantName` | 청구인 | 홍길동 |
| `bankName` | 은행명 | 우리은행 |
| `accountNumber` | 계좌번호 | 1002-123-456789 |
| `accountHolder` | 예금주 | 홍길동 |

### 선택 컬럼

| 컬럼 | 설명 | 예시 |
|------|------|------|
| `groupId` | 그룹ID (같은 ID는 하나의 지출결의서) | 1 |
| `expenseDate` | 지출일자 | 2024-12-01 |
| `applicantTitle` | 직책 | 팀장 |

## 그룹핑 기능

`groupId`가 같은 행들은 하나의 지출결의서로 묶입니다.

### 예시

| groupId | detail | description | unitPrice | quantity |
|---------|--------|-------------|-----------|----------|
| 1 | 아웃팅비 | 회의 후 식사 | 10000 | 5 |
| 1 | 소모품비 | 회의 다과 | 5000 | 10 |
| 2 | 교육교재비 | 공과 구입 | 15000 | 20 |

위 데이터는 2개의 지출결의서로 생성됩니다:
- 지출결의서 1: 2개 항목 (아웃팅비 + 소모품비)
- 지출결의서 2: 1개 항목 (교육교재비)

`groupId`가 없으면 각 행이 개별 지출결의서로 생성됩니다.

## 자동 조회 로직

1. Excel의 `category`, `subcategory`, `detail` 값으로 BudgetMaster 테이블 검색
2. 매칭되는 레코드에서 `committee`, `department` 값 가져오기
3. 해당 값으로 지출결의서 생성

## 에러 처리

### 검증 오류

```
❌ 검증 오류:
   행 2: category(예산항) 누락
   행 3: unitPrice(단가) 유효하지 않음
```

### 예산 정보 미발견

```
❌ 예산 정보를 찾을 수 없음:
   그룹 1: 사역지원비 / 기획비 / 존재하지않는세목
```

BudgetMaster에 해당 조합이 없는 경우 발생합니다.

## 파일 구조

```
expense-system/
├── scripts/
│   ├── bulk-upload.ts           # 일괄 업로드 스크립트
│   └── generate-upload-template.ts  # 템플릿 생성 스크립트
├── templates/
│   └── bulk-upload-template.xlsx    # 샘플 템플릿
└── tsconfig.scripts.json        # 스크립트용 TS 설정
```

## 주의사항

1. **날짜 형식**: `YYYY-MM-DD` 형식 권장 (예: 2024-12-01)
2. **금액 계산**: `amount`는 자동 계산됨 (`Math.floor(unitPrice * quantity / 10) * 10`)
3. **계좌번호**: 문자열로 처리됨 (하이픈 포함 가능)
4. **중복 실행**: 동일 데이터 재업로드 시 중복 생성됨 (주의)
