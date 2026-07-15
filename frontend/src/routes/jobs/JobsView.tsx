import React, { useState } from 'react';

export const JobsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'content'>('jobs');

  const jobs = [
    { id: 'job-1', type: 'ContentPipeline', channel: 'Shayari Channel', stage: 'Published', retries: 0, time: '2026-07-15 15:30' },
    { id: 'job-2', type: 'ContentPipeline', channel: 'Startup Growth', stage: 'Failed', retries: 1, time: '2026-07-15 15:45', reason: 'Zod Validation Schema Mismatch' },
    { id: 'job-3', type: 'TokenRefresh', channel: 'N/A', stage: 'Success', retries: 0, time: '2026-07-15 16:00' },
  ];

  const contents = [
    { id: 'gc-1', profile: 'Motivational Urdu Shayari', text: 'گرتے ہیں شہسوار ہی میدانِ جنگ میں وہ طفل کیا گرے جو گھٹنوں کے بل چلے', lang: 'Urdu', status: 'Published' },
    { id: 'gc-2', profile: 'Startup Business Quotes', text: 'The best way to predict the future is to create it.', lang: 'English', status: 'Unpublished' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Jobs & Content</h2>
        <p className="text-sm text-[#9c9cb0]">Track job state machines and manage output content outputs</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a1a24] gap-6 text-sm">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`pb-4 font-semibold transition ${
            activeTab === 'jobs' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-[#6e6e80] hover:text-[#9c9cb0]'
          }`}
        >
          Job Executions
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={`pb-4 font-semibold transition ${
            activeTab === 'content' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-[#6e6e80] hover:text-[#9c9cb0]'
          }`}
        >
          Generated Content
        </button>
      </div>

      {/* Contents */}
      {activeTab === 'jobs' ? (
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] overflow-hidden">
          <table className="w-full text-left text-sm text-[#e0e0e6]">
            <thead className="bg-[#161620] text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
              <tr>
                <th className="px-6 py-4">Job ID</th>
                <th className="px-6 py-4">Job Type</th>
                <th className="px-6 py-4">Channel</th>
                <th className="px-6 py-4">Stage / Status</th>
                <th className="px-6 py-4">Attempts</th>
                <th className="px-6 py-4">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a24]">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-[#161620]/30 transition">
                  <td className="px-6 py-4 font-mono text-xs">{job.id}</td>
                  <td className="px-6 py-4 font-medium text-white">{job.type}</td>
                  <td className="px-6 py-4 text-[#9c9cb0]">{job.channel}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        job.stage === 'Published' || job.stage === 'Success' 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : job.stage === 'Failed' 
                          ? 'bg-red-500/10 text-red-400' 
                          : 'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {job.stage}
                      </span>
                      {job.reason && <span className="text-[10px] text-red-400 font-mono">{job.reason}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-[#9c9cb0]">{job.retries + 1}</td>
                  <td className="px-6 py-4 text-xs text-[#9c9cb0]">{job.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          {contents.map((gc) => (
            <div key={gc.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#6e6e80]">Profile: <span className="font-semibold text-white">{gc.profile}</span></span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  gc.status === 'Published' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'
                }`}>
                  {gc.status}
                </span>
              </div>
              <div className="rounded-lg bg-[#161620] p-4 font-mono text-sm leading-relaxed border border-[#222230]">
                {gc.text}
              </div>
              <div className="flex justify-between items-center text-xs pt-2">
                <span className="text-[#6e6e80]">Language: <span className="text-white">{gc.lang}</span></span>
                <div className="flex gap-3">
                  <button className="text-purple-400 hover:text-purple-300">Duplicate</button>
                  <button className="text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobsView;
