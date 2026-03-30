'use client';

import { ToastProvider } from '@/components/ui/Toast';
import { useSafeArea } from '@/lib/hooks/useSafeArea';

// Android PWA에서 safe-area CSS 변수 초기화
function SafeAreaInitializer({ children }: { children: React.ReactNode }) {
  useSafeArea();
  return <>{children}</>;
}

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SafeAreaInitializer>
      <ToastProvider>
        {children}
      </ToastProvider>
    </SafeAreaInitializer>
  );
}
