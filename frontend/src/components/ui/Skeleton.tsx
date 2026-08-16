import React from 'react';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[#181824]/80 border border-[#222234]/40 ${className}`}
    />
  );
};

export const SkeletonStatCard: React.FC = () => (
  <div className="relative rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 animate-pulse">
    <div className="flex justify-between items-center">
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-9 w-9 rounded-xl bg-[#1d1d2b]" />
    </div>
    <Skeleton className="h-8 w-24" />
    <Skeleton className="h-3 w-36" />
  </div>
);

export const SkeletonCard: React.FC = () => (
  <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-5 flex flex-col justify-between animate-pulse">
    <div className="space-y-4">
      {/* Card Header with Title & Badge */}
      <div className="flex justify-between items-start gap-3">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      {/* Card Body */}
      <div className="space-y-2 pt-1">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>

      {/* Badges / Meta Pills */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
      </div>
    </div>

    {/* Card Footer with Actions */}
    <div className="border-t border-[#1a1a24]/50 pt-4 flex items-center justify-between">
      <Skeleton className="h-3 w-24" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  </div>
);

export const SkeletonContentCard: React.FC = () => (
  <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-5 space-y-4 flex flex-col justify-between animate-pulse">
    <div className="space-y-3">
      {/* Header with Language Pill & Date */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16 rounded font-mono" />
        <Skeleton className="h-3 w-20" />
      </div>

      {/* Quote Block */}
      <div className="bg-[#151522] p-3 rounded-lg border border-[#222235] space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
    </div>

    {/* Footer with Media icons, Caption & Action buttons */}
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3 w-32" />
      </div>

      <div className="flex items-center justify-between border-t border-[#1a1a24]/50 pt-3">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-7 w-7 rounded-lg" />
        </div>
      </div>
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; columns?: number; showPagination?: boolean }> = ({
  rows = 5,
  columns = 6,
  showPagination = true,
}) => (
  <div className="space-y-4 animate-pulse">
    <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] overflow-hidden shadow-lg">
      <table className="w-full text-left text-sm">
        {/* Table Header Bar */}
        <thead className="bg-[#161620] text-xs uppercase border-b border-[#1a1a24]">
          <tr>
            {Array.from({ length: columns }).map((_, cIdx) => (
              <th key={cIdx} className="px-6 py-4">
                <Skeleton className={`h-3.5 ${cIdx === 0 ? 'w-20' : cIdx === columns - 1 ? 'w-16 ml-auto' : 'w-24'}`} />
              </th>
            ))}
          </tr>
        </thead>
        {/* Table Body Rows */}
        <tbody className="divide-y divide-[#1a1a24]">
          {Array.from({ length: rows }).map((_, rIdx) => (
            <tr key={rIdx} className="py-2">
              {Array.from({ length: columns }).map((_, cIdx) => (
                <td key={cIdx} className="px-6 py-4">
                  {cIdx === 0 ? (
                    <Skeleton className="h-3.5 w-24 font-mono" />
                  ) : cIdx === 2 ? (
                    <Skeleton className="h-5 w-28 rounded-md" />
                  ) : cIdx === columns - 1 ? (
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-7 w-16 rounded-lg" />
                    </div>
                  ) : (
                    <Skeleton className={`h-3.5 ${cIdx === 1 ? 'w-32' : 'w-20'}`} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Table Pagination Bar */}
    {showPagination && (
      <div className="flex items-center justify-between border border-[#1a1a24] bg-[#0e0e12] p-4 rounded-xl">
        <Skeleton className="h-3.5 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-7 w-7 rounded-lg" />
        </div>
      </div>
    )}
  </div>
);

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="space-y-3 w-full animate-pulse">
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-4 flex items-center justify-between space-x-4"
      >
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    ))}
  </div>
);

export const PageContentSkeleton: React.FC = () => (
  <div className="space-y-8 animate-in fade-in duration-200">
    {/* Page Header Shimmer */}
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-52" />
        </div>
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
    </div>

    {/* Stat Cards Shimmer Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SkeletonStatCard />
      <SkeletonStatCard />
      <SkeletonStatCard />
      <SkeletonStatCard />
    </div>

    {/* Main Content Table Shimmer */}
    <SkeletonTable rows={5} columns={6} />
  </div>
);

export const FullAppSkeleton: React.FC = () => (
  <div className="flex h-screen w-screen overflow-hidden bg-[#0c0c0e] animate-in fade-in duration-150">
    {/* Sidebar Skeleton */}
    <aside className="flex w-64 flex-col border-r border-[#1a1a24] bg-[#0e0e12] px-4 py-6 shrink-0">
      {/* Workspace Brand Header */}
      <div className="mb-8 px-2 space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-3 w-40" />
      </div>

      {/* Navigation Menu Links */}
      <nav className="flex-1 space-y-2 overflow-y-auto pr-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
              i === 0 ? 'bg-purple-600/10 border-l-2 border-purple-500' : ''
            }`}
          >
            <Skeleton className="h-4 w-4 rounded shrink-0" />
            <Skeleton className={`h-3.5 ${i % 3 === 0 ? 'w-24' : i % 2 === 0 ? 'w-28' : 'w-20'}`} />
          </div>
        ))}
      </nav>

      {/* Footer & User Session */}
      <div className="mt-auto border-t border-[#1a1a24] pt-4 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <Skeleton className="h-8 w-8 rounded-full bg-purple-600/20 shrink-0" />
          <div className="space-y-1.5 flex-1 overflow-hidden">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <div className="px-2">
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      </div>
    </aside>

    {/* Main Container */}
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Top Navbar Header */}
      <header className="flex h-16 items-center justify-between border-b border-[#1a1a24] bg-[#0e0e12]/80 px-8 backdrop-blur-md z-30 shrink-0">
        {/* Search Bar Shimmer */}
        <div className="w-96">
          <Skeleton className="h-9 w-full rounded-lg bg-[#161620]" />
        </div>

        {/* Right Header Controls Shimmer */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="h-8 w-px bg-[#1a1a24]" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </header>

      {/* Route Page Body Content */}
      <main className="flex-1 overflow-y-auto bg-[#0a0a0c] p-8 text-[#e0e0e6]">
        <PageContentSkeleton />
      </main>
    </div>
  </div>
);

// Default PageSkeleton is the complete FullAppSkeleton for seamless page reloads
export const PageSkeleton: React.FC = FullAppSkeleton;

export default Skeleton;
