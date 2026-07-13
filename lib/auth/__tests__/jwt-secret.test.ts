/**
 * @jest-environment node
 *
 * AC7: USER_JWT_SECRET 미설정 시 프로덕션 부팅 실패(하드코딩 폴백 제거)
 */

import { describe, it, expect } from 'vitest';
import {
  getUserJwtSecretString,
  getUserJwtSecret,
  DEV_FALLBACK_USER_JWT_SECRET,
} from '../jwt-secret';

describe('jwt-secret (AC7)', () => {
  it('프로덕션 + 미설정 → throw (부팅 실패)', () => {
    expect(() =>
      getUserJwtSecretString({ NODE_ENV: 'production' })
    ).toThrow(/USER_JWT_SECRET/);
  });

  it('프로덕션 + 빈 문자열 → throw', () => {
    expect(() =>
      getUserJwtSecretString({ NODE_ENV: 'production', USER_JWT_SECRET: '' })
    ).toThrow(/USER_JWT_SECRET/);
  });

  it('프로덕션 + 설정됨 → 설정 값 사용', () => {
    expect(
      getUserJwtSecretString({ NODE_ENV: 'production', USER_JWT_SECRET: 'strong-key' })
    ).toBe('strong-key');
  });

  it('개발 환경 + 미설정 → 폴백 허용 (throw 안 함)', () => {
    expect(
      getUserJwtSecretString({ NODE_ENV: 'development' })
    ).toBe(DEV_FALLBACK_USER_JWT_SECRET);
  });

  it('테스트 환경 + 미설정 → 폴백 허용', () => {
    expect(getUserJwtSecretString({ NODE_ENV: 'test' })).toBe(
      DEV_FALLBACK_USER_JWT_SECRET
    );
  });

  it('getUserJwtSecret 은 동일 문자열의 Uint8Array 를 반환', () => {
    const key = getUserJwtSecret({ NODE_ENV: 'production', USER_JWT_SECRET: 'abc' });
    expect(key).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(key)).toBe('abc');
  });

  it('설정 값이 폴백보다 우선', () => {
    expect(
      getUserJwtSecretString({ NODE_ENV: 'development', USER_JWT_SECRET: 'custom' })
    ).toBe('custom');
  });
});
