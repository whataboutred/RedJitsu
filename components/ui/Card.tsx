'use client';

import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'outline' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const cardVariants = {
  // Near-transparent by default so content sits "on the page" (matches Home),
  // not inside a visible grey box. Use `elevated`/`outline` where a real
  // surface or boundary is genuinely needed.
  default: 'bg-transparent border-transparent',
  elevated: 'bg-surface-elevated/90 border-white/10 shadow-card-hover',
  outline: 'bg-transparent border-white/10',
  ghost: 'bg-transparent border-transparent',
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
  bjj: 'from-purple-500/20 to-purple-700/20',
  cardio: 'from-emerald-500/20 to-emerald-700/20',
};

export const StatCard = ({ label, value, icon, trend, trendValue, color = 'default' }: StatCardProps) => {
  return (
    <div className={`stat-card bg-gradient-to-br ${colorVariants[color]}`}>
      <div className="flex items-start justify-between mb-2">
        {icon && <span className="text-zinc-400">{icon}</span>}
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-400'
            }`}
          >
            {trend === 'up' ? <ArrowUp className="w-3 h-3" /> : trend === 'down' ? <ArrowDown className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            {trendValue}
          </span>
        )}
      </div>
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
};

export default Card;
