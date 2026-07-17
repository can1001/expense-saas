/**
 * 프론트 도메인 스위치 헬퍼 (Strangler 커토버용).
 *
 * `NEXT_PUBLIC_PY_DOMAINS` 환경변수(쉼표 구분, 예: "auth,budget,expenses")로
 * 도메인별 FastAPI 전환 여부를 제어한다. 화면 전환 태스크(C2~C10)는
 * `/api/*` 직접 호출 대신 이 헬퍼(`apiBase`)만 사용해 프리픽스를 결정한다.
 *
 * 미설정/빈 값이면 모든 도메인이 off → 기존 `/api/*` 그대로 나간다(무변경 원칙).
 */

function parsePyDomains(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((domain) => domain.trim())
      .filter(Boolean),
  );
}

export function pyEnabled(domain: string): boolean {
  const domains = parsePyDomains(process.env.NEXT_PUBLIC_PY_DOMAINS);
  return domains.has(domain);
}

export function apiBase(domain: string): string {
  return pyEnabled(domain) ? "/api/py" : "/api";
}

/**
 * FastAPI `{ detail }` / 레거시 Next.js `{ error }` 에러 응답을 모두 지원하는
 * 메시지 추출 유틸 (py-client.ts의 패턴 재사용).
 */
export function readApiError(res: Response, data: unknown): string {
  const body = (data ?? {}) as { detail?: unknown; error?: unknown };
  if (typeof body.detail === "string" && body.detail) return body.detail;
  if (typeof body.error === "string" && body.error) return body.error;
  return `요청 실패 (${res.status})`;
}
