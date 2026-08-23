import React, { useState } from 'react';
import { Button } from '../ui/Button.js';
import { TemplateLivePreview } from './TemplateLivePreview.js';
import { X, GitCompare } from 'lucide-react';

interface TemplateVersion {
  id: string;
  versionNumber: number;
  definition: any;
  sampleContent: any;
  status: string;
  createdAt: string;
  notes?: string | null;
}

interface Template {
  id: string;
  name: string;
  versions?: TemplateVersion[];
}

interface VersionComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template;
}

const SECTIONS: Array<{ key: string; label: string }> = [
  { key: 'layout', label: '1. Layout & Alignments' },
  { key: 'typography', label: '2. Typography Scales' },
  { key: 'colors', label: '3. Color Palette' },
  { key: 'emphasisRules', label: '4. Emphasis Rules' },
  { key: 'spacing', label: '5. Spacing & Insets' },
  { key: 'decorations', label: '6. Decorations' },
  { key: 'branding', label: '7. Branding Rules' },
  { key: 'watermark', label: '8. Watermark Rules' },
  { key: 'backgroundTreatment', label: '9. Background Treatment' },
  { key: 'compatibility', label: 'Compatibility Constraints' },
];

export const VersionComparisonModal: React.FC<VersionComparisonModalProps> = ({
  isOpen,
  onClose,
  template,
}) => {
  const versions = template.versions || [];

  const [versionNumA, setVersionNumA] = useState<number>(() => {
    return versions.length > 1 ? versions[1]!.versionNumber : (versions[0]?.versionNumber || 1);
  });

  const [versionNumB, setVersionNumB] = useState<number>(() => {
    return versions[0]?.versionNumber || 1;
  });

  if (!isOpen) return null;

  const versionA = versions.find((v) => v.versionNumber === versionNumA) || versions[0];
  const versionB = versions.find((v) => v.versionNumber === versionNumB) || versions[0];

  const defA = versionA?.definition || {};
  const defB = versionB?.definition || {};

  const sectionDiffs = SECTIONS.map((sec) => {
    const valA = JSON.stringify(defA[sec.key] ?? null);
    const valB = JSON.stringify(defB[sec.key] ?? null);
    const isChanged = valA !== valB;
    return {
      key: sec.key,
      label: sec.label,
      isChanged,
    };
  });

  const changedCount = sectionDiffs.filter((d) => d.isChanged).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-4 sm:p-6 flex justify-center items-start sm:items-center py-8">
      <div className="w-full max-w-5xl rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1a1a24] pb-3">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-purple-400" />
              Compare Template Versions — {template.name}
            </h3>
            <p className="text-xs text-[#9c9cb0]">
              Visual side-by-side comparison and top-level definition section diffs
            </p>
          </div>
          <button onClick={onClose} className="text-[#6e6e80] hover:text-white cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Version Pickers */}
        <div className="grid grid-cols-2 gap-6 bg-[#14141e] p-4 rounded-xl border border-[#1a1a24]">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8c8c9e] mb-1">
              Version A (Base)
            </label>
            <select
              value={versionNumA}
              onChange={(e) => setVersionNumA(parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-[#20202e] bg-[#181824] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.versionNumber}>
                  Version {v.versionNumber} ({v.status}) — {new Date(v.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8c8c9e] mb-1">
              Version B (Comparison)
            </label>
            <select
              value={versionNumB}
              onChange={(e) => setVersionNumB(parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-[#20202e] bg-[#181824] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.versionNumber}>
                  Version {v.versionNumber} ({v.status}) — {new Date(v.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Flat Section Diff Badges */}
        <div className="bg-[#0b0b10] p-4 rounded-xl border border-[#1a1a24] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Section-Level Changes ({changedCount} modified)
            </span>
            <span className="text-[11px] text-[#6e6e80]">
              Comparing v{versionNumA} vs v{versionNumB}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
            {sectionDiffs.map((diff) => (
              <div
                key={diff.key}
                className={`p-2.5 rounded-lg border flex items-center justify-between text-[11px] font-medium transition ${
                  diff.isChanged
                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                    : 'bg-[#14141e] border-[#1a1a24] text-[#6e6e80]'
                }`}
              >
                <span className="truncate pr-1">{diff.label}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                    diff.isChanged
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-[#20202e] text-[#6e6e80]'
                  }`}
                >
                  {diff.isChanged ? 'Changed' : 'Same'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Side-by-Side Live Previews */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0b0b10] p-6 rounded-xl border border-[#1a1a24]">
          <div className="flex flex-col items-center space-y-2">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              Version {versionNumA} Preview
            </div>
            {defA && (
              <TemplateLivePreview
                definition={defA}
                canonicalSampleContent={versionA?.sampleContent}
                widthPx={230}
              />
            )}
          </div>

          <div className="flex flex-col items-center space-y-2">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              Version {versionNumB} Preview
            </div>
            {defB && (
              <TemplateLivePreview
                definition={defB}
                canonicalSampleContent={versionB?.sampleContent}
                widthPx={230}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-[#1a1a24] pt-4">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Comparison
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VersionComparisonModal;
