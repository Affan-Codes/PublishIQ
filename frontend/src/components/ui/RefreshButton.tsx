import React from 'react';
import { RefreshCw } from 'lucide-react';

export interface RefreshButtonProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  isRefreshing = false,
  title = 'Refresh data',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'p-1.5 rounded-lg text-xs' : 'p-2.5 rounded-xl text-sm';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={isRefreshing}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center bg-[#161622] hover:bg-[#1d1d2e] text-gray-300 hover:text-white border border-[#222235] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${sizeClasses} ${className}`}
    >
      <RefreshCw className={`${iconSize} ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
    </button>
  );
};

export default RefreshButton;
