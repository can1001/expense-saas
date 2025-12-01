# 지출결의서 관리 시스템 - 설치 가이드

## 📦 이 폴더의 내용

```
expense-system-project/
├── app/
│   ├── api/              # API Routes (완성)
│   ├── page.tsx          # 홈페이지 (완성)
│   └── layout.tsx        # 레이아웃
├── lib/
│   ├── prisma.ts         # Prisma 클라이언트
│   ├── validators.ts     # Zod 스키마 & 계산 함수
│   └── utils.ts          # 유틸리티
├── prisma/
│   ├── schema.prisma     # DB 스키마
│   └── seed.ts           # 시드 데이터 (204개 항목)
├── package.json          # 의존성
├── .env.example          # 환경 변수 예시
└── README.md             # 이 파일
```

## 🚀 빠른 시작

### 1. Next.js 프로젝트 생성

```bash
npx create-next-app@latest expense-system \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd expense-system
```

### 2. 이 폴더의 파일들을 복사

```bash
# 다운로드한 폴더에서
cp -r app/* expense-system/app/
cp -r lib/* expense-system/lib/
cp -r prisma/* expense-system/prisma/
cp package.json expense-system/package.json
cp .env.example expense-system/.env
```

### 3. 패키지 설치

```bash
cd expense-system
npm install
```

### 4. 데이터베이스 설정

```bash
# SQLite 사용 (개발용)
npx prisma db push
npx prisma db seed
```

### 5. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 접속

## ✅ 완성된 기능

- ✅ API Routes (CRUD 완성)
- ✅ 데이터베이스 스키마
- ✅ 시드 데이터 (204개 예산 항목)
- ✅ 홈페이지
- ✅ 유효성 검증
- ✅ 유틸리티 함수

## 🔄 구현 필요한 부분

- 🔄 지출결의서 목록 페이지
- 🔄 작성 페이지
- 🔄 상세/수정 페이지
- 🔄 UI 컴포넌트
- 🔄 PDF 생성

## 📚 API 엔드포인트

```
GET    /api/expenses          # 목록
POST   /api/expenses          # 생성
GET    /api/expenses/[id]     # 상세
PUT    /api/expenses/[id]     # 수정
DELETE /api/expenses/[id]     # 삭제
GET    /api/budget            # 예산 마스터
```

## 💡 개발 팁

### API 테스트 (브라우저 콘솔)

```javascript
// 예산 목록 조회
fetch('/api/budget')
  .then(r => r.json())
  .then(console.log);

// 지출결의서 생성
fetch('/api/expenses', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    committee: '기획위원회',
    department: '재정팀',
    budgetCategory: '사무행정비',
    budgetSubcategory: '사무_회의및접대비',
    items: [{
      budgetDetail: '아웃팅비_재정팀',
      description: '재정팀 회의 후 식사',
      unitPrice: 10000,
      quantity: 5,
      amount: 50000,
      order: 1,
    }],
    requestDate: new Date().toISOString(),
    applicantName: '홍길동',
    bankName: '우리은행',
    accountNumber: '123-456-789',
    accountHolder: '홍길동',
  })
})
  .then(r => r.json())
  .then(console.log);
```

## 🛠 유용한 명령어

```bash
# Prisma Studio (DB GUI)
npx prisma studio

# 데이터베이스 초기화
npx prisma migrate reset

# 타입 생성
npx prisma generate
```

## 📞 문제 해결

### Prisma 에러
```bash
npx prisma generate
```

### 패키지 충돌
```bash
rm -rf node_modules package-lock.json
npm install
```

## 🎯 다음 단계

1. 지출결의서 목록 페이지 만들기
2. 작성 폼 컴포넌트 개발
3. PDF 생성 기능 추가

---

**프로젝트 준비 완료!** 🚀
