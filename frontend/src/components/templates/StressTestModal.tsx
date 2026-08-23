import React, { useState, useEffect } from 'react';
import apiClient from '../../lib/api-client.js';
import { Button } from '../ui/Button.js';
import { X, CheckCircle2, AlertTriangle, XCircle, Play, Loader2, ShieldCheck } from 'lucide-react';

interface StressTestResult {
  id: string;
  name: string;
  description: string;
  language: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  message: string;
  content: any;
}

interface StressTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  definition: any;
  onSelectScenarioForPreview: (scenarioId: string) => void;
}

export const StressTestModal: React.FC<StressTestModalProps> = ({
  isOpen,
  onClose,
  definition,
  onSelectScenarioForPreview,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<StressTestResult[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const runStressTest = async () => {
    if (!definition) return;
    setIsRunning(true);
    setErrorText(null);
    try {
      const res = await apiClient.post('/templates/stress-test', { definition });
      if (res.data?.success && Array.isArray(res.data?.data?.scenarios)) {
        setResults(res.data.data.scenarios);
      }
    } catch (err: any) {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to run layout stress test');
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runStressTest();
    }
  }, [isOpen, definition]);

  if (!isOpen) return null;

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const warnCount = results.filter((r) => r.status === 'WARNING').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-4 sm:p-6 flex justify-center items-start sm:items-center py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-5 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1a1a24] pb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-400" />
              Template Layout Stress Test
            </h3>
            <p className="text-xs text-[#9c9cb0]">
              Automated compatibility and canvas overflow validation across 9 edge-case scenarios
            </p>
          </div>
          <button onClick={onClose} className="text-[#6e6e80] hover:text-white cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Status Scoreboard */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-lg font-bold text-emerald-300">{passCount}</div>
              <div className="text-[10px] text-emerald-400/80 font-medium">Passed</div>
            </div>
          </div>
          <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded-xl flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-lg font-bold text-amber-300">{warnCount}</div>
              <div className="text-[10px] text-amber-400/80 font-medium">Warnings (Auto-Shrunk)</div>
            </div>
          </div>
          <div className="bg-rose-950/20 border border-rose-500/20 p-3 rounded-xl flex items-center gap-3">
            <XCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <div>
              <div className="text-lg font-bold text-rose-300">{failCount}</div>
              <div className="text-[10px] text-rose-400/80 font-medium">Failed</div>
            </div>
          </div>
        </div>

        {errorText && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
            {errorText}
          </div>
        )}

        {/* Scenarios List */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {isRunning ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-[#8c8c9e]">
              <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              <span>Evaluating scenarios against layout bounds...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-[#6e6e80] text-xs">No stress test results generated.</div>
          ) : (
            results.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-[#1a1a24] bg-[#14141e] hover:bg-[#181826] transition gap-3"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{item.name}</span>
                    <span className="text-[10px] text-[#6e6e80] font-mono">({item.language})</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'PASS'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : item.status === 'WARNING'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8c8c9e] leading-snug">{item.message}</p>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  icon={Play}
                  onClick={() => {
                    onSelectScenarioForPreview(item.id);
                    onClose();
                  }}
                  title="Load scenario into live preview"
                >
                  Preview
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center border-t border-[#1a1a24] pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={runStressTest}
            isLoading={isRunning}
            loadingText="Re-testing..."
          >
            Re-run Stress Test
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StressTestModal;
