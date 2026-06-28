/**
 * SimpleItemsSection 컴포넌트 테스트
 *
 * 버그 회귀 테스트:
 * - 적요(description) 필드 register ref 충돌 수정 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import SimpleItemsSection from '../SimpleItemsSection';
import {
  SimpleExpenseFormData,
  simpleExpenseFormSchema,
  defaultSimpleExpenseFormData,
} from '@/lib/schemas/simple-expense-schema';

// Mock useMemoPreferences hook
vi.mock('@/lib/hooks/useMemoPreferences', () => ({
  useMemoPreferences: () => ({
    favorites: [],
    toggleFavorite: vi.fn(),
    isFavorite: () => false,
  }),
}));

// Mock fetch for memo examples API
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ examples: [] }),
  })
) as unknown as typeof fetch;

// Wrapper component with FormProvider
function TestWrapper({ children }: { children: (props: any) => React.ReactNode }) {
  const methods = useForm<SimpleExpenseFormData>({
    resolver: zodResolver(simpleExpenseFormSchema),
    defaultValues: defaultSimpleExpenseFormData as SimpleExpenseFormData,
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(() => {})}>
        {children({
          control: methods.control,
          register: methods.register,
          setValue: methods.setValue,
          errors: methods.formState.errors,
          trigger: methods.trigger,
          getValues: methods.getValues,
        })}
        <button type="submit" data-testid="submit-btn">
          제출
        </button>
      </form>
    </FormProvider>
  );
}

describe('SimpleItemsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('적요(description) 필드 회귀 테스트', () => {
    it('적요 필드에 입력한 값이 폼 상태에 반영되어야 함', async () => {
      const user = userEvent.setup();
      let formMethods: any;

      render(
        <TestWrapper>
          {(props) => {
            formMethods = props;
            return (
              <SimpleItemsSection
                control={props.control}
                register={props.register}
                setValue={props.setValue}
                errors={props.errors}
              />
            );
          }}
        </TestWrapper>
      );

      // 적요 입력 필드 찾기
      const descriptionInput = screen.getByPlaceholderText('예: 11월분 식대');
      expect(descriptionInput).toBeInTheDocument();

      // 값 입력
      await user.type(descriptionInput, '회의 다과비');

      // 폼 상태에 값이 반영되었는지 확인
      await waitFor(() => {
        const values = formMethods.getValues();
        expect(values.items[0].description).toBe('회의 다과비');
      });
    });

    it('적요 필드가 비어있으면 유효성 검증에서 실패해야 함', async () => {
      const user = userEvent.setup();
      let formMethods: any;

      render(
        <TestWrapper>
          {(props) => {
            formMethods = props;
            return (
              <SimpleItemsSection
                control={props.control}
                register={props.register}
                setValue={props.setValue}
                errors={props.errors}
              />
            );
          }}
        </TestWrapper>
      );

      // 예산 필드들 설정 (필수 필드)
      formMethods.setValue('items.0.budgetCategory', '사무행정비');
      formMethods.setValue('items.0.budgetSubcategory', '회의비');
      formMethods.setValue('items.0.budgetDetail', '다과비');
      formMethods.setValue('items.0.unitPrice', 10000);
      formMethods.setValue('items.0.quantity', 1);
      formMethods.setValue('items.0.amount', 10000);
      // 적요는 비워둠

      // items 필드 유효성 검증 트리거
      const isValid = await formMethods.trigger('items');

      // 적요가 비어있으므로 유효성 검증 실패
      expect(isValid).toBe(false);
    });

    it('적요 필드에 값을 입력하면 유효성 검증을 통과해야 함', async () => {
      const user = userEvent.setup();
      let formMethods: any;

      render(
        <TestWrapper>
          {(props) => {
            formMethods = props;
            return (
              <SimpleItemsSection
                control={props.control}
                register={props.register}
                setValue={props.setValue}
                errors={props.errors}
              />
            );
          }}
        </TestWrapper>
      );

      // 모든 필수 필드 설정
      formMethods.setValue('items.0.budgetCategory', '사무행정비');
      formMethods.setValue('items.0.budgetSubcategory', '회의비');
      formMethods.setValue('items.0.budgetDetail', '다과비');
      formMethods.setValue('items.0.description', '회의 다과비'); // 적요 설정
      formMethods.setValue('items.0.unitPrice', 10000);
      formMethods.setValue('items.0.quantity', 1);
      formMethods.setValue('items.0.amount', 10000);

      // items 필드 유효성 검증 트리거
      const isValid = await formMethods.trigger('items');

      // 모든 필드가 채워졌으므로 유효성 검증 통과
      expect(isValid).toBe(true);
    });

    it('적요 필드 값이 undefined가 아닌 빈 문자열로 초기화되어야 함', async () => {
      let formMethods: any;

      render(
        <TestWrapper>
          {(props) => {
            formMethods = props;
            return (
              <SimpleItemsSection
                control={props.control}
                register={props.register}
                setValue={props.setValue}
                errors={props.errors}
              />
            );
          }}
        </TestWrapper>
      );

      // 초기값이 undefined가 아닌 빈 문자열이어야 함
      const values = formMethods.getValues();
      expect(values.items[0].description).toBeDefined();
      expect(typeof values.items[0].description).toBe('string');
    });
  });

  describe('항목 추가/삭제', () => {
    it('항목 추가 버튼 클릭 시 새 항목이 추가되어야 함', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          {(props) => (
            <SimpleItemsSection
              control={props.control}
              register={props.register}
              setValue={props.setValue}
              errors={props.errors}
            />
          )}
        </TestWrapper>
      );

      // 처음에는 항목 1개
      expect(screen.getByText('항목 1')).toBeInTheDocument();
      expect(screen.queryByText('항목 2')).not.toBeInTheDocument();

      // 항목 추가 버튼 클릭
      const addButton = screen.getByText('+ 항목 추가');
      await user.click(addButton);

      // 항목 2가 추가됨
      expect(screen.getByText('항목 2')).toBeInTheDocument();
    });
  });
});
