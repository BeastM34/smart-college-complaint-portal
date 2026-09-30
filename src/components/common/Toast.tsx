import React from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ToastType } from '@/context/ToastContext';

export interface ToastProps {
  id?: string;
  title?: string;
  message: string;
  type?: ToastType;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  title,
  message,
  type = 'info',
  onClose,
  className,
}) => {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300',
        type === 'success' &&
          'bg-emerald-50/95 border-emerald-200 text-emerald-900 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-200',
        type === 'error' &&
          'bg-rose-50/95 border-rose-200 text-rose-900 dark:bg-rose-950/90 dark:border-rose-800 dark:text-rose-200',
        type === 'warning' &&
          'bg-amber-50/95 border-amber-200 text-amber-900 dark:bg-amber-950/90 dark:border-amber-800 dark:text-amber-200',
        type === 'info' &&
          'bg-indigo-50/95 border-indigo-200 text-indigo-900 dark:bg-indigo-950/90 dark:border-indigo-800 dark:text-indigo-200',
        className
      )}
    >
      <div className="shrink-0 mt-0.5">
        {type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
        {type === 'error' && <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
        {type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
        {type === 'info' && <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      </div>
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold mb-0.5">{title}</p>}
        <p className="text-xs opacity-90 leading-relaxed">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
