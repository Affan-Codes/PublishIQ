import React from 'react';

export const QueueView: React.FC = () => {
  const queues = [
    { name: 'content-pipeline', waiting: 0, active: 0, delayed: 0, failed: 2, limit: 2 },
    { name: 'cleanup', waiting: 0, active: 0, delayed: 1, failed: 0, limit: 1 },
    { name: 'archive', waiting: 0, active: 0, delayed: 1, failed: 0, limit: 1 },
    { name: 'retry-publish', waiting: 0, active: 0, delayed: 0, failed: 0, limit: 2 },
    { name: 'token-refresh', waiting: 0, active: 0, delayed: 1, failed: 0, limit: 1 },
    { name: 'health-check', waiting: 0, active: 0, delayed: 1, failed: 0, limit: 1 },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Queues</h2>
        <p className="text-sm text-[#9c9cb0]">Monitor active BullMQ background processing structures</p>
      </div>

      {/* Queues List */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {queues.map((q) => (
          <div key={q.name} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white font-mono">{q.name}</h3>
              <p className="text-xs text-[#6e6e80] mt-0.5">Concurrency Limit: {q.limit}</p>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-lg bg-[#161620] py-2">
                <p className="text-[#6e6e80]">Wait</p>
                <p className="mt-1 font-bold text-white">{q.waiting}</p>
              </div>
              <div className="rounded-lg bg-[#161620] py-2">
                <p className="text-[#6e6e80]">Active</p>
                <p className="mt-1 font-bold text-purple-400">{q.active}</p>
              </div>
              <div className="rounded-lg bg-[#161620] py-2">
                <p className="text-[#6e6e80]">Delay</p>
                <p className="mt-1 font-bold text-yellow-400">{q.delayed}</p>
              </div>
              <div className="rounded-lg bg-[#161620] py-2">
                <p className="text-[#6e6e80]">Fail</p>
                <p className={`mt-1 font-bold ${q.failed > 0 ? 'text-red-400' : 'text-[#6e6e80]'}`}>{q.failed}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QueueView;
