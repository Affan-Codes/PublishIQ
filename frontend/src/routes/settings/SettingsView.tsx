import React, { useState } from 'react';
import { useNotifications } from '../../context/NotificationContext.js';
import { RefreshButton } from '../../components/ui/RefreshButton.js';
import { Button } from '../../components/ui/Button.js';
import { Save, Settings } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { addToast } = useNotifications();
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [aiRetries, setAiRetries] = useState(3);
  const [dupLimit, setDupLimit] = useState(5);
  const [publishRetries, setPublishRetries] = useState(3);
  const [renderConcurrency, setRenderConcurrency] = useState(2);
  const [videoDuration, setVideoDuration] = useState(15);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      addToast('System configuration reloaded', 'info');
    }, 500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      addToast('System settings saved successfully', 'success');
    }, 600);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Settings className="h-6 w-6 text-purple-400" /> System Settings
          </h2>
          <p className="text-sm text-[#9c9cb0]">Configure operational parameters and system-wide default thresholds</p>
        </div>

        <RefreshButton onRefresh={handleRefresh} isRefreshing={isRefreshing} title="Reload settings" />
      </div>

      {/* Grid Settings Forms */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-lg">
          <h3 className="text-lg font-bold text-white">Retry Limits & Fault Tolerance</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">AI Generation Retries</label>
              <input
                type="number"
                value={aiRetries}
                onChange={(e) => setAiRetries(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Duplicate Regeneration Limit</label>
              <input
                type="number"
                value={dupLimit}
                onChange={(e) => setDupLimit(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Platform Publish Retries</label>
              <input
                type="number"
                value={publishRetries}
                onChange={(e) => setPublishRetries(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-lg">
          <h3 className="text-lg font-bold text-white">Rendering & Asset Storage</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Render Concurrency Workers</label>
              <input
                type="number"
                value={renderConcurrency}
                onChange={(e) => setRenderConcurrency(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Default Video Duration (Seconds)</label>
              <input
                type="number"
                value={videoDuration}
                onChange={(e) => setVideoDuration(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            icon={Save}
            isLoading={isSaving}
            loadingText="Saving Settings..."
          >
            Save Configurations
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SettingsView;
