import React from 'react';

export const PublishingHistoryView: React.FC = () => {
  const records = [
    { id: '1', channel: 'Shayari Channel', platform: 'YouTube', type: 'Shayari', time: '2026-07-15 15:30', status: 'Success', details: 'Video Uploaded (ID: yt-mock-123)' },
    { id: '2', channel: 'Daily Motivation Reels', platform: 'Instagram', type: 'Motivational Quote', time: '2026-07-15 12:00', status: 'Success', details: 'Media Shared (ID: ig-mock-456)' },
    { id: '3', channel: 'Startup Growth Shorts', platform: 'YouTube', type: 'Business Quote', time: '2026-07-15 10:00', status: 'Success', details: 'Video Uploaded (ID: yt-mock-789)' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Publishing History</h2>
        <p className="text-sm text-[#9c9cb0]">Track platform upload and post history logs</p>
      </div>

      {/* History table */}
      <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] overflow-hidden">
        <table className="w-full text-left text-sm text-[#e0e0e6]">
          <thead className="bg-[#161620] text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
            <tr>
              <th className="px-6 py-4">Channel</th>
              <th className="px-6 py-4">Platform</th>
              <th className="px-6 py-4">Content Type</th>
              <th className="px-6 py-4">Publish Status</th>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">External Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a24]">
            {records.map((rec) => (
              <tr key={rec.id} className="hover:bg-[#161620]/30 transition">
                <td className="px-6 py-4 font-semibold text-white">{rec.channel}</td>
                <td className="px-6 py-4 text-[#9c9cb0]">{rec.platform}</td>
                <td className="px-6 py-4 text-[#9c9cb0]">{rec.type}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                    {rec.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-[#9c9cb0]">{rec.time}</td>
                <td className="px-6 py-4 text-xs text-[#9c9cb0] font-mono">{rec.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PublishingHistoryView;
