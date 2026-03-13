# 모바일 앱 설정 가이드

expense-system의 모바일 앱은 별도의 **expense-app** 프로젝트로 관리됩니다.

## 프로젝트 구조

```
/Users/wandosea/Documents/GitHub/
├── expense-system/     # Next.js 웹앱 + API (이 프로젝트)
│   ├── app/
│   ├── components/
│   ├── prisma/
│   └── ...
│
└── expense-app/        # Capacitor 네이티브 래퍼 (별도 프로젝트)
    ├── android/
    ├── ios/
    ├── www/
    └── capacitor.config.ts
```

## 아키텍처

```
┌─────────────────────────────────────────┐
│         expense-app (Capacitor)         │
│  ┌─────────────────────────────────┐    │
│  │         WebView                 │    │
│  │   expense-system URL 로드        │    │
│  └─────────────────────────────────┘    │
└──────────────────┼──────────────────────┘
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────┐
│     expense-system (Render)             │
│  https://expense-system-j7a0.onrender.com │
│  - Next.js SSR 페이지                    │
│  - API Routes (/api/*)                  │
└──────────────────┼──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│         Neon PostgreSQL                 │
└─────────────────────────────────────────┘
```

## 모바일 앱 빌드

모바일 앱 빌드는 **expense-app** 프로젝트에서 진행합니다:

```bash
cd /Users/wandosea/Documents/GitHub/expense-app

# 설정 동기화
npm run sync

# Android Studio 열기
npm run android

# Xcode 열기 (macOS)
npm run ios
```

자세한 내용은 [expense-app/README.md](../../expense-app/README.md)를 참조하세요.

## 장점

1. **관심사 분리**: 웹앱과 네이티브 래퍼 독립 관리
2. **독립 배포**: 서버 업데이트 시 앱 재배포 불필요
3. **깔끔한 구조**: home-care-service/home-care-app과 동일한 패턴
4. **유지보수 용이**: 각 프로젝트의 역할이 명확

## 관련 문서

- [expense-app README](../../expense-app/README.md)
- [PWA 설정](../public/manifest.json)
