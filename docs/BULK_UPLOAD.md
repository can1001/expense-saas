# 지출결의서 일괄 업로드 가이드

## 개요

Excel 파일을 통해 여러 지출결의서를 한 번에 업로드할 수 있습니다.
입력된 `committee`/`department`/`budgetCategory`/`budgetSubcategory`/`budgetDetail` 조합이 실제 활성 예산 매핑인지 검증한 뒤 저장합니다.
**청구인 정보는 엑셀에 포함되지 않으며 업로드 수행자(웹: 로그인 사용자, CLI: `--as` 인자)가 자동으로 채워집니다.**

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

컬럼명은 신규 작성 폼 스키마(`createExpenseSchema`)와 동일. **청구인 정보는 엑셀에 포함되지 않음** — 업로드 수행자(웹: 로그인 사용자, CLI: `--as <username>`)가 자동 채움.

| 컬럼 | 설명 | 예시 |
|------|------|------|
| `committee` | 위원회 | 교육위원회 |
| `department` | 사역팀(부) | 기획팀 |
| `budgetCategory` | 예산(항) | 사역지원비 |
| `budgetSubcategory` | 예산(목) | 기획비 |
| `budgetDetail` | 예산(세목) | 아웃팅비 |
| `description` | 적요 | 기획팀 회의 후 식사 |
| `unitPrice` | 단가 | 10000 |
| `quantity` | 수량 | 5 |
| `requestDate` | 청구일자 | 2026-05-01 |
| `bankName` | 은행명 (수취 계좌) | 우리은행 |
| `accountNumber` | 계좌번호 (수취 계좌) | 1002-123-456789 |
| `accountHolder` | 예금주 (수취 계좌) | 홍길동 |

### 선택 컬럼

| 컬럼 | 설명 | 예시 |
|------|------|------|
| `groupId` | 그룹ID (같은 ID는 하나의 지출결의서) | 1 |
| `expenseDate` | 지급일자 | 2026-05-05 |

## 그룹핑 기능

`groupId`가 같은 행들은 하나의 지출결의서로 묶입니다 (`groupId` 없으면 각 행이 개별 지출결의서).

### 예시

| groupId | budgetDetail | description | unitPrice | quantity |
|---------|--------------|-------------|-----------|----------|
| 1 | 아웃팅비 | 회의 후 식사 | 10000 | 5 |
| 1 | 소모품비 | 회의 다과 | 5000 | 10 |
| 2 | 교육교재비 | 공과 구입 | 15000 | 20 |

위 데이터는 2개의 지출결의서로 생성됩니다.

## 검증 로직

1. **필수 컬럼**: 누락 시 행 에러.
2. **예산 매핑 조회**: `budgetCategory/budgetSubcategory/budgetDetail`로 위원회/사역팀 자동 도출.
3. **위원회/사역팀 교차 검증**: 입력 (위원회, 사역팀, 세목) 조합이 실제 활성 매핑인지 직접 질의 (`verifyBudgetMapping`). 1:N 매핑에서 정답인 alternate 부서 입력도 정상 수용.
4. **청구인**: 엑셀에서 받지 않음 — 웹은 로그인 사용자, CLI는 `--as <username>` 인자가 모든 행의 청구인이 됨 (userId/applicantName/applicantTitle 자동).
5. 검증 통과 시 `status=DRAFT`, 결재선 미생성으로 일괄 생성. 한 건이라도 실패 시 **전체 트랜잭션 롤백**.

> **변경 사항**
> - 2026-05-30 (v4): **청구인 정보를 엑셀에서 제거**, 업로드 수행자가 자동 채움. 동명이인 문제 해소 + 데이터 입력 책임 추적.
> - 2026-05-30 (v3): NaN unitPrice/quantity 검증 강화, Content-Length 헤더 누락 거부, 1:N 부서 매핑 `verifyBudgetMapping` 도입.
> - 2026-05-30 (v2): 컬럼명을 신규 작성 폼 스키마와 통일 (`category`→`budgetCategory` 등), `committee`/`department` 필수 추가.
> - 청구인 매칭 실패 시 admin 폴백 동작 제거. 일부 행 실패 시 전체 트랜잭션 롤백.
> - CLI 내부 로직이 `lib/services/bulk-expense-upload-service.ts`로 이동됨 (웹 UI와 공유).

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
