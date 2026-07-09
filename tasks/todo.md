# 템플릿 UI 구현 태스크 (Phase 4) ✅ 완료

## 진행 상황

| Phase | 상태 | 완료일 |
|-------|------|--------|
| Phase 1: 저장된 은행 계좌 | ✅ 완료 | 기존 |
| Phase 2: 2단계 마법사 UI | ✅ 완료 | 2026-05-04 |
| Phase 3: 모바일 최적화 | ✅ 완료 | 2026-05-04 |
| Phase 4: 템플릿 API | ✅ 완료 | 2026-05-04 |
| **Phase 4: 템플릿 UI** | ✅ 완료 | 2026-07-09 |

---

## Slice 1: 템플릿 불러오기 ✅

### Task 4.4: useTemplates 훅 ✅
- [x] `lib/hooks/useTemplates.ts` 생성
- [x] GET `/api/expense-templates` 호출
- [x] POST `/api/expense-templates/[id]` (use) 호출
- [x] POST `/api/expense-templates` (create) 호출
- [x] 에러 핸들링
- **검증**: 단위 테스트 통과

### Task 4.5: TemplateSelector 컴포넌트 ✅
- [x] `components/simple-expense-form/TemplateSelector.tsx` 생성
- [x] 템플릿 목록 칩 형태로 표시 (최대 6개)
- [x] 사용 횟수 표시
- [x] 클릭 시 `onSelect` 콜백 호출
- [x] "더보기" 클릭 시 전체 목록 모달
- [x] 로딩/빈 상태 처리
- [x] 터치 타겟 48px
- **검증**: `components/simple-expense-form/__tests__/TemplateSelector.test.tsx`

### Task 4.6: WizardStep1에 통합 ✅
- [x] `WizardStep1.tsx`에 TemplateSelector 추가
- [x] `onTemplateSelect` prop 추가
- [x] 템플릿 선택 시 첫 번째 항목에 값 채움
- **검증**: 템플릿 선택 → 폼 채움 동작

### Checkpoint 1 ✅
- [x] 템플릿 목록 표시 확인
- [x] 템플릿 선택 시 폼 자동 채움 확인
- [x] usageCount 증가 확인

---

## Slice 2: 템플릿 저장하기 ✅

### Task 4.7: SaveTemplateModal 컴포넌트 ✅
- [x] `components/simple-expense-form/SaveTemplateModal.tsx` 생성
- [x] 모달 열기/닫기
- [x] 템플릿 이름 입력 (필수, 최대 50자)
- [x] 저장 성공 시 토스트 메시지
- [x] 최대 20개 제한 시 안내
- **검증**: `components/simple-expense-form/__tests__/SaveTemplateModal.test.tsx`

### Task 4.8: SimpleExpenseWizard에 저장 유도 통합 ✅
- [x] 제출 성공 후 저장 유도 모달 표시
- [x] "저장하기" 클릭 시 SaveTemplateModal 열기
- [x] "나중에" 클릭 시 바로 목록으로 이동
- **검증**: 제출 → 저장 유도 → 템플릿 생성

### Checkpoint 2 ✅
- [x] 제출 후 저장 유도 모달 표시 확인
- [x] 템플릿 저장 성공 확인
- [x] 저장된 템플릿이 목록에 표시 확인

---

## 최종 검증 ✅

### 기능 테스트
- [x] 템플릿 불러오기 → 폼 채움 → 제출 → 성공
- [x] 새 작성 → 제출 → 템플릿 저장 → 다음 작성 시 불러오기
- [x] usageCount 정렬 (자주 쓰는 것 먼저)

### 회귀 테스트
- [x] 템플릿 없이 기존 방식으로 작성 가능
- [x] 모바일/데스크톱 반응형 동작

### 성능 테스트
- [x] 템플릿 목록 로드 < 200ms

---

## 구현 파일 목록

| 파일 | 역할 |
|------|------|
| `lib/hooks/useTemplates.ts` | 템플릿 CRUD 훅 |
| `components/simple-expense-form/TemplateSelector.tsx` | 템플릿 선택 UI |
| `components/simple-expense-form/SaveTemplateModal.tsx` | 템플릿 저장 모달 |
| `components/simple-expense-form/WizardStep1.tsx` | Step 1에 템플릿 선택 통합 |
| `components/simple-expense-form/SimpleExpenseWizard.tsx` | 저장 유도 로직 통합 |
| `app/api/expense-templates/route.ts` | GET/POST API |
| `app/api/expense-templates/[id]/route.ts` | GET/PUT/DELETE/POST API |
