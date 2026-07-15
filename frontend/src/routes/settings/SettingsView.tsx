import React from 'react';

export const SettingsView: React.FC = () => {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">System Settings</h2>
        <p className="text-sm text-[#9c9cb0]">Configure operational parameters and system-wide default thresholds</p>
      </div>

      {/* Grid Settings Forms */}
      <div className="space-y-6">
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6">
          <h3 className="text-lg font-bold text-white">Retry Limits</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">AI Generation Retries</label>
              <input type="number" defaultValue={3} className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Duplicate Regeneration Limit</label>
              <input type="number" defaultValue={5} className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Platform Publish Retries</label>
              <input type="number" defaultValue={3} className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6">
          <h3 className="text-lg font-bold text-white">Rendering & Storage</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Render Concurrency</label>
              <input type="number" defaultValue={2} className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Default Video Duration (Seconds)</label>
              <input type="number" defaultValue={15} className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500">
            Save Configurations
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
