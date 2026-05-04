/**
 * 자동이체 주기 선택 컴포넌트
 */

interface FrequencySelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

const frequencyOptions = [
  { value: 'MONTHLY', label: '월간' },
  { value: 'QUARTERLY', label: '분기 (3개월)' },
  { value: 'SEMI_ANNUAL', label: '반기 (6개월)' },
  { value: 'ANNUAL', label: '연간' },
];

export function FrequencySelector({
  value,
  onChange,
  disabled = false,
  label,
  id = 'frequency',
}: FrequencySelectorProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {frequencyOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
