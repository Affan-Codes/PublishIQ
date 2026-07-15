import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../../lib/api-client.js';
import { Plus, History, RotateCcw, X, AlertCircle } from 'lucide-react';

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
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [historyPrompt, setHistoryPrompt] = useState<Prompt | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Queries
  const { data: prompts = [], isLoading, isError, error } = useQuery<Prompt[]>({
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
      setIsCreateOpen(false);
      resetCreate();
    },
    onError: (err: any) => {
      setErrorText(err.message || 'Failed to create prompt');
    },
  });

  const addVersionMutation = useMutation({
    mutationFn: async (values: PromptVersionValues) => {
      const res = await apiClient.post(`/prompts/${historyPrompt?.id}/versions`, values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      if (historyPrompt) {
        // Refetch versions
        apiClient.get(`/prompts/${historyPrompt.id}`).then((res) => {
          setHistoryPrompt(res.data.data);
        });
      }
      setIsVersionOpen(false);
      resetVer();
    },
    onError: (err: any) => {
      setErrorText(err.message || 'Failed to add version');
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async ({ promptId, versionNumber }: { promptId: string; versionNumber: number }) => {
      const res = await apiClient.post(`/prompts/${promptId}/versions/${versionNumber}/rollback`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      if (historyPrompt) {
        apiClient.get(`/prompts/${historyPrompt.id}`).then((res) => {
          setHistoryPrompt(res.data.data);
        });
      }
      alert('Prompt version successfully rolled back (marked as active default).');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to rollback version');
    },
  });

  const onCreateSubmit = (values: PromptCreateValues) => {
    setErrorText(null);
    createMutation.mutate(values);
  };

  const onVersionSubmit = (values: PromptVersionValues) => {
    setErrorText(null);
    addVersionMutation.mutate(values);
  };

  const openHistory = async (prompt: Prompt) => {
    try {
      const res = await apiClient.get(`/prompts/${prompt.id}`);
      setHistoryPrompt(res.data.data);
    } catch (err) {
      alert('Failed to load version details');
    }
  };

  // Filtered prompts
  const filteredPrompts = prompts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Prompt Library</h2>
          <p className="text-sm text-[#9c9cb0]">Manage AI prompt templates and review immutable version history</p>
        </div>
        <button
          onClick={() => {
            setErrorText(null);
            resetCreate();
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
        >
          <Plus className="h-4 w-4" /> Add Prompt
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search prompts by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-72 rounded-lg border border-[#1a1a24] bg-[#0e0e12] px-4 py-2 text-sm text-white outline-none focus:border-purple-500"
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 flex items-start gap-4 text-red-200">
          <AlertCircle className="h-6 w-6 shrink-0 text-red-400" />
          <div>
            <h3 className="font-semibold text-white">Error loading prompts</h3>
            <p className="text-sm mt-1">{(error as any)?.message || 'Please check your connection and try again.'}</p>
          </div>
        </div>
      )}

      {/* Prompt Grid & History Panel */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* List Section */}
          <div className="lg:col-span-2 space-y-6">
            {filteredPrompts.length === 0 ? (
              <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-12 text-center text-[#6e6e80]">
                <p className="text-sm">No prompts found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {filteredPrompts.map((p) => (
                  <div key={p.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 hover:border-purple-500/30 transition">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                        {p.status}
                      </span>
                      <button
                        onClick={() => openHistory(p)}
                        className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold"
                      >
                        <History className="h-3.5 w-3.5" /> History & Pin
                      </button>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white line-clamp-1">{p.name}</h3>
                      <p className="text-xs text-[#6e6e80] mt-1 line-clamp-2">{p.notes || 'No description notes.'}</p>
                    </div>

                    <div className="pt-2 border-t border-[#1a1a24]/50 flex justify-between items-center text-[10px] text-[#6e6e80] font-mono">
                      <span>ID: {p.id.substring(0, 8)}...</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History Panel */}
          <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 h-fit space-y-6">
            {historyPrompt ? (
              <>
                <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
                  <div>
                    <h3 className="font-bold text-white text-base">{historyPrompt.name}</h3>
                    <p className="text-xs text-[#6e6e80] mt-0.5 font-mono">ID: {historyPrompt.id}</p>
                  </div>
                  <button
                    onClick={() => {
                      setErrorText(null);
                      resetVer({ body: '', notes: '' });
                      setIsVersionOpen(true);
                    }}
                    className="flex items-center gap-1 rounded bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-purple-500"
                  >
                    <Plus className="h-3 w-3" /> New Version
                  </button>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {historyPrompt.versions?.map((v) => (
                    <div key={v.id} className="rounded-lg bg-[#161620] p-4 border border-[#222230] space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-purple-400">Version {v.versionNumber}</span>
                        <div className="flex gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            v.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'bg-gray-500/10 text-gray-500'
                          }`}>
                            {v.status}
                          </span>
                          {v.status !== 'Active' && (
                            <button
                              onClick={() => rollbackMutation.mutate({ promptId: historyPrompt.id, versionNumber: v.versionNumber })}
                              className="text-purple-400 hover:text-purple-300"
                              title="Set Active Default"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="rounded bg-[#0c0c10] p-3 font-mono text-[10px] text-gray-300 border border-[#1a1a24] break-all max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {v.body}
                      </div>

                      {v.notes && (
                        <p className="text-[10px] text-[#6e6e80]">Notes: <span className="text-[#9c9cb0]">{v.notes}</span></p>
                      )}
                      
                      <div className="text-[9px] text-[#6e6e80] text-right">
                        Pinned UUID: <span className="font-mono text-white select-all">{v.id}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-[#6e6e80] text-sm">
                Select a prompt's "History & Pin" to view immutable version details and reference IDs.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Prompt Dialog */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[#222230] bg-[#0e0e12] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4 mb-6">
              <h3 className="text-lg font-bold text-white">Create Prompt & Initial Version</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-[#6e6e80] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={subCreate(onCreateSubmit)} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Prompt Name</label>
                <input
                  type="text"
                  placeholder="e.g. Shayari Generator"
                  {...regCreate('name')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                />
                {errCreate.name && (
                  <p className="mt-1 text-xs text-red-400">{errCreate.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Prompt Notes</label>
                <input
                  type="text"
                  placeholder="Brief notes about topic placeholders..."
                  {...regCreate('notes')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                />
                {errCreate.notes && (
                  <p className="mt-1 text-xs text-red-400">{errCreate.notes.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Initial Version Body</label>
                <textarea
                  rows={6}
                  placeholder="Generate Shayari on topic {{topic}}. Use Urdu nastaliq script..."
                  {...regCreate('body')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500 font-mono"
                />
                {errCreate.body && (
                  <p className="mt-1 text-xs text-red-400">{errCreate.body.message}</p>
                )}
              </div>

              {errorText && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-200">
                  {errorText}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-[#1a1a24]/50">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg border border-[#1a1a24] px-4 py-2 text-sm font-semibold text-[#9c9cb0] hover:bg-[#161620] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Version Dialog */}
      {isVersionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[#222230] bg-[#0e0e12] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4 mb-6">
              <h3 className="text-lg font-bold text-white">Create New Prompt Version</h3>
              <button onClick={() => setIsVersionOpen(false)} className="text-[#6e6e80] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={subVer(onVersionSubmit)} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Version Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Added Urdu script rules, modified length"
                  {...regVer('notes')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                />
                {errVer.notes && (
                  <p className="mt-1 text-xs text-red-400">{errVer.notes.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Version Prompt Body</label>
                <textarea
                  rows={6}
                  placeholder="Insert new prompt body..."
                  {...regVer('body')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500 font-mono"
                />
                {errVer.body && (
                  <p className="mt-1 text-xs text-red-400">{errVer.body.message}</p>
                )}
              </div>

              {errorText && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-200">
                  {errorText}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-[#1a1a24]/50">
                <button
                  type="button"
                  onClick={() => setIsVersionOpen(false)}
                  className="rounded-lg border border-[#1a1a24] px-4 py-2 text-sm font-semibold text-[#9c9cb0] hover:bg-[#161620] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addVersionMutation.isPending}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
                >
                  Save Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptsView;
