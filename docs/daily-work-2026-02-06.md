# 작업 일지 - 2026-02-06

## 1. 메인화면 및 마이페이지 Header 추가

### 변경 파일
- `components/HomeClient.tsx`
- `app/mypage/page.tsx`
- `app/mypage/password/page.tsx`
- `app/mypage/signatures/page.tsx`

### 변경 내용
- 모든 페이지에서 일관된 네비게이션 헤더 사용하도록 개선
- 기존에는 메인화면과 마이페이지에 Header 컴포넌트가 없어 다른 페이지로 이동하려면 메뉴 카드만 사용 가능했음
- Header 추가로 모바일 햄버거 메뉴, 사용자 드롭다운 등 접근 가능

### 커밋
```
9967804 feat: 메인화면 및 마이페이지에 Header 추가
```

---

## 2. 모바일 메인화면 카드 레이아웃 수정

### 문제점
- 메인화면 카드에서 제목(h2)과 설명(p)이 한 줄에 붙어서 표시됨
- Tailwind CSS 4에서 기본 display 속성 변경으로 인한 문제

### 해결 방법
- 각 카드의 h2와 p 요소를 `<div>`로 감싸서 block 레이아웃 보장

### 변경 파일
- `components/HomeClient.tsx`
- `lib/constants/styles.ts` (TEXT_SECTION_TITLE에 `block` 추가)

---

## 3. 지출결의서 상세 세부항목 그리드 개선

### 변경 파일
- `app/approvals/[id]/page.tsx`

### 개선 내용

#### 모바일 (md 미만)
- 기존: 테이블 형식 (수평 스크롤 필요)
- 변경: `MobileItemCard` 카드 형식으로 표시
  - 순서 번호 뱃지
  - 금액 강조 표시
  - 예산(세목), 적요, 단가x수량 정보

#### 데스크톱 (md 이상)
- 헤더 배경색 진하게 (`bg-gray-50` → `bg-gray-100`)
- 줄무늬 효과 (짝수/홀수 행 배경색 구분)
- hover 효과 (`hover:bg-blue-50`)
- 합계 행 강조 (`bg-blue-50`)
- 항목 수 뱃지 추가

### 코드 구조
```tsx
{/* 모바일: 카드 형식 */}
<div className="md:hidden space-y-3">
  {expense.items.map((item) => (
    <MobileItemCard ... />
  ))}
  {/* 모바일 합계 */}
  <div className="bg-blue-50 rounded-lg p-3">...</div>
</div>

{/* 데스크톱: 개선된 테이블 */}
<div className="hidden md:block overflow-x-auto">
  <table>...</table>
</div>
```

---

## 요약

| 작업 | 설명 |
|------|------|
| Header 추가 | 메인화면, 마이페이지 3개 페이지에 일관된 Header 적용 |
| 카드 레이아웃 | 모바일 메인화면 카드 제목/설명 줄바꿈 수정 |
| 세부항목 그리드 | 결재 상세 페이지 모바일 카드 + 데스크톱 테이블 개선 |
