/**
 * Capacitor 런타임 감지 헬퍼
 *
 * Next.js 동일 코드가 웹 브라우저와 Capacitor WebView 양쪽에서 동작할 때,
 * 어떤 환경에서 실행 중인지 분기하기 위한 유틸.
 */

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return capacitor ?? null;
}

/**
 * Capacitor WebView 환경인지 (모바일 앱)
 */
export function isCapacitor(): boolean {
  return !!getCapacitor()?.isNativePlatform?.();
}

/**
 * 플랫폼 식별자 반환: 'android' | 'ios' | 'web'
 */
export function getPlatform(): 'android' | 'ios' | 'web' {
  const p = getCapacitor()?.getPlatform?.();
  if (p === 'android' || p === 'ios') return p;
  return 'web';
}

/**
 * Capacitor Android 앱에서만 true
 */
export function isCapacitorAndroid(): boolean {
  return isCapacitor() && getPlatform() === 'android';
}
