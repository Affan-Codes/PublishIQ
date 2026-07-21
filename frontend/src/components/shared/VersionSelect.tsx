import React from 'react';

export interface VersionOption {
  id: string;
  versionNumber: number | string;
  name?: string;
  isPinned?: boolean;
}

interface VersionSelectProps {
  label: string;
  options: VersionOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export const VersionSelect: React.FC<VersionSelectProps> = ({
  label,
  options,
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col space-y-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
      >
        <option value="">Select version...</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            v{opt.versionNumber} {opt.name ? `- ${opt.name}` : ''} {opt.isPinned ? '(Pinned)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
};

export default VersionSelect;
