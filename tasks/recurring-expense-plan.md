# 자동이체 UI 구현 계획

## 현재 상태 (2026-05-04 업데이트)

### Phase 1: 기본 CRUD ✅ 완료

| Task | 파일 | 상태 |
|------|------|------|
| 1.1 상태 배지 | `RecurringExpenseStatus.tsx` | ✅ 완료 |
| 1.2 주기/일자 선택기 | `FrequencySelector.tsx`, `DayOfMonthInput.tsx` | ✅ 완료 |
| 1.3 등록 폼 + 페이지 | `RecurringExpenseForm.tsx`, `new/page.tsx` | ✅ 완료 |
| 1.4 카드 + 목록 페이지 | `RecurringExpenseCard.tsx`, `page.tsx` | ✅ 완료 |
| 1.5 상세 페이지 | `RecurringExpenseDetail.tsx`, `[id]/page.tsx` | ✅ 완료 |
| 1.6 수정 페이지 | `[id]/edit/page.tsx` | ✅ 완료 |

**테스트**: 1432개 통과, 커버리지 93%+

### Phase 2: 상태 관리 (부분 완료)

| Task | 상태 | 설명 |
|------|------|------|
| 2.1 일시정지/재개 | ✅ 완료 | RecurringExpenseDetail에 구현 |
| 2.2 취소 기능 | ⏳ 미완료 | 취소 버튼 + 확인 다이얼로그 필요 |

### Phase 3: 고급 기능 (미완료)

| Task | 상태 | 우선순위 |
|------|------|----------|
| 3.1 생성 이력 표시 | ⏳ 미완료 | P1 |
| 3.2 목록 필터 | ✅ 완료 | 상태 탭 구현됨 |
| 3.3 목록 검색 | ⏳ 미완료 | P1 |
| 3.4 무한 스크롤 | ⏳ 미완료 | P0 |

### 후속 작업 (미완료)

| Task | 상태 | 우선순위 |
|------|------|----------|
| 네비게이션 메뉴 | ⏳ 미완료 | **최우선** |

---

## 의존성 그래프

```
ConfirmDialog (신규 또는 Modal 재사용)
    └─> RecurringExpenseDetail (취소 버튼 추가)

GeneratedExpenseList (신규)
    └─> RecurringExpenseDetail (이력 섹션 추가)

목록 검색
    ├─> API 수정 (/api/recurring-expenses - search 파라미터)
    └─> page.tsx (검색 UI)

네비게이션 메뉴
    └─> Header.tsx (navItems + 권한 체크)
```

---

## 남은 작업 계획

### Task A: 네비게이션 메뉴 추가 (최우선)

**목표**: 사용자가 자동이체 기능에 접근할 수 있도록 헤더에 메뉴 추가

**파일**:
- `components/Header.tsx`
- `lib/constants/menu-permissions.ts` (권한 함수)

**인수 조건**:
- [ ] navItems에 "자동이체" 메뉴 추가
- [ ] href: `/recurring-expenses`
- [ ] 아이콘: Lucide `Repeat` 또는 `CalendarClock`
- [ ] 재정팀 역할만 표시 (finance_head, accountant, finance_member)
- [ ] 모바일 드로어에도 표시

**검증**:
- 재정팀 계정 로그인 → 메뉴 표시 확인
- 일반 사용자 로그인 → 메뉴 숨김 확인

---

### Task B: 취소 기능 + 확인 다이얼로그

**목표**: 자동이체 취소 기능 (되돌릴 수 없음 경고)

**파일**:
- `components/ui/ConfirmDialog.tsx` (신규)
- `components/recurring-expense/RecurringExpenseDetail.tsx` (수정)
- 테스트 파일

**인수 조건**:
- [ ] ConfirmDialog 컴포넌트 생성
  - 제목, 메시지, variant(danger/warning), 확인/취소 버튼
- [ ] 취소 버튼 클릭 시 경고 다이얼로그 표시
- [ ] "되돌릴 수 없습니다" 경고 메시지
- [ ] variant="danger"로 빨간색 강조
- [ ] 확인 시 DELETE API 호출 → CANCELLED 상태
- [ ] 취소 후 목록 페이지로 이동

**검증**:
```bash
npm test -- --run ConfirmDialog
npm test -- --run RecurringExpenseDetail
```

---

### Task C: 생성 이력 표시

**목표**: 자동 생성된 지출결의서 목록 표시

**파일**:
- `components/recurring-expense/GeneratedExpenseList.tsx` (신규)
- `components/recurring-expense/RecurringExpenseDetail.tsx` (수정)
- 테스트 파일

**인수 조건**:
- [ ] GeneratedExpenseList 컴포넌트 생성
- [ ] 표시 항목: 생성 일시, 금액, 상태 배지
- [ ] 지출결의서 상세 페이지 링크
- [ ] 최근 10건 표시 (API에서 이미 포함)
- [ ] 빈 상태: "생성된 지출결의서가 없습니다"
- [ ] 상세 페이지 하단에 통합

**검증**:
```bash
npm test -- --run GeneratedExpenseList
```

---

### Task D: 목록 검색 기능

**목표**: 이름/수취인으로 검색

**파일**:
- `app/api/recurring-expenses/route.ts` (수정)
- `app/recurring-expenses/page.tsx` (수정)

**인수 조건**:
- [ ] API에 search 쿼리 파라미터 추가
- [ ] name, recipientName 필드에서 LIKE 검색
- [ ] 검색 입력 UI (아이콘 + input)
- [ ] 디바운스 300ms
- [ ] 검색어 비우면 전체 목록

**검증**:
```bash
npm test -- --run recurring-expenses
```

---

### Task E: 무한 스크롤

**목표**: 목록 페이지 무한 스크롤

**파일**:
- `app/recurring-expenses/page.tsx` (수정)

**인수 조건**:
- [ ] IntersectionObserver로 스크롤 감지
- [ ] 다음 페이지 자동 로드
- [ ] 로딩 인디케이터 (스피너)
- [ ] hasMore 플래그로 종료 처리
- [ ] 기존 useInfiniteScroll 훅 재사용 검토

**검증**:
- 11건 이상 데이터로 스크롤 테스트

---

## 체크포인트

### Checkpoint 2 (Phase 2 완료)
- [ ] Task A: 네비게이션 메뉴 동작
- [ ] Task B: 취소 기능 동작
- [ ] ConfirmDialog 테스트 통과

### Checkpoint 3 (Phase 3 완료)
- [ ] Task C: 생성 이력 표시
- [ ] Task D: 검색 기능 동작
- [ ] Task E: 무한 스크롤 동작

### 최종 검증
```bash
npm test -- --run
npm run build
```

---

## 우선순위 요약

| 순위 | Task | 이유 |
|------|------|------|
| 1 | **네비게이션 메뉴** | 사용자가 기능에 접근 불가 |
| 2 | 취소 기능 + 다이얼로그 | 핵심 상태 관리 완성 |
| 3 | 생성 이력 표시 | 사용자 요구사항 P1 |
| 4 | 무한 스크롤 | 스펙 P0 |
| 5 | 목록 검색 | 스펙 P1 |

---

## 파일 목록 (남은 작업)

| 파일 | 유형 | Task |
|------|------|------|
| `components/Header.tsx` | 수정 | A |
| `lib/constants/menu-permissions.ts` | 수정 | A |
| `components/ui/ConfirmDialog.tsx` | 신규 | B |
| `components/recurring-expense/RecurringExpenseDetail.tsx` | 수정 | B, C |
| `components/recurring-expense/GeneratedExpenseList.tsx` | 신규 | C |
| `app/api/recurring-expenses/route.ts` | 수정 | D |
| `app/recurring-expenses/page.tsx` | 수정 | D, E |
