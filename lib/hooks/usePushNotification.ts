'use client';

import { useState, useEffect, useCallback } from 'react';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface UsePushNotificationReturn {
  /** 푸시 알림 지원 여부 */
  isSupported: boolean;

  /** 현재 권한 상태 */
  permission: PermissionState;

  /** 구독 여부 */
  isSubscribed: boolean;

  /** 로딩 상태 */
  isLoading: boolean;

  /** 에러 메시지 */
  error: string | null;

  /** 푸시 권한 요청 및 구독 */
  subscribe: (deviceName?: string) => Promise<boolean>;

  /** 구독 해제 */
  unsubscribe: () => Promise<boolean>;

  /** 테스트 알림 발송 */
  sendTest: () => Promise<boolean>;
}

/**
 * 웹 푸시 알림 관리 훅
 *
 * @example
 * const { isSupported, permission, isSubscribed, subscribe, unsubscribe } = usePushNotification();
 *
 * if (!isSupported) {
 *   return <div>이 브라우저는 푸시 알림을 지원하지 않습니다.</div>;
 * }
 *
 * if (permission === 'denied') {
 *   return <div>푸시 알림이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.</div>;
 * }
 *
 * <button onClick={() => subscribe()}>알림 받기</button>
 */
export function usePushNotification(): UsePushNotificationReturn {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 브라우저 지원 여부 및 권한 상태 확인
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Push API 지원 여부 확인
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);

    if (!supported) {
      setPermission('unsupported');
      return;
    }

    // 현재 권한 상태 확인
    setPermission(Notification.permission as PermissionState);

    // 기존 구독 여부 확인
    checkSubscription();
  }, []);

  // 기존 구독 여부 확인
  const checkSubscription = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('[usePushNotification] 구독 확인 실패:', err);
    }
  }, []);

  // VAPID 공개키 가져오기
  const getVapidPublicKey = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/push/vapid-public-key');

      if (!response.ok) {
        throw new Error('VAPID 키를 가져올 수 없습니다.');
      }

      const data = await response.json();
      return data.publicKey;
    } catch (err) {
      console.error('[usePushNotification] VAPID 키 조회 실패:', err);
      return null;
    }
  }, []);

  // URL-safe Base64 to Uint8Array 변환
  const urlBase64ToUint8Array = useCallback((base64String: string): ArrayBuffer => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray.buffer as ArrayBuffer;
  }, []);

  // Service Worker 등록 및 대기
  const ensureServiceWorkerRegistered = useCallback(
    async (): Promise<ServiceWorkerRegistration> => {
      // 이미 등록된 SW가 있는지 확인
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log('[Push] 기존 SW 등록:', registrations.length);

      if (registrations.length > 0) {
        // 이미 등록된 SW 사용
        const registration = registrations[0];
        if (registration.active) {
          console.log('[Push] 활성 SW 발견');
          return registration;
        }
      }

      // SW가 없으면 수동 등록 시도
      console.log('[Push] SW 수동 등록 시도');
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        console.log('[Push] SW 등록 성공:', registration.scope);

        // 활성화 대기
        if (registration.installing) {
          console.log('[Push] SW 설치 중...');
          await new Promise<void>((resolve) => {
            registration.installing?.addEventListener('statechange', (e) => {
              const sw = e.target as ServiceWorker;
              console.log('[Push] SW 상태:', sw.state);
              if (sw.state === 'activated') {
                resolve();
              }
            });
          });
        }

        return registration;
      } catch (error) {
        console.error('[Push] SW 등록 실패:', error);
        throw new Error('Service Worker 등록에 실패했습니다.');
      }
    },
    []
  );

  // 푸시 권한 요청 및 구독
  const subscribe = useCallback(
    async (deviceName?: string): Promise<boolean> => {
      if (!isSupported) {
        setError('이 브라우저는 푸시 알림을 지원하지 않습니다.');
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        // 1. 권한 요청
        console.log('[Push] 1. 권한 요청 시작');
        const result = await Notification.requestPermission();
        console.log('[Push] 2. 권한 결과:', result);
        setPermission(result as PermissionState);

        if (result !== 'granted') {
          setError('푸시 알림 권한이 거부되었습니다.');
          return false;
        }

        // 2. VAPID 키 가져오기
        console.log('[Push] 3. VAPID 키 조회');
        const vapidPublicKey = await getVapidPublicKey();
        console.log('[Push] 4. VAPID 키:', vapidPublicKey ? '있음' : '없음');

        if (!vapidPublicKey) {
          setError('서버에서 VAPID 키를 가져올 수 없습니다.');
          return false;
        }

        // 3. Service Worker 등록 확인
        console.log('[Push] 5. Service Worker 확인');
        const registration = await ensureServiceWorkerRegistered();
        console.log('[Push] 6. SW 준비 완료:', registration.scope);

        // 4. Push 구독
        console.log('[Push] 7. pushManager.subscribe 시작');
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        console.log('[Push] 8. 구독 완료:', subscription.endpoint);

        // 5. 서버에 구독 등록
        console.log('[Push] 9. 서버에 구독 등록');
        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            deviceName,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '구독 등록에 실패했습니다.');
        }

        console.log('[Push] 10. 완료!');
        setIsSubscribed(true);
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : '구독에 실패했습니다.';
        setError(errorMessage);
        console.error('[usePushNotification] 구독 실패:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isSupported, getVapidPublicKey, urlBase64ToUint8Array, ensureServiceWorkerRegistered]
  );

  // 구독 해제
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // 브라우저 구독 해제
        await subscription.unsubscribe();

        // 서버에 구독 해제 알림
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '구독 해제에 실패했습니다.';
      setError(errorMessage);
      console.error('[usePushNotification] 구독 해제 실패:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // 테스트 알림 발송
  const sendTest = useCallback(async (): Promise<boolean> => {
    if (!isSubscribed) {
      setError('먼저 알림을 구독해주세요.');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '테스트 알림 발송에 실패했습니다.');
      }

      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '테스트 알림 발송에 실패했습니다.';
      setError(errorMessage);
      console.error('[usePushNotification] 테스트 발송 실패:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSubscribed]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTest,
  };
}

export default usePushNotification;
