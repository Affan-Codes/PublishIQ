import React, { useState } from 'react';

export const TemplatesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'templates' | 'prompts'>('templates');

  const templates = [
    { id: '1', name: 'Classic Dark Theme', path: 'templates/ClassicDark.tsx', version: 2, status: 'Active', notes: 'Simple black background, clean white typography' },
    { id: '2', name: 'Premium Gold Border', path: 'templates/GoldBorder.tsx', version: 1, status: 'Active', notes: 'Thin golden gradient border with elegant script typography' },
    { id: '3', name: 'Modern Minimal Lofi', path: 'templates/LofiMinimal.tsx', version: 1, status: 'Draft', notes: 'Stylized grid overlay with pastel color text' },
  ];

  const prompts = [
    { id: '1', name: 'Inspirational Shayari Generator', versions: [{ num: 2, text: 'Generate an inspirational Urdu Shayari on {{topic}}...' }, { num: 1, text: 'Create Urdu Shayari...' }], status: 'Active' },
    { id: '2', name: 'Startup Motivational Quotes', versions: [{ num: 4, text: 'Generate a short punchy business quote for {{target}}...' }, { num: 3, text: 'Generate startup quote...' }], status: 'Active' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Templates & Prompts</h2>
          <p className="text-sm text-[#9c9cb0]">Configure image rendering components and AI instruction sets</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a1a24] gap-6 text-sm">
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-4 font-semibold transition ${
            activeTab === 'templates' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-[#6e6e80] hover:text-[#9c9cb0]'
          }`}
        >
          Image Templates
        </button>
        <button
          onClick={() => setActiveTab('prompts')}
          className={`pb-4 font-semibold transition ${
            activeTab === 'prompts' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-[#6e6e80] hover:text-[#9c9cb0]'
          }`}
        >
          Prompt Library
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'templates' ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  tpl.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {tpl.status}
                </span>
                <span className="text-xs text-[#6e6e80]">v{tpl.version}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{tpl.name}</h3>
                <p className="text-xs text-[#9c9cb0] font-mono mt-1">{tpl.path}</p>
                <p className="text-xs text-[#6e6e80] mt-3">{tpl.notes}</p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#1a1a24]/50 text-xs">
                <button className="text-purple-400 hover:text-purple-300">View Preview Matrix</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {prompts.map((p) => (
            <div key={p.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{p.name}</h3>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {p.status}
                </span>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#6e6e80] uppercase tracking-wider">Versions ({p.versions.length})</p>
                {p.versions.map((v) => (
                  <div key={v.num} className="rounded-lg bg-[#161620] p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[#6e6e80] font-mono">
                      <span>Version {v.num}</span>
                      <span>Immutable Snapshot</span>
                    </div>
                    <p className="font-mono text-[#e0e0e6] leading-relaxed bg-[#0c0c10] p-3 rounded border border-[#222230]">
                      {v.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplatesView;
