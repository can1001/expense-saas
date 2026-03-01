/**
 * 예산 정보 섹션 컴포넌트
 *
 * 일반 지출결의서에서 위원회/사역팀/항/목을 선택합니다.
 * 항/목은 첫 번째 항목(items.0)에 저장됩니다.
 */

'use client';

import { Control, Controller } from 'react-hook-form';
import { EnhancedBudgetSelector } from '@/components/budget-selector';
import { ExpenseFormData } from '@/lib/schemas/expense-schema';
import { SECTION_CARD, SECTION_TITLE, ERROR_MESSAGE } from '@/lib/constants/styles';

interface BudgetSectionProps {
  control: Control<ExpenseFormData>;
  disabled?: boolean;
  onBudgetDetailChange?: (detail: string) => void;
  showDetail?: boolean;  // 세목 표시 여부 (기본값: false - 이제 ItemsSection에서 표시)
  onDetailsLoaded?: (details: string[]) => void;  // 세목 옵션 외부 전달
}

export default function BudgetSection({
  control,
  disabled = false,
  onBudgetDetailChange,
  showDetail = false,  // 기본값: false (세목은 ItemsSection에서 표시)
  onDetailsLoaded,
}: BudgetSectionProps) {
  return (
    <div className={SECTION_CARD}>
      <h2 className={SECTION_TITLE}>예산 정보</h2>
      <Controller
        name="committee"
        control={control}
        render={({ field, fieldState: committeeFieldState }) => (
          <Controller
            name="department"
            control={control}
            render={({ field: departmentField, fieldState: departmentFieldState }) => (
              <Controller
                name="items.0.budgetCategory"
                control={control}
                render={({ field: categoryField, fieldState: categoryFieldState }) => (
                  <Controller
                    name="items.0.budgetSubcategory"
                    control={control}
                    render={({ field: subcategoryField, fieldState: subcategoryFieldState }) => (
                      <div>
                        <EnhancedBudgetSelector
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
                          showDetail={showDetail}
                          onDetailsLoaded={onDetailsLoaded}
                          showQuickAccess={true}
                        />
                        {(committeeFieldState.error ||
                          departmentFieldState.error ||
                          categoryFieldState.error ||
                          subcategoryFieldState.error) && (
                          <p className={`${ERROR_MESSAGE} mt-2`}>
                            {committeeFieldState.error?.message ||
                              departmentFieldState.error?.message ||
                              categoryFieldState.error?.message ||
                              subcategoryFieldState.error?.message}
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
