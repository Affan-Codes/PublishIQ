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
import { Plus, History, RotateCcw, X, AlertCircle, FileText, Search } from 'lucide-react';

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
}

interface Prompt {
  id: string;
  name: string;
  status: 'Draft' | 'Active' | 'Deprecated';
  notes: string | null;
  versions?: PromptVersion[];
}

export const PromptsView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotifications();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [historyPrompt, setHistoryPrompt] = useState<Prompt | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Queries
  const { data: prompts = [], isLoading, isFetching, isError, error, refetch } = useQuery<Prompt[]>({
    queryKey: ['prompts'],
    queryFn: async () => {
      const res = await apiClient.get('/prompts');
      return res.data.data;
    },
  });

  const { register: regCreate, handleSubmit: subCreate, reset: resetCreate, formState: { errors: errCreate } } = useForm<PromptCreateValues>({
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
                  Version History
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Prompt Instructions Body
                </label>
                <textarea
                  rows={6}
                  placeholder="You are an expert poet. Generate a 2-line Shayari in Hindi..."
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
                <p className="text-xs text-[#9c9cb0]">Prompt Version Registry & Rollback Engine</p>
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
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          ver.status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-gray-500/10 text-gray-400'
                        }`}
                      >
                        {ver.status}
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

                  {ver.status !== 'Active' && (
                    <div className="flex justify-end pt-1">
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
                    </div>
                  )}
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
    </div>
  );
};

export default PromptsView;
