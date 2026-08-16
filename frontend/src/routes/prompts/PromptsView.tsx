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
import { Plus, History, RotateCcw, X, AlertCircle, FileText, Search, Play, Sparkles, CheckCircle2, AlertTriangle, FileCode } from 'lucide-react';

const promptCreateSchema = z.object({
  name: z.string().min(1, 'Prompt name is required').max(100),
  notes: z.string().max(500).optional(),
  body: z.string().min(1, 'Prompt body cannot be empty'),
});

const promptVersionSchema = z.object({
  body: z.string().min(1, 'Version body cannot be empty'),
  notes: z.string().max(500).optional(),
});

type PromptCreateValues = z.infer<typeof promptCreateSchema>;
type PromptVersionValues = z.infer<typeof promptVersionSchema>;

interface PromptVersion {
  id: string;
  promptId: string;
  versionNumber: number;
  body: string;
  status: 'Draft' | 'Active' | 'Deprecated';
  notes: string | null;
  createdAt: string;
  usedByProfileCount?: number;
}

interface Prompt {
  id: string;
  name: string;
  status: 'Draft' | 'Active' | 'Deprecated';
  notes: string | null;
  versions?: PromptVersion[];
}

interface OutputContractField {
  key: string;
  type: string;
  description: string;
  required: boolean;
}

function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
  const variables = matches.map((m) => m.replace(/[\{\}]/g, '').trim());
  return Array.from(new Set(variables));
}

export const PromptsView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotifications();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [historyPrompt, setHistoryPrompt] = useState<Prompt | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Testing State
  const [testingVersion, setTestingVersion] = useState<{ prompt: Prompt; version: PromptVersion } | null>(null);
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ text: string; metadata?: any } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Queries
  const { data: prompts = [], isLoading, isFetching, isError, error, refetch } = useQuery<Prompt[]>({
    queryKey: ['prompts'],
    queryFn: async () => {
      const res = await apiClient.get('/prompts');
      return res.data.data;
    },
  });

  const { data: outputContract = [] } = useQuery<OutputContractField[]>({
    queryKey: ['prompts', 'output-contract'],
    queryFn: async () => {
      const res = await apiClient.get('/prompts/output-contract');
      return res.data.data;
    },
    staleTime: Infinity,
  });

  const { register: regCreate, handleSubmit: subCreate, reset: resetCreate, watch: watchCreate, setValue: setValueCreate, formState: { errors: errCreate } } = useForm<PromptCreateValues>({
    resolver: zodResolver(promptCreateSchema),
  });

  const { register: regVer, handleSubmit: subVer, reset: resetVer, formState: { errors: errVer } } = useForm<PromptVersionValues>({
    resolver: zodResolver(promptVersionSchema),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (values: PromptCreateValues) => {
      const res = await apiClient.post('/prompts', values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      addToast('Prompt template created successfully', 'success');
      setIsCreateOpen(false);
      resetCreate();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to create prompt');
    },
  });

  const addVersionMutation = useMutation({
    mutationFn: async (values: PromptVersionValues) => {
      const res = await apiClient.post(`/prompts/${historyPrompt?.id}/versions`, values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      addToast('New prompt version published', 'success');
      if (historyPrompt) {
        apiClient.get(`/prompts/${historyPrompt.id}`).then((res) => {
          setHistoryPrompt(res.data.data);
        });
      }
      setIsVersionOpen(false);
      resetVer();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to add version');
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async ({ promptId, versionNumber }: { promptId: string; versionNumber: number }) => {
      const res = await apiClient.post(`/prompts/${promptId}/versions/${versionNumber}/rollback`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      addToast('Prompt version activated as primary default', 'success');
      if (historyPrompt) {
        apiClient.get(`/prompts/${historyPrompt.id}`).then((res) => {
          setHistoryPrompt(res.data.data);
        });
      }
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Failed to activate version', 'error');
    },
  });

  const openTestModal = (prompt: Prompt, version: PromptVersion) => {
    const vars = extractVariables(version.body);
    const initialVars: Record<string, string> = {};
    vars.forEach((v) => {
      if (v === 'contentType') initialVars[v] = 'Quote';
      else if (v === 'language') initialVars[v] = 'English';
      else if (v === 'tone') initialVars[v] = 'Inspiring';
      else if (v === 'style') initialVars[v] = 'Poetic';
      else initialVars[v] = '';
    });
    setTestVariables(initialVars);
    setTestResult(null);
    setTestError(null);
    setTestingVersion({ prompt, version });
  };

  const handleRunTest = async () => {
    if (!testingVersion) return;
    setIsTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const res = await apiClient.post(
        `/prompts/${testingVersion.prompt.id}/versions/${testingVersion.version.versionNumber}/test`,
        { variables: testVariables }
      );
      setTestResult(res.data.data);
      addToast('Prompt test generation completed', 'success');
    } catch (err: any) {
      setTestError(err.response?.data?.error?.message || err.message || 'Prompt test generation failed');
    } finally {
      setIsTesting(false);
    }
  };

  const filteredPrompts = prompts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">AI System Prompts</h2>
            <p className="text-sm text-[#9c9cb0]">Manage versioned AI quote and Shayari generation instructions</p>
          </div>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} />
        </div>
        <ErrorState
          title="Failed to load prompt templates"
          message={(error as any)?.message || 'An error occurred while fetching AI prompts.'}
          onRetry={() => refetch()}
          onRefresh={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">AI System Prompts</h2>
          <p className="text-sm text-[#9c9cb0]">Manage versioned AI quote and Shayari generation instructions</p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} title="Refresh prompts" />
          <Button icon={Plus} onClick={() => { setErrorText(null); setIsCreateOpen(true); }}>
            Create Prompt
          </Button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-3 bg-[#0e0e12] p-4 rounded-xl border border-[#1a1a24] relative">
        <Search className="absolute left-7 text-[#6e6e80]" size={16} />
        <input
          type="text"
          placeholder="Filter prompts by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-80 rounded-lg border border-[#1a1a24] bg-[#161620] pl-10 pr-4 py-2 text-sm text-white placeholder-[#6e6e80] focus:border-purple-500 outline-none transition"
        />
      </div>

      {/* Prompts Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredPrompts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No system prompts configured"
          description="Create system prompts to guide Gemini AI quote generation."
          actionLabel="Create Prompt"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 flex flex-col justify-between hover:border-[#2b2b3a] transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      prompt.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {prompt.status}
                  </span>
                  <span className="text-[10px] text-[#6e6e80] font-mono">
                    ID: {prompt.id.slice(0, 8)}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">{prompt.name}</h3>
                  <p className="text-xs text-[#9c9cb0] mt-1 line-clamp-2">
                    {prompt.notes || 'No version notes recorded.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-[#1a1a24]/50 pt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={History}
                  onClick={async () => {
                    const res = await apiClient.get(`/prompts/${prompt.id}`);
                    setHistoryPrompt(res.data.data);
                  }}
                >
                  Version History & Testing
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Prompt Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">Create New Prompt Template</h3>
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

            <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 text-xs text-purple-200 space-y-1.5">
              <div className="font-semibold text-purple-300">💡 System Placeholders (Injected at generation time):</div>
              <ul className="space-y-1 text-[11px] text-[#b8b8cc]">
                <li><code className="bg-[#161620] px-1 py-0.5 rounded text-purple-300 font-mono">{'{{contentType}}'}</code> &rarr; from Content Profile's Content Type (e.g. Shayari, Quote)</li>
                <li><code className="bg-[#161620] px-1 py-0.5 rounded text-purple-300 font-mono">{'{{language}}'}</code> &rarr; from Content Profile's Language field (English, Hindi, Urdu)</li>
                <li><code className="bg-[#161620] px-1 py-0.5 rounded text-purple-300 font-mono">{'{{tone}}'}</code> &rarr; from Content Profile's Tone field</li>
                <li><code className="bg-[#161620] px-1 py-0.5 rounded text-purple-300 font-mono">{'{{style}}'}</code> &rarr; from Content Profile's Writing Style field</li>
                <li><code className="bg-[#161620] px-1 py-0.5 rounded text-purple-300 font-mono">{'{{musicCatalog}}'}</code> &rarr; auto-populated with eligible background music tracks (optional)</li>
              </ul>
            </div>

            {outputContract && outputContract.length > 0 && (
              <div className="rounded-lg bg-[#14141e] border border-[#2b2b3a] p-3 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                  <FileCode size={14} />
                  <span>Expected AI Output Contract (Gemini JSON Schema):</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {outputContract.map((field) => (
                    <div key={field.key} className="bg-[#0e0e12] p-2 rounded border border-[#1a1a24] space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-purple-300 font-semibold">{field.key}</span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${field.required ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-400'}`}>
                          {field.required ? 'required' : 'optional'}
                        </span>
                      </div>
                      <p className="text-[#9c9cb0] text-[10px] line-clamp-2">{field.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={subCreate((v) => createMutation.mutate(v))} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Prompt Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hindi Romantic Shayari Master Prompt"
                  {...regCreate('name')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                />
                {errCreate.name && <p className="mt-1 text-xs text-red-400">{errCreate.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Initial Version Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Initial creation for quotes generation"
                  {...regCreate('notes')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                    Prompt Instructions Body
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const current = watchCreate('body');
                      if (!current || window.confirm('Insert starter template? This will replace any existing text in the prompt body.')) {
                        setValueCreate('body', `# ROLE\nYou are an expert content creator and poet.\n\n# OBJECTIVE\nGenerate a {{contentType}} in {{language}} with a {{tone}} tone and {{style}} style.\n\n# CONTENT RULES\n- Keep the main quote/content concise, impactful, and authentic.\n- Ensure the tone matches the requested mood.\n\n# OUTPUT\nReturn only the requested structured fields — do not add extra commentary.`);
                      }
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 underline cursor-pointer"
                  >
                    Insert Starter Template
                  </button>
                </div>
                <textarea
                  rows={6}
                  placeholder="You are an expert poet. Generate a 2-line {{contentType}} in {{language}} with a {{tone}} tone..."
                  {...regCreate('body')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-3 text-white font-mono text-xs outline-none focus:border-purple-500"
                />
                {errCreate.body && <p className="mt-1 text-xs text-red-400">{errCreate.body.message}</p>}
              </div>

              <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
                <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)} disabled={createMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createMutation.isPending} loadingText="Saving...">
                  Create Prompt
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History Drawer */}
      {historyPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">{historyPrompt.name}</h3>
                <p className="text-xs text-[#9c9cb0]">Prompt Version Registry, Testing & Rollback Engine</p>
              </div>
              <button onClick={() => setHistoryPrompt(null)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="flex justify-between items-center bg-[#14141e] p-4 rounded-xl border border-[#1a1a24]">
              <span className="text-xs text-[#9c9cb0]">Need to tweak prompt behavior? Create a new immutable version.</span>
              <Button size="sm" icon={Plus} onClick={() => { setErrorText(null); setIsVersionOpen(true); }}>
                New Version
              </Button>
            </div>

            {/* Versions List */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {(historyPrompt.versions || []).map((ver) => (
                <div key={ver.id} className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Version {ver.versionNumber}</span>
                      {ver.status === 'Active' ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      ) : (ver.usedByProfileCount ?? 0) > 0 ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle size={10} />
                          Deprecated (In Use)
                        </span>
                      ) : (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
                          Deprecated
                        </span>
                      )}
                      <span className="text-xs text-[#9c9cb0]">
                        · Used by {ver.usedByProfileCount ?? 0} {ver.usedByProfileCount === 1 ? 'profile' : 'profiles'}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#6e6e80]">
                      {new Date(ver.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-[#9c9cb0] font-mono bg-[#0c0c12] p-3 rounded-lg border border-[#1b1b26] whitespace-pre-wrap">
                    {ver.body}
                  </p>

                  {ver.notes && <p className="text-xs text-[#6e6e80] italic">Notes: {ver.notes}</p>}

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#1a1a24]/50">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Sparkles}
                      onClick={() => openTestModal(historyPrompt, ver)}
                    >
                      Test Generation
                    </Button>

                    {ver.status !== 'Active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        icon={RotateCcw}
                        isLoading={rollbackMutation.isPending}
                        loadingText="Activating..."
                        onClick={() =>
                          rollbackMutation.mutate({ promptId: historyPrompt.id, versionNumber: ver.versionNumber })
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
              <Button variant="secondary" size="sm" onClick={() => setHistoryPrompt(null)}>
                Close History
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Version Modal */}
      {isVersionOpen && historyPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">Publish New Prompt Version</h3>
              <button onClick={() => setIsVersionOpen(false)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                {errorText}
              </div>
            )}

            <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 text-xs text-purple-200 space-y-1.5">
              <div className="font-semibold text-purple-300">💡 System Placeholders (Injected at generation time):</div>
              <ul className="space-y-1 text-[11px] text-[#b8b8cc]">
                <li><code className="bg-[#161620] px-1 py-0.5 rounded text-purple-300 font-mono">{'{{contentType}}'}</code> &rarr; from Content Profile's Content Type (e.g. Shayari, Quote)</li>
                <li><code className="bg-[#161620] px-1 py-0.5 rounded text-purple-300 font-mono">{'{{language}}'}</code> &rarr; from Content Profile's Language field (English, Hindi, Urdu)</li>
                <li><code className="bg-[#161620] px-1 py-0.5 rounded text-purple-300 font-mono">{'{{tone}}'}</code> &rarr; from Content Profile's Tone field</li>
                <li><code className="bg-[#161620] px-1 py-0.5 rounded text-purple-300 font-mono">{'{{style}}'}</code> &rarr; from Content Profile's Writing Style field</li>
                <li><code className="bg-[#161620] px-1 py-0.5 rounded text-purple-300 font-mono">{'{{musicCatalog}}'}</code> &rarr; auto-populated with eligible background music tracks (optional)</li>
              </ul>
            </div>

            {outputContract && outputContract.length > 0 && (
              <div className="rounded-lg bg-[#14141e] border border-[#2b2b3a] p-3 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                  <FileCode size={14} />
                  <span>Expected AI Output Contract (Gemini JSON Schema):</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {outputContract.map((field) => (
                    <div key={field.key} className="bg-[#0e0e12] p-2 rounded border border-[#1a1a24] space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-purple-300 font-semibold">{field.key}</span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${field.required ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-400'}`}>
                          {field.required ? 'required' : 'optional'}
                        </span>
                      </div>
                      <p className="text-[#9c9cb0] text-[10px] line-clamp-2">{field.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={subVer((v) => addVersionMutation.mutate(v))} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Version Change Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Improved emotional tone and structure"
                  {...regVer('notes')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Prompt Instructions Body
                </label>
                <textarea
                  rows={8}
                  placeholder="Enter refined prompt instructions..."
                  {...regVer('body')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-3 text-white font-mono text-xs outline-none focus:border-purple-500"
                />
                {errVer.body && <p className="mt-1 text-xs text-red-400">{errVer.body.message}</p>}
              </div>

              <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
                <Button variant="secondary" type="button" onClick={() => setIsVersionOpen(false)} disabled={addVersionMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={addVersionMutation.isPending} loadingText="Publishing...">
                  Publish Version
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prompt Testing Modal */}
      {testingVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="text-purple-400" size={18} />
                  Test Generation (Version {testingVersion.version.versionNumber})
                </h3>
                <p className="text-xs text-[#9c9cb0]">Execute an interactive test call to Gemini AI using this prompt template</p>
              </div>
              <button onClick={() => setTestingVersion(null)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {testError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{testError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-2">
                  Prompt Placeholders & Test Inputs
                </h4>
                {Object.keys(testVariables).length === 0 ? (
                  <p className="text-xs text-[#9c9cb0] italic">No {'{{variable}}'} placeholders detected in this prompt body.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.keys(testVariables).map((varKey) => (
                      <div key={varKey} className="space-y-1">
                        <label className="text-xs font-mono text-purple-300">{`{{${varKey}}}`}</label>
                        <input
                          type="text"
                          value={testVariables[varKey]}
                          onChange={(e) =>
                            setTestVariables((prev) => ({ ...prev, [varKey]: e.target.value }))
                          }
                          placeholder={`Value for ${varKey}`}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  icon={Play}
                  onClick={handleRunTest}
                  isLoading={isTesting}
                  loadingText="Generating AI Test Content..."
                >
                  Run Test Generation
                </Button>
              </div>

              {testResult && (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                    <CheckCircle2 size={16} />
                    <span>AI Test Generation Output Received:</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-[#6e6e80]">Generated Content Text:</span>
                    <p className="text-sm text-white font-medium bg-[#0e0e12] p-3 rounded-lg border border-[#1a1a24] whitespace-pre-wrap">
                      {testResult.text}
                    </p>
                  </div>

                  {testResult.metadata?.caption && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#6e6e80]">Suggested Caption:</span>
                      <p className="text-xs text-[#9c9cb0] bg-[#0e0e12] p-2.5 rounded-lg border border-[#1a1a24] whitespace-pre-wrap">
                        {testResult.metadata.caption}
                      </p>
                    </div>
                  )}

                  {Array.isArray(testResult.metadata?.hashtags) && testResult.metadata.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {testResult.metadata.hashtags.map((tag: string, i: number) => (
                        <span key={i} className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                          #{tag.replace(/^#/, '')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-[#1a1a24] pt-4">
              <Button variant="secondary" size="sm" onClick={() => setTestingVersion(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptsView;
