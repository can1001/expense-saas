# 자동이체 UI 구현 태스크 목록

## Phase 1: 기본 CRUD ✅ 완료

- [x] **1.1** RecurringExpenseStatus 컴포넌트 (상태 배지)
- [x] **1.2** FrequencySelector + DayOfMonthInput 컴포넌트
- [x] **1.3** RecurringExpenseForm + 등록 페이지
- [x] **1.4** RecurringExpenseCard + 목록 페이지
- [x] **1.5** RecurringExpenseDetail + 상세 페이지
- [x] **1.6** 수정 페이지

### ✅ Checkpoint 1 완료
- [x] 테스트 통과: 1432개
- [x] 빌드 성공
- [x] 커버리지: 93%+

---

## Phase 2: 상태 관리 ✅ 완료

- [x] **2.1** 일시정지/재개 기능
- [x] **2.2** 취소 기능 + 확인 다이얼로그 (ConfirmDialog)

### ✅ Checkpoint 2 완료
- [x] 취소 기능 동작 확인
- [x] ConfirmDialog 테스트 통과 (20개)

---

## Phase 3: 고급 기능 ✅ 완료

- [x] **3.1** 목록 상태 필터 (상태 탭)
- [x] **3.2** 생성 이력 표시 (GeneratedExpenseList)
- [x] **3.3** 목록 검색 기능
- [x] **3.4** 무한 스크롤

### ✅ Checkpoint 3 완료
- [x] 생성 이력 표시 확인
- [x] 검색 기능 동작 확인
- [x] 무한 스크롤 동작 확인

---

## 후속 작업 ✅ 완료

- [x] **A** 네비게이션 메뉴 추가
  - Header.tsx에 "자동이체" 메뉴
  - 재정팀 역할만 표시

---

## 보안 이슈 수정 ✅ 완료

- [x] **Issue 1**: DELETE 엔드포인트 소유권 검증 (CRITICAL)
  - expense-delete.test.ts: 10개 테스트 통과
- [x] **Issue 2**: 로그인 Rate Limiting (HIGH)
  - rate-limit.test.ts: 25개 테스트 통과

---

## 최종 검증 ✅ 완료

```bash
npm test -- --run  # 1465 tests passed
npm run build      # Success
```

---

## 운영 배치 트리거 (Production)

- [x] **B** Render Cron Job 추가
  - `render.yaml` cron 서비스 정의 (KST 03:00 / UTC 18:00 daily)
  - `scripts/cron-recurring-process.mjs` 진입 스크립트 추가
  - `.env.example`에 `CRON_SECRET` 항목 추가
  - **운영자 작업 필요**: Render 대시보드에서 Blueprint 적용 + `CRON_SECRET`/`APP_URL` 환경변수 설정
  - **첫 배포 검증**: cron 서비스 "Trigger Run" 수동 실행 후 로그에서 `${생성건수}건의 지출결의서가 생성되었습니다.` 확인
