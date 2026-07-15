import React from 'react';

export const ContentProfilesView: React.FC = () => {
  const profiles = [
    { id: '1', name: 'Motivational Urdu Shayari', type: 'Shayari', lang: 'Urdu', tone: 'Inspirational', promptPin: 'v2', templatePin: 'v1' },
    { id: '2', name: 'Elite Startup Business Quotes', type: 'Business Quote', lang: 'English', tone: 'Professional', promptPin: 'v4', templatePin: 'v2' },
    { id: '3', name: 'Festive Hindi Wishes', type: 'Festival Wish', lang: 'Hindi', tone: 'Warm & Celebrating', promptPin: 'v1', templatePin: 'v1' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Content Profiles</h2>
          <p className="text-sm text-[#9c9cb0]">Configure prompts, validation, writing styles, and rendering rules</p>
        </div>
        <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500">
          Create Profile
        </button>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {profiles.map((profile) => (
          <div key={profile.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full">
                {profile.type}
              </span>
              <span className="text-xs text-[#9c9cb0]">{profile.lang}</span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">{profile.name}</h3>
              <p className="text-xs text-[#6e6e80] mt-1">Tone: {profile.tone}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#161620] p-3 text-xs">
              <div>
                <p className="text-[#6e6e80]">Prompt Version</p>
                <p className="font-semibold text-white mt-0.5">{profile.promptPin} (pinned)</p>
              </div>
              <div>
                <p className="text-[#6e6e80]">Template Version</p>
                <p className="font-semibold text-white mt-0.5">{profile.templatePin} (pinned)</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button className="text-purple-400 hover:text-purple-300">Edit Settings</button>
              <button className="text-gray-400 hover:text-gray-300">Clone</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContentProfilesView;
