# PRD (Product Requirements Document)

## To Do List

- [x] `npm run lint` 실행 가능
- [x] `npm run test` 실행 가능
- [x] `npm run test:coverage` 실행 가능
- [x] `npm run test:e2e` 실행 가능
- [x] CI/CD에서 자동 실행 설정 완료
- [x] 영수증 첨부 필수 validation (제출 시)
- [x] 청구인 서명 누락 버그 수정 (신규 생성 + 제출)
- [x] 재정보고서 API 권한 검증 추가 (finance_head, accountant, finance_member만 접근)
- [x] 재정보고서 UI 아코디언 확장 (레벨 2 하위 항목 토글 표시)
- [x] 재정보고서 Excel 내보내기 기능 추가
- [x] 재정보고서 파싱 로직 보강 (다중 시트, 병합 셀, 합계 검증 5% 초과 시 저장 거부)

## 청나잇 (Youth Night) 기능

- [ ] Phase 1: 기반 구축
  - [ ] Curriculum, Lesson, Question 모델 추가 (prisma/schema.prisma)
  - [ ] CurriculumType (FAMILY_WORSHIP, YOUTH_NIGHT), AgeGroup enum 추가
  - [ ] 청나잇 메인 페이지 (/youth-night)
  - [ ] 연령별 페이지 (/youth-night/[ageGroup])
  - [ ] 레슨 상세 페이지 (/youth-night/[ageGroup]/lessons/[lessonId])
- [ ] Phase 2: 학생 참여 기능
  - [ ] Attendance 모델 및 출석 체크 API
  - [ ] QuizResponse 모델 및 퀴즈 기능
  - [ ] 포인트 시스템 (StudentPoints)
- [ ] Phase 3: 암송 & 랭킹
  - [ ] RecitationSubmission 모델 및 암송 인증
  - [ ] 랭킹 시스템 (/youth-night/[ageGroup]/ranking)
- [ ] Phase 4: 관리자 기능
  - [ ] 교안 업로드 (관리자)
  - [ ] 암송 승인 (교사)
  - [ ] 통계 대시보드
