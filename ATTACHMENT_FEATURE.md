# 첨부파일 업로드 기능 가이드

## 개요

지출결의서에 영수증 이미지를 첨부할 수 있는 기능이 추가되었습니다. Cloudinary를 사용하여 이미지를 안전하게 저장하고 관리합니다.

## 주요 기능

- ✅ 여러 개의 이미지 파일 업로드 (최대 10개)
- ✅ 실시간 이미지 미리보기
- ✅ 개별 파일 삭제
- ✅ 파일 크기 제한 (10MB per file)
- ✅ 이미지 타입만 허용 (jpg, png, gif 등)
- ✅ 지출결의서 삭제 시 자동으로 Cloudinary에서도 삭제

## Cloudinary 설정

### 1. Cloudinary 계정 생성

1. [Cloudinary](https://cloudinary.com) 접속
2. 무료 계정 생성 (Sign up for free)
3. Dashboard로 이동

### 2. API 키 확인

Dashboard에서 다음 정보를 확인:
- **Cloud Name**: 예) `your-cloud-name`
- **API Key**: 예) `123456789012345`
- **API Secret**: 예) `abcdefghijklmnopqrstuvwxyz123`

### 3. 환경 변수 설정

`.env` 파일에 Cloudinary 정보 입력:

```bash
# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your-cloud-name"
```

**중요**: `.env` 파일의 기본값(`your_cloud_name` 등)을 실제 값으로 교체해야 합니다.

## 사용 방법

### 지출결의서 작성/수정 시

1. 지출결의서 작성 또는 수정 페이지로 이동
2. **첨부파일** 섹션에서 "영수증 이미지 추가" 버튼 클릭
3. 이미지 파일 선택 (여러 개 선택 가능)
4. 업로드 진행 상황 확인
5. 업로드된 이미지 미리보기 확인
6. 삭제가 필요한 경우 이미지 우측 상단의 X 버튼 클릭
7. 지출결의서 저장

### 상세 페이지에서

- 업로드된 첨부파일들이 그리드 형태로 표시됩니다
- 이미지를 클릭하면 새 탭에서 원본 크기로 볼 수 있습니다
- 파일명과 크기 정보도 함께 표시됩니다

## 기술 스택

### 새로 추가된 패키지

```json
{
  "cloudinary": "^2.x",        // 서버사이드 Cloudinary SDK
  "next-cloudinary": "^6.x"    // Next.js용 Cloudinary 컴포넌트
}
```

### 파일 구조

```
app/
├── api/
│   ├── upload/
│   │   ├── route.ts                          # 파일 업로드 API
│   │   └── delete/route.ts                   # 파일 삭제 API
│   └── expenses/
│       └── [id]/
│           ├── route.ts                      # 첨부파일 포함 조회/삭제
│           └── attachments/
│               ├── route.ts                  # 첨부파일 추가/조회
│               └── [attachmentId]/route.ts   # 개별 첨부파일 삭제

components/
└── FileUpload.tsx                            # 파일 업로드 컴포넌트

lib/
└── cloudinary.ts                             # Cloudinary 설정 및 유틸

prisma/
└── schema.prisma                             # ExpenseAttachment 모델 추가
```

## API 엔드포인트

### 1. 파일 업로드
```
POST /api/upload
Content-Type: multipart/form-data

Body: { file: File }

Response: {
  success: true,
  data: {
    publicId: string,
    url: string,
    secureUrl: string,
    format: string,
    width: number,
    height: number,
    bytes: number,
    fileName: string
  }
}
```

### 2. Cloudinary 이미지 삭제
```
DELETE /api/upload/delete
Content-Type: application/json

Body: { publicId: string }

Response: { success: true }
```

### 3. 지출결의서에 첨부파일 추가
```
POST /api/expenses/{id}/attachments
Content-Type: application/json

Body: {
  publicId: string,
  url: string,
  secureUrl: string,
  format: string,
  fileName: string,
  fileSize: number,
  width?: number,
  height?: number
}

Response: { id: string, ... }
```

### 4. 첨부파일 삭제
```
DELETE /api/expenses/{id}/attachments/{attachmentId}

Response: { success: true }
```

## 데이터베이스 스키마

```prisma
model ExpenseAttachment {
  id          String   @id @default(cuid())
  expenseId   String
  expense     Expense  @relation(fields: [expenseId], references: [id], onDelete: Cascade)

  // Cloudinary 정보
  publicId    String   // Cloudinary public_id
  url         String   // 이미지 URL
  secureUrl   String   // HTTPS URL
  format      String   // 파일 포맷 (jpg, png 등)

  // 파일 정보
  fileName    String   // 원본 파일명
  fileSize    Int      // 파일 크기 (bytes)
  width       Int?     // 이미지 너비
  height      Int?     // 이미지 높이

  // 메타
  createdAt   DateTime @default(now())

  @@index([expenseId])
}
```

## 보안 및 제한사항

### 파일 검증
- **파일 타입**: 이미지만 허용 (image/*)
- **파일 크기**: 최대 10MB per file
- **파일 개수**: 최대 10개 per 지출결의서

### Cloudinary 저장 위치
- 폴더: `expense-receipts/`
- Public ID 형식: `{timestamp}-{filename}`

### Cascade 삭제
- 지출결의서 삭제 시 첨부파일도 DB와 Cloudinary에서 자동 삭제
- 에러 발생 시에도 DB 삭제는 진행 (fail-safe)

## 문제 해결

### 업로드 실패 시

1. **Cloudinary 환경 변수 확인**
   ```bash
   # .env 파일에서 확인
   CLOUDINARY_CLOUD_NAME="..."
   CLOUDINARY_API_KEY="..."
   CLOUDINARY_API_SECRET="..."
   ```

2. **파일 크기 확인**
   - 10MB 이하인지 확인
   - 이미지 압축 도구 사용 고려

3. **네트워크 확인**
   - Cloudinary 서비스 상태 확인
   - 방화벽/프록시 설정 확인

### 이미지 표시 안 됨

1. **Next.js 이미지 도메인 설정 확인**
   ```typescript
   // next.config.ts
   images: {
     remotePatterns: [
       {
         protocol: 'https',
         hostname: 'res.cloudinary.com',
         pathname: '/**',
       },
     ],
   }
   ```

2. **개발 서버 재시작**
   ```bash
   npm run dev
   ```

## Cloudinary 무료 플랜 제한

- 스토리지: 25 GB
- 대역폭: 25 GB/월
- 변환: 25 크레딧/월
- 일반적인 사용에는 충분합니다

## 향후 개선 사항

- [ ] 드래그 앤 드롭 업로드
- [ ] 이미지 편집 기능 (크롭, 회전)
- [ ] 파일 압축 자동화
- [ ] 라이트박스 이미지 뷰어
- [ ] PDF 등 다른 파일 형식 지원

## 배포 시 주의사항

### Render 환경 변수 설정

Render Dashboard에서 다음 환경 변수 추가:
```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
```

### 재배포
환경 변수 변경 후 자동으로 재배포됩니다.
