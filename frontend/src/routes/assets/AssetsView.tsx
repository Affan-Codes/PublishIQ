import React, { useState } from 'react';

export const AssetsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Music' | 'Fonts' | 'Images'>('Music');

  const musicTracks = [
    { id: '1', name: 'Chill Lofi Beats #01', status: 'Active', mood: 'Relaxed', license: 'Confirmed', file: 'chill_lofi_beats_01.mp3' },
    { id: '2', name: 'Motivational Cinematic String', status: 'Active', mood: 'Inspirational', license: 'Confirmed', file: 'cinematic_strings_02.mp3' },
    { id: '3', name: 'Unlicensed Track Demo', status: 'Disabled', mood: 'Upbeat', license: 'Unconfirmed', file: 'unknown_lic.mp3' },
  ];

  const fonts = [
    { id: '1', name: 'Inter Medium', status: 'Active', script: 'English Latin', file: 'inter_med.ttf' },
    { id: '2', name: 'Noto Devanagari Complete', status: 'Active', script: 'Hindi Devanagari', file: 'noto_deva.ttf' },
    { id: '3', name: 'Mehr Nastaliq Urdu', status: 'Active', script: 'Urdu Nastaliq', file: 'mehr_nastaliq.ttf' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Assets</h2>
          <p className="text-sm text-[#9c9cb0]">Manage fonts, backgrounds, licensing, and audio files</p>
        </div>
        <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500">
          Upload Asset
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a1a24] gap-6 text-sm">
        {['Music', 'Fonts', 'Images'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`pb-4 font-semibold transition ${
              activeTab === tab ? 'border-b-2 border-purple-500 text-purple-400' : 'text-[#6e6e80] hover:text-[#9c9cb0]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Lists */}
      {activeTab === 'Music' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {musicTracks.map((track) => (
            <div key={track.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  track.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'
                }`}>
                  {track.status}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  track.license === 'Confirmed' ? 'bg-purple-500/10 text-purple-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  Licensing: {track.license}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{track.name}</h3>
                <p className="text-xs text-[#9c9cb0] font-mono mt-1">{track.file}</p>
                <p className="text-xs text-[#6e6e80] mt-3">Mood: {track.mood}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Fonts' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {fonts.map((font) => (
            <div key={font.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#6e6e80]">Script: <span className="text-white">{font.script}</span></span>
                <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">v1.0</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{font.name}</h3>
                <p className="text-xs text-[#9c9cb0] font-mono mt-1">{font.file}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Images' && (
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-8 text-center text-[#6e6e80]">
          <p className="text-sm">No image overlays, watermarks, or branding logos loaded.</p>
        </div>
      )}
    </div>
  );
};

export default AssetsView;
