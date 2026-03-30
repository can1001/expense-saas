'use client';

import { useEffect, useState } from 'react';

interface SafeAreaInfo {
  isAndroid: boolean;
  isPWA: boolean;
  isAndroidPWA: boolean;
  bottomInset: number;
}

export function useSafeArea(): SafeAreaInfo {
  const [safeArea, setSafeArea] = useState<SafeAreaInfo>({
    isAndroid: false,
    isPWA: false,
    isAndroidPWA: false,
    bottomInset: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = /android/i.test(userAgent);

    // PWA standalone 모드 감지
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error - iOS Safari specific
      window.navigator.standalone === true;

    const isAndroidPWA = isAndroid && isPWA;

    // Android PWA에서 네비게이션 바 높이 계산
    let bottomInset = 0;
    if (isAndroidPWA) {
      // window.screen.height - window.innerHeight로 근사값 계산
      const screenDiff = window.screen.height - window.innerHeight;

      // 상태바(~24dp) + 네비게이션바(~48dp) = ~72dp 예상
      if (screenDiff > 100) {
        // 3-button navigation: ~48dp
        bottomInset = 48;
      } else if (screenDiff > 50) {
        // Gesture navigation: ~32dp
        bottomInset = 32;
      } else {
        // Minimal navigation
        bottomInset = 16;
      }

      // CSS 변수로 설정
      document.documentElement.style.setProperty(
        '--android-nav-height',
        `${bottomInset}px`
      );
    }

    setSafeArea({
      isAndroid,
      isPWA,
      isAndroidPWA,
      bottomInset,
    });

    // display-mode 변경 감지 (브라우저 -> PWA 전환 시)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => {
      window.location.reload();
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return safeArea;
}
