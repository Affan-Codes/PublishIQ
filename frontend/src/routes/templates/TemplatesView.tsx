import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../../lib/api-client.js';
import { useNotifications } from '../../context/NotificationContext.js';
import { RefreshButton } from '../../components/ui/RefreshButton.js';
import { SkeletonCard } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Button } from '../../components/ui/Button.js';
import { ErrorState } from '../../components/ui/ErrorState.js';
import {
  Plus,
  History,
  RotateCcw,
  X,
  AlertCircle,
  Layout,
  Search,
  Type,
  Palette,
  Sparkles,
  Maximize,
  Shield,
  Layers,
  Image,
  Eye,
  GitCompare,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import { TemplateLivePreview } from '../../components/templates/TemplateLivePreview.js';
import { StressTestModal } from '../../components/templates/StressTestModal.js';
import { VersionComparisonModal } from '../../components/templates/VersionComparisonModal.js';

const TemplateCategorySchema = z.enum([
  'CodeAnalogy',
  'MinimalQuote',
  'SplitStatement',
  'Terminal',
  'CodeBlock',
]);

const templateCreateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  category: TemplateCategorySchema,
  notes: z.string().max(500).optional(),
});

type TemplateCreateValues = z.infer<typeof templateCreateSchema>;

interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  componentPath: string | null;
  componentSource: string | null;
  category: string | null;
  definition: any | null;
  sampleContent: any | null;
  previewImageUrl: string | null;
  status: 'Draft' | 'Active' | 'Deprecated';
  notes: string | null;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  status: 'Draft' | 'Active' | 'Deprecated';
  notes: string | null;
  usedByCount?: number;
  versions?: TemplateVersion[];
}

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  CodeAnalogy: {
    label: 'Code Analogy',
    description: 'Multi-line programming concepts mapped to philosophical emotions (Variables, Functions, Loops)',
  },
  MinimalQuote: {
    label: 'Minimal Quote',
    description: 'Clean, bold centered quote with emphasis keywords and subtle attribution',
  },
  SplitStatement: {
    label: 'Split Statement',
    description: 'Header hook with decorative line divider and highlighted body statements over photo backdrop',
  },
  Terminal: {
    label: 'Terminal',
    description: 'Developer command prompt with $ command, highlighted error status, and logs',
  },
  CodeBlock: {
    label: 'Code Block',
    description: 'Framed syntax snippet card with monospace styling and bottom reflection narrative',
  },
};

const DEFAULT_FALLBACK_DEFINITION = {
  category: 'MinimalQuote',
  layout: { contentAlign: 'center', verticalAnchor: 'center', maxContentWidthPx: 880, blockGapPx: 48, safeAreaInsetsPx: { topPx: 140, bottomPx: 160, leftPx: 80, rightPx: 80 } },
  typography: {
    heading: { sizePx: 64, weight: 700, lineHeight: 1.5 },
    body: { sizePx: 48, weight: 400, lineHeight: 1.6 },
    code: { sizePx: 38, lineHeight: 1.5 },
    caption: { sizePx: 28, weight: 600, lineHeight: 1.4 },
  },
  colors: { background: '#0A0A0C', primary: '#FFFFFF', secondary: '#E2E8F0', accent: '#FFFFFF', muted: '#718096', error: '#E53E3E' },
  emphasisRules: {
    primary: { colorToken: 'primary', weight: 700, textTransform: 'uppercase' },
    secondary: { colorToken: 'secondary', weight: 600, textTransform: 'none' },
    normal: { colorToken: 'primary', weight: 400, textTransform: 'none' },
    muted: { colorToken: 'muted', weight: 400, textTransform: 'none' },
  },
  contentMapping: {
    heading: { typography: 'heading' },
    body_default: { typography: 'body' },
    body_label: { typography: 'body', forceEmphasis: 'primary' },
    body_attribution: { typography: 'caption', forceEmphasis: 'muted' },
    code_default: { typography: 'code' },
    code_command: { typography: 'code', forceEmphasis: 'normal' },
    body_error: { typography: 'body', forceEmphasis: 'primary', colorOverride: 'error' },
    list_item_default: { typography: 'body' },
  },
  decorations: { divider: 'none', codeIcon: false, terminalPrompt: false, heart: false, cornerMark: false },
  backgroundTreatment: { mode: 'solid' },
  branding: { typography: 'caption', sizeScalePct: 100, opacityCeiling: 1.0 },
  watermark: { typography: 'caption', sizeScalePct: 100, opacityCeiling: 0.65 },
  compatibility: { supportedBlockTypes: ['heading', 'body', 'divider'], supportedRoles: ['default', 'attribution', 'cta', 'error', 'label'], minBlocks: 1, maxBlocks: 6 },
};

export const TemplatesView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotifications();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [isStressTestOpen, setIsStressTestOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [historyTemplate, setHistoryTemplate] = useState<Template | null>(null);
  const [selectedVersionForPreview, setSelectedVersionForPreview] = useState<TemplateVersion | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('canonical');

  // 9-tab Template Editor states
  const [activeEditorTab, setActiveEditorTab] = useState<'layout' | 'typography' | 'colors' | 'emphasis' | 'spacing' | 'decorations' | 'branding' | 'watermark' | 'background'>('layout');
  const [editorDefinition, setEditorDefinition] = useState<any>(DEFAULT_FALLBACK_DEFINITION);
  const [lastSavedDefinition, setLastSavedDefinition] = useState<any>(DEFAULT_FALLBACK_DEFINITION);
  const [editorCategory, setEditorCategory] = useState<string>('MinimalQuote');
  const [versionNotes, setVersionNotes] = useState('');

  // Unsaved changes boolean computed via JSON string comparison
  const hasUnsavedChanges = JSON.stringify(editorDefinition) !== JSON.stringify(lastSavedDefinition);

  // Queries
  const { data: templates = [], isLoading, isFetching, isError, error, refetch } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await apiClient.get('/templates');
      return res.data.data;
    },
  });

  const getTemplateForCategory = (cat: string) => {
    return templates.find((t) => {
      const activeVer = t.versions?.find((v) => v.status === 'Active') || t.versions?.[0];
      return activeVer?.category === cat;
    });
  };

  const { register: regCreate, handleSubmit: subCreate, reset: resetCreate, setValue: setCreateValue, formState: { errors: errCreate } } = useForm<TemplateCreateValues>({
    resolver: zodResolver(templateCreateSchema),
    defaultValues: {
      category: 'MinimalQuote',
    },
  });

  // When opening Create Modal
  const handleOpenCreate = () => {
    setErrorText(null);
    setSelectedScenarioId('canonical');
    const existing = getTemplateForCategory('MinimalQuote');
    const activeVer = existing?.versions?.find((v) => v.status === 'Active') || existing?.versions?.[0];
    const initialDef = activeVer?.definition
      ? JSON.parse(JSON.stringify(activeVer.definition))
      : { ...DEFAULT_FALLBACK_DEFINITION, category: 'MinimalQuote' };
    setEditorCategory('MinimalQuote');
    setEditorDefinition(initialDef);
    setLastSavedDefinition(JSON.parse(JSON.stringify(initialDef)));
    resetCreate({ category: 'MinimalQuote', name: '', notes: '' });
    setIsCreateOpen(true);
  };

  // When opening Add Version Modal
  const handleOpenAddVersion = (tmpl: Template) => {
    setErrorText(null);
    setSelectedScenarioId('canonical');
    const activeVer = tmpl.versions?.find((v) => v.status === 'Active') || tmpl.versions?.[0];
    const cat = activeVer?.category || 'MinimalQuote';
    const initialDef = activeVer?.definition
      ? JSON.parse(JSON.stringify(activeVer.definition))
      : { ...DEFAULT_FALLBACK_DEFINITION, category: cat };
    setEditorCategory(cat);
    setEditorDefinition(initialDef);
    setLastSavedDefinition(JSON.parse(JSON.stringify(initialDef)));
    setVersionNotes('');
    setIsVersionOpen(true);
  };

  // Discard changes
  const handleDiscardChanges = () => {
    setEditorDefinition(JSON.parse(JSON.stringify(lastSavedDefinition)));
    addToast('Unsaved changes discarded', 'info');
  };

  // When category changes in form, reset definition by cloning from the seeded template of that category
  const handleCategoryChange = (cat: string) => {
    setEditorCategory(cat);
    setCreateValue('category', cat as any);
    const existing = getTemplateForCategory(cat);
    const activeVer = existing?.versions?.find((v) => v.status === 'Active') || existing?.versions?.[0];
    const newDef = activeVer?.definition
      ? JSON.parse(JSON.stringify(activeVer.definition))
      : { ...DEFAULT_FALLBACK_DEFINITION, category: cat };
    setEditorDefinition(newDef);
    setLastSavedDefinition(JSON.parse(JSON.stringify(newDef)));
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (values: TemplateCreateValues) => {
      const existing = getTemplateForCategory(values.category);
      const activeVer = existing?.versions?.find((v) => v.status === 'Active') || existing?.versions?.[0];
      const payload = {
        name: values.name,
        notes: values.notes,
        category: values.category,
        definition: editorDefinition,
        sampleContent: activeVer?.sampleContent || null,
      };
      const res = await apiClient.post('/templates', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      addToast('Visual template created successfully', 'success');
      setIsCreateOpen(false);
      resetCreate();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to create template');
    },
  });

  const addVersionMutation = useMutation({
    mutationFn: async () => {
      const activeVer = historyTemplate?.versions?.find((v) => v.status === 'Active') || historyTemplate?.versions?.[0];
      const payload = {
        category: editorCategory,
        definition: editorDefinition,
        sampleContent: activeVer?.sampleContent || null,
        notes: versionNotes || undefined,
      };
      const res = await apiClient.post(`/templates/${historyTemplate?.id}/versions`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      addToast('New template version published', 'success');
      if (historyTemplate) {
        apiClient.get(`/templates/${historyTemplate.id}`).then((res) => {
          setHistoryTemplate(res.data.data);
        });
      }
      setIsVersionOpen(false);
      setVersionNotes('');
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to add version');
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async ({ templateId, versionNumber }: { templateId: string; versionNumber: number }) => {
      const res = await apiClient.post(`/templates/${templateId}/versions/${versionNumber}/rollback`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      addToast('Template version activated as primary default', 'success');
      if (historyTemplate) {
        apiClient.get(`/templates/${historyTemplate.id}`).then((res) => {
          setHistoryTemplate(res.data.data);
        });
      }
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Failed to activate version', 'error');
    },
  });

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Visual Rendering Templates</h2>
            <p className="text-sm text-[#9c9cb0]">Manage visual templates for AI-generated content</p>
          </div>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} />
        </div>
        <ErrorState
          title="Failed to load visual templates"
          message={(error as any)?.message || 'An error occurred while fetching video rendering templates.'}
          onRetry={() => refetch()}
          onRefresh={() => refetch()}
        />
      </div>
    );
  }

  // 9-tab Definition Editor Sub-Component
  const renderDefinitionTabs = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 border-b border-[#1a1a24] pb-2">
        {[
          { id: 'layout', label: '1. Layout', icon: Layout },
          { id: 'typography', label: '2. Typography', icon: Type },
          { id: 'colors', label: '3. Colors', icon: Palette },
          { id: 'emphasis', label: '4. Emphasis', icon: Sparkles },
          { id: 'spacing', label: '5. Spacing', icon: Maximize },
          { id: 'decorations', label: '6. Decorations', icon: Layers },
          { id: 'branding', label: '7. Branding', icon: Shield },
          { id: 'watermark', label: '8. Watermark', icon: Shield },
          { id: 'background', label: '9. Background', icon: Image },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeEditorTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveEditorTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                active
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-[#6e6e80] hover:text-white hover:bg-[#14141e]'
              }`}
            >
              <Icon size={12} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Layout */}
      {activeEditorTab === 'layout' && (
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[#6e6e80] font-semibold uppercase mb-1">Content Alignment</label>
            <select
              value={editorDefinition.layout?.contentAlign || 'left'}
              onChange={(e) => setEditorDefinition({ ...editorDefinition, layout: { ...editorDefinition.layout, contentAlign: e.target.value } })}
              className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none"
            >
              <option value="left">Left Aligned</option>
              <option value="center">Center Aligned</option>
            </select>
          </div>
          <div>
            <label className="block text-[#6e6e80] font-semibold uppercase mb-1">Vertical Anchor</label>
            <select
              value={editorDefinition.layout?.verticalAnchor || 'center'}
              onChange={(e) => setEditorDefinition({ ...editorDefinition, layout: { ...editorDefinition.layout, verticalAnchor: e.target.value } })}
              className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none"
            >
              <option value="top">Top Anchored</option>
              <option value="center">Center Anchored</option>
              <option value="bottom">Bottom Anchored</option>
            </select>
          </div>
        </div>
      )}

      {/* TAB 2: Typography */}
      {activeEditorTab === 'typography' && (
        <div className="grid grid-cols-2 gap-4 text-xs max-h-56 overflow-y-auto pr-1">
          {['heading', 'body', 'code', 'caption'].map((role) => {
            const typo = editorDefinition.typography?.[role] || { sizePx: 40, lineHeight: 1.5, weight: 400 };
            return (
              <div key={role} className="bg-[#14141e] p-3 rounded-lg border border-[#1a1a24] space-y-2">
                <span className="font-bold text-white uppercase tracking-wider">{role}</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6e6e80]">Size: {typo.sizePx}px</span>
                  <input
                    type="range"
                    min="14"
                    max="100"
                    value={typo.sizePx}
                    onChange={(e) => {
                      const updated = { ...editorDefinition.typography, [role]: { ...typo, sizePx: Number(e.target.value) } };
                      setEditorDefinition({ ...editorDefinition, typography: updated });
                    }}
                    className="w-24 accent-purple-500"
                  />
                </div>
                {role !== 'code' && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#6e6e80]">Weight</span>
                    <select
                      value={typo.weight || 400}
                      onChange={(e) => {
                        const updated = { ...editorDefinition.typography, [role]: { ...typo, weight: Number(e.target.value) } };
                        setEditorDefinition({ ...editorDefinition, typography: updated });
                      }}
                      className="bg-[#161620] border border-[#1a1a24] text-white rounded px-2 py-0.5 text-[11px]"
                    >
                      <option value={400}>Regular (400)</option>
                      <option value={600}>SemiBold (600)</option>
                      <option value={700}>Bold (700)</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: Colors */}
      {activeEditorTab === 'colors' && (
        <div className="grid grid-cols-3 gap-3 text-xs">
          {['background', 'primary', 'secondary', 'accent', 'muted', 'error'].map((slot) => {
            const val = editorDefinition.colors?.[slot] || '#FFFFFF';
            return (
              <div key={slot} className="bg-[#14141e] p-2.5 rounded-lg border border-[#1a1a24] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#9c9cb0] capitalize">{slot}</span>
                  <div className="w-4 h-4 rounded border border-white/20" style={{ backgroundColor: val }} />
                </div>
                <input
                  type="text"
                  value={val}
                  onChange={(e) => {
                    const updated = { ...editorDefinition.colors, [slot]: e.target.value };
                    setEditorDefinition({ ...editorDefinition, colors: updated });
                  }}
                  className="w-full bg-[#161620] border border-[#1a1a24] text-white font-mono px-2 py-1 rounded text-xs"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 4: Emphasis */}
      {activeEditorTab === 'emphasis' && (
        <div className="grid grid-cols-2 gap-3 text-xs max-h-56 overflow-y-auto pr-1">
          {['primary', 'secondary', 'normal', 'muted'].map((role) => {
            const rule = editorDefinition.emphasisRules?.[role] || { colorToken: 'accent', weight: 700, textTransform: 'none' };
            return (
              <div key={role} className="bg-[#14141e] p-3 rounded-lg border border-[#1a1a24] space-y-2">
                <span className="font-bold text-white capitalize">{role} Emphasis</span>
                <div className="flex justify-between items-center">
                  <span className="text-[#6e6e80]">Color Slot:</span>
                  <select
                    value={rule.colorToken}
                    onChange={(e) => {
                      const updated = { ...editorDefinition.emphasisRules, [role]: { ...rule, colorToken: e.target.value } };
                      setEditorDefinition({ ...editorDefinition, emphasisRules: updated });
                    }}
                    className="bg-[#161620] border border-[#1a1a24] text-white rounded px-2 py-0.5 text-[11px]"
                  >
                    {['accent', 'primary', 'secondary', 'muted', 'error'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6e6e80]">Transform:</span>
                  <select
                    value={rule.textTransform || 'none'}
                    onChange={(e) => {
                      const updated = { ...editorDefinition.emphasisRules, [role]: { ...rule, textTransform: e.target.value } };
                      setEditorDefinition({ ...editorDefinition, emphasisRules: updated });
                    }}
                    className="bg-[#161620] border border-[#1a1a24] text-white rounded px-2 py-0.5 text-[11px]"
                  >
                    <option value="none">None</option>
                    <option value="uppercase">UPPERCASE</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 5: Spacing */}
      {activeEditorTab === 'spacing' && (
        <div className="space-y-4 text-xs">
          <div>
            <div className="flex justify-between text-[#6e6e80] mb-1">
              <span>Max Content Width: {editorDefinition.layout?.maxContentWidthPx || 900}px</span>
              <span>400px - 1000px</span>
            </div>
            <input
              type="range"
              min="400"
              max="1000"
              value={editorDefinition.layout?.maxContentWidthPx || 900}
              onChange={(e) => setEditorDefinition({ ...editorDefinition, layout: { ...editorDefinition.layout, maxContentWidthPx: Number(e.target.value) } })}
              className="w-full accent-purple-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-[#6e6e80] mb-1">
              <span>Block Gap: {editorDefinition.layout?.blockGapPx || 32}px</span>
              <span>8px - 160px</span>
            </div>
            <input
              type="range"
              min="8"
              max="160"
              value={editorDefinition.layout?.blockGapPx || 32}
              onChange={(e) => setEditorDefinition({ ...editorDefinition, layout: { ...editorDefinition.layout, blockGapPx: Number(e.target.value) } })}
              className="w-full accent-purple-500"
            />
          </div>
        </div>
      )}

      {/* TAB 6: Decorations */}
      {activeEditorTab === 'decorations' && (
        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[#6e6e80]">Divider Style</span>
            <select
              value={editorDefinition.decorations?.divider || 'none'}
              onChange={(e) => setEditorDefinition({ ...editorDefinition, decorations: { ...editorDefinition.decorations, divider: e.target.value } })}
              className="bg-[#161620] border border-[#1a1a24] text-white rounded px-3 py-1 text-xs"
            >
              <option value="none">None</option>
              <option value="line">Horizontal Line</option>
              <option value="code_symbol">&lt;/&gt; Code Symbol</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            {[
              { key: 'terminalPrompt', label: 'Terminal Prompt ($)' },
              { key: 'codeIcon', label: 'Code Icon (</>)' },
              { key: 'heart', label: 'Heart Mark (♡)' },
              { key: 'cornerMark', label: 'Corner Framing Marks' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 bg-[#14141e] p-2 rounded-lg border border-[#1a1a24] cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editorDefinition.decorations?.[key])}
                  onChange={(e) => {
                    const dec = { ...editorDefinition.decorations, [key]: e.target.checked };
                    setEditorDefinition({ ...editorDefinition, decorations: dec });
                  }}
                  className="accent-purple-500"
                />
                <span className="text-white text-xs">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: Branding */}
      {activeEditorTab === 'branding' && (
        <div className="space-y-4 text-xs">
          <div>
            <div className="flex justify-between text-[#6e6e80] mb-1">
              <span>Size Scale: {editorDefinition.branding?.sizeScalePct || 100}%</span>
              <span>50% - 150%</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              value={editorDefinition.branding?.sizeScalePct || 100}
              onChange={(e) => setEditorDefinition({ ...editorDefinition, branding: { ...editorDefinition.branding, sizeScalePct: Number(e.target.value) } })}
              className="w-full accent-purple-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-[#6e6e80] mb-1">
              <span>Opacity Ceiling: {Math.round((editorDefinition.branding?.opacityCeiling ?? 1) * 100)}%</span>
              <span>0% - 100%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={editorDefinition.branding?.opacityCeiling ?? 1}
              onChange={(e) => setEditorDefinition({ ...editorDefinition, branding: { ...editorDefinition.branding, opacityCeiling: Number(e.target.value) } })}
              className="w-full accent-purple-500"
            />
          </div>
        </div>
      )}

      {/* TAB 8: Watermark */}
      {activeEditorTab === 'watermark' && (
        <div className="space-y-4 text-xs">
          <div>
            <div className="flex justify-between text-[#6e6e80] mb-1">
              <span>Size Scale: {editorDefinition.watermark?.sizeScalePct || 100}%</span>
              <span>50% - 150%</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              value={editorDefinition.watermark?.sizeScalePct || 100}
              onChange={(e) => setEditorDefinition({ ...editorDefinition, watermark: { ...editorDefinition.watermark, sizeScalePct: Number(e.target.value) } })}
              className="w-full accent-purple-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-[#6e6e80] mb-1">
              <span>Opacity Ceiling: {Math.round((editorDefinition.watermark?.opacityCeiling ?? 0.7) * 100)}%</span>
              <span>0% - 100%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={editorDefinition.watermark?.opacityCeiling ?? 0.7}
              onChange={(e) => setEditorDefinition({ ...editorDefinition, watermark: { ...editorDefinition.watermark, opacityCeiling: Number(e.target.value) } })}
              className="w-full accent-purple-500"
            />
          </div>
        </div>
      )}

      {/* TAB 9: Background */}
      {activeEditorTab === 'background' && (
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-[#6e6e80] font-semibold uppercase mb-1">Background Treatment Mode</label>
            <select
              value={editorDefinition.backgroundTreatment?.mode || 'solid'}
              onChange={(e) => setEditorDefinition({ ...editorDefinition, backgroundTreatment: { ...editorDefinition.backgroundTreatment, mode: e.target.value } })}
              className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none"
            >
              <option value="solid">Solid Canvas Color</option>
              <option value="image_overlay">Image Overlay (Transparent Plate with Scrim)</option>
              <option value="gradient">Vertical Gradient</option>
            </select>
          </div>
          {editorDefinition.backgroundTreatment?.mode === 'image_overlay' && (
            <div>
              <div className="flex justify-between text-[#6e6e80] mb-1">
                <span>Scrim Opacity: {Math.round((editorDefinition.backgroundTreatment?.scrimOpacity ?? 0.65) * 100)}%</span>
                <span>0% - 100%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={editorDefinition.backgroundTreatment?.scrimOpacity ?? 0.65}
                onChange={(e) => setEditorDefinition({ ...editorDefinition, backgroundTreatment: { ...editorDefinition.backgroundTreatment, scrimOpacity: Number(e.target.value) } })}
                className="w-full accent-purple-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Visual Rendering Templates</h2>
          <p className="text-sm text-[#9c9cb0]">Manage visual templates for AI-generated content</p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} title="Refresh templates" />
          <Button icon={Plus} onClick={handleOpenCreate}>
            Create Template
          </Button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-3 bg-[#0e0e12] p-4 rounded-xl border border-[#1a1a24] relative">
        <Search className="absolute left-7 text-[#6e6e80]" size={16} />
        <input
          type="text"
          placeholder="Filter templates by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-80 rounded-lg border border-[#1a1a24] bg-[#161620] pl-10 pr-4 py-2 text-sm text-white placeholder-[#6e6e80] focus:border-purple-500 outline-none transition"
        />
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          icon={Layout}
          title="No rendering templates configured"
          description="Register visual layout components for automated FFmpeg video rendering."
          actionLabel="Create Template"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => {
            const activeVer = template.versions?.find((v) => v.status === 'Active') || template.versions?.[0];
            const categoryName = activeVer?.category || 'MinimalQuote';
            return (
              <div
                key={template.id}
                className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 flex flex-col justify-between hover:border-[#2b2b3a] transition"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        template.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {template.status}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {categoryName}
                    </span>
                  </div>

                  {activeVer?.previewImageUrl && (
                    <div className="w-full h-32 rounded-lg bg-black overflow-hidden border border-[#1a1a24] flex items-center justify-center relative group">
                      <img
                        src={activeVer.previewImageUrl}
                        alt={template.name}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition duration-300"
                      />
                      <button
                        onClick={() => setSelectedVersionForPreview(activeVer)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs gap-1 transition cursor-pointer"
                      >
                        <Eye size={14} /> Full Preview
                      </button>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-bold text-white">{template.name}</h3>
                    <p className="text-xs text-[#9c9cb0] mt-1 line-clamp-2">
                      {template.notes || 'No notes available.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#1a1a24]/50 pt-4 text-xs">
                  <span className="text-[#6e6e80]">
                    Used By: <strong className="text-white">{template.usedByCount || 0}</strong> profiles
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={History}
                    onClick={async () => {
                      const res = await apiClient.get(`/templates/${template.id}`);
                      setHistoryTemplate(res.data.data);
                    }}
                  >
                    Version Registry
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

              {/* Create Template Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-4 sm:p-6 flex justify-center items-start sm:items-center py-8">
          <div className="w-full max-w-5xl rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-5 shadow-2xl my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white">Create Visual Rendering Template</h3>
                {hasUnsavedChanges && (
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                    Unsaved Changes
                  </span>
                )}
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{errorText}</span>
              </div>
            )}

            <form onSubmit={subCreate((v) => createMutation.mutate(v))} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Form & 9 Tabs */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                        Template Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Minimalist Quote Poster"
                        {...regCreate('name')}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500 text-xs"
                      />
                      {errCreate.name && <p className="mt-1 text-xs text-red-400">{errCreate.name.message}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                        Template Category
                      </label>
                      <select
                        value={editorCategory}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500 text-xs"
                      >
                        {Object.entries(CATEGORY_META).map(([cat, meta]) => (
                          <option key={cat} value={cat}>{meta.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                      Template Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Vertical layout for viral social shorts"
                      {...regCreate('notes')}
                      className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500 text-xs"
                    />
                  </div>

                  {/* 9-Tab Template Definition Editor */}
                  <div className="bg-[#0b0b10] p-4 rounded-xl border border-[#1a1a24] space-y-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">
                      Template Definition Settings (9 Tabs)
                    </span>
                    {renderDefinitionTabs()}
                  </div>
                </div>

                {/* Right Column: Live Preview & Stress Testing */}
                <div className="lg:col-span-4 flex flex-col items-center bg-[#0b0b10] p-4 rounded-xl border border-[#1a1a24] space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Eye size={13} className="text-purple-400" /> Live Canvas
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      icon={ShieldCheck}
                      onClick={() => setIsStressTestOpen(true)}
                    >
                      Test Layout
                    </Button>
                  </div>

                  <TemplateLivePreview
                    definition={editorDefinition}
                    selectedScenarioId={selectedScenarioId}
                    onSelectScenario={setSelectedScenarioId}
                    widthPx={250}
                  />

                  {hasUnsavedChanges && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      icon={Undo2}
                      onClick={handleDiscardChanges}
                      className="w-full"
                    >
                      Discard Changes
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#1a1a24] pt-4">
                <div>
                  {hasUnsavedChanges && (
                    <span className="text-xs text-amber-400/90 font-medium">
                      You have unsaved definition changes.
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)} disabled={createMutation.isPending}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={createMutation.isPending} loadingText="Saving...">
                    Create Template
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version Registry Drawer */}
      {historyTemplate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-start sm:items-center py-8">
          <div className="w-full max-w-3xl rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-5 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-3">
              <div>
                <h3 className="text-xl font-bold text-white">{historyTemplate.name}</h3>
                <p className="text-xs text-[#9c9cb0]">Template Version Registry & Preview Engine</p>
              </div>
              <button onClick={() => setHistoryTemplate(null)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="flex justify-between items-center bg-[#14141e] p-4 rounded-xl border border-[#1a1a24]">
              <span className="text-xs text-[#9c9cb0]">Manage layout definitions, preview rendered output, or activate older versions.</span>
              <div className="flex items-center gap-2">
                {(historyTemplate.versions?.length || 0) >= 2 && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={GitCompare}
                    onClick={() => setIsComparisonOpen(true)}
                  >
                    Compare Versions
                  </Button>
                )}
                <Button size="sm" icon={Plus} onClick={() => handleOpenAddVersion(historyTemplate)}>
                  New Version
                </Button>
              </div>
            </div>

            {/* Versions List */}
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {(historyTemplate.versions || []).map((ver) => (
                <div key={ver.id} className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Version {ver.versionNumber}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          ver.status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-gray-500/10 text-gray-400'
                        }`}
                      >
                        {ver.status}
                      </span>
                      {ver.category && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {ver.category}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#6e6e80]">
                      {new Date(ver.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {ver.previewImageUrl && (
                    <div className="flex items-center gap-3 bg-[#0c0c12] p-2 rounded border border-[#1a1a24]">
                      <img src={ver.previewImageUrl} alt="Preview" className="w-16 h-28 object-cover rounded border border-white/10" />
                      <div className="text-xs space-y-1">
                        <span className="font-semibold text-white block">Rendered Preview Plate</span>
                        <span className="text-[10px] text-[#6e6e80] font-mono break-all">{ver.previewImageUrl}</span>
                        <button
                          onClick={() => setSelectedVersionForPreview(ver)}
                          className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-[11px] font-semibold pt-1 cursor-pointer"
                        >
                          <Eye size={12} /> Inspect Full Render
                        </button>
                      </div>
                    </div>
                  )}

                  {ver.notes && <p className="text-xs text-[#6e6e80] italic">Notes: {ver.notes}</p>}

                  <div className="flex items-center justify-between border-t border-[#1a1a24] pt-2">
                    <span className="text-[10px] text-[#6e6e80] font-mono">ID: {ver.id}</span>
                    {ver.status !== 'Active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        icon={RotateCcw}
                        isLoading={rollbackMutation.isPending}
                        loadingText="Activating..."
                        onClick={() =>
                          rollbackMutation.mutate({ templateId: historyTemplate.id, versionNumber: ver.versionNumber })
                        }
                      >
                        Set as Active
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-[#1a1a24] pt-4">
              <Button variant="secondary" size="sm" onClick={() => setHistoryTemplate(null)}>
                Close Registry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Version Modal */}
      {isVersionOpen && historyTemplate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-4 sm:p-6 flex justify-center items-start sm:items-center py-8">
          <div className="w-full max-w-5xl rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-5 shadow-2xl my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white">Publish New Template Version</h3>
                {hasUnsavedChanges && (
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                    Unsaved Changes
                  </span>
                )}
              </div>
              <button onClick={() => setIsVersionOpen(false)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                {errorText}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Form & 9 Tabs */}
                <div className="lg:col-span-8 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#6e6e80] font-semibold uppercase mb-1">Category</label>
                      <select
                        value={editorCategory}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none"
                      >
                        {Object.entries(CATEGORY_META).map(([cat, meta]) => (
                          <option key={cat} value={cat}>{meta.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#6e6e80] font-semibold uppercase mb-1">Version Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Updated subtitle scaling and palette"
                        value={versionNotes}
                        onChange={(e) => setVersionNotes(e.target.value)}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none"
                      />
                    </div>
                  </div>

                  {/* 9 Tabs Editor */}
                  <div className="bg-[#0b0b10] p-4 rounded-xl border border-[#1a1a24] space-y-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">
                      Template Definition Settings (9 Tabs)
                    </span>
                    {renderDefinitionTabs()}
                  </div>
                </div>

                {/* Right Column: Live Preview & Stress Testing */}
                <div className="lg:col-span-4 flex flex-col items-center bg-[#0b0b10] p-4 rounded-xl border border-[#1a1a24] space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Eye size={13} className="text-purple-400" /> Live Canvas
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      icon={ShieldCheck}
                      onClick={() => setIsStressTestOpen(true)}
                    >
                      Test Layout
                    </Button>
                  </div>

                  <TemplateLivePreview
                    definition={editorDefinition}
                    canonicalSampleContent={
                      historyTemplate.versions?.find((v) => v.status === 'Active')?.sampleContent
                    }
                    selectedScenarioId={selectedScenarioId}
                    onSelectScenario={setSelectedScenarioId}
                    widthPx={250}
                  />

                  {hasUnsavedChanges && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      icon={Undo2}
                      onClick={handleDiscardChanges}
                      className="w-full"
                    >
                      Discard Changes
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#1a1a24] pt-4">
                <div>
                  {hasUnsavedChanges && (
                    <span className="text-xs text-amber-400/90 font-medium">
                      You have unsaved definition changes.
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" type="button" onClick={() => setIsVersionOpen(false)} disabled={addVersionMutation.isPending}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => addVersionMutation.mutate()}
                    isLoading={addVersionMutation.isPending}
                    loadingText="Publishing..."
                  >
                    Publish Version
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {selectedVersionForPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md p-4 sm:p-6 flex justify-center items-center">
          <div className="w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-2">
              <span className="text-sm font-bold text-white">Version {selectedVersionForPreview.versionNumber} Preview</span>
              <button onClick={() => setSelectedVersionForPreview(null)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>
            {selectedVersionForPreview.previewImageUrl ? (
              <div className="w-full aspect-[9/16] rounded-lg overflow-hidden border border-white/20 bg-black shadow-inner">
                <img
                  src={selectedVersionForPreview.previewImageUrl}
                  alt="Full Render Preview"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <p className="text-xs text-[#6e6e80] py-8 text-center">No preview image generated for this version.</p>
            )}
          </div>
        </div>
      )}

      {/* Stress Test Modal */}
      <StressTestModal
        isOpen={isStressTestOpen}
        onClose={() => setIsStressTestOpen(false)}
        definition={editorDefinition}
        onSelectScenarioForPreview={(scenarioId) => setSelectedScenarioId(scenarioId)}
      />

      {/* Version Comparison Modal */}
      {historyTemplate && (
        <VersionComparisonModal
          isOpen={isComparisonOpen}
          onClose={() => setIsComparisonOpen(false)}
          template={historyTemplate}
        />
      )}
    </div>
  );
};

export default TemplatesView;
