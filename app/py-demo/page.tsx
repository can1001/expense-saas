'use client';

/**
 * FastAPI 백엔드 연동 PoC 데모 (spec §7 · §12 Phase 프론트 연동).
 *
 * 이 페이지는 `/api/py/*` 프록시 경유로 **FastAPI 백엔드**를 브라우저에서 직접 호출한다:
 *   로그인 → me(effective 권한) → 예산 캐스케이드.
 * 기존 앱/로그인은 전혀 건드리지 않는다 (Strangler — 새로 추가만).
 *
 * 사전조건: FastAPI 가 :8000 에서 실행 중이어야 함 (RUNNING_ZONE=local uv run uvicorn main:app).
 */

import { useState } from 'react';
import { pyApi, PyApiError } from '@/lib/api/py-client';

interface StepResult {
  label: string;
  ok: boolean;
  detail: string;
}

export default function PyDemoPage() {
  const [userid, setUserid] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);

  const run = async () => {
    setRunning(true);
    setSteps([]);
    const out: StepResult[] = [];
    const push = (r: StepResult) => {
      out.push(r);
      setSteps([...out]);
    };

    try {
      // 1) 로그인 (FastAPI)
      const login = await pyApi.login(userid.trim(), password);
      push({
        label: '1) POST /api/py/auth/login',
        ok: true,
        detail: `user=${login.user.username} (${login.user.role}) · tenant=${login.tenant?.name ?? '—'} · token=${login.token.slice(0, 16)}…`,
      });
      const token = login.token;

      // 2) me (effective 권한)
      const me = await pyApi.me(token);
      push({
        label: '2) GET /api/py/auth/me',
        ok: true,
        detail: `roles=${me.roles.join(',')} · permissions ${me.permissions.length}개 (예: ${me.permissions.slice(0, 4).join(', ')}…)`,
      });

      // 3) 예산 캐스케이드 — 위원회 목록
      const committees = await pyApi.budgetCascade(token, {});
      push({
        label: '3) POST /api/py/budget (위원회)',
        ok: true,
        detail: `${committees.field}: ${committees.options.join(', ') || '(없음)'}`,
      });

      // 4) 캐스케이드 — 첫 위원회의 부서
      const first = committees.options[0];
      if (first) {
        const depts = await pyApi.budgetCascade(token, { committee: first });
        push({
          label: `4) POST /api/py/budget (${first} → 부서)`,
          ok: true,
          detail: `${depts.field}: ${depts.options.join(', ') || '(없음)'}`,
        });
      }

      push({ label: '✅ 완료', ok: true, detail: '프론트 → /api/py 프록시 → FastAPI 왕복 성공' });
    } catch (e) {
      const msg = e instanceof PyApiError ? `[${e.status}] ${e.message}` : String(e);
      push({ label: '❌ 실패', ok: false, detail: msg });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">FastAPI 연동 데모</h1>
        <p className="text-sm text-gray-500 mt-1">
          <code>/api/py/*</code> 프록시 경유로 FastAPI 백엔드를 브라우저에서 직접 호출합니다.
          (FastAPI 가 <code>:8000</code> 에서 실행 중이어야 함)
        </p>
      </div>

      <div className="flex gap-2 items-end">
        <label className="flex flex-col text-sm">
          <span className="text-gray-600">아이디</span>
          <input
            className="border rounded px-3 py-2 min-h-[44px]"
            value={userid}
            onChange={(e) => setUserid(e.target.value)}
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-gray-600">비밀번호</span>
          <input
            className="border rounded px-3 py-2 min-h-[44px]"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          onClick={run}
          disabled={running}
          className="bg-blue-600 text-white rounded px-5 py-2 min-h-[44px] disabled:opacity-50"
        >
          {running ? '실행 중…' : '연동 테스트 실행'}
        </button>
      </div>

      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li
            key={i}
            className={`rounded border p-3 text-sm ${
              s.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="font-medium text-gray-800">{s.label}</div>
            <div className="text-gray-600 mt-0.5 break-all">{s.detail}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
