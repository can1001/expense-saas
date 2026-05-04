# 간편 지출결의서 개선 태스크 목록

## Phase 1: 저장된 은행 계좌

### Task 1.1: DB 스키마 추가
- [ ] `prisma/schema.prisma`에 SavedBankAccount 모델 추가
- [ ] `npm run db:push` 실행
- **검증**: Prisma Studio에서 테이블 생성 확인

### Task 1.2: 저장 계좌 API (GET/POST)
- [ ] `app/api/saved-accounts/route.ts` 생성
- [ ] GET: 현재 사용자 계좌 목록 반환
- [ ] POST: 새 계좌 저장 (중복 체크, 최대 5개 제한)
- **검증**: API 테스트 (curl 또는 Thunder Client)

### Task 1.3: 저장 계좌 API (PUT/DELETE)
- [ ] `app/api/saved-accounts/[id]/route.ts` 생성
- [ ] PUT: 계좌 수정 + 기본 계좌 설정
- [ ] DELETE: 계좌 삭제
- **검증**: API 테스트

### Task 1.4: SavedAccountSelector 컴포넌트
- [ ] `components/expense-form/SavedAccountSelector.tsx` 생성
- [ ] 저장된 계좌 목록 표시 (라디오 버튼)
- [ ] "새 계좌 입력" 옵션
- [ ] "현재 계좌 저장" 체크박스
- **검증**: 스토리북 또는 개발 서버에서 UI 확인

### Task 1.5: 폼 통합
- [ ] `SimpleExpenseForm.tsx`에 SavedAccountSelector 통합
- [ ] 기존 BankAccountSelector는 "새 계좌 입력" 시 표시
- **검증**: 전체 폼 흐름 테스트

### Checkpoint 1
- [ ] 저장된 계좌 CRUD 동작 확인
- [ ] 기존 폼과 통합 확인

---

## Phase 2: 2단계 마법사 UI

### Task 2.1: SimpleExpenseWizard 컨테이너
- [ ] `components/simple-expense-form/SimpleExpenseWizard.tsx` 생성
- [ ] 스텝 상태 관리 (currentStep)
- [ ] 스텝 전환 애니메이션 (선택)
- **검증**: 컴포넌트 렌더링 확인

### Task 2.2: WizardStep1 - 예산/금액 입력
- [ ] `components/simple-expense-form/WizardStep1.tsx` 생성
- [ ] 기존 SimpleItemsSection 재활용
- [ ] "다음" 버튼 추가
- **검증**: 항목 입력 후 다음 단계 이동

### Task 2.3: WizardStep2 - 청구/은행/첨부
- [ ] `components/simple-expense-form/WizardStep2.tsx` 생성
- [ ] 청구 정보 섹션
- [ ] SavedAccountSelector 통합
- [ ] 첨부파일 섹션
- [ ] "이전", "제출" 버튼
- **검증**: 이전 단계 복귀 시 데이터 유지

### Task 2.4: WizardNavigation 컴포넌트
- [ ] `components/simple-expense-form/WizardNavigation.tsx` 생성
- [ ] 스텝 인디케이터 (1/2, 2/2)
- [ ] 이전/다음 버튼
- [ ] 하단 고정 (모바일)
- **검증**: 모바일/데스크톱 반응형 확인

### Task 2.5: 스와이프 네비게이션
- [ ] react-swipeable 적용
- [ ] 왼쪽 스와이프: 다음 단계
- [ ] 오른쪽 스와이프: 이전 단계
- **검증**: 모바일에서 스와이프 동작

### Task 2.6: 기존 폼 교체
- [ ] `app/expenses/simple/new/page.tsx` 수정
- [ ] SimpleExpenseForm → SimpleExpenseWizard
- **검증**: 새 작성 페이지에서 마법사 동작

### Checkpoint 2
- [ ] 2단계 폼 흐름 확인
- [ ] 유효성 검증 확인
- [ ] 모바일/데스크톱 반응형 확인

---

## Phase 3: 모바일 최적화

### Task 3.1: AmountInput 컴포넌트
- [ ] `components/simple-expense-form/AmountInput.tsx` 생성
- [ ] `inputmode="numeric"` 적용
- [ ] 천 단위 콤마 포맷팅
- [ ] 터치 타겟 48px
- **검증**: 모바일에서 숫자 키패드 표시

### Task 3.2: 터치 타겟 확대
- [ ] 버튼 최소 높이 48px 적용
- [ ] 탭 영역 확대 (padding)
- [ ] 항목 간격 조정
- **검증**: Chrome DevTools로 터치 타겟 측정

### Task 3.3: 접근성 개선
- [ ] aria-label 추가
- [ ] 포커스 스타일 개선
- [ ] 키보드 네비게이션 확인
- **검증**: 접근성 검사 (Lighthouse)

### Checkpoint 3
- [ ] 모바일에서 숫자 키패드 확인
- [ ] 터치 타겟 48px 이상
- [ ] 스와이프 네비게이션 동작

---

## Phase 4: 템플릿 기능

### Task 4.1: DB 스키마 추가
- [ ] `prisma/schema.prisma`에 ExpenseTemplate 모델 추가
- [ ] `npm run db:push` 실행
- **검증**: Prisma Studio에서 테이블 생성 확인

### Task 4.2: 템플릿 API (GET/POST)
- [ ] `app/api/expense-templates/route.ts` 생성
- [ ] GET: 사용자 템플릿 목록 (usageCount DESC)
- [ ] POST: 템플릿 생성 (최대 20개 제한)
- **검증**: API 테스트

### Task 4.3: 템플릿 API (PUT/DELETE)
- [ ] `app/api/expense-templates/[id]/route.ts` 생성
- [ ] PUT: 템플릿 수정 + usageCount 증가
- [ ] DELETE: 템플릿 삭제
- **검증**: API 테스트

### Task 4.4: TemplateSelector 컴포넌트
- [ ] `components/simple-expense-form/TemplateSelector.tsx` 생성
- [ ] 템플릿 목록 표시 (칩 또는 드롭다운)
- [ ] 템플릿 선택 시 폼 자동 채움
- **검증**: 템플릿 선택 동작

### Task 4.5: SaveTemplateModal 컴포넌트
- [ ] `components/simple-expense-form/SaveTemplateModal.tsx` 생성
- [ ] 템플릿 이름 입력
- [ ] 저장 확인 모달
- **검증**: 작성 완료 후 템플릿 저장

### Task 4.6: 폼 통합
- [ ] WizardStep1에 TemplateSelector 추가
- [ ] 제출 성공 후 "템플릿 저장" 옵션 제공
- **검증**: 전체 흐름 테스트

### Checkpoint 4
- [ ] 템플릿 CRUD 동작 확인
- [ ] 사용 횟수 정렬 확인
- [ ] 제한 (20개) 확인

---

## 최종 검증

### 기능 테스트
- [ ] 저장된 계좌 선택 및 자동 채움
- [ ] 2단계 마법사 전체 흐름
- [ ] 템플릿 저장 및 불러오기
- [ ] 모바일 터치 최적화

### 회귀 테스트
- [ ] 기존 지출결의서 작성 기능
- [ ] 기존 간편 지출결의서 수정 기능
- [ ] 결재 프로세스

### 성능 테스트
- [ ] 계좌/템플릿 조회 응답 시간 < 200ms
- [ ] 폼 입력 반응성

---

## 진행 상황

| Phase | 상태 | 완료일 |
|-------|------|--------|
| Phase 1: 저장된 은행 계좌 | ⬜ 대기 | - |
| Phase 2: 2단계 마법사 UI | ⬜ 대기 | - |
| Phase 3: 모바일 최적화 | ⬜ 대기 | - |
| Phase 4: 템플릿 기능 | ⬜ 대기 | - |
