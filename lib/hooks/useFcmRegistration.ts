'use client';

import { useCallback, useEffect, useState } from 'react';
import { isCapacitorAndroid } from '@/lib/runtime/capacitor';

type FcmStatus =
  | 'idle'
  | 'unsupported'
  | 'pending-permission'
  | 'denied'
  | 'registering'
  | 'registered'
  | 'error';

interface UseFcmRegistrationReturn {
  status: FcmStatus;
  token: string | null;
  error: string | null;
  register: () => Promise<boolean>;
  unregister: () => Promise<boolean>;
}

/**
 * Capacitor 모바일 앱에서 FCM 토큰을 획득하고 백엔드에 등록하는 훅.
 *
 * - Capacitor WebView가 아닌 일반 브라우저에서는 status='unsupported'로 no-op.
 * - 토큰 획득 후 자동으로 POST /api/push/fcm-subscribe.
 * - 알림 탭 시 notification.data.url로 라우팅.
 *
 * 웹 푸시(usePushNotification)와 병행 사용 가능.
 */
export function useFcmRegistration(options?: {
  autoRegister?: boolean;
}): UseFcmRegistrationReturn {
  const [status, setStatus] = useState<FcmStatus>('idle');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(async (): Promise<boolean> => {
    if (!isCapacitorAndroid()) {
      setStatus('unsupported');
      return false;
    }

    try {
      setError(null);
      setStatus('pending-permission');

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );

      // 알림 채널 명시 생성 (heads-up + 진동 + 소리). 채널이 없으면 Android 가 fcm_fallback 채널
      // (importance=DEFAULT, 무음/무진동) 으로 떨어뜨려서 status bar 아이콘만 뜸. 서버는
      // notification.channelId='expense-default' 로 보내므로 동일 id 로 미리 생성해야 함.
      // createChannel 은 idempotent.
      try {
        await PushNotifications.createChannel({
          id: 'expense-default',
          name: '지출결의서 알림',
          description: '결재 / 지급 알림',
          importance: 5,     // HIGH (heads-up 표시)
          visibility: 1,     // PUBLIC (잠금화면 표시)
          lights: true,
          vibration: true,
          sound: 'default',
        });
      } catch (e) {
        console.warn('[useFcmRegistration] createChannel 실패 (계속 진행):', e);
      }

      // 리스너를 권한 prompt 이전에 등록한다.
      // Why: Android 의 일부 OEM/Capacitor 8.x 조합에서 권한 grant 응답 직후 native plugin 이
      // 자체적으로 register 를 trigger 해 `registration` 이벤트가 일찍 발사되는 경우가 있음.
      // listener 등록을 권한 prompt 이후로 미루면 그 이벤트를 놓쳐 토큰을 잃고 timeout 됨
      // (에뮬레이터 Pixel_2 + API 34 에서 재현 확인됨 2026-06-29).
      await PushNotifications.removeAllListeners();

      const tokenPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('FCM 토큰 획득 타임아웃 (30초)')),
          30_000
        );

        PushNotifications.addListener('registration', (tok) => {
          clearTimeout(timeout);
          resolve(tok.value);
        });

        PushNotifications.addListener('registrationError', (err) => {
          clearTimeout(timeout);
          reject(new Error(err.error || 'FCM 등록 실패'));
        });
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const url = action.notification.data?.url;
        if (typeof url === 'string' && url.length > 0) {
          try {
            const target = url.startsWith('http')
              ? new URL(url).pathname + new URL(url).search
              : url;
            window.location.href = target;
          } catch {
            window.location.href = url;
          }
        }
      });

      const perm = await PushNotifications.checkPermissions();
      let receive = perm.receive;

      if (receive === 'prompt' || receive === 'prompt-with-rationale') {
        const requested = await PushNotifications.requestPermissions();
        receive = requested.receive;
      }

      if (receive !== 'granted') {
        setStatus('denied');
        setError('알림 권한이 거부되었습니다. 설정에서 허용해주세요.');
        return false;
      }

      setStatus('registering');
      await PushNotifications.register();
      const fcmToken = await tokenPromise;
      setToken(fcmToken);

      const response = await fetch('/api/push/fcm-subscribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: fcmToken,
          platform: 'android',
          deviceModel:
            typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'FCM 토큰 백엔드 등록 실패');
      }

      setStatus('registered');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'FCM 등록 실패';
      console.error('[useFcmRegistration]', err);
      setError(message);
      setStatus('error');
      return false;
    }
  }, []);

  const unregister = useCallback(async (): Promise<boolean> => {
    if (!isCapacitorAndroid()) return false;
    if (!token) return true;

    try {
      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      await PushNotifications.removeAllListeners();

      await fetch('/api/push/fcm-subscribe', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      setToken(null);
      setStatus('idle');
      return true;
    } catch (err) {
      console.error('[useFcmRegistration] unregister 실패:', err);
      return false;
    }
  }, [token]);

  useEffect(() => {
    if (!isCapacitorAndroid()) {
      setStatus('unsupported');
      return;
    }
    if (options?.autoRegister) {
      register();
    }
  }, [options?.autoRegister, register]);

  return { status, token, error, register, unregister };
}

export default useFcmRegistration;
