import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSafeArea } from '../useSafeArea';

describe('useSafeArea', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default matchMedia mock
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return default values on initial render', () => {
    const { result } = renderHook(() => useSafeArea());

    expect(result.current).toEqual({
      isAndroid: false,
      isPWA: false,
      isAndroidPWA: false,
      bottomInset: 0,
    });
  });

  it('should detect Android device', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
      configurable: true,
    });

    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, configurable: true });

    const { result } = renderHook(() => useSafeArea());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isAndroid).toBe(true);
    expect(result.current.isPWA).toBe(false);
    expect(result.current.isAndroidPWA).toBe(false);
  });

  it('should detect PWA standalone mode', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
      configurable: true,
    });

    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, configurable: true });

    const { result } = renderHook(() => useSafeArea());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isPWA).toBe(true);
    expect(result.current.isAndroid).toBe(false);
    expect(result.current.isAndroidPWA).toBe(false);
  });

  it('should detect Android PWA with 3-button navigation (screenDiff > 100)', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
      configurable: true,
    });

    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, configurable: true });

    Object.defineProperty(window, 'screen', {
      value: { height: 800 },
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 600,
      configurable: true,
    });

    const setPropertyMock = vi.fn();
    Object.defineProperty(document.documentElement, 'style', {
      value: { setProperty: setPropertyMock },
      configurable: true,
    });

    const { result } = renderHook(() => useSafeArea());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isAndroidPWA).toBe(true);
    expect(result.current.bottomInset).toBe(48);
    expect(setPropertyMock).toHaveBeenCalledWith('--android-nav-height', '48px');
  });

  it('should detect Android PWA with gesture navigation (screenDiff > 50)', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
      configurable: true,
    });

    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, configurable: true });

    Object.defineProperty(window, 'screen', {
      value: { height: 700 },
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 620,
      configurable: true,
    });

    const setPropertyMock = vi.fn();
    Object.defineProperty(document.documentElement, 'style', {
      value: { setProperty: setPropertyMock },
      configurable: true,
    });

    const { result } = renderHook(() => useSafeArea());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isAndroidPWA).toBe(true);
    expect(result.current.bottomInset).toBe(32);
  });

  it('should detect Android PWA with minimal navigation (screenDiff <= 50)', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
      configurable: true,
    });

    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, configurable: true });

    Object.defineProperty(window, 'screen', {
      value: { height: 700 },
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 680,
      configurable: true,
    });

    const setPropertyMock = vi.fn();
    Object.defineProperty(document.documentElement, 'style', {
      value: { setProperty: setPropertyMock },
      configurable: true,
    });

    const { result } = renderHook(() => useSafeArea());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isAndroidPWA).toBe(true);
    expect(result.current.bottomInset).toBe(16);
  });

  it('should detect iOS PWA standalone mode via navigator.standalone', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
      configurable: true,
    });

    // @ts-expect-error - iOS specific property
    Object.defineProperty(window.navigator, 'standalone', {
      value: true,
      configurable: true,
    });

    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, configurable: true });

    const { result } = renderHook(() => useSafeArea());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isPWA).toBe(true);
  });

  it('should add and remove event listener for display-mode change', async () => {
    const addEventListenerMock = vi.fn();
    const removeEventListenerMock = vi.fn();

    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    }));
    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, configurable: true });

    const { unmount } = renderHook(() => useSafeArea());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();

    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
