# Ralph Loop - expense-system 자동 구현

## 너의 역할

expense-system(지출결의서 관리 시스템) 프로젝트를 자율적으로 구현하는 AI 개발자다.
매 반복(iteration)마다 PRD.md에서 미완료 TASK **하나**를 골라 구현한다.

## 절대 규칙

- PRD.md에서 `- [ ]` (체크 안 된 항목)을 반드시 직접 확인하라.
- `- [ ]`가 하나라도 남아있으면 `<promise>COMPLETE</promise>`를 절대 출력하지 마라.
- 실제로 코드를 작성/수정하지 않았으면 TASK를 완료 처리하지 마라.
- 반드시 `npm run lint`와 `npm run build`로 검증 후 커밋하라.

---

## 매 반복 실행 순서

### 1단계: 현재 상태 파악

1. `PRD.md` 읽기 → `- [ ]` 항목 확인 (위에서부터 순서대로)
2. `progress.txt` 읽기 → 이전 반복의 패턴/주의사항 확인
3. 첫 번째 미완료 `- [ ]` TASK 선택 (하위 체크박스가 있으면 해당 섹션 전체를 하나의 TASK로 처리)

### 2단계: 구현 전 준비

1. 수정할 대상 파일 전체 코드 읽기
2. 연관 파일 확인 (API 라우트, 타입 정의, 부모 컴포넌트)
3. 기존 코드 패턴 파악 (아래 "기존 코드 패턴" 섹션 참고)

### 3단계: 구현 및 검증

1. 코드 작성 / 수정
2. 린트 검사: `npm run lint`
3. 빌드 검사: `npm run build`
4. 에러 발생 시 수정 후 재검증

### 4단계: 완료 처리

1. PRD.md에서 해당 TASK의 `- [ ]` → `- [x]`로 변경 (하위 항목 포함)
2. `git add -A && git commit -m "feat: TASK 한글 설명"`
3. progress.txt에 아래 형식으로 기록

---

## progress.txt 기록 형식

```
[TASK] 완료 - HH:mm
- 구현 내용:
- 수정/생성 파일:
- 발견한 패턴:
- 주의사항:
---
```

---

## 프로젝트 기술 스택

| 분류       | 기술                                |
| ---------- | ----------------------------------- |
| 프레임워크 | Next.js 16.0.5 (App Router)         |
| 언어       | TypeScript                          |
| React      | React 19                            |
| 스타일링   | Tailwind CSS 4                      |
| DB         | PostgreSQL (Neon) + Prisma 7.0.1    |
| 폼 검증    | React Hook Form + Zod               |
| PDF        | @react-pdf/renderer                 |
| PWA        | next-pwa (webpack mode required)    |
| 모바일     | react-swipeable, lucide-react       |

---

## 예산 5단계 하이라키

```
위원회 → 사역팀/부 → 예산(항) → 예산(목) → 예산(세목)
```

- `components/BudgetSelector.tsx`에서 캐스케이드 선택 처리
- `/api/budget` POST 엔드포인트로 계층별 필터링

---

## 금액 계산 규칙

```javascript
Math.floor((unitPrice × quantity) / 10) * 10  // 10원 미만 절사
```

- 클라이언트: UX용
- 서버: 검증용 (`lib/validators.ts`)

---

## 핵심 프로젝트 구조

```
app/
  expenses/              # 지출결의서 목록/상세/작성
  offline/               # 오프라인 페이지
  admin/                 # 관리자 페이지
    quarterly-report/    # 분기별 회계보고
  api/
    expenses/            # GET, POST, PUT, DELETE
    budget/              # 예산 조회/필터
    admin/               # 관리자 API

components/
  mobile/                # 카메라, GPS, 음성입력
  ui/                    # Skeleton, Loading, Accordion
  expense-form/          # 폼 섹션
  BudgetSelector.tsx     # 예산 계층 선택

lib/
  prisma.ts              # Prisma 클라이언트
  validators.ts          # Zod 스키마
  utils.ts               # 유틸리티

prisma/
  schema.prisma          # DB 스키마
  seed.ts                # 시드 데이터 (204개 예산항목)
```

---

## 기존 코드 패턴 (반드시 따를 것)

### API 라우트 패턴

```typescript
// app/api/xxx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const data = await prisma.model.findMany();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: '오류 메시지' }, { status: 500 });
  }
}
```

### 클라이언트 컴포넌트 패턴

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function ComponentName() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/api/endpoint')
      .then(res => res.json())
      .then(setData);
  }, []);

  return (/* JSX */);
}
```

### 반응형 클래스

```
md:hidden         → 모바일만 (< 768px)
hidden md:block   → 데스크톱만 (≥ 768px)
min-h-[44px]      → 터치 타겟 (WCAG)
```

---

## 코딩 규칙

- `'use client'`는 인터랙션/상태가 필요한 컴포넌트에만
- Tailwind 유틸리티 클래스 사용, inline style 금지
- TypeScript `any` 사용 최소화
- 기존 컴포넌트/유틸 재사용 우선
- 한국어 주석 허용

---

## 막혔을 때

- TypeScript 에러 5번 시도 후 미해결 → TASK 스킵, progress.txt에 사유 기록, 다음 TASK 진행
- 빌드 실패 → `git checkout -- .`으로 되돌리고 progress.txt에 기록, 다음 TASK 진행
- 외부 API 키 필요한 경우 → 환경변수 확인 후 없으면 스킵

---

## 종료 조건

PRD.md에 `- [ ]` (미완료 항목)이 하나도 없을 때만:

```
<promise>COMPLETE</promise>
```

미완료 항목이 하나라도 있으면 절대 출력하지 않는다.
