import React from 'react';

export const PlatformConnectionsView: React.FC = () => {
  const connections = [
    { id: '1', platform: 'YouTube', account: 'WisdomQuotesOfficial', status: 'Healthy', expires: '2026-07-16 16:00', scopes: ['youtube.upload', 'youtube.readonly'] },
    { id: '2', platform: 'Instagram', account: 'ShayariDailyReels', status: 'Healthy', expires: '2026-07-16 15:45', scopes: ['instagram_basic', 'instagram_content_publish'] },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Platform Connections</h2>
          <p className="text-sm text-[#9c9cb0]">Manage OAuth integration tokens and health states for publishing</p>
        </div>
        <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500">
          Connect Account
        </button>
      </div>

      {/* Connection grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {connections.map((conn) => (
          <div key={conn.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{conn.platform}</h3>
              <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                {conn.status}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-white font-medium">{conn.account}</p>
              <p className="text-xs text-[#9c9cb0]">Token Expiry: {conn.expires}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#6e6e80] uppercase tracking-wider">Granted Scopes</p>
              <div className="flex flex-wrap gap-1.5">
                {conn.scopes.map((s) => (
                  <span key={s} className="rounded bg-[#161620] px-2 py-0.5 font-mono text-[10px] text-[#9c9cb0] border border-[#222230]">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1a1a24]/50 text-xs">
              <button className="text-purple-400 hover:text-purple-300">Test Connection</button>
              <button className="text-red-400 hover:text-red-300">Disconnect</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlatformConnectionsView;
