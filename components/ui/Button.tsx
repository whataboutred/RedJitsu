'use client';

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-red-600 to-brand-red hover:from-red-500 hover:to-red-600 active:from-red-700 active:to-red-800 text-white shadow-lg shadow-red-500/25',
  secondary: 'bg-surface-elevated hover:bg-surface-pressed active:bg-surface-pressed text-white border border-white/10',
  ghost: 'bg-transparent hover:bg-red-500/5 active:bg-white/10 text-zinc-300 hover:text-white',
  danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white',
  success: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-sm rounded-lg gap-1.5',
  md: 'px-5 py-3 text-base rounded-xl gap-2',
  lg: 'px-6 py-4 text-lg rounded-2xl gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: isDisabled ? 1 : 0.98 }}
        className={`
          inline-flex items-center justify-center font-semibold
          transition-all duration-200 ease-out
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variants[variant]}
          ${sizes[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <Spinner size={size} />
        ) : (
          <>
            {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
            <span>{children}</span>
            {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

// Icon Button variant
interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  icon: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'danger';
  label?: string;
}

const iconSizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const iconVariants = {
  default: 'bg-surface-elevated text-zinc-300 hover:text-white hover:bg-surface-pressed',
  ghost: 'bg-transparent text-zinc-400 hover:text-white hover:bg-white/10',
  danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = 'md', variant = 'default', label, className = '', ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.95 }}
        className={`
          inline-flex items-center justify-center rounded-full
          transition-all duration-200 ease-out
          disabled:opacity-50 disabled:cursor-not-allowed
          ${iconSizes[size]}
          ${iconVariants[variant]}
          ${className}
        `}
        aria-label={label}
        {...props}
      >
        {icon}
      </motion.button>
    );
  }
);

IconButton.displayName = 'IconButton';

// Floating Action Button
interface FABProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  icon: ReactNode;
  label?: string;
  extended?: boolean;
  position?: 'bottom-right' | 'bottom-center';
}

export const FAB = forwardRef<HTMLButtonElement, FABProps>(
  ({ icon, label, extended = false, position = 'bottom-right', className = '', ...props }, ref) => {
    const positionClasses = {
      'bottom-right': 'bottom-24 right-4',
      'bottom-center': 'bottom-24 left-1/2 -translate-x-1/2',
    };

    return (
      <motion.button
        ref={ref}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`
          fixed z-50 flex items-center justify-center
          bg-brand-red text-white font-semibold
          shadow-lg shadow-red-500/30
          transition-shadow duration-200
          hover:shadow-xl hover:shadow-red-500/40
          ${extended ? 'px-6 h-14 rounded-full gap-2' : 'w-14 h-14 rounded-full'}
          ${positionClasses[position]}
          ${className}
        `}
        {...props}
      >
        {icon}
        {extended && label && <span>{label}</span>}
      </motion.button>
    );
  }
);

FAB.displayName = 'FAB';

// Spinner component
const Spinner = ({ size }: { size: ButtonSize }) => {
  const spinnerSizes = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };
  return (
    <svg
      className={`animate-spin ${spinnerSizes[size]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

export default Button;
