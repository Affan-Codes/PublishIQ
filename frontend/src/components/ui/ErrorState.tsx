import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button.js';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onRefresh?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while communicating with the server.',
  onRetry,
  onRefresh,
  isRetrying = false,
  className = '',
}) => {
  return (
    <div className={`rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center my-4 ${className}`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="mt-1 text-xs text-rose-200/80 max-w-md mx-auto">{message}</p>
      
      <div className="mt-6 flex justify-center gap-3">
        {onRetry && (
          <Button
            variant="danger"
            size="sm"
            onClick={onRetry}
            isLoading={isRetrying}
            loadingText="Retrying..."
          >
            Try Again
          </Button>
        )}
        {onRefresh && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            icon={RefreshCw}
          >
            Refresh Data
          </Button>
        )}
      </div>
    </div>
  );
};

export default ErrorState;
