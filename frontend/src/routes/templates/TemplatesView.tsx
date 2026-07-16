import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../../lib/api-client.js';
import { Plus, History, RotateCcw, X, AlertCircle } from 'lucide-react';

const templateCreateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  notes: z.string().max(500).optional(),
  componentPath: z.string().min(1, 'Component path is required'),
  componentSource: z.string().optional(),
});

const templateVersionSchema = z.object({
  componentPath: z.string().min(1, 'Component path is required'),
  componentSource: z.string().optional(),
  notes: z.string().max(500).optional(),
});

type TemplateCreateValues = z.infer<typeof templateCreateSchema>;
type TemplateVersionValues = z.infer<typeof templateVersionSchema>;

interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  componentPath: string;
  componentSource: string | null;
  status: 'Draft' | 'Active' | 'Deprecated';
  notes: string | null;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  status: 'Draft' | 'Active' | 'Deprecated';
  notes: string | null;
  versions?: TemplateVersion[];
}

export const TemplatesView: React.FC = () => {
  const queryClient = useQueryClient();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [historyTemplate, setHistoryTemplate] = useState<Template | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Queries
  const { data: templates = [], isLoading, isError, error } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await apiClient.get('/templates');
      return res.data.data;
    },
  });

  const { register: regCreate, handleSubmit: subCreate, reset: resetCreate, formState: { errors: errCreate } } = useForm<TemplateCreateValues>({
    resolver: zodResolver(templateCreateSchema),
  });

  const { register: regVer, handleSubmit: subVer, reset: resetVer, formState: { errors: errVer } } = useForm<TemplateVersionValues>({
    resolver: zodResolver(templateVersionSchema),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (values: TemplateCreateValues) => {
      const res = await apiClient.post('/templates', values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsCreateOpen(false);
      resetCreate();
    },
    onError: (err: any) => {
      setErrorText(err.message || 'Failed to create template');
    },
  });

  const addVersionMutation = useMutation({
    mutationFn: async (values: TemplateVersionValues) => {
      const res = await apiClient.post(`/templates/${historyTemplate?.id}/versions`, values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      if (historyTemplate) {
        apiClient.get(`/templates/${historyTemplate.id}`).then((res) => {
          setHistoryTemplate(res.data.data);
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
    mutationFn: async ({ templateId, versionNumber }: { templateId: string; versionNumber: number }) => {
      const res = await apiClient.post(`/templates/${templateId}/versions/${versionNumber}/rollback`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      if (historyTemplate) {
        apiClient.get(`/templates/${historyTemplate.id}`).then((res) => {
          setHistoryTemplate(res.data.data);
        });
      }
      alert('Template version successfully rolled back (marked as active default).');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to rollback version');
    },
  });

  const onCreateSubmit = (values: TemplateCreateValues) => {
    setErrorText(null);
    createMutation.mutate(values);
  };

  const onVersionSubmit = (values: TemplateVersionValues) => {
    setErrorText(null);
    addVersionMutation.mutate(values);
  };

  const openHistory = async (template: Template) => {
    try {
      const res = await apiClient.get(`/templates/${template.id}`);
      setHistoryTemplate(res.data.data);
    } catch {
      alert('Failed to load version details');
    }
  };

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Template Library</h2>
          <p className="text-sm text-[#9c9cb0]">Configure component layouts and visual themes for Playwright/FFmpeg renderers</p>
        </div>
        <button
          onClick={() => {
            setErrorText(null);
            resetCreate();
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
        >
          <Plus className="h-4 w-4" /> Add Template
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search templates by name..."
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
            <h3 className="font-semibold text-white">Error loading templates</h3>
            <p className="text-sm mt-1">{(error as any)?.message || 'Please check your connection and try again.'}</p>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main List */}
          <div className="lg:col-span-2 space-y-6">
            {filteredTemplates.length === 0 ? (
              <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-12 text-center text-[#6e6e80]">
                <p className="text-sm">No templates found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {filteredTemplates.map((t) => (
                  <div key={t.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 hover:border-purple-500/30 transition">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                        {t.status}
                      </span>
                      <button
                        onClick={() => openHistory(t)}
                        className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold"
                      >
                        <History className="h-3.5 w-3.5" /> History & Pin
                      </button>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white line-clamp-1">{t.name}</h3>
                      <p className="text-xs text-[#6e6e80] mt-1 line-clamp-2">{t.notes || 'No description notes.'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History details panel */}
          <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 h-fit space-y-6">
            {historyTemplate ? (
              <>
                <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
                  <div>
                    <h3 className="font-bold text-white text-base">{historyTemplate.name}</h3>
                    <p className="text-xs text-[#6e6e80] mt-0.5 font-mono">ID: {historyTemplate.id}</p>
                  </div>
                  <button
                    onClick={() => {
                      setErrorText(null);
                      resetVer({ componentPath: '', componentSource: '', notes: '' });
                      setIsVersionOpen(true);
                    }}
                    className="flex items-center gap-1 rounded bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-purple-500"
                  >
                    <Plus className="h-3 w-3" /> New Version
                  </button>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {historyTemplate.versions?.map((v) => (
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
                              onClick={() => rollbackMutation.mutate({ templateId: historyTemplate.id, versionNumber: v.versionNumber })}
                              className="text-purple-400 hover:text-purple-300"
                              title="Set Active Default"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-semibold text-[#6e6e80]">Component Path</span>
                        <p className="text-xs font-mono text-[#e0e0e6]">{v.componentPath}</p>
                      </div>

                      {v.componentSource && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-semibold text-[#6e6e80]">Component Source (CSS/SVG)</span>
                          <div className="rounded bg-[#0c0c10] p-3 font-mono text-[10px] text-gray-300 border border-[#1a1a24] break-all max-h-32 overflow-y-auto whitespace-pre">
                            {v.componentSource}
                          </div>
                        </div>
                      )}

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
                Select a template's "History & Pin" to view immutable version details and reference IDs.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Template Dialog */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[#222230] bg-[#0e0e12] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4 mb-6">
              <h3 className="text-lg font-bold text-white">Create Template & Initial Version</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-[#6e6e80] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={subCreate(onCreateSubmit)} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. Classic Dark Theme"
                  {...regCreate('name')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                />
                {errCreate.name && (
                  <p className="mt-1 text-xs text-red-400">{errCreate.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Template Notes</label>
                <input
                  type="text"
                  placeholder="Notes describing typography/colors..."
                  {...regCreate('notes')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                />
                {errCreate.notes && (
                  <p className="mt-1 text-xs text-red-400">{errCreate.notes.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Component Path</label>
                <input
                  type="text"
                  placeholder="e.g. templates/ClassicDark.tsx"
                  {...regCreate('componentPath')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500 font-mono"
                />
                {errCreate.componentPath && (
                  <p className="mt-1 text-xs text-red-400">{errCreate.componentPath.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Component Source (Optional)</label>
                <textarea
                  rows={4}
                  placeholder="Paste style tags, inline SVG code, or metadata options..."
                  {...regCreate('componentSource')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500 font-mono"
                />
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
              <h3 className="text-lg font-bold text-white">Create New Template Version</h3>
              <button onClick={() => setIsVersionOpen(false)} className="text-[#6e6e80] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={subVer(onVersionSubmit)} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Version Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Added background padding"
                  {...regVer('notes')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Component Path</label>
                <input
                  type="text"
                  placeholder="e.g. templates/ClassicDark_v2.tsx"
                  {...regVer('componentPath')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500 font-mono"
                />
                {errVer.componentPath && (
                  <p className="mt-1 text-xs text-red-400">{errVer.componentPath.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Component Source (Optional)</label>
                <textarea
                  rows={4}
                  placeholder="Paste style tags, inline SVG code..."
                  {...regVer('componentSource')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500 font-mono"
                />
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

export default TemplatesView;
