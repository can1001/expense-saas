# API Documentation - 첨부파일 관리

## 개요

지출결의서의 첨부파일(영수증 이미지)을 관리하는 API 엔드포인트 문서입니다.

## 인증

현재 MVP 버전에서는 인증이 없습니다. 향후 추가 예정입니다.

---

## 1. 파일 업로드

### `POST /api/upload`

Cloudinary에 이미지 파일을 업로드합니다.

#### Request

**Content-Type**: `multipart/form-data`

**Body Parameters**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| file | File | ✅ | 업로드할 이미지 파일 |

**파일 제한사항**:
- **허용 형식**: JPEG, JPG, PNG, GIF, WEBP
- **최대 크기**: 5MB
- **타입**: 이미지 파일만 허용

#### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "publicId": "expense-receipts/1701234567890-receipt.jpg",
    "url": "http://res.cloudinary.com/...",
    "secureUrl": "https://res.cloudinary.com/...",
    "format": "jpg",
    "width": 1920,
    "height": 1080,
    "bytes": 245678,
    "fileName": "receipt.jpg"
  }
}
```

**Error Responses**:

```json
// 400 - 파일 없음
{
  "error": "파일이 제공되지 않았습니다."
}

// 400 - 빈 파일
{
  "error": "빈 파일은 업로드할 수 없습니다."
}

// 400 - 파일 크기 초과
{
  "error": "파일 크기는 5MB를 초과할 수 없습니다.",
  "maxSize": 5242880,
  "actualSize": 6000000
}

// 400 - 지원하지 않는 형식
{
  "error": "지원하지 않는 파일 형식입니다. 이미지 파일만 업로드 가능합니다.",
  "allowedTypes": ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
  "receivedType": "application/pdf"
}

// 400 - 파일명 너무 긺
{
  "error": "파일명이 너무 깁니다. (최대 255자)"
}

// 500 - Cloudinary 에러
{
  "error": "Cloudinary 업로드에 실패했습니다.",
  "details": "...",
  "httpCode": 401
}
```

#### Example

**cURL**:
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@/path/to/receipt.jpg"
```

**JavaScript**:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});

const data = await response.json();
```

---

## 2. Cloudinary 이미지 삭제

### `DELETE /api/upload/delete`

Cloudinary에서 이미지를 삭제합니다. (DB에는 영향 없음)

#### Request

**Content-Type**: `application/json`

**Body Parameters**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| publicId | string | ✅ | Cloudinary public_id |

#### Response

**Success (200)**:
```json
{
  "success": true,
  "message": "이미지가 성공적으로 삭제되었습니다.",
  "publicId": "expense-receipts/1701234567890-receipt.jpg"
}
```

**Error Responses**:

```json
// 400 - publicId 없음
{
  "error": "publicId가 제공되지 않았습니다."
}

// 404 - 이미지 없음
{
  "error": "삭제할 이미지를 찾을 수 없습니다.",
  "publicId": "..."
}

// 500 - Cloudinary 에러
{
  "error": "Cloudinary 삭제에 실패했습니다.",
  "details": "...",
  "httpCode": 404
}
```

#### Example

**cURL**:
```bash
curl -X DELETE http://localhost:3000/api/upload/delete \
  -H "Content-Type: application/json" \
  -d '{"publicId": "expense-receipts/1701234567890-receipt.jpg"}'
```

**JavaScript**:
```javascript
const response = await fetch('/api/upload/delete', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    publicId: 'expense-receipts/1701234567890-receipt.jpg'
  }),
});
```

---

## 3. 첨부파일 추가

### `POST /api/expenses/{id}/attachments`

지출결의서에 첨부파일 정보를 추가합니다. (Cloudinary 업로드 후 호출)

#### Request

**Content-Type**: `application/json`

**URL Parameters**:
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 지출결의서 ID |

**Body Parameters**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| publicId | string | ✅ | Cloudinary public_id |
| url | string | ✅ | 이미지 HTTP URL |
| secureUrl | string | ✅ | 이미지 HTTPS URL |
| format | string | ✅ | 파일 포맷 (jpg, png 등) |
| fileName | string | ✅ | 원본 파일명 |
| fileSize | number | ✅ | 파일 크기 (bytes) |
| width | number | ⬜ | 이미지 너비 |
| height | number | ⬜ | 이미지 높이 |

#### Response

**Success (201)**:
```json
{
  "id": "clx1234567890",
  "expenseId": "clx0987654321",
  "publicId": "expense-receipts/1701234567890-receipt.jpg",
  "url": "http://res.cloudinary.com/...",
  "secureUrl": "https://res.cloudinary.com/...",
  "format": "jpg",
  "fileName": "receipt.jpg",
  "fileSize": 245678,
  "width": 1920,
  "height": 1080,
  "createdAt": "2024-12-04T10:30:00.000Z"
}
```

**Error Responses**:

```json
// 400 - 유효하지 않은 ID
{
  "error": "유효하지 않은 지출결의서 ID입니다."
}

// 400 - 필수 필드 누락
{
  "error": "필수 필드가 누락되었습니다.",
  "missingFields": ["publicId", "url"]
}

// 400 - 유효하지 않은 URL
{
  "error": "secureUrl은 유효한 HTTPS URL이어야 합니다."
}

// 404 - 지출결의서 없음
{
  "error": "지출결의서를 찾을 수 없습니다."
}

// 409 - 중복
{
  "error": "이미 존재하는 첨부파일입니다."
}
```

#### Example

**JavaScript**:
```javascript
const response = await fetch('/api/expenses/clx0987654321/attachments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    publicId: 'expense-receipts/1701234567890-receipt.jpg',
    url: 'http://res.cloudinary.com/...',
    secureUrl: 'https://res.cloudinary.com/...',
    format: 'jpg',
    fileName: 'receipt.jpg',
    fileSize: 245678,
    width: 1920,
    height: 1080,
  }),
});
```

---

## 4. 첨부파일 목록 조회

### `GET /api/expenses/{id}/attachments`

지출결의서의 모든 첨부파일을 조회합니다.

#### Request

**URL Parameters**:
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 지출결의서 ID |

#### Response

**Success (200)**:
```json
[
  {
    "id": "clx1234567890",
    "expenseId": "clx0987654321",
    "publicId": "expense-receipts/1701234567890-receipt.jpg",
    "url": "http://res.cloudinary.com/...",
    "secureUrl": "https://res.cloudinary.com/...",
    "format": "jpg",
    "fileName": "receipt.jpg",
    "fileSize": 245678,
    "width": 1920,
    "height": 1080,
    "createdAt": "2024-12-04T10:30:00.000Z"
  },
  {
    "id": "clx2345678901",
    "expenseId": "clx0987654321",
    "publicId": "expense-receipts/1701234567891-invoice.png",
    "url": "http://res.cloudinary.com/...",
    "secureUrl": "https://res.cloudinary.com/...",
    "format": "png",
    "fileName": "invoice.png",
    "fileSize": 189234,
    "width": 1200,
    "height": 800,
    "createdAt": "2024-12-04T10:31:00.000Z"
  }
]
```

**Error Responses**:

```json
// 400 - 유효하지 않은 ID
{
  "error": "유효하지 않은 지출결의서 ID입니다."
}

// 404 - 지출결의서 없음
{
  "error": "지출결의서를 찾을 수 없습니다."
}
```

#### Example

**cURL**:
```bash
curl http://localhost:3000/api/expenses/clx0987654321/attachments
```

**JavaScript**:
```javascript
const response = await fetch('/api/expenses/clx0987654321/attachments');
const attachments = await response.json();
```

---

## 5. 첨부파일 삭제

### `DELETE /api/expenses/{id}/attachments/{attachmentId}`

첨부파일을 DB와 Cloudinary에서 모두 삭제합니다.

#### Request

**URL Parameters**:
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 지출결의서 ID |
| attachmentId | string | 첨부파일 ID |

#### Response

**Success (200)**:
```json
{
  "success": true,
  "message": "첨부파일이 성공적으로 삭제되었습니다.",
  "cloudinaryDeleted": true,
  "attachmentId": "clx1234567890"
}
```

**Error Responses**:

```json
// 400 - 유효하지 않은 ID
{
  "error": "유효하지 않은 첨부파일 ID입니다."
}

// 403 - 권한 없음
{
  "error": "이 첨부파일은 해당 지출결의서에 속하지 않습니다."
}

// 404 - 첨부파일 없음
{
  "error": "첨부파일을 찾을 수 없습니다."
}

// 404 - 지출결의서 없음
{
  "error": "지출결의서를 찾을 수 없습니다."
}
```

#### Example

**cURL**:
```bash
curl -X DELETE \
  http://localhost:3000/api/expenses/clx0987654321/attachments/clx1234567890
```

**JavaScript**:
```javascript
const response = await fetch(
  '/api/expenses/clx0987654321/attachments/clx1234567890',
  { method: 'DELETE' }
);
```

---

## 워크플로우

### 파일 업로드 전체 프로세스

```
1. 사용자가 파일 선택
   ↓
2. POST /api/upload
   - Cloudinary에 업로드
   - publicId, secureUrl 등 반환
   ↓
3. POST /api/expenses/{id}/attachments
   - DB에 첨부파일 정보 저장
   - attachment ID 반환
   ↓
4. 완료
```

### 파일 삭제 전체 프로세스

```
1. 사용자가 삭제 버튼 클릭
   ↓
2. DELETE /api/expenses/{id}/attachments/{attachmentId}
   - DB에서 첨부파일 정보 조회
   - Cloudinary에서 이미지 삭제
   - DB에서 첨부파일 레코드 삭제
   ↓
3. 완료
```

---

## 에러 코드 요약

| 코드 | 의미 | 주요 원인 |
|------|------|----------|
| 400 | Bad Request | 잘못된 요청 데이터, 유효성 검증 실패 |
| 403 | Forbidden | 권한 없음 (첨부파일 소유권 불일치) |
| 404 | Not Found | 리소스를 찾을 수 없음 |
| 409 | Conflict | 중복된 리소스 |
| 500 | Internal Server Error | 서버 오류, Cloudinary 오류 |

---

## 보안 고려사항

### 현재 구현

1. **파일 타입 검증**: 이미지만 허용
2. **파일 크기 제한**: 5MB
3. **Cloudinary 폴더**: `expense-receipts/`로 제한
4. **SQL Injection 방지**: Prisma ORM 사용
5. **XSS 방지**: React 기본 보호

### 향후 개선사항

1. **인증/권한**: JWT 토큰 기반 인증
2. **Rate Limiting**: 업로드 횟수 제한
3. **파일 스캔**: 악성코드 검사
4. **CORS**: 허용 도메인 제한
5. **서명된 URL**: Cloudinary Signed Upload

---

## 테스트

### 수동 테스트

```bash
# 1. 파일 업로드 테스트
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test-receipt.jpg"

# 2. 첨부파일 추가 테스트 (expenseId와 업로드 결과 사용)
curl -X POST http://localhost:3000/api/expenses/{expenseId}/attachments \
  -H "Content-Type: application/json" \
  -d '{
    "publicId": "...",
    "url": "...",
    "secureUrl": "...",
    "format": "jpg",
    "fileName": "test-receipt.jpg",
    "fileSize": 12345
  }'

# 3. 첨부파일 조회 테스트
curl http://localhost:3000/api/expenses/{expenseId}/attachments

# 4. 첨부파일 삭제 테스트
curl -X DELETE \
  http://localhost:3000/api/expenses/{expenseId}/attachments/{attachmentId}
```

---

## 성능 고려사항

1. **파일 크기 제한**: 5MB로 제한하여 서버 부하 감소
2. **비동기 처리**: 모든 업로드/삭제가 비동기로 처리
3. **이미지 최적화**: Cloudinary 자동 최적화 활용
4. **CDN**: Cloudinary CDN으로 빠른 이미지 로딩

---

## 제한사항

1. **최대 파일 개수**: 지출결의서당 10개
2. **파일 크기**: 5MB per file
3. **총 스토리지**: Cloudinary 무료 플랜 25GB
4. **대역폭**: Cloudinary 무료 플랜 25GB/월
5. **동시 업로드**: 제한 없음 (순차 처리 권장)

---

## 참고 자료

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Prisma Documentation](https://www.prisma.io/docs)
