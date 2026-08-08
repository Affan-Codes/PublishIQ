import React from 'react';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[#181824]/80 border border-[#222234]/40 ${className}`}
    />
  );
};

export const SkeletonStatCard: React.FC = () => (
  <div className="relative rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-3 animate-pulse">
    <div className="flex justify-between items-center">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
    <Skeleton className="h-8 w-20" />
    <Skeleton className="h-3 w-36" />
  </div>
);

export const SkeletonCard: React.FC = () => (
  <div className="rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 animate-pulse">
    <div className="flex justify-between items-center">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
    <div className="flex justify-between items-center pt-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-20 rounded-lg" />
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 5,
}) => (
  <div className="w-full rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 overflow-hidden space-y-4">
    <div className="flex justify-between items-center pb-4 border-b border-[#1a1a24]">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center space-x-4 py-2 border-b border-[#1a1a24]/40 last:border-0">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <Skeleton
              key={cIdx}
              className={`h-4 ${cIdx === 0 ? 'w-1/4' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="space-y-3 w-full">
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-4 flex items-center justify-between space-x-4 animate-pulse"
      >
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    ))}
  </div>
);

export const PageSkeleton: React.FC = () => (
  <div className="space-y-8 animate-in fade-in duration-200">
    {/* Page Header Shimmer */}
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-9 w-28 rounded-lg" />
    </div>

    {/* Stat Cards Shimmer Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SkeletonStatCard />
      <SkeletonStatCard />
      <SkeletonStatCard />
      <SkeletonStatCard />
    </div>

    {/* Main Content Table Shimmer */}
    <SkeletonTable rows={5} columns={5} />
  </div>
);

export default Skeleton;
