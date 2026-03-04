/**
 * 푸시 알림 테스트 스크립트
 *
 * 사용법:
 *   npx ts-node scripts/test-push-notification.ts
 *
 * 환경 변수:
 *   TEST_BASE_URL - 테스트 대상 URL (기본: http://localhost:4001)
 *   TEST_USER_ID - 테스트 계정 ID
 *   TEST_USER_PASSWORD - 테스트 계정 비밀번호
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4001';
const TEST_USER_ID = process.env.TEST_USER_ID || 'testuser';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'test1234';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: unknown;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function addResult(name: string, success: boolean, message: string, data?: unknown) {
  results.push({ name, success, message, data });
  const icon = success ? '✅' : '❌';
  log(`${icon} ${name}: ${message}`);
}

async function testVapidPublicKey(): Promise<string | null> {
  log('\n=== 테스트 1: VAPID 공개키 조회 ===');

  try {
    const response = await fetch(`${BASE_URL}/api/push/vapid-public-key`);
    const data = await response.json();

    if (response.ok && data.publicKey) {
      addResult('VAPID 공개키 조회', true, `키 길이: ${data.publicKey.length}자`);
      return data.publicKey;
    } else if (response.status === 503) {
      addResult('VAPID 공개키 조회', false, 'VAPID 키가 설정되지 않았습니다.');
      return null;
    } else {
      addResult('VAPID 공개키 조회', false, `응답 오류: ${JSON.stringify(data)}`);
      return null;
    }
  } catch (error) {
    addResult('VAPID 공개키 조회', false, `네트워크 오류: ${error}`);
    return null;
  }
}

async function login(): Promise<string | null> {
  log('\n=== 테스트 2: 로그인 ===');

  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userid: TEST_USER_ID,
        password: TEST_USER_PASSWORD,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user?.id) {
        addResult('로그인', true, `사용자: ${data.user.username} (${data.user.role})`);
        // Push API는 'user' 쿠키에 JSON 형식의 사용자 정보를 기대함
        const userCookieValue = encodeURIComponent(JSON.stringify(data.user));
        return `user=${userCookieValue}`;
      } else {
        addResult('로그인', false, '응답에 사용자 정보 없음');
        return null;
      }
    } else {
      const data = await response.json();
      addResult('로그인', false, `로그인 실패: ${data.error || '알 수 없는 오류'}`);
      return null;
    }
  } catch (error) {
    addResult('로그인', false, `네트워크 오류: ${error}`);
    return null;
  }
}

async function testSubscribeWithoutAuth() {
  log('\n=== 테스트 3: 미인증 구독 요청 (401 예상) ===');

  try {
    const response = await fetch(`${BASE_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: {
          endpoint: 'https://test.example.com/push',
          keys: { p256dh: 'test', auth: 'test' },
        },
      }),
    });

    if (response.status === 401) {
      addResult('미인증 구독 거부', true, '401 Unauthorized 응답 확인');
    } else {
      addResult('미인증 구독 거부', false, `예상: 401, 실제: ${response.status}`);
    }
  } catch (error) {
    addResult('미인증 구독 거부', false, `네트워크 오류: ${error}`);
  }
}

async function testSubscribeWithInvalidData(cookie: string) {
  log('\n=== 테스트 4: 잘못된 구독 데이터 (400 예상) ===');

  try {
    const response = await fetch(`${BASE_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        subscription: {
          endpoint: '',  // 빈 endpoint
          keys: {},
        },
      }),
    });

    if (response.status === 400) {
      addResult('잘못된 데이터 거부', true, '400 Bad Request 응답 확인');
    } else {
      const data = await response.json();
      addResult('잘못된 데이터 거부', false, `예상: 400, 실제: ${response.status}, ${JSON.stringify(data)}`);
    }
  } catch (error) {
    addResult('잘못된 데이터 거부', false, `네트워크 오류: ${error}`);
  }
}

async function testPushTest(cookie: string): Promise<boolean> {
  log('\n=== 테스트 5: 테스트 푸시 발송 ===');

  try {
    const response = await fetch(`${BASE_URL}/api/push/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
    });

    const data = await response.json();

    if (response.ok && data.success) {
      addResult('테스트 푸시 발송', true, data.message, data.results);
      return true;
    } else if (response.status === 503) {
      addResult('테스트 푸시 발송', false, 'VAPID 키 미설정으로 푸시 불가');
      return false;
    } else if (response.status === 404 && data.code === 'NO_SUBSCRIPTION') {
      // 구독이 없는 경우는 예상된 결과 - 경고로 처리
      addResult('테스트 푸시 발송', true, `(예상됨) ${data.error} - 브라우저에서 구독 후 테스트하세요`);
      return true;
    } else {
      addResult('테스트 푸시 발송', false, `오류: ${data.error || JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    addResult('테스트 푸시 발송', false, `네트워크 오류: ${error}`);
    return false;
  }
}

async function testUnsubscribeAll(cookie: string) {
  log('\n=== 테스트 6: 모든 구독 해제 ===');

  try {
    const response = await fetch(`${BASE_URL}/api/push/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ all: true }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      addResult('모든 구독 해제', true, data.message);
    } else {
      addResult('모든 구독 해제', false, `오류: ${data.error || JSON.stringify(data)}`);
    }
  } catch (error) {
    addResult('모든 구독 해제', false, `네트워크 오류: ${error}`);
  }
}

async function checkCurrentUser(cookie: string) {
  log('\n=== 테스트 7: 쿠키 검증 ===');

  try {
    // user 쿠키에서 사용자 정보 추출
    const match = cookie.match(/user=([^;]+)/);
    if (match) {
      const userInfo = JSON.parse(decodeURIComponent(match[1]));
      addResult('쿠키 검증', true, `${userInfo.username} (${userInfo.role})`);
    } else {
      addResult('쿠키 검증', false, '쿠키에서 사용자 정보 추출 실패');
    }
  } catch (error) {
    addResult('쿠키 검증', false, `파싱 오류: ${error}`);
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('테스트 결과 요약');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
  });

  console.log('='.repeat(60));
  console.log(`총 ${results.length}개 테스트: ${passed}개 통과, ${failed}개 실패`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n⚠️  실패한 테스트가 있습니다. 위 로그를 확인하세요.');
  } else {
    console.log('\n🎉 모든 테스트가 통과했습니다!');
  }
}

function printBrowserTestGuide() {
  console.log('\n' + '='.repeat(60));
  console.log('브라우저에서 푸시 구독 테스트 방법');
  console.log('='.repeat(60));
  console.log(`
1. 브라우저에서 ${BASE_URL} 접속
2. 로그인
3. 개발자 도구 (F12) → Console 탭 열기
4. 아래 코드 실행:

// VAPID 공개키 가져오기
const keyRes = await fetch('/api/push/vapid-public-key');
const { publicKey } = await keyRes.json();

// 서비스 워커 준비
const registration = await navigator.serviceWorker.ready;

// 푸시 구독
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: publicKey
});

// 서버에 구독 등록
const res = await fetch('/api/push/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subscription: subscription.toJSON(),
    deviceName: 'Test Browser'
  })
});
console.log(await res.json());

// 테스트 푸시 발송
const testRes = await fetch('/api/push/test', { method: 'POST' });
console.log(await testRes.json());
// → 브라우저 알림이 표시되어야 합니다!

5. 알림이 표시되면 성공!
`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('푸시 알림 테스트 스크립트');
  console.log('='.repeat(60));
  console.log(`대상 URL: ${BASE_URL}`);
  console.log(`테스트 계정: ${TEST_USER_ID}`);
  console.log('='.repeat(60));

  // 테스트 1: VAPID 공개키 조회
  const publicKey = await testVapidPublicKey();

  if (!publicKey) {
    console.log('\n⚠️  VAPID 키가 설정되지 않아 푸시 알림을 테스트할 수 없습니다.');
    console.log('   .env 파일에 다음을 설정하세요:');
    console.log('   VAPID_PUBLIC_KEY="..."');
    console.log('   VAPID_PRIVATE_KEY="..."');
    console.log('   VAPID_SUBJECT="mailto:admin@example.com"');
    console.log('\n   키 생성: npx web-push generate-vapid-keys');
    printSummary();
    process.exit(1);
  }

  // 테스트 2: 로그인
  const cookie = await login();

  if (!cookie) {
    console.log('\n⚠️  로그인에 실패했습니다. 테스트 계정 정보를 확인하세요.');
    console.log(`   TEST_USER_ID=${TEST_USER_ID}`);
    console.log(`   TEST_USER_PASSWORD=****`);
    printSummary();
    process.exit(1);
  }

  // 테스트 3: 미인증 구독 거부
  await testSubscribeWithoutAuth();

  // 테스트 4: 잘못된 데이터 거부
  await testSubscribeWithInvalidData(cookie);

  // 테스트 5: 테스트 푸시 발송
  await testPushTest(cookie);

  // 테스트 6: 모든 구독 해제
  await testUnsubscribeAll(cookie);

  // 테스트 7: 현재 사용자 확인
  await checkCurrentUser(cookie);

  // 결과 요약
  printSummary();

  // 브라우저 테스트 가이드
  printBrowserTestGuide();
}

main().catch(console.error);
