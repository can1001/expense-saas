/**
 * FastAPI(Python) 백엔드 호출 클라이언트 (Strangler 이전용).
 *
 * Next.js rewrites 로 `/api/py/*` → `${API_ORIGIN}/api/*` (FastAPI :8000) 프록시된다.
 * (next.config.ts 참조 · spec §7)
 *
 * - 에러 형식: FastAPI 는 `{ detail: string }` 로 응답한다 (Next.js 의 `{ error }` 와 다름).
 * - 토큰: 로그인 응답의 `token` 을 Bearer 로 전달 (FastAPI 는 쿠키도 발급하지만
 *   기존 Next.js 세션과 시크릿이 달라 상호 검증되지 않으므로, PoC 는 Bearer 를 명시 사용).
 */

const PY_BASE = "/api/py";

export class PyApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "PyApiError";
  }
}

async function pyFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${PY_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // FastAPI: { detail }, 그 외 폴백
    const msg = data?.detail || data?.error || `요청 실패 (${res.status})`;
    throw new PyApiError(res.status, msg);
  }
  return data as T;
}

// ── 타입 (FastAPI 스키마 대응) ────────────────────────────────
export interface PyLoginResponse {
  success: boolean;
  message: string;
  user: {
    id: string;
    userid: string;
    username: string;
    role: string;
    department: string | null;
    permissions: {
      canApprove: boolean;
      canManageExpense: boolean;
      canAccessAdmin: boolean;
      canExportData: boolean;
      canRegisterUsers: boolean;
    };
  };
  tenant: { id: string; name: string; subdomain: string } | null;
  token: string;
}

export interface PyMeResponse {
  id: string;
  userid: string;
  username: string;
  role: string;
  roles: string[];
  tenantId: string | null;
  department: string | null;
  permissions: string[];
}

export interface PyCascadeResponse {
  field: string;
  options: string[];
}

// ── API ──────────────────────────────────────────────────────
export const pyApi = {
  login: (userid: string, password: string) =>
    pyFetch<PyLoginResponse>("/auth/login", { method: "POST", body: { userid, password } }),

  me: (token: string) => pyFetch<PyMeResponse>("/auth/me", { token }),

  budgetCascade: (
    token: string,
    sel: { committee?: string; department?: string; category?: string; subcategory?: string },
  ) => pyFetch<PyCascadeResponse>("/budget", { method: "POST", body: sel, token }),
};
