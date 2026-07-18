import { describe, it, expect } from 'vitest';
import { getFiscalYear, getFiscalYearLabel } from '../fiscal-year';

describe('getFiscalYear', () => {
  it('캘린더 연도를 반환한다', () => {
    expect(getFiscalYear(new Date('2026-07-18'))).toBe(2026);
  });

  it('연초/연말 경계에서도 캘린더 연도를 따른다', () => {
    expect(getFiscalYear(new Date('2026-01-01'))).toBe(2026);
    expect(getFiscalYear(new Date('2025-12-31'))).toBe(2025);
  });

  it('인자 없이 호출하면 현재 연도를 반환한다', () => {
    expect(getFiscalYear()).toBe(new Date().getFullYear());
  });
});

describe('getFiscalYearLabel', () => {
  it('"YYYY 회계연도" 형식으로 표기한다', () => {
    expect(getFiscalYearLabel(new Date('2026-07-18'))).toBe('2026 회계연도');
  });
});
