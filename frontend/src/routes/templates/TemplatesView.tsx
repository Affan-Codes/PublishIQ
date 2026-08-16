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
import { Plus, History, RotateCcw, X, AlertCircle, Layout, Search } from 'lucide-react';

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
  const { addToast } = useNotifications();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [historyTemplate, setHistoryTemplate] = useState<Template | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Queries
  const { data: templates = [], isLoading, isFetching, isError, error, refetch } = useQuery<Template[]>({
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
      addToast('Visual template created successfully', 'success');
      setIsCreateOpen(false);
      resetCreate();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to create template');
    },
  });

  const addVersionMutation = useMutation({
    mutationFn: async (values: TemplateVersionValues) => {
      const res = await apiClient.post(`/templates/${historyTemplate?.id}/versions`, values);
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
      resetVer();
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
            <p className="text-sm text-[#9c9cb0]">Manage Remotion and Canvas video overlay layouts</p>
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Visual Rendering Templates</h2>
          <p className="text-sm text-[#9c9cb0]">Manage Remotion and Canvas video overlay layouts</p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} title="Refresh templates" />
          <Button icon={Plus} onClick={() => { setErrorText(null); setIsCreateOpen(true); }}>
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
          description="Register visual layout components for automated FFmpeg and Remotion video rendering."
          actionLabel="Create Template"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
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
                  <span className="text-[10px] text-[#6e6e80] font-mono">
                    ID: {template.id.slice(0, 8)}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">{template.name}</h3>
                  <p className="text-xs text-[#9c9cb0] mt-1 line-clamp-2">
                    {template.notes || 'No notes available.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-[#1a1a24]/50 pt-4">
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
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-start sm:items-center py-10 sm:py-12">
          <div className="w-full max-w-lg rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">Create Visual Rendering Template</h3>
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
                  Template Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Elegant Shayari Short Layout"
                  {...regCreate('name')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                />
                {errCreate.name && <p className="mt-1 text-xs text-red-400">{errCreate.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Component File Path
                </label>
                <input
                  type="text"
                  placeholder="templates/ShayariShortTemplate.tsx"
                  {...regCreate('componentPath')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white font-mono outline-none focus:border-purple-500"
                />
                {errCreate.componentPath && <p className="mt-1 text-xs text-red-400">{errCreate.componentPath.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Initial Version Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Baseline vertical layout layout"
                  {...regCreate('notes')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Component Source JSON Config (Optional)
                </label>
                <textarea
                  rows={4}
                  placeholder="{ &quot;aspectRatio&quot;: &quot;9:16&quot;, &quot;fontSize&quot;: 24 }"
                  {...regCreate('componentSource')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-3 text-white font-mono text-xs outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
                <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)} disabled={createMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createMutation.isPending} loadingText="Saving...">
                  Create Template
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version Registry Drawer */}
      {historyTemplate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-start sm:items-center py-10 sm:py-12">
          <div className="w-full max-w-2xl rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">{historyTemplate.name}</h3>
                <p className="text-xs text-[#9c9cb0]">Template Version Registry & Activation Engine</p>
              </div>
              <button onClick={() => setHistoryTemplate(null)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="flex justify-between items-center bg-[#14141e] p-4 rounded-xl border border-[#1a1a24]">
              <span className="text-xs text-[#9c9cb0]">Update template rendering paths or code configurations.</span>
              <Button size="sm" icon={Plus} onClick={() => { setErrorText(null); setIsVersionOpen(true); }}>
                New Version
              </Button>
            </div>

            {/* Versions List */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
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
                    </div>
                    <span className="text-[10px] text-[#6e6e80]">
                      {new Date(ver.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-white font-mono bg-[#0c0c12] p-2.5 rounded border border-[#1b1b26]">
                    Path: {ver.componentPath}
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
                          rollbackMutation.mutate({ templateId: historyTemplate.id, versionNumber: ver.versionNumber })
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
              <Button variant="secondary" size="sm" onClick={() => setHistoryTemplate(null)}>
                Close Registry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Version Modal */}
      {isVersionOpen && historyTemplate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-start sm:items-center py-10 sm:py-12">
          <div className="w-full max-w-lg rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">Publish New Template Version</h3>
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
                  Component File Path
                </label>
                <input
                  type="text"
                  placeholder="templates/ShayariShortTemplateV2.tsx"
                  {...regVer('componentPath')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white font-mono outline-none focus:border-purple-500"
                />
                {errVer.componentPath && <p className="mt-1 text-xs text-red-400">{errVer.componentPath.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Version Change Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Updated subtitle font scaling"
                  {...regVer('notes')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Component Source JSON Config (Optional)
                </label>
                <textarea
                  rows={4}
                  placeholder="{ &quot;updatedAt&quot;: &quot;2026&quot; }"
                  {...regVer('componentSource')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-3 text-white font-mono text-xs outline-none focus:border-purple-500"
                />
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

export default TemplatesView;
