/**
 * 마법사 Step 1: 예산 항목 + 금액 + 적요
 */

'use client';

import { Control, UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { SimpleExpenseFormData } from '@/lib/schemas/simple-expense-schema';
import SimpleItemsSection from './SimpleItemsSection';
import TemplateSelector, { TemplateSelectData } from './TemplateSelector';

interface WizardStep1Props {
  control: Control<SimpleExpenseFormData>;
  register: UseFormRegister<SimpleExpenseFormData>;
  setValue: UseFormSetValue<SimpleExpenseFormData>;
  errors: FieldErrors<SimpleExpenseFormData>;
  disabled?: boolean;
  userId?: string;
  /** 템플릿 선택 시 콜백 (첫 번째 항목에 적용) */
  onTemplateSelect?: (data: TemplateSelectData) => void;
}

export default function WizardStep1({
  control,
  register,
  setValue,
  errors,
  disabled = false,
  userId,
  onTemplateSelect,
}: WizardStep1Props) {
  return (
    <div className="space-y-6">
      {/* 안내 문구 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-1">지출 항목 입력</h3>
        <p className="text-sm text-blue-700">
          예산 세목을 선택하고 금액과 적요를 입력하세요.
          <br className="hidden md:block" />
          여러 항목을 추가할 수 있습니다.
        </p>
      </div>

      {/* 템플릿 선택 */}
      {onTemplateSelect && (
        <TemplateSelector onSelect={onTemplateSelect} disabled={disabled} />
      )}

      {/* Zod 검증 에러 표시 */}
      {errors.items && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-medium text-red-800 mb-2">다음 항목을 확인해주세요:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
            {errors.items.message && <li>{errors.items.message}</li>}
            {Array.isArray(errors.items) &&
              errors.items.map((itemError, idx) => {
                if (!itemError) return null;
                const fieldErrors: string[] = [];
                if (itemError.budgetCategory)
                  fieldErrors.push(`예산(항): ${itemError.budgetCategory.message}`);
                if (itemError.budgetSubcategory)
                  fieldErrors.push(`예산(목): ${itemError.budgetSubcategory.message}`);
                if (itemError.budgetDetail)
                  fieldErrors.push(`세목: ${itemError.budgetDetail.message}`);
                if (itemError.description)
                  fieldErrors.push(`적요: ${itemError.description.message}`);
                if (itemError.unitPrice)
                  fieldErrors.push(`단가: ${itemError.unitPrice.message}`);
                if (itemError.quantity)
                  fieldErrors.push(`수량: ${itemError.quantity.message}`);
                if (itemError.amount)
                  fieldErrors.push(`금액: ${itemError.amount.message}`);
                if (fieldErrors.length === 0) return null;
                return (
                  <li key={idx}>
                    <span className="font-medium">[{idx + 1}행]</span> {fieldErrors.join(', ')}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {/* 세부 항목 */}
      <SimpleItemsSection
        control={control}
        register={register}
        setValue={setValue}
        errors={errors}
        disabled={disabled}
        userId={userId}
      />
    </div>
  );
}
