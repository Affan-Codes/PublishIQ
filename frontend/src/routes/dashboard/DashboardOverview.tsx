import React from 'react';

export const DashboardOverview: React.FC = () => {
  const stats = [
    { name: 'Total Channels', value: '4', change: 'YouTube & Instagram' },
    { name: 'Content Pipeline Jobs', value: '18', change: '8 successful, 2 failed' },
    { name: 'Queue Status', value: '0 active', change: 'All schedules idle' },
    { name: 'Success Rate', value: '80%', change: 'Last 30 days' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Dashboard</h2>
        <p className="text-sm text-[#9c9cb0]">Overview of your content generation and publishing operations</p>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">{stat.name}</p>
            <p className="mt-2 text-3xl font-bold text-white">{stat.value}</p>
            <p className="mt-1 text-xs text-[#9c9cb0]">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Side: Recent Activity */}
        <div className="lg:col-span-2 rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6">
          <h3 className="text-lg font-bold text-white">Recent Pipeline Executions</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1a1a24]/50 pb-4">
              <div>
                <p className="text-sm font-semibold text-white">Motivational Shayari #12</p>
                <p className="text-xs text-[#6e6e80]">Channel: Shayari Channel (YouTube)</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                Published
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[#1a1a24]/50 pb-4">
              <div>
                <p className="text-sm font-semibold text-white">Business Quotes #34</p>
                <p className="text-xs text-[#6e6e80]">Channel: Startup Growth (Instagram)</p>
              </div>
              <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                Failed (API Error)
              </span>
            </div>
            <div className="flex items-center justify-between pb-2">
              <div>
                <p className="text-sm font-semibold text-white">Daily Wisdom Quotes #4</p>
                <p className="text-xs text-[#6e6e80]">Channel: Daily Wisdom (YouTube)</p>
              </div>
              <span className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
                Draft
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Health Checks */}
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6">
          <h3 className="text-lg font-bold text-white">Integrations Health</h3>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#9c9cb0]">Gemini AI Provider</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#9c9cb0]">YouTube Connection</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Healthy
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#9c9cb0]">Instagram Connection</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Healthy
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#9c9cb0]">Local Media Storage</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
