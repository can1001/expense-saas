/**
 * 자동이체 이체일 입력 컴포넌트
 * 1-28일 범위로 제한 (월말 일자 문제 방지)
 */

interface DayOfMonthInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

const MIN_DAY = 1;
const MAX_DAY = 28;

export function DayOfMonthInput({
  value,
  onChange,
  disabled = false,
  label,
  id = 'dayOfMonth',
}: DayOfMonthInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = parseInt(e.target.value, 10);

    if (isNaN(newValue)) {
      newValue = MIN_DAY;
    } else if (newValue < MIN_DAY) {
      newValue = MIN_DAY;
    } else if (newValue > MAX_DAY) {
      newValue = MAX_DAY;
    }

    onChange(newValue);
  };

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          min={MIN_DAY}
          max={MAX_DAY}
          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-center"
        />
        <span className="text-sm text-gray-500">매월 {value}일</span>
      </div>
    </div>
  );
}
