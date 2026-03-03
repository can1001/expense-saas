/**
 * PPTX 프레젠테이션 생성 스크립트
 *
 * 사용법: node generate-pptx.js
 *
 * 3개의 PPTX 파일을 생성합니다:
 * - 01-expense-guide.pptx (지출결의서 작성 가이드)
 * - 02-pwa-guide.pptx (PWA 사용 가이드)
 * - 03-push-guide.pptx (푸시 알림 가이드)
 */

const pptxgen = require('pptxgenjs');
const path = require('path');

// 공통 스타일 설정
const STYLES = {
  title: { fontSize: 36, bold: true, color: '3B82F6' },
  subtitle: { fontSize: 18, color: '6B7280' },
  heading: { fontSize: 28, bold: true, color: '1E40AF' },
  body: { fontSize: 16, color: '374151' },
  bullet: { fontSize: 14, color: '374151' },
  tableHeader: { fontSize: 12, bold: true, fill: '3B82F6', color: 'FFFFFF' },
  tableBody: { fontSize: 11, color: '374151' },
};

// 슬라이드 마스터 설정
function setupMaster(pptx) {
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = '지출결의서 시스템';
  pptx.company = '';
  pptx.subject = '사용자 가이드';

  pptx.defineSlideMaster({
    title: 'MASTER_SLIDE',
    background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0, y: '95%', w: '100%', h: '5%', fill: { color: '3B82F6' } } },
      { text: { text: '지출결의서 시스템', options: { x: 0.5, y: '96%', fontSize: 10, color: 'FFFFFF' } } },
    ],
    slideNumber: { x: '95%', y: '96%', fontSize: 10, color: 'FFFFFF' },
  });
}

// 표지 슬라이드 생성
function addTitleSlide(pptx, title, subtitle) {
  const slide = pptx.addSlide();
  slide.addText(title, {
    x: 0.5, y: '35%', w: '90%', h: 1.5,
    fontSize: 44, bold: true, color: '3B82F6', align: 'center',
  });
  slide.addText(subtitle, {
    x: 0.5, y: '55%', w: '90%', h: 0.5,
    fontSize: 20, color: '6B7280', align: 'center',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: '35%', y: '50%', w: '30%', h: 0.02, fill: { color: '3B82F6' },
  });
}

// 목차 슬라이드 생성
function addTocSlide(pptx, title, items) {
  const slide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  slide.addText(title, { x: 0.5, y: 0.3, w: '90%', ...STYLES.heading });

  items.forEach((item, i) => {
    slide.addText(`${i + 1}. ${item}`, {
      x: 1, y: 1.2 + (i * 0.45), w: '80%',
      fontSize: 16, color: '374151', bullet: false,
    });
  });
}

// 일반 슬라이드 생성
function addContentSlide(pptx, title, content, options = {}) {
  const slide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  slide.addText(title, { x: 0.5, y: 0.3, w: '90%', ...STYLES.heading });

  if (typeof content === 'string') {
    slide.addText(content, {
      x: 0.5, y: 1.0, w: '90%', h: 4,
      fontSize: 14, color: '374151', valign: 'top',
    });
  } else if (Array.isArray(content)) {
    content.forEach((item, i) => {
      slide.addText(item, {
        x: 0.7, y: 1.0 + (i * 0.4), w: '85%',
        fontSize: 14, color: '374151', bullet: { type: 'bullet' },
      });
    });
  }

  return slide;
}

// 테이블 슬라이드 생성
function addTableSlide(pptx, title, headers, rows, options = {}) {
  const slide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  slide.addText(title, { x: 0.5, y: 0.3, w: '90%', ...STYLES.heading });

  const tableData = [
    headers.map(h => ({ text: h, options: { ...STYLES.tableHeader } })),
    ...rows.map(row => row.map(cell => ({ text: cell, options: { ...STYLES.tableBody } }))),
  ];

  slide.addTable(tableData, {
    x: 0.5, y: 1.0, w: options.width || '90%',
    border: { pt: 0.5, color: 'E5E7EB' },
    colW: options.colW,
    fontFace: 'Apple SD Gothic Neo',
  });

  return slide;
}

// 코드 블록 슬라이드 생성
function addCodeSlide(pptx, title, code, description = '') {
  const slide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  slide.addText(title, { x: 0.5, y: 0.3, w: '90%', ...STYLES.heading });

  if (description) {
    slide.addText(description, {
      x: 0.5, y: 0.9, w: '90%',
      fontSize: 14, color: '6B7280',
    });
  }

  slide.addText(code, {
    x: 0.5, y: description ? 1.4 : 1.0, w: '90%', h: 3,
    fontSize: 12, fontFace: 'Courier New', color: '1F2937',
    fill: { color: 'F3F4F6' }, valign: 'top',
  });

  return slide;
}

// 감사 슬라이드 생성
function addThankYouSlide(pptx) {
  const slide = pptx.addSlide();
  slide.addText('감사합니다', {
    x: 0.5, y: '40%', w: '90%', h: 1,
    fontSize: 44, bold: true, color: '3B82F6', align: 'center',
  });
  slide.addText('문의: 관리자에게 연락', {
    x: 0.5, y: '55%', w: '90%', h: 0.5,
    fontSize: 18, color: '6B7280', align: 'center',
  });
}

// ================================================
// 1. 지출결의서 작성 가이드
// ================================================
function generateExpenseGuide() {
  const pptx = new pptxgen();
  setupMaster(pptx);
  pptx.title = '지출결의서 작성 가이드';

  // 1. 표지
  addTitleSlide(pptx, '지출결의서 작성 가이드', '지출결의서 관리 시스템 사용자 교육');

  // 2. 목차
  addTocSlide(pptx, '목차', [
    '작성 Flow 개요',
    '예산 정보 입력',
    '세부 항목 입력',
    '신청 정보 입력',
    '은행 정보 입력',
    '첨부파일 업로드',
    '결재선 미리보기',
    '저장과 제출',
    '서명/도장 선택',
    '지출결의서 수정',
  ]);

  // 3. 작성 Flow 개요
  let slide = addCodeSlide(pptx, '작성 Flow 개요',
    '예산 정보 → 세부 항목 → 신청 정보 → 은행 정보 → 첨부파일 → 결재선 확인 → 저장/제출');

  addTableSlide(pptx, '접근 방법',
    ['플랫폼', '방법'],
    [
      ['데스크톱', '상단 메뉴 → "새 지출결의서"'],
      ['모바일', '하단 네비게이션 → "+" 버튼'],
    ]);

  // 4. 예산 정보 입력
  addTableSlide(pptx, '1단계: 예산 정보 입력 - 4단계 계층 선택',
    ['순서', '항목', '예시'],
    [
      ['1', '위원회', '재정위원회'],
      ['2', '사역팀/부', '재정팀'],
      ['3', '예산(항)', '사무행정비'],
      ['4', '예산(목)', '회의접대비'],
    ]);

  addContentSlide(pptx, '예산 정보 선택 규칙', [
    '상위 항목 선택 → 하위 항목 활성화',
    '상위 항목 변경 시 하위 항목 초기화',
    '예산(목)까지 선택해야 세목 선택 가능',
  ]);

  // 5. 세부 항목 입력
  addTableSlide(pptx, '2단계: 세부 항목 입력 (1~10개)',
    ['필드', '설명', '필수'],
    [
      ['예산(세목)', '드롭다운 선택', 'O'],
      ['적요', '지출 상세 설명', 'O'],
      ['단가', '건당 금액 (원)', 'O'],
      ['수량', '개수/인원', 'O'],
      ['금액', '자동 계산 (단가 × 수량)', '자동'],
    ]);

  addContentSlide(pptx, '세부 항목 - 편의 기능', [
    '적요 입력 도우미: 포커스 시 예제 툴팁 표시',
    '음성 입력 (모바일): 마이크 버튼 탭 → 음성으로 적요 입력',
    '항목 추가: "+ 항목 추가" 버튼 (최대 10개)',
    '항목 삭제: 각 항목의 "X" 버튼 (최소 1개 유지)',
  ]);

  // 6. 신청 정보 입력
  addTableSlide(pptx, '3단계: 신청 정보 입력',
    ['필드', '설명', '자동 입력'],
    [
      ['청구일자', '청구 날짜', '오늘 날짜'],
      ['청구팀', '위원회 + 사역팀', '자동 생성'],
      ['청구인', '작성자 이름', '로그인 사용자'],
      ['직책', '작성자 직책', '-'],
    ]);

  // 7. 은행 정보 입력
  addContentSlide(pptx, '4단계: 은행 정보 입력', [
    '모드 1: 저장된 계좌 - 미리 저장한 계좌 드롭다운 선택',
    '모드 2: 직접 입력 - 은행명, 계좌번호, 예금주 입력',
    '기본 계좌가 있으면 자동 선택됨',
  ]);

  // 8. 첨부파일 업로드
  addContentSlide(pptx, '5단계: 첨부파일 업로드', [
    '드래그 앤 드롭: 파일 끌어다 놓기',
    '클릭하여 선택: 업로드 영역 클릭',
    '카메라 촬영 (모바일): 영수증 바로 촬영',
    '제한: 이미지/PDF, 각 5MB 이하, 최대 10개',
  ]);

  // 9. 결재선 미리보기
  addCodeSlide(pptx, '6단계: 결재선 미리보기',
    '1차 결재: 세목 담당자 (팀장)\n    ↓\n2차 결재: 회계\n    ↓\n3차 결재: 재정팀장',
    '예산 현황: 배정 예산 / 사용 금액 / 잔여 예산 표시');

  // 10. 저장과 제출
  addTableSlide(pptx, '저장과 제출',
    ['버튼', '동작', '결과 상태'],
    [
      ['취소', '작성 취소', '-'],
      ['저장', '임시 저장', 'DRAFT (작성중)'],
      ['제출', '결재 요청', 'PENDING (결재대기)'],
    ]);

  addContentSlide(pptx, '저장 vs 제출 차이점', [
    '저장: 나중에 계속 작성 가능, 수정 가능',
    '제출: 결재자에게 전달, 수정 불가 (회수 후 수정 가능)',
  ]);

  // 11. 서명/도장 선택
  addContentSlide(pptx, '서명/도장 선택', [
    '방식 1: 저장된 서명/도장 - 마이페이지에서 미리 등록',
    '방식 2: 실시간 서명 - 화면에 직접 서명 그리기',
    '기본 서명이 설정되어 있으면 자동 사용',
  ]);

  // 12. 지출결의서 수정
  addTableSlide(pptx, '지출결의서 수정 가능 상태',
    ['상태', '수정 가능'],
    [
      ['DRAFT (작성중)', 'O'],
      ['REJECTED (반려됨)', 'O'],
      ['WITHDRAWN (회수됨)', 'O'],
      ['PENDING (결재대기)', 'X (회수 후 가능)'],
      ['APPROVED (승인됨)', 'X'],
    ]);

  // 13. FAQ
  addContentSlide(pptx, 'FAQ', [
    'Q: 예산(세목)이 선택되지 않아요 → A: 예산(목)을 먼저 선택하세요',
    'Q: 저장 후 어디서 찾나요? → A: "내 지출결의서" 메뉴 → "작성중" 상태',
    'Q: 제출 후 수정하고 싶어요 → A: "회수" 버튼으로 회수 후 수정 가능',
    'Q: 카메라가 작동 안 해요 → A: HTTPS 연결 필요 (localhost 제외)',
  ]);

  // 감사 슬라이드
  addThankYouSlide(pptx);

  return pptx.writeFile({ fileName: path.join(__dirname, '01-expense-guide.pptx') });
}

// ================================================
// 2. PWA 사용 가이드
// ================================================
function generatePwaGuide() {
  const pptx = new pptxgen();
  setupMaster(pptx);
  pptx.title = 'PWA 사용 가이드';

  // 1. 표지
  addTitleSlide(pptx, 'PWA 사용 가이드', '지출결의서 앱 설치 및 오프라인 사용');

  // 2. PWA란?
  addTableSlide(pptx, 'PWA란? (Progressive Web App)',
    ['장점', '설명'],
    [
      ['설치 가능', '홈 화면에 아이콘으로 추가'],
      ['오프라인 지원', '인터넷 없이도 사용 가능'],
      ['빠른 로딩', '리소스 캐싱으로 빠른 시작'],
      ['자동 업데이트', '앱스토어 없이 자동 업데이트'],
      ['저용량', '네이티브 앱 대비 적은 용량'],
    ]);

  // 3. 앱 설치 - iOS
  addContentSlide(pptx, '앱 설치 - iOS (iPhone, iPad)', [
    '1. Safari 브라우저로 사이트 접속',
    '2. 하단의 공유 버튼 (□↑) 탭',
    '3. 스크롤하여 "홈 화면에 추가" 선택',
    '4. 이름 확인 후 "추가" 탭',
    '',
    '⚠️ iOS에서는 Safari에서만 PWA 설치 가능',
  ]);

  // 4. 앱 설치 - Android
  addContentSlide(pptx, '앱 설치 - Android', [
    '1. Chrome으로 사이트 접속',
    '2. 주소창 옆 메뉴 (⋮) 탭',
    '3. "앱 설치" 또는 "홈 화면에 추가" 선택',
    '4. "설치" 확인',
    '',
    '자동 설치 배너: 여러 번 방문 시 자동 표시',
  ]);

  // 5. 앱 설치 - Desktop
  addContentSlide(pptx, '앱 설치 - Desktop (PC, Mac)', [
    'Chrome:',
    '  1. 사이트 접속',
    '  2. 주소창 오른쪽의 설치 아이콘 (⊕) 클릭',
    '  3. "설치" 확인',
    '',
    'Edge: 동일한 방식으로 설치 가능',
  ]);

  // 6. 오프라인 사용
  addTableSlide(pptx, '오프라인 사용',
    ['가능 ✅', '불가능 ❌'],
    [
      ['지출결의서 작성', '결재 제출'],
      ['임시저장', '결재선 조회'],
      ['첨부파일 추가', '예산 현황 조회'],
    ]);

  addContentSlide(pptx, '오프라인 상태 표시', [
    '인터넷 연결이 끊어지면 화면 상단에 노란색 배너 표시',
    '"오프라인 상태입니다. 작성한 내용은 자동으로 저장됩니다."',
    '데이터는 브라우저 IndexedDB에 자동 저장',
  ]);

  // 7. 백그라운드 동기화
  addTableSlide(pptx, '백그라운드 동기화 - 상태 표시',
    ['상태', '배너 색상', '설명'],
    [
      ['오프라인', '노란색', '인터넷 연결 없음'],
      ['동기화 대기', '파란색', 'N개 항목 대기 중'],
      ['동기화 완료', '녹색', '모든 데이터 동기화됨'],
      ['동기화 실패', '빨간색', '오류 발생'],
    ]);

  // 8. 문제 해결
  addContentSlide(pptx, '문제 해결', [
    '설치 옵션이 안 나타남:',
    '  - iOS: Safari 브라우저 사용 확인',
    '  - Android: HTTPS 연결 확인',
    '',
    '오프라인에서 작동 안 함:',
    '  - 해당 페이지를 온라인에서 한 번 방문 필요',
    '',
    '동기화가 안 됨:',
    '  - "지금 동기화" 버튼 클릭 또는 페이지 새로고침',
  ]);

  // 감사 슬라이드
  addThankYouSlide(pptx);

  return pptx.writeFile({ fileName: path.join(__dirname, '02-pwa-guide.pptx') });
}

// ================================================
// 3. 푸시 알림 가이드
// ================================================
function generatePushGuide() {
  const pptx = new pptxgen();
  setupMaster(pptx);
  pptx.title = '푸시 알림 가이드';

  // 1. 표지
  addTitleSlide(pptx, '푸시 알림 가이드', '결재 알림을 실시간으로 받아보세요');

  // 2. 웹 푸시 알림이란?
  addTableSlide(pptx, '웹 푸시 알림이란?',
    ['장점', '설명'],
    [
      ['실시간 알림', '결재 이벤트 발생 시 즉시 알림'],
      ['백그라운드 알림', '브라우저를 닫아도 알림 수신'],
      ['다기기 지원', 'PC, 모바일 모두 알림 가능'],
    ]);

  addTableSlide(pptx, '지원 브라우저',
    ['브라우저', '지원 여부', '비고'],
    [
      ['Chrome', '✅', '권장'],
      ['Edge', '✅', ''],
      ['Firefox', '✅', ''],
      ['Safari', '⚠️', 'macOS 13+, iOS 16.4+'],
    ]);

  // 3. 알림 권한 설정
  addContentSlide(pptx, '알림 권한 설정', [
    '1. 사이트 접속 시 알림 권한 요청 배너 표시',
    '2. "알림 받기" 버튼 클릭',
    '3. 브라우저 권한 요청 팝업에서 "허용" 선택',
    '',
    '권한 상태:',
    '  - 허용 (granted): 알림 수신 가능',
    '  - 거부 (denied): 알림 차단됨',
    '  - 기본값 (default): 아직 선택 안 함',
  ]);

  // 4. 알림 종류
  addTableSlide(pptx, '알림 종류',
    ['이벤트', '수신자', '알림 내용'],
    [
      ['결재 제출', '결재자', '새로운 결재 요청 도착'],
      ['결재 승인', '신청자', '결재가 승인됨'],
      ['결재 반려', '신청자', '결재가 반려됨 + 사유'],
      ['결재 회수', '결재자', '결재 요청 회수됨'],
      ['지급 완료', '신청자', '지급 완료됨'],
    ]);

  // 5. 알림 설정 변경
  addContentSlide(pptx, '알림 설정 변경', [
    '설정 페이지 접근:',
    '  프로필 아이콘 → "설정" → "알림 설정" 탭',
    '',
    '채널별 설정:',
    '  - SMS 알림 수신 여부',
    '  - 카카오 알림톡 수신 여부',
    '  - 웹 푸시 알림 수신 여부',
    '',
    '이벤트별 설정:',
    '  각 이벤트(제출/승인/반려/지급완료)별로 개별 설정 가능',
  ]);

  // 6. 문제 해결
  addContentSlide(pptx, '문제 해결 - 알림이 오지 않음', [
    '1. 브라우저 설정 확인',
    '   주소창 자물쇠 아이콘 → 사이트 설정 → 알림 허용',
    '',
    '2. 운영체제 설정 확인',
    '   Windows/macOS: 설정 → 알림 → 브라우저 앱 허용',
    '',
    '3. 방해 금지 모드 확인',
    '   방해 금지 모드가 켜져 있으면 알림이 표시되지 않음',
  ]);

  addContentSlide(pptx, '권한 거부 시 다시 허용하기', [
    'Chrome:',
    '  1. 주소창 왼쪽 자물쇠 아이콘 클릭',
    '  2. "사이트 설정" 선택',
    '  3. "알림"을 "허용"으로 변경',
    '',
    'Safari:',
    '  1. Safari → 환경설정 → 웹사이트 → 알림',
    '  2. 해당 사이트 설정을 "허용"으로 변경',
  ]);

  // 감사 슬라이드
  addThankYouSlide(pptx);

  return pptx.writeFile({ fileName: path.join(__dirname, '03-push-guide.pptx') });
}

// ================================================
// 메인 실행
// ================================================
async function main() {
  console.log('PPTX 파일 생성 시작...\n');

  try {
    console.log('1. 지출결의서 작성 가이드 생성 중...');
    await generateExpenseGuide();
    console.log('   ✅ 01-expense-guide.pptx 생성 완료\n');

    console.log('2. PWA 사용 가이드 생성 중...');
    await generatePwaGuide();
    console.log('   ✅ 02-pwa-guide.pptx 생성 완료\n');

    console.log('3. 푸시 알림 가이드 생성 중...');
    await generatePushGuide();
    console.log('   ✅ 03-push-guide.pptx 생성 완료\n');

    console.log('========================================');
    console.log('모든 PPTX 파일이 생성되었습니다!');
    console.log('========================================');
    console.log('생성된 파일:');
    console.log('  - 01-expense-guide.pptx');
    console.log('  - 02-pwa-guide.pptx');
    console.log('  - 03-push-guide.pptx');
  } catch (error) {
    console.error('오류 발생:', error);
    process.exit(1);
  }
}

main();
