import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../lib/api-client.js';
import { STRESS_TEST_SCENARIOS } from '../../constants/stress-scenarios.js';
import { Loader2, AlertCircle, RefreshCw, Layers } from 'lucide-react';

interface TemplateLivePreviewProps {
  definition: any;
  canonicalSampleContent?: any;
  brandingText?: string;
  watermarkText?: string;
  selectedScenarioId?: string;
  onSelectScenario?: (id: string) => void;
  widthPx?: number;
}

export const TemplateLivePreview: React.FC<TemplateLivePreviewProps> = ({
  definition,
  canonicalSampleContent,
  brandingText,
  watermarkText,
  selectedScenarioId = 'canonical',
  onSelectScenario,
  widthPx = 270,
}) => {
  const [html, setHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string>(selectedScenarioId);

  const seqRef = useRef(0);
  const abortCtrlRef = useRef<AbortController | null>(null);

  // Sync external scenarioId changes
  useEffect(() => {
    setScenarioId(selectedScenarioId);
  }, [selectedScenarioId]);

  const handleScenarioChange = (newScenarioId: string) => {
    setScenarioId(newScenarioId);
    if (onSelectScenario) {
      onSelectScenario(newScenarioId);
    }
  };

  // Determine current content and language payload
  const currentScenario = STRESS_TEST_SCENARIOS.find((s) => s.id === scenarioId);
  const currentContent = currentScenario ? currentScenario.content : (canonicalSampleContent || STRESS_TEST_SCENARIOS[0]!.content);
  const currentLanguage = currentScenario ? currentScenario.language : 'English';

  useEffect(() => {
    if (!definition) return;

    // Increment request sequence counter
    const currentSeq = ++seqRef.current;

    // Abort previous in-flight request
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }

    const abortCtrl = new AbortController();
    abortCtrlRef.current = abortCtrl;

    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const payload = {
          definition,
          content: currentContent,
          language: currentLanguage,
          branding: brandingText,
          watermark: watermarkText,
        };

        const res = await apiClient.post('/templates/preview', payload, {
          signal: abortCtrl.signal,
        });

        // Discard response if a newer request was sent
        if (currentSeq < seqRef.current) {
          return;
        }

        if (res.data?.success && res.data?.data?.html) {
          setHtml(res.data.data.html);
          setErrorMsg(null);
        }
      } catch (err: any) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          return;
        }
        if (currentSeq >= seqRef.current) {
          const apiError = err.response?.data?.error?.message || err.message || 'Validation error';
          setErrorMsg(apiError);
        }
      } finally {
        if (currentSeq >= seqRef.current) {
          setIsLoading(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      abortCtrl.abort();
    };
  }, [definition, scenarioId, brandingText, watermarkText]);

  // Fixed 1080x1920 scale calculation
  const scale = widthPx / 1080;
  const heightPx = Math.round(1920 * scale);

  return (
    <div className="flex flex-col items-center space-y-3">
      {/* Scenario selector bar */}
      <div className="w-full flex items-center justify-between gap-2 text-xs bg-[#12121c] p-2 rounded-lg border border-[#1a1a24]">
        <div className="flex items-center gap-1.5 text-[#9c9cb0] font-semibold">
          <Layers size={13} className="text-purple-400" />
          <span>Sample:</span>
        </div>
        <select
          value={scenarioId}
          onChange={(e) => handleScenarioChange(e.target.value)}
          className="flex-1 rounded border border-[#20202e] bg-[#181824] px-2 py-1 text-[11px] text-white outline-none focus:border-purple-500"
        >
          {canonicalSampleContent && <option value="canonical">Saved Canonical Example</option>}
          {STRESS_TEST_SCENARIOS.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.name} ({scenario.language})
            </option>
          ))}
        </select>
      </div>

      {/* Preview Frame */}
      <div
        className="relative rounded-xl overflow-hidden border-2 border-[#20202e] bg-black shadow-2xl transition-all"
        style={{ width: `${widthPx}px`, height: `${heightPx}px` }}
      >
        {/* Loading overlay indicator (subtle, non-blanking) */}
        {isLoading && (
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 rounded-full bg-purple-900/80 backdrop-blur-sm px-2 py-0.5 text-[10px] text-purple-200 border border-purple-400/30">
            <Loader2 size={10} className="animate-spin" />
            <span>Updating...</span>
          </div>
        )}

        {/* Error notification banner */}
        {errorMsg && (
          <div className="absolute top-2 left-2 right-2 z-20 flex items-center gap-1.5 rounded-lg bg-rose-950/90 backdrop-blur-sm p-2 text-[10px] text-rose-200 border border-rose-500/40 leading-tight">
            <AlertCircle size={12} className="text-rose-400 shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
        )}

        {/* Scaled 1080x1920 IFrame */}
        {html ? (
          <div
            style={{
              width: '1080px',
              height: '1920px',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <iframe
              title="Live Template Preview"
              sandbox="allow-same-origin"
              srcDoc={html}
              className="w-[1080px] h-[1920px] border-0 pointer-events-none bg-black"
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#6e6e80] text-xs p-4 text-center">
            <RefreshCw size={20} className="animate-spin mb-2 text-purple-400" />
            <span>Rendering preview...</span>
          </div>
        )}
      </div>

      <span className="text-[10px] text-[#6e6e80] font-mono">1080 × 1920 (9:16 Canvas)</span>
    </div>
  );
};

export default TemplateLivePreview;
