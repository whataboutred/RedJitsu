'use client';

import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'outline' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const cardVariants = {
  default: 'bg-surface/80 border-white/[0.07]',
  elevated: 'bg-surface-elevated/90 border-white/10 shadow-card-hover',
  outline: 'bg-transparent border-white/10',
  ghost: 'bg-surface/40 border-transparent',
};

const paddingVariants = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'md',
      interactive = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseClasses = `
      backdrop-blur-sm rounded-2xl border
      transition-all duration-200
      ${cardVariants[variant]}
      ${paddingVariants[padding]}
      ${interactive ? 'cursor-pointer hover:bg-surface-elevated/90 hover:border-red-500/10 active:scale-[0.99]' : ''}
      ${className}
    `;

    return (
      <div ref={ref} className={baseClasses} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Animated Card variant
interface AnimatedCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'outline' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  delay?: number;
}

export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'md',
      interactive = false,
      delay = 0,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay }}
        whileHover={interactive ? { scale: 1.01 } : undefined}
        whileTap={interactive ? { scale: 0.99 } : undefined}
        className={`
          backdrop-blur-sm rounded-2xl border
          transition-colors duration-200
          ${cardVariants[variant]}
          ${paddingVariants[padding]}
          ${interactive ? 'cursor-pointer hover:bg-surface-elevated/90 hover:border-red-500/10' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

AnimatedCard.displayName = 'AnimatedCard';

// Stat Card
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'default' | 'strength' | 'bjj' | 'cardio';
}

const colorVariants = {
  default: 'from-zinc-500/20 to-zinc-600/20',
  strength: 'from-brand-red/20 to-red-700/20',
  bjj: 'from-purple-500/20 to-pink-500/20',
  cardio: 'from-emerald-500/20 to-cyan-500/20',
};

export const StatCard = ({ label, value, icon, trend, trendValue, color = 'default' }: StatCardProps) => {
  return (
    <div className={`stat-card bg-gradient-to-br ${colorVariants[color]}`}>
      <div className="flex items-start justify-between mb-2">
        {icon && <span className="text-zinc-400">{icon}</span>}
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-400'
            }`}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </span>
        )}
      </div>
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
};

// Exercise Card Header
interface ExerciseCardHeaderProps {
  name: string;
  sets?: number;
  lastPerformed?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
  onDelete?: () => void;
  children?: ReactNode;
}

export const ExerciseCardHeader = ({
  name,
  sets,
  lastPerformed,
  isExpanded,
  onToggle,
  onDelete,
  children,
}: ExerciseCardHeaderProps) => {
  return (
    <div className="exercise-card">
      <div className="exercise-card-header" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{name}</h3>
          <div className="flex items-center gap-3 text-sm text-zinc-400 mt-0.5">
            {sets !== undefined && <span>{sets} sets</span>}
            {lastPerformed && (
              <span className="text-zinc-500">Last: {lastPerformed}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </div>
      </div>
      {isExpanded && children && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="exercise-card-body"
        >
          {children}
        </motion.div>
      )}
    </div>
  );
};

export default Card;
