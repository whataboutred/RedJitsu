'use client';

import { ReactNode } from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export const Skeleton = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  lines = 1,
}: SkeletonProps) => {
  const variants = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    rounded: 'rounded-2xl',
  };

  const style = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1rem' : undefined),
  };

  if (lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`bg-surface-elevated animate-pulse ${variants[variant]} ${className}`}
            style={{
              ...style,
              width: i === lines - 1 ? '75%' : style.width,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`bg-surface-elevated animate-pulse ${variants[variant]} ${className}`}
      style={style}
    />
  );
};

// Skeleton Card
export const SkeletonCard = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`bg-surface/80 rounded-2xl p-4 border border-white/[0.07] ${className}`}>
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton height={12} />
        <Skeleton width="80%" height={12} />
      </div>
    </div>
  );
};

// Skeleton Exercise Card
export const SkeletonExerciseCard = () => {
  return (
    <div className="bg-surface rounded-2xl overflow-hidden border border-white/[0.07]">
      <div className="p-4 bg-surface-elevated/50">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton width={150} height={18} />
            <Skeleton width={100} height={14} />
          </div>
          <Skeleton variant="circular" width={32} height={32} />
        </div>
      </div>
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton variant="circular" width={28} height={28} />
            <Skeleton width={80} height={40} className="rounded-xl" />
            <Skeleton width={60} height={40} className="rounded-xl" />
            <Skeleton variant="circular" width={28} height={28} />
          </div>
        ))}
      </div>
    </div>
  );
};

// Skeleton Stat Card
export const SkeletonStatCard = () => {
  return (
    <div className="stat-card">
      <Skeleton variant="circular" width={24} height={24} className="mb-2" />
      <Skeleton width="50%" height={28} className="mb-1" />
      <Skeleton width="70%" height={14} />
    </div>
  );
};

// Skeleton List Item
export const SkeletonListItem = () => {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1">
        <Skeleton width="60%" height={16} className="mb-1" />
        <Skeleton width="40%" height={12} />
      </div>
      <Skeleton width={60} height={24} className="rounded-lg" />
    </div>
  );
};

// Wrapper component for loading states
interface LoadingStateProps {
  isLoading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}

export const LoadingState = ({ isLoading, skeleton, children }: LoadingStateProps) => {
  if (isLoading) return <>{skeleton}</>;
  return <>{children}</>;
};

export default Skeleton;
