'use client';

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, useState } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  helper?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, iconPosition = 'left', helper, className = '', ...props }, ref) => {
    const [focused, setFocused] = useState(false);

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">{label}</label>
        )}
        <div className="relative">
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">{icon}</div>
          )}
          <input
            ref={ref}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            className={`
              w-full bg-surface border rounded-xl
              px-4 py-3 text-white placeholder-zinc-500
              outline-none transition-all duration-200
              ${icon && iconPosition === 'left' ? 'pl-10' : ''}
              ${icon && iconPosition === 'right' ? 'pr-10' : ''}
              ${error ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-white/10 focus:border-brand-red focus:ring-2 focus:ring-brand-red/25'}
              disabled:opacity-50 disabled:cursor-not-allowed
              ${className}
            `}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{icon}</div>
          )}
        </div>
        {(error || helper) && (
          <p className={`mt-1.5 text-sm ${error ? 'text-red-400' : 'text-zinc-500'}`}>
            {error || helper}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Number Input with increment/decrement
interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
}

const numberSizes = {
  sm: { input: 'text-lg py-2', button: 'w-10 h-10', container: 'gap-2' },
  md: { input: 'text-xl py-3', button: 'w-12 h-12', container: 'gap-3' },
  lg: { input: 'text-2xl py-4', button: 'w-14 h-14', container: 'gap-4' },
};

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ label, value, onChange, min = 0, max = 9999, step = 1, unit, size = 'md', className = '', ...props }, ref) => {
    const sizes = numberSizes[size];

    const increment = () => {
      const newVal = Math.min(value + step, max);
      onChange(newVal);
    };

    const decrement = () => {
      const newVal = Math.max(value - step, min);
      onChange(newVal);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value) || 0;
      onChange(Math.max(min, Math.min(max, val)));
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-zinc-400 mb-1.5 text-center">{label}</label>
        )}
        <div className={`flex items-center justify-center ${sizes.container}`}>
          <button
            type="button"
            onClick={decrement}
            className={`
              ${sizes.button} rounded-full
              bg-surface-elevated text-white font-bold text-xl
              flex items-center justify-center
              hover:bg-surface-pressed active:bg-surface-pressed active:scale-95
              transition-all duration-150
              disabled:opacity-30 disabled:cursor-not-allowed
            `}
            disabled={value <= min}
          >
            -
          </button>
          <div className="relative flex-1 max-w-[120px]">
            <input
              ref={ref}
              type="number"
              value={value}
              onChange={handleChange}
              className={`
                w-full bg-surface border border-white/10 rounded-xl
                ${sizes.input} text-center font-semibold text-white
                outline-none transition-all duration-200
                focus:border-brand-red focus:ring-2 focus:ring-brand-red/25
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                ${className}
              `}
              {...props}
            />
            {unit && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                {unit}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={increment}
            className={`
              ${sizes.button} rounded-full
              bg-surface-elevated text-white font-bold text-xl
              flex items-center justify-center
              hover:bg-surface-pressed active:bg-surface-pressed active:scale-95
              transition-all duration-150
              disabled:opacity-30 disabled:cursor-not-allowed
            `}
            disabled={value >= max}
          >
            +
          </button>
        </div>
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';

// Textarea
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helper, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">{label}</label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full bg-surface border rounded-xl
            px-4 py-3 text-white placeholder-zinc-500
            outline-none transition-all duration-200 resize-none
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-white/10 focus:border-brand-red focus:ring-2 focus:ring-brand-red/25'}
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
        {(error || helper) && (
          <p className={`mt-1.5 text-sm ${error ? 'text-red-400' : 'text-zinc-500'}`}>
            {error || helper}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// Select Input
interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">{label}</label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={`
              w-full bg-surface border rounded-xl
              px-4 py-3 text-white appearance-none
              outline-none transition-all duration-200
              ${error ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-white/10 focus:border-brand-red focus:ring-2 focus:ring-brand-red/25'}
              disabled:opacity-50 disabled:cursor-not-allowed
              ${className}
            `}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Toggle/Chip Button Group
interface ToggleGroupProps {
  options: { value: string; label: string; icon?: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  variant?: 'default' | 'strength' | 'bjj' | 'cardio';
}

const toggleVariants = {
  default: 'bg-brand-red/20 text-brand-red border-brand-red/50',
  strength: 'bg-red-500/20 text-red-400 border-red-500/50',
  bjj: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  cardio: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
};

export const ToggleGroup = ({ options, value, onChange, variant = 'default' }: ToggleGroupProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`
            inline-flex items-center gap-2 px-4 py-2 rounded-full
            border transition-all duration-200 text-sm font-medium
            ${
              value === opt.value
                ? toggleVariants[variant]
                : 'bg-surface-elevated/50 text-zinc-400 border-white/[0.07] hover:bg-surface-pressed/50 hover:text-zinc-300'
            }
          `}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default Input;
