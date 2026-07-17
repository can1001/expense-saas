/**
 * 프론트 도메인 스위치 헬퍼 테스트
 */

import { describe, it, expect, afterEach } from 'vitest';
import { pyEnabled, apiBase, readApiError } from '../api-base';

describe('pyEnabled / apiBase', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PY_DOMAINS;
  });

  it('미설정 시 모든 도메인이 off이다', () => {
    delete process.env.NEXT_PUBLIC_PY_DOMAINS;
    expect(pyEnabled('auth')).toBe(false);
    expect(apiBase('auth')).toBe('/api');
  });

  it('빈 문자열이면 모든 도메인이 off이다', () => {
    process.env.NEXT_PUBLIC_PY_DOMAINS = '';
    expect(pyEnabled('auth')).toBe(false);
    expect(apiBase('auth')).toBe('/api');
  });

  it('설정된 도메인은 on, 그 외는 off이다', () => {
    process.env.NEXT_PUBLIC_PY_DOMAINS = 'auth,budget';
    expect(pyEnabled('auth')).toBe(true);
    expect(pyEnabled('budget')).toBe(true);
    expect(pyEnabled('expenses')).toBe(false);

    expect(apiBase('auth')).toBe('/api/py');
    expect(apiBase('expenses')).toBe('/api');
  });

  it('공백이 섞인 입력도 정상 파싱한다', () => {
    process.env.NEXT_PUBLIC_PY_DOMAINS = ' auth ,  budget,  ';
    expect(pyEnabled('auth')).toBe(true);
    expect(pyEnabled('budget')).toBe(true);
    expect(pyEnabled('')).toBe(false);
  });
});

describe('readApiError', () => {
  it('FastAPI { detail } 형식에서 메시지를 추출한다', () => {
    const res = new Response(null, { status: 401 });
    expect(readApiError(res, { detail: '인증이 필요합니다' })).toBe('인증이 필요합니다');
  });

  it('레거시 { error } 형식에서 메시지를 추출한다', () => {
    const res = new Response(null, { status: 400 });
    expect(readApiError(res, { error: '잘못된 요청입니다' })).toBe('잘못된 요청입니다');
  });

  it('둘 다 없으면 상태 코드 기반 기본 메시지를 반환한다', () => {
    const res = new Response(null, { status: 500 });
    expect(readApiError(res, {})).toBe('요청 실패 (500)');
  });

  it('data가 null/undefined여도 안전하게 처리한다', () => {
    const res = new Response(null, { status: 500 });
    expect(readApiError(res, null)).toBe('요청 실패 (500)');
    expect(readApiError(res, undefined)).toBe('요청 실패 (500)');
  });
});
