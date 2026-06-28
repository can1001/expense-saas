# 템플릿 UI 구현 태스크 (Phase 4 잔여)

## 진행 상황

| Phase | 상태 | 완료일 |
|-------|------|--------|
| Phase 1: 저장된 은행 계좌 | ✅ 완료 | 기존 |
| Phase 2: 2단계 마법사 UI | ✅ 완료 | 2026-05-04 |
| Phase 3: 모바일 최적화 | ✅ 완료 | 2026-05-04 |
| Phase 4: 템플릿 API | ✅ 완료 | 2026-05-04 |
| **Phase 4: 템플릿 UI** | ⬜ 진행 중 | - |

---

## Slice 1: 템플릿 불러오기

### Task 4.4: useTemplates 훅
- [ ] `lib/hooks/useTemplates.ts` 생성
- [ ] GET `/api/expense-templates` 호출
- [ ] POST `/api/expense-templates/[id]` (use) 호출
- [ ] POST `/api/expense-templates` (create) 호출
- [ ] 에러 핸들링
- **검증**: 단위 테스트 통과

### Task 4.5: TemplateSelector 컴포넌트
- [ ] `components/simple-expense-form/TemplateSelector.tsx` 생성
- [ ] 템플릿 목록 칩 형태로 표시 (최대 6개)
- [ ] 사용 횟수 표시
- [ ] 클릭 시 `onSelect` 콜백 호출
- [ ] "더보기" 클릭 시 전체 목록 모달
- [ ] 로딩/빈 상태 처리
- [ ] 터치 타겟 48px
- **검증**: 컴포넌트 테스트

### Task 4.6: WizardStep1에 통합
- [ ] `WizardStep1.tsx`에 TemplateSelector 추가
- [ ] `onTemplateSelect` prop 추가
- [ ] 템플릿 선택 시 첫 번째 항목에 값 채움
- **검증**: 템플릿 선택 → 폼 채움 동작

### Checkpoint 1
- [ ] 템플릿 목록 표시 확인
- [ ] 템플릿 선택 시 폼 자동 채움 확인
- [ ] usageCount 증가 확인

---

## Slice 2: 템플릿 저장하기

### Task 4.7: SaveTemplateModal 컴포넌트
- [ ] `components/simple-expense-form/SaveTemplateModal.tsx` 생성
- [ ] 모달 열기/닫기
- [ ] 템플릿 이름 입력 (필수, 최대 50자)
- [ ] 저장 성공 시 토스트 메시지
- [ ] 최대 20개 제한 시 안내
- **검증**: 컴포넌트 테스트

### Task 4.8: SimpleExpenseWizard에 저장 유도 통합
- [ ] 제출 성공 후 저장 유도 모달 표시
- [ ] "저장하기" 클릭 시 SaveTemplateModal 열기
- [ ] "다음에" 클릭 시 바로 목록으로 이동
- **검증**: 제출 → 저장 유도 → 템플릿 생성

### Checkpoint 2
- [ ] 제출 후 저장 유도 모달 표시 확인
- [ ] 템플릿 저장 성공 확인
- [ ] 저장된 템플릿이 목록에 표시 확인

---

## 최종 검증

### 기능 테스트
- [ ] 템플릿 불러오기 → 폼 채움 → 제출 → 성공
- [ ] 새 작성 → 제출 → 템플릿 저장 → 다음 작성 시 불러오기
- [ ] usageCount 정렬 (자주 쓰는 것 먼저)

### 회귀 테스트
- [ ] 템플릿 없이 기존 방식으로 작성 가능
- [ ] 모바일/데스크톱 반응형 동작

### 성능 테스트
- [ ] 템플릿 목록 로드 < 200ms
