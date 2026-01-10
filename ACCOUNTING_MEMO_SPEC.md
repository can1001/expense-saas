# 회계 시스템 세목별 적요 예제 관리 및 툴팁 기능

## 1. 개요

회계/경비 입력 시 세목(계정과목)별로 자주 사용하는 적요 문구를 관리하고, 입력 시 툴팁으로 예제를 보여주는 기능.

### 목표

- 적요 입력 시간 단축
- 적요 문구 일관성 유지
- 사용자 편의성 향상

---

## 2. 기능 목록

### 2.1 핵심 기능

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 적요 예제 툴팁 | 세목 선택 후 적요 필드 포커스 시 예제 목록 표시 | P0 |
| 예제 선택 입력 | 툴팁에서 예제 클릭/Enter로 적요 필드에 입력 | P0 |
| 키보드 네비게이션 | ↑↓ 키로 예제 선택, ESC로 닫기 | P0 |
| 실시간 필터링 | 타이핑 중 매칭되는 예제만 표시 | P1 |
| 사용 빈도 정렬 | 자주 사용하는 적요를 상단에 표시 | P1 |

### 2.2 관리 기능

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 예제 추가 | 세목별 적요 예제 등록 | P0 |
| 예제 수정 | 기존 예제 문구 수정 | P1 |
| 예제 삭제 | 불필요한 예제 삭제 | P1 |
| 일괄 등록 | CSV/Excel로 다량 등록 | P2 |

---

## 3. 데이터 구조

### 3.1 타입 정의

```typescript
// 적요 예제
interface MemoExample {
  id: string;
  text: string;           // 적요 문구
  frequency: number;      // 사용 횟수 (정렬용)
  createdAt: Date;
  updatedAt: Date;
}

// 세목 (계정과목)
interface AccountCode {
  id: string;
  code: string;           // 계정코드 (예: "501", "502")
  name: string;           // 계정명 (예: "여비교통비", "접대비")
  category: string;       // 분류 (예: "인건비", "경비", "판관비")
  memoExamples: MemoExample[];
  isActive: boolean;
}

// 세목-적요 매핑 (DB용, 정규화 시)
interface AccountMemoMapping {
  id: string;
  accountCodeId: string;
  memoExampleId: string;
  frequency: number;
  lastUsedAt: Date;
}
```

### 3.2 DB 스키마 (Prisma)

```prisma
model AccountCode {
  id          String   @id @default(cuid())
  code        String   @unique        // "501"
  name        String                  // "여비교통비"
  category    String                  // "경비"
  isActive    Boolean  @default(true)

  memoExamples AccountMemoExample[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model AccountMemoExample {
  id            String   @id @default(cuid())
  text          String                  // "출장 교통비 (서울-부산)"
  frequency     Int      @default(0)    // 사용 횟수

  accountCode   AccountCode @relation(fields: [accountCodeId], references: [id])
  accountCodeId String

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lastUsedAt    DateTime?

  @@index([accountCodeId])
  @@index([frequency(sort: Desc)])
}
```

---

## 4. 컴포넌트 설계

### 4.1 컴포넌트 구조

```
components/
└── accounting/
    └── memo/
        ├── MemoTooltip.tsx           # 툴팁 UI
        ├── MemoInput.tsx             # 적요 입력 필드 + 툴팁 통합
        ├── MemoExampleManager.tsx    # 예제 관리 모달
        ├── MemoExampleList.tsx       # 예제 목록 (관리용)
        ├── MemoExampleForm.tsx       # 예제 추가/수정 폼
        └── index.ts                  # exports

hooks/
└── useMemoExamples.ts               # 적요 예제 CRUD 훅

types/
└── accounting.ts                    # 타입 정의

lib/
└── api/
    └── memo-examples.ts             # API 함수
```

### 4.2 컴포넌트 Props

```typescript
// MemoTooltip
interface MemoTooltipProps {
  examples: MemoExample[];
  isOpen: boolean;
  position: { top: number; left: number };
  selectedIndex: number;
  searchTerm: string;
  onSelect: (example: MemoExample) => void;
  onClose: () => void;
}

// MemoInput
interface MemoInputProps {
  accountCode: string;              // 선택된 세목 코드
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// MemoExampleManager
interface MemoExampleManagerProps {
  accountCode: AccountCode;
  isOpen: boolean;
  onClose: () => void;
  onSave: (examples: MemoExample[]) => void;
}
```

---

## 5. UI/UX 설계

### 5.1 툴팁 표시 흐름

```
┌─────────────────────────────────────────────────────┐
│  경비 입력                                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  날짜: [2024-01-15]                                │
│                                                     │
│  세목: [501 - 여비교통비     ▼]  [⚙️ 예제관리]      │
│                                                     │
│  적요: [출장                    ]  ← 포커스 + 입력  │
│        ┌──────────────────────┐                    │
│        │ 💡 적요 예제          │                    │
│        │ ↑↓ 선택, Enter 입력  │                    │
│        ├──────────────────────┤                    │
│        │ ▸ 출장 교통비 (서울) │ 15회               │
│        │   출장 숙박비        │ 8회                │
│        └──────────────────────┘                    │
│                                                     │
│  금액: [          ] 원                             │
│                                                     │
│  [추가]                                            │
└─────────────────────────────────────────────────────┘
```

### 5.2 적요 예제 관리 모달

```
┌─────────────────────────────────────────────────────┐
│  501 - 여비교통비 적요 예제 관리              [✕]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [새 적요 예제 입력...                    ] [추가]  │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  📝 등록된 예제 (5개)                              │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 출장 교통비 (서울-부산)          15회  [삭제]│   │
│  │ 택시비                           12회  [삭제]│   │
│  │ 주차비                            8회  [삭제]│   │
│  │ 고속도로 통행료                   5회  [삭제]│   │
│  │ 출장 숙박비                       3회  [삭제]│   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
├─────────────────────────────────────────────────────┤
│                              [취소]  [저장]         │
└─────────────────────────────────────────────────────┘
```

### 5.3 키보드 단축키

| 키 | 동작 |
|----|------|
| `↓` | 다음 예제 선택 |
| `↑` | 이전 예제 선택 |
| `Enter` | 선택한 예제 입력 |
| `Escape` | 툴팁 닫기 |
| `Tab` | 툴팁 닫고 다음 필드로 |

---

## 6. API 설계

### 6.1 엔드포인트

```
GET    /api/account-codes                    # 세목 목록 조회
GET    /api/account-codes/:code/memo-examples # 세목별 적요 예제 조회
POST   /api/account-codes/:code/memo-examples # 적요 예제 추가
PUT    /api/memo-examples/:id                # 적요 예제 수정
DELETE /api/memo-examples/:id                # 적요 예제 삭제
PATCH  /api/memo-examples/:id/frequency      # 사용 횟수 증가
```

### 6.2 API 응답 예시

```typescript
// GET /api/account-codes/501/memo-examples
{
  "accountCode": {
    "code": "501",
    "name": "여비교통비",
    "category": "경비"
  },
  "memoExamples": [
    {
      "id": "memo_1",
      "text": "출장 교통비 (서울-부산)",
      "frequency": 15,
      "lastUsedAt": "2024-01-10T09:00:00Z"
    },
    {
      "id": "memo_2",
      "text": "택시비",
      "frequency": 12,
      "lastUsedAt": "2024-01-12T14:30:00Z"
    }
  ]
}
```

---

## 7. 샘플 데이터

### 7.1 세목 목록

| 코드 | 세목명 | 분류 |
|------|--------|------|
| 401 | 급여 | 인건비 |
| 402 | 복리후생비 | 인건비 |
| 501 | 여비교통비 | 경비 |
| 502 | 접대비 | 경비 |
| 503 | 통신비 | 경비 |
| 504 | 소모품비 | 경비 |
| 505 | 수도광열비 | 경비 |
| 601 | 광고선전비 | 판관비 |
| 602 | 지급수수료 | 판관비 |
| 701 | 수선비 | 유지비 |

### 7.2 세목별 적요 예제

```typescript
const sampleMemoExamples = {
  "401": [ // 급여
    "2024년 1월분 급여",
    "상여금 지급",
    "야근수당",
    "주휴수당",
    "연차수당"
  ],
  "402": [ // 복리후생비
    "직원 식대",
    "경조사비 지급",
    "건강검진비",
    "동호회 지원금",
    "명절 선물비",
    "워크샵 비용"
  ],
  "501": [ // 여비교통비
    "출장 교통비 (서울-부산)",
    "택시비",
    "주차비",
    "고속도로 통행료",
    "출장 숙박비",
    "KTX 승차권"
  ],
  "502": [ // 접대비
    "거래처 식사 접대",
    "명절 선물 (거래처)",
    "골프 접대",
    "경조사 화환",
    "거래처 다과"
  ],
  "503": [ // 통신비
    "사무실 인터넷 요금",
    "법인 휴대폰 요금",
    "전화 요금",
    "우편 발송비",
    "팩스 요금"
  ],
  "504": [ // 소모품비
    "사무용품 구입",
    "프린터 토너",
    "복사용지",
    "청소용품",
    "전구/형광등",
    "배터리"
  ],
  "601": [ // 광고선전비
    "온라인 광고비 (네이버)",
    "현수막 제작",
    "홍보 인쇄물",
    "SNS 광고비",
    "전시회 참가비"
  ],
  "602": [ // 지급수수료
    "카드 결제 수수료",
    "송금 수수료",
    "세무사 수수료",
    "법무사 수수료",
    "플랫폼 이용료"
  ],
  "701": [ // 수선비
    "에어컨 수리",
    "사무실 시설 보수",
    "차량 정비",
    "컴퓨터 수리",
    "배관 수리"
  ]
};
```

---

## 8. 구현 체크리스트

### Phase 1: 기본 기능

- [ ] 타입 정의
- [ ] DB 스키마 작성 (Prisma)
- [ ] 시드 데이터 생성
- [ ] MemoTooltip 컴포넌트
- [ ] MemoInput 컴포넌트
- [ ] 기본 API (조회)

### Phase 2: 관리 기능

- [ ] MemoExampleManager 모달
- [ ] 예제 추가/삭제 API
- [ ] 사용 빈도 업데이트 로직

### Phase 3: 고급 기능

- [ ] 실시간 필터링
- [ ] 사용 빈도순 정렬
- [ ] 일괄 등록 기능

---

## 9. 기술 결정 사항 (확인 필요)

| 항목 | 옵션 | 결정 |
|------|------|------|
| 저장소 | localStorage / Supabase / Prisma+DB | ? |
| 프레임워크 | Next.js App Router / Pages Router | ? |
| 스타일링 | Tailwind CSS / CSS Modules | ? |
| 상태관리 | useState / Zustand / React Query | ? |
| 기존 시스템 | 신규 / 기존 경비시스템 통합 | ? |

---

## 10. 참고

### 관련 파일 (기존 프로젝트 확인 필요)

- 세목 마스터 테이블
- 경비 입력 컴포넌트
- 공통 모달/툴팁 컴포넌트

### 유사 패턴

- VS Code Autocomplete
- Google 검색 자동완성
- Slack 이모지 선택기
