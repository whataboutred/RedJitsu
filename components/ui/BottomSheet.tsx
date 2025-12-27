'use client';

import { ReactNode, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo, useAnimation } from 'framer-motion';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  header?: ReactNode;
  snapPoints?: number[]; // Array of heights as percentage of viewport (e.g., [0.5, 0.95])
  initialSnap?: number; // Index of initial snap point
  showHandle?: boolean;
}

export const BottomSheet = ({
  isOpen,
  onClose,
  children,
  title,
  header,
  snapPoints = [0.5, 0.95],
  initialSnap = 0,
  showHandle = true,
}: BottomSheetProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const controls = useAnimation();
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [isExpanded, setIsExpanded] = useState(initialSnap === snapPoints.length - 1);
  const isDraggingRef = useRef(false);

  // Sort snap points ascending
  const sortedSnapPoints = [...snapPoints].sort((a, b) => a - b);
  const minSnap = sortedSnapPoints[0];
  const maxSnap = sortedSnapPoints[sortedSnapPoints.length - 1];

  // Get current height as viewport percentage
  const currentHeight = sortedSnapPoints[currentSnap] || minSnap;

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setCurrentSnap(initialSnap);
      setIsExpanded(initialSnap === snapPoints.length - 1);
      controls.set({ height: `${sortedSnapPoints[initialSnap] * 100}dvh` });
    }
  }, [isOpen, initialSnap, controls, snapPoints.length, sortedSnapPoints]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const snapToPoint = useCallback((index: number) => {
    const targetHeight = sortedSnapPoints[index];
    setCurrentSnap(index);
    setIsExpanded(index === sortedSnapPoints.length - 1);
    controls.start({
      height: `${targetHeight * 100}dvh`,
      transition: { type: 'spring', damping: 30, stiffness: 300 }
    });
  }, [controls, sortedSnapPoints]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    isDraggingRef.current = false;
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    // If dragged down fast from minimum snap, close
    if (currentSnap === 0 && (velocity > 500 || offset > 150)) {
      onClose();
      return;
    }

    // Determine direction
    const isDraggingDown = velocity > 0 || (velocity === 0 && offset > 0);

    if (isDraggingDown) {
      // Dragging down - go to lower snap point or close
      if (currentSnap > 0) {
        snapToPoint(currentSnap - 1);
      } else if (offset > 150 || velocity > 500) {
        onClose();
      } else {
        // Snap back to current
        snapToPoint(currentSnap);
      }
    } else {
      // Dragging up - go to higher snap point
      if (currentSnap < sortedSnapPoints.length - 1) {
        snapToPoint(currentSnap + 1);
      } else {
        // Already at max, snap back
        snapToPoint(currentSnap);
      }
    }
  };

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  // Handle content scroll to expand/collapse
  const handleContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) return;

    const target = e.currentTarget;
    const isAtTop = target.scrollTop <= 0;

    // If at top and not expanded, touching content area should expand
    // This is handled by the drag gesture on the handle
  };

  // Handle touch on content when at min snap to expand
  const handleContentTouchStart = (e: React.TouchEvent) => {
    if (currentSnap === 0 && contentRef.current) {
      const isAtTop = contentRef.current.scrollTop <= 0;
      if (isAtTop) {
        // Allow the drag to propagate to expand
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%', height: `${currentHeight * 100}dvh` }}
            animate={{ y: 0, height: `${currentHeight * 100}dvh` }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-3xl border-t border-white/10 flex flex-col"
            style={{
              maxHeight: `${maxSnap * 100}dvh`,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)'
            }}
          >
            {/* Drag Handle Area */}
            <motion.div
              drag="y"
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.1, bottom: 0.3 }}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              className="flex-shrink-0 cursor-grab active:cursor-grabbing"
            >
              {/* Handle */}
              {showHandle && (
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-12 h-1 bg-zinc-600 rounded-full" />
                </div>
              )}

              {/* Title */}
              {title && (
                <div className="px-4 pb-3 border-b border-white/5">
                  <h2 className="text-lg font-semibold text-white">{title}</h2>
                </div>
              )}
            </motion.div>

            {/* Fixed Header (stays above scroll) */}
            {header && (
              <div className="flex-shrink-0 px-4 pt-4 pb-2">
                {header}
              </div>
            )}

            {/* Content */}
            <div
              ref={contentRef}
              className="flex-1 overflow-y-auto overscroll-contain p-4 pt-2 min-h-0"
              onScroll={handleContentScroll}
              onTouchStart={handleContentTouchStart}
            >
              {children}
            </div>

            {/* Expand/Collapse indicator */}
            {sortedSnapPoints.length > 1 && (
              <button
                onClick={() => snapToPoint(isExpanded ? 0 : sortedSnapPoints.length - 1)}
                className="absolute top-14 right-4 p-2 text-zinc-500 hover:text-white transition-colors"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                <svg
                  className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Simple Modal variant (centered)
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

const modalSizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  full: 'max-w-full',
};

export const Modal = ({ isOpen, onClose, children, title, size = 'md' }: ModalProps) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal Container - Flexbox centering for reliable mobile support */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            style={{ padding: 'max(16px, env(safe-area-inset-left)) max(16px, env(safe-area-inset-right))' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`
                w-full ${modalSizes[size]}
                bg-zinc-900 rounded-2xl border border-white/10
                shadow-2xl overflow-hidden pointer-events-auto
                box-border
              `}
              style={{
                maxHeight: 'min(calc(100vh - 2rem), calc(100dvh - 2rem))',
                maxWidth: `min(${size === 'sm' ? '24rem' : size === 'lg' ? '32rem' : size === 'full' ? '100%' : '28rem'}, calc(100vw - 32px))`,
              }}
            >
              {/* Header */}
              {title && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
                  <h2 className="text-lg font-semibold text-white truncate pr-2">{title}</h2>
                  <button
                    onClick={onClose}
                    className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 flex-shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Content */}
              <div
                className="p-4 overflow-y-auto overflow-x-hidden"
                style={{
                  maxHeight: 'calc(100dvh - 10rem)',
                }}
              >
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

// Confirmation Dialog
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
}

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: ConfirmDialogProps) => {
  const confirmVariants = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-amber-600 hover:bg-amber-700',
    default: 'bg-brand-red hover:bg-red-600',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-zinc-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-3 rounded-xl text-white font-medium transition-colors ${confirmVariants[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BottomSheet;
