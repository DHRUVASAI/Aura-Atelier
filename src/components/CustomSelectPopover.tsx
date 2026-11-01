import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface CustomSelectPopoverProps {
  id?: string;
  ariaLabel: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

export const CustomSelectPopover: React.FC<CustomSelectPopoverProps> = ({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  variant = 'light',
  size = 'sm',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption =
    options.find((opt) => opt.value === value) || options[0] || { value: '', label: 'Select' };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isDark = variant === 'dark';
  const padClass = size === 'md' ? 'px-3.5 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs';

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 ${padClass} ${
          isDark
            ? 'bg-slate-900 border border-slate-700 text-slate-100 hover:border-amber-500/60'
            : 'bg-white border border-slate-300 text-slate-900 hover:border-slate-400'
        }`}
      >
        <span className="truncate text-left">{selectedOption.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          } ${isDark ? 'text-amber-400' : 'text-slate-500'}`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 mt-1.5 z-50 min-w-full w-max max-w-[320px] rounded-xl shadow-2xl border p-1 space-y-0.5 max-h-60 overflow-y-auto ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-slate-100'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                  active
                    ? isDark
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-slate-900 text-white font-semibold'
                    : isDark
                    ? 'text-slate-200 hover:bg-slate-800'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="truncate">
                  <div>{opt.label}</div>
                  {opt.sublabel && (
                    <div
                      className={`text-[10px] font-mono ${
                        active
                          ? isDark
                            ? 'text-slate-900'
                            : 'text-slate-300'
                          : 'text-slate-400'
                      }`}
                    >
                      {opt.sublabel}
                    </div>
                  )}
                </div>
                {active && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
