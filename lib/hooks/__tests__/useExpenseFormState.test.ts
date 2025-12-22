/**
 * useExpenseFormState 훅 테스트
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpenseFormState } from '../useExpenseFormState';
import { UploadedFile } from '@/lib/types';

describe('useExpenseFormState', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useExpenseFormState());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.fetchLoading).toBe(false);
    expect(result.current.attachments).toEqual([]);
  });

  it('should set fetchLoading to true when isEditMode is true', () => {
    const { result } = renderHook(() => useExpenseFormState({ isEditMode: true }));

    expect(result.current.fetchLoading).toBe(true);
  });

  it('should initialize with initialAttachments', () => {
    const initialAttachments: UploadedFile[] = [
      {
        id: '1',
        publicId: 'public-1',
        url: 'http://example.com/file1.pdf',
        originalName: 'file1.pdf',
        format: 'pdf',
        size: 1024,
      },
    ];

    const { result } = renderHook(() =>
      useExpenseFormState({ initialAttachments })
    );

    expect(result.current.attachments).toEqual(initialAttachments);
  });

  it('should update loading state', () => {
    const { result } = renderHook(() => useExpenseFormState());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should update error state', () => {
    const { result } = renderHook(() => useExpenseFormState());

    act(() => {
      result.current.setError('테스트 에러');
    });

    expect(result.current.error).toBe('테스트 에러');

    act(() => {
      result.current.setError(null);
    });

    expect(result.current.error).toBeNull();
  });

  it('should update fetchLoading state', () => {
    const { result } = renderHook(() => useExpenseFormState({ isEditMode: true }));

    expect(result.current.fetchLoading).toBe(true);

    act(() => {
      result.current.setFetchLoading(false);
    });

    expect(result.current.fetchLoading).toBe(false);
  });

  it('should update attachments state', () => {
    const { result } = renderHook(() => useExpenseFormState());

    const newAttachments: UploadedFile[] = [
      {
        publicId: 'public-1',
        url: 'http://example.com/file1.pdf',
        originalName: 'file1.pdf',
        format: 'pdf',
        size: 1024,
      },
      {
        publicId: 'public-2',
        url: 'http://example.com/file2.jpg',
        originalName: 'file2.jpg',
        format: 'jpg',
        size: 2048,
      },
    ];

    act(() => {
      result.current.setAttachments(newAttachments);
    });

    expect(result.current.attachments).toEqual(newAttachments);
  });

  it('should clear error with clearError', () => {
    const { result } = renderHook(() => useExpenseFormState());

    act(() => {
      result.current.setError('테스트 에러');
    });

    expect(result.current.error).toBe('테스트 에러');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should reset all state with reset', () => {
    const { result } = renderHook(() =>
      useExpenseFormState({
        isEditMode: true,
        initialAttachments: [
          {
            publicId: 'public-1',
            url: 'http://example.com/file.pdf',
            originalName: 'file.pdf',
            format: 'pdf',
            size: 1024,
          },
        ],
      })
    );

    // 상태 변경
    act(() => {
      result.current.setLoading(true);
      result.current.setError('에러 발생');
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe('에러 발생');

    // reset 호출
    act(() => {
      result.current.reset();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.fetchLoading).toBe(false);
    expect(result.current.attachments).toEqual([]);
  });
});
