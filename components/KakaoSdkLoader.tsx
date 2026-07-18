'use client';

import Script from 'next/script';

// 카카오 JS SDK 로더 (M3 게이트, ARC-003)
// - NEXT_PUBLIC_KAKAO_JS_KEY 미설정 시 아무것도 로드하지 않는다.
//   로그인/초대/마이페이지의 카카오 버튼은 window.Kakao 부재를 감지해 안내만 표시한다.
// - 로그인 버튼들이 Kakao.Auth.login(팝업 콜백) 방식을 쓰므로 구(v1) SDK를 로드한다.
const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

interface KakaoSdkGlobal {
  isInitialized?: () => boolean;
  init?: (jsKey: string) => void;
}

export function KakaoSdkLoader() {
  if (!KAKAO_JS_KEY) return null;

  return (
    <Script
      src="https://developers.kakao.com/sdk/js/kakao.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        const kakao = (window as unknown as { Kakao?: KakaoSdkGlobal }).Kakao;
        if (kakao?.init && !kakao.isInitialized?.()) {
          kakao.init(KAKAO_JS_KEY);
        }
      }}
    />
  );
}
