import React from 'react';

export const ChannelsView: React.FC = () => {
  const channels = [
    { id: '1', name: 'Shayari Channel', platform: 'YouTube', mode: 'Hybrid', status: 'Active', cron: '0 9 * * *' },
    { id: '2', name: 'Daily Motivation Reels', platform: 'Instagram', mode: 'Automatic', status: 'Active', cron: '0 12,18 * * *' },
    { id: '3', name: 'Startup Growth Shorts', platform: 'YouTube', mode: 'Manual', status: 'Active', cron: '0 10 * * *' },
    { id: '4', name: 'Tech Insights IGTV', platform: 'Instagram', mode: 'Hybrid', status: 'Disabled', cron: '0 15 * * *' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Channels</h2>
          <p className="text-sm text-[#9c9cb0]">Manage destinations and schedules for video publishing</p>
        </div>
        <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500">
          Create Channel
        </button>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {channels.map((channel) => (
          <div key={channel.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                channel.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'
              }`}>
                {channel.status}
              </span>
              <span className="text-xs text-[#6e6e80]">{channel.platform}</span>
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-white">{channel.name}</h3>
              <p className="text-xs text-[#9c9cb0] mt-1">Schedule: {channel.cron}</p>
            </div>

            <div className="flex items-center justify-between border-t border-[#1a1a24]/50 pt-4">
              <div className="text-xs">
                <span className="text-[#6e6e80]">Automation Mode: </span>
                <span className="font-semibold text-white">{channel.mode}</span>
              </div>
              <div className="flex gap-2">
                <button className="text-xs text-purple-400 hover:text-purple-300">Edit</button>
                <button className="text-xs text-red-400 hover:text-red-300">Disable</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChannelsView;
