'use client';

import { ToastProvider } from '@/components/ui/Toast';
import { MeConfigProvider } from '@/lib/contexts/MeConfigContext';
import { TenantProvider } from '@/lib/contexts/TenantContext';
import { useSafeArea } from '@/lib/hooks/useSafeArea';
import { useFcmRegistration } from '@/lib/hooks/useFcmRegistration';

// Android PWA에서 safe-area CSS 변수 초기화
function SafeAreaInitializer({ children }: { children: React.ReactNode }) {
  useSafeArea();
  return <>{children}</>;
}

// Capacitor 모바일 앱에서 마운트 시 FCM 토큰 자동 등록 시도 (일반 브라우저에선 no-op)
function FcmAutoRegister({ children }: { children: React.ReactNode }) {
  useFcmRegistration({ autoRegister: true });
  return <>{children}</>;
}

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    // MeConfigProvider가 TenantProvider보다 바깥 — TenantContext가 서버 주도
    // 설정(config.labels/orgType)을 org-terms에 연결한다 (B5)
    <MeConfigProvider>
      <TenantProvider>
        <SafeAreaInitializer>
          <FcmAutoRegister>
            <ToastProvider>
              {children}
            </ToastProvider>
          </FcmAutoRegister>
        </SafeAreaInitializer>
      </TenantProvider>
    </MeConfigProvider>
  );
}
