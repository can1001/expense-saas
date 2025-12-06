# 지출결의서 다운로드 및 프린트 기능 분석 및 개선 방안

## 📋 목차
1. [현재 구현 상태 분석](#현재-구현-상태-분석)
2. [문제점 및 개선 필요 사항](#문제점-및-개선-필요-사항)
3. [구체적인 개선 방안](#구체적인-개선-방안)
4. [우선순위별 개선 계획](#우선순위별-개선-계획)
5. [구현 예시 코드](#구현-예시-코드)

---

## 현재 구현 상태 분석

### 1. PDF 다운로드 기능

#### 구현 위치
- **컴포넌트**: `components/PDFDocument.tsx`
- **사용 페이지**: `app/expenses/[id]/page.tsx`
- **라이브러리**: `@react-pdf/renderer` (v4.3.1)

#### 현재 상태
```typescript
// app/expenses/[id]/page.tsx (115-130줄)
const handleDownloadPDF = async () => {
  if (!expense) return;
  
  try {
    const blob = await pdf(<ExpensePDFDocument expense={expense} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `지출결의서_${expense.applicantName}_${format(new Date(expense.requestDate), 'yyyyMMdd')}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('PDF 생성 중 오류가 발생했습니다.');
    console.error('PDF generation error:', err);
  }
};
```

#### 특징
- ✅ 클라이언트 사이드에서 PDF 생성
- ✅ 파일명 형식: `지출결의서_[청구인]_[날짜].pdf`
- ❌ **현재 버튼이 주석 처리되어 비활성화 상태** (193-212줄)
- ❌ 한글 폰트 지원이 주석 처리됨 (8-11줄)
- ❌ 로딩 상태 표시 없음
- ❌ 에러 처리가 단순 alert만 사용

### 2. 엑셀 다운로드 기능

#### 구현 위치
- **함수**: `lib/excel.ts` - `generateExpenseExcel()`
- **라이브러리**: `exceljs` (v4.4.0)

#### 현재 상태
```typescript
// lib/excel.ts (56-311줄)
export async function generateExpenseExcel(expense: Expense) {
  // 템플릿 파일 로드
  // 데이터 매핑
  // 첨부파일 이미지 시트 추가
  // 파일 다운로드
}
```

#### 특징
- ✅ 템플릿 기반 엑셀 생성 (`/template.xlsx`)
- ✅ 첨부파일(영수증) 이미지를 별도 시트로 포함
- ✅ A4 용지 크기로 이미지 배치 (2x2 그리드)
- ✅ 파일명 형식: `지출결의서_[청구인]_[날짜].xlsx`
- ⚠️ 이미지 로드 실패 시 에러 처리만 콘솔 출력
- ⚠️ 로딩 상태 표시 없음

### 3. 프린트 기능

#### 현재 상태
- ❌ **명시적인 프린트 기능이 없음**
- ❌ `window.print()` 기능 미구현
- ❌ `@media print` CSS 스타일 없음
- ❌ 웹 페이지에서 직접 프린트 불가능
- 사용자는 PDF를 다운로드한 후 수동으로 프린트해야 함

---

## 문제점 및 개선 필요 사항

### 🔴 심각한 문제

1. **PDF 다운로드 버튼이 비활성화됨**
   - 기능은 구현되어 있으나 UI에서 접근 불가
   - 사용자가 PDF를 다운로드할 수 없음

2. **프린트 기능 부재**
   - 웹 페이지에서 직접 프린트 불가능
   - 사용자 경험 저하

3. **한글 폰트 미지원**
   - PDF에서 한글이 제대로 표시되지 않을 수 있음
   - Helvetica 폰트만 사용 중

### 🟡 개선 필요 사항

4. **로딩 상태 미표시**
   - PDF/엑셀 생성 중 사용자 피드백 없음
   - 대용량 파일 생성 시 사용자 혼란 가능

5. **에러 처리 개선 필요**
   - 단순 alert만 사용
   - 사용자 친화적인 에러 메시지 부족

6. **프린트 최적화 스타일 부재**
   - 웹 페이지를 프린트할 때 불필요한 요소 출력
   - 프린트용 레이아웃 최적화 필요

7. **PDF 생성 성능**
   - 클라이언트 사이드 생성으로 인한 성능 이슈 가능
   - 대용량 데이터 처리 시 메모리 사용량 증가

8. **첨부파일 처리**
   - PDF에 첨부파일(영수증) 이미지 미포함
   - 엑셀에는 포함되나 PDF에는 없음

---

## 구체적인 개선 방안

### 1. PDF 다운로드 기능 활성화 및 개선

#### 1.1 버튼 활성화
- 주석 처리된 PDF 다운로드 버튼 활성화
- 버튼 UI 개선 (아이콘, 툴팁 추가)

#### 1.2 한글 폰트 지원
```typescript
// PDFDocument.tsx에 한글 폰트 추가
Font.register({
  family: 'NotoSansKR',
  src: '/fonts/NotoSansKR-Regular.ttf', // 로컬 폰트 파일
  // 또는 CDN 사용
  src: 'https://fonts.gstatic.com/s/notosanskr/v12/Pby7FmXiEBPT4ITbgNA5CgmOsn7uwpYcuH8y.ttf',
});

// 스타일에서 폰트 적용
fontFamily: 'NotoSansKR',
```

#### 1.3 로딩 상태 추가
```typescript
const [pdfLoading, setPdfLoading] = useState(false);

const handleDownloadPDF = async () => {
  if (!expense) return;
  
  setPdfLoading(true);
  try {
    // PDF 생성 로직
  } finally {
    setPdfLoading(false);
  }
};
```

#### 1.4 에러 처리 개선
- Toast 알림 라이브러리 사용 (react-hot-toast 등)
- 상세한 에러 메시지 제공
- 재시도 기능 추가

#### 1.5 첨부파일 이미지 PDF 포함
- PDF에 첨부파일 이미지를 별도 페이지로 추가
- 이미지 크기 최적화 및 레이아웃 조정

### 2. 프린트 기능 구현

#### 2.1 프린트 버튼 추가
```typescript
const handlePrint = () => {
  window.print();
};
```

#### 2.2 프린트 전용 CSS 스타일
```css
/* globals.css 또는 별도 print.css */
@media print {
  /* 헤더, 네비게이션, 버튼 숨김 */
  header,
  nav,
  button:not(.print-visible) {
    display: none !important;
  }
  
  /* 페이지 나누기 */
  .expense-section {
    page-break-inside: avoid;
  }
  
  /* 색상 최적화 */
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  /* 여백 설정 */
  @page {
    margin: 1cm;
    size: A4;
  }
  
  /* 테이블 최적화 */
  table {
    border-collapse: collapse;
  }
  
  /* 링크 URL 표시 */
  a[href]:after {
    content: " (" attr(href) ")";
  }
}
```

#### 2.3 프린트 전용 레이아웃 컴포넌트
- 프린트 시에만 표시되는 최적화된 레이아웃
- 결재 서명란 추가
- 페이지 번호 추가

#### 2.4 PDF 프린트 옵션
- PDF 다운로드 후 자동으로 프린트 대화상자 열기 옵션
- 프린트 설정 미리보기

### 3. 엑셀 다운로드 개선

#### 3.1 로딩 상태 추가
- 엑셀 생성 중 로딩 인디케이터 표시
- 진행률 표시 (가능한 경우)

#### 3.2 에러 처리 개선
- 이미지 로드 실패 시 사용자에게 알림
- 재시도 옵션 제공

#### 3.3 성능 최적화
- 대용량 이미지 리사이징
- 이미지 압축 옵션

### 4. 서버 사이드 PDF 생성 (선택사항)

#### 4.1 API 엔드포인트 추가
```typescript
// app/api/expenses/[id]/pdf/route.ts
export async function GET(request: Request, { params }: { params: { id: string } }) {
  // 서버에서 PDF 생성
  // puppeteer 또는 pdfkit 사용
}
```

#### 장점
- 클라이언트 메모리 부담 감소
- 더 빠른 생성 속도 (대용량 데이터)
- 한글 폰트 서버에서 관리

#### 단점
- 서버 리소스 사용 증가
- 추가 라이브러리 필요

### 5. 사용자 경험 개선

#### 5.1 다운로드 옵션 통합
- 드롭다운 메뉴로 PDF/엑셀 선택
- 일괄 다운로드 옵션 (여러 지출결의서)

#### 5.2 프리뷰 기능
- PDF/엑셀 다운로드 전 미리보기
- 프린트 미리보기

#### 5.3 다운로드 히스토리
- 최근 다운로드한 파일 목록
- 재다운로드 기능

---

## 우선순위별 개선 계획

### 🔥 높은 우선순위 (즉시 구현)

1. **PDF 다운로드 버튼 활성화**
   - 작업 시간: 30분
   - 영향도: 높음
   - 난이도: 낮음

2. **프린트 기능 구현**
   - 작업 시간: 2-3시간
   - 영향도: 높음
   - 난이도: 중간

3. **로딩 상태 추가**
   - 작업 시간: 1시간
   - 영향도: 중간
   - 난이도: 낮음

4. **프린트 전용 CSS 스타일**
   - 작업 시간: 2시간
   - 영향도: 높음
   - 난이도: 중간

### 🟡 중간 우선순위 (단기 개선)

5. **한글 폰트 지원**
   - 작업 시간: 2-3시간
   - 영향도: 중간
   - 난이도: 중간

6. **에러 처리 개선**
   - 작업 시간: 2시간
   - 영향도: 중간
   - 난이도: 낮음

7. **PDF에 첨부파일 이미지 포함**
   - 작업 시간: 3-4시간
   - 영향도: 중간
   - 난이도: 높음

### 🟢 낮은 우선순위 (장기 개선)

8. **서버 사이드 PDF 생성**
   - 작업 시간: 1-2일
   - 영향도: 낮음
   - 난이도: 높음

9. **프리뷰 기능**
   - 작업 시간: 1일
   - 영향도: 낮음
   - 난이도: 중간

10. **다운로드 히스토리**
    - 작업 시간: 1일
    - 영향도: 낮음
    - 난이도: 중간

---

## 구현 예시 코드

### 1. PDF 다운로드 버튼 활성화 및 개선

```typescript
// app/expenses/[id]/page.tsx

const [pdfLoading, setPdfLoading] = useState(false);
const [excelLoading, setExcelLoading] = useState(false);

const handleDownloadPDF = async () => {
  if (!expense) return;
  
  setPdfLoading(true);
  try {
    const blob = await pdf(<ExpensePDFDocument expense={expense} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `지출결의서_${expense.applicantName}_${format(new Date(expense.requestDate), 'yyyyMMdd')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF generation error:', err);
    alert('PDF 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    setPdfLoading(false);
  }
};

// 버튼 UI
<button
  onClick={handleDownloadPDF}
  disabled={pdfLoading}
  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center gap-2"
  title="PDF 파일로 다운로드"
>
  {pdfLoading ? (
    <>
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
      생성 중...
    </>
  ) : (
    <>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      PDF 다운로드
    </>
  )}
</button>
```

### 2. 프린트 기능 구현

```typescript
// app/expenses/[id]/page.tsx

const handlePrint = () => {
  window.print();
};

// 버튼 추가
<button
  onClick={handlePrint}
  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 print:hidden"
  title="페이지 프린트"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
  프린트
</button>
```

```css
/* app/globals.css에 추가 */

@media print {
  /* 불필요한 요소 숨김 */
  header,
  nav,
  button,
  .no-print {
    display: none !important;
  }
  
  /* 페이지 설정 */
  @page {
    margin: 1.5cm;
    size: A4;
  }
  
  /* 본문 스타일 */
  body {
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
    background: #fff;
  }
  
  /* 섹션 최적화 */
  .expense-section {
    page-break-inside: avoid;
    margin-bottom: 1rem;
  }
  
  /* 테이블 최적화 */
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 10pt;
  }
  
  table th,
  table td {
    border: 1px solid #000;
    padding: 0.5rem;
  }
  
  /* 색상 인쇄 */
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  /* 링크 URL 표시 */
  a[href]:after {
    content: " (" attr(href) ")";
    font-size: 8pt;
    color: #666;
  }
  
  /* 페이지 번호 */
  @page {
    @bottom-right {
      content: "페이지 " counter(page) " / " counter(pages);
      font-size: 9pt;
      color: #666;
    }
  }
}
```

### 3. 한글 폰트 지원

```typescript
// components/PDFDocument.tsx

import { Font } from '@react-pdf/renderer';

// 한글 폰트 등록
Font.register({
  family: 'NotoSansKR',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosanskr/v36/PbykFmXiEBPT4ITbgNA5Cgm20HTs4JMMuA.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/notosanskr/v36/Pby7FmXiEBPT4ITbgNA5Cgm20HTs4JMMuA.ttf',
      fontWeight: 'bold',
    },
  ],
});

// 스타일 수정
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'NotoSansKR', // Helvetica 대신 사용
  },
  // ... 나머지 스타일
});
```

### 4. PDF에 첨부파일 이미지 포함

```typescript
// components/PDFDocument.tsx

import { Image } from '@react-pdf/renderer';

export const ExpensePDFDocument: React.FC<PDFDocumentProps> = ({ expense }) => {
  // ... 기존 코드
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 기존 내용 */}
      </Page>
      
      {/* 첨부파일 이미지 페이지 추가 */}
      {expense.attachments && expense.attachments.length > 0 && (
        expense.attachments.map((attachment, index) => (
          <Page key={attachment.id} size="A4" style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.title}>첨부파일 {index + 1}</Text>
              <Text style={styles.subtitle}>{attachment.fileName}</Text>
            </View>
            <View style={styles.imageContainer}>
              <Image
                src={attachment.secureUrl}
                style={styles.attachmentImage}
              />
            </View>
          </Page>
        ))
      )}
    </Document>
  );
};

// 스타일 추가
const styles = StyleSheet.create({
  // ... 기존 스타일
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  attachmentImage: {
    maxWidth: '90%',
    maxHeight: '80%',
    objectFit: 'contain',
  },
});
```

---

## 결론

현재 지출결의서 시스템의 다운로드 및 프린트 기능은 기본적인 구조는 갖추고 있으나, 다음과 같은 개선이 필요합니다:

1. **즉시 개선 필요**: PDF 다운로드 버튼 활성화, 프린트 기능 추가
2. **사용자 경험 개선**: 로딩 상태, 에러 처리, 한글 폰트 지원
3. **기능 확장**: 첨부파일 PDF 포함, 프린트 최적화

이러한 개선을 통해 사용자가 더 편리하게 지출결의서를 다운로드하고 프린트할 수 있게 됩니다.

---

## 참고 자료

- [@react-pdf/renderer 공식 문서](https://react-pdf.org/)
- [ExcelJS 공식 문서](https://github.com/exceljs/exceljs)
- [CSS Print Media Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/print)
- [Noto Sans KR 폰트](https://fonts.google.com/noto/specimen/Noto+Sans+KR)
