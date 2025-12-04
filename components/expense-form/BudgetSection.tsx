/**
 * 예산 정보 섹션 컴포넌트
 */

'use client';

import { Control, Controller } from 'react-hook-form';
import BudgetSelector from '@/components/BudgetSelector';
import { ExpenseFormData } from '@/lib/schemas/expense-schema';

interface BudgetSectionProps {
  control: Control<ExpenseFormData>;
  disabled?: boolean;
  onBudgetDetailChange?: (detail: string) => void;
}

export default function BudgetSection({
  control,
  disabled = false,
  onBudgetDetailChange,
}: BudgetSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">예산 정보</h2>
      <Controller
        name="committee"
        control={control}
        render={({ field, fieldState }) => (
          <Controller
            name="department"
            control={control}
            render={({ field: departmentField }) => (
              <Controller
                name="budgetCategory"
                control={control}
                render={({ field: categoryField }) => (
                  <Controller
                    name="budgetSubcategory"
                    control={control}
                    render={({ field: subcategoryField }) => (
                      <div>
                        <BudgetSelector
                          value={{
                            committee: field.value,
                            department: departmentField.value,
                            category: categoryField.value,
                            subcategory: subcategoryField.value,
                          }}
                          onChange={(budget) => {
                            field.onChange(budget.committee);
                            departmentField.onChange(budget.department);
                            categoryField.onChange(budget.category);
                            subcategoryField.onChange(budget.subcategory);

                            // 예산(세목)이 선택되면 콜백 호출
                            if (budget.detail && onBudgetDetailChange) {
                              onBudgetDetailChange(budget.detail);
                            }
                          }}
                          disabled={disabled}
                        />
                        {(fieldState.error ||
                          departmentField.fieldState.error ||
                          categoryField.fieldState.error ||
                          subcategoryField.fieldState.error) && (
                          <p className="mt-2 text-sm text-red-600">
                            {fieldState.error?.message ||
                              departmentField.fieldState.error?.message ||
                              categoryField.fieldState.error?.message ||
                              subcategoryField.fieldState.error?.message}
                          </p>
                        )}
                      </div>
                    )}
                  />
                )}
              />
            )}
          />
        )}
      />
    </div>
  );
}
