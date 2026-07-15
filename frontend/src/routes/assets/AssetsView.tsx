import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../../lib/api-client.js';
import { Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';

const assetSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(100),
  type: z.enum(['Background', 'Font', 'Music', 'Logo', 'Watermark', 'Animation', 'Icon']),
  status: z.enum(['Active', 'Disabled']),
  filePath: z.string().min(1, 'Asset file path is required'),
  licenseStatus: z.enum(['Confirmed', 'Unconfirmed']),
});

type AssetFormValues = z.infer<typeof assetSchema>;

interface Asset {
  id: string;
  name: string;
  type: 'Background' | 'Font' | 'Music' | 'Logo' | 'Watermark' | 'Animation' | 'Icon';
  status: 'Active' | 'Disabled';
  filePath: string;
  licenseStatus: 'Confirmed' | 'Unconfirmed';
  metadata: any;
  createdAt: string;
}

export const AssetsView: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [selectedFilterType, setSelectedFilterType] = useState<string>('ALL');

  // Queries
  const { data: assets = [], isLoading, isError, error } = useQuery<Asset[]>({
    queryKey: ['assets', selectedFilterType],
    queryFn: async () => {
      const url = selectedFilterType === 'ALL' ? '/assets' : `/assets?type=${selectedFilterType}`;
      const res = await apiClient.get(url);
      return res.data.data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (values: AssetFormValues) => {
      const res = await apiClient.post('/assets', { ...values, metadata: {} });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.message || 'Failed to create asset');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: AssetFormValues) => {
      const res = await apiClient.put(`/assets/${editingAsset?.id}`, values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.message || 'Failed to update asset');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/assets/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setDeletingAssetId(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete asset. Make sure no active profiles reference it.');
      setDeletingAssetId(null);
    },
  });

  const onSubmit = (values: AssetFormValues) => {
    setErrorText(null);
    if (editingAsset) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const openCreateDialog = () => {
    setEditingAsset(null);
    setErrorText(null);
    reset({ name: '', type: 'Music', status: 'Active', filePath: '', licenseStatus: 'Confirmed' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (asset: Asset) => {
    setEditingAsset(asset);
    setErrorText(null);
    reset({
      name: asset.name,
      type: asset.type,
      status: asset.status,
      filePath: asset.filePath,
      licenseStatus: asset.licenseStatus,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingAsset(null);
    setErrorText(null);
    reset();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Asset Library</h2>
          <p className="text-sm text-[#9c9cb0]">Manage backgrounds, audio files, fonts, and watermarks</p>
        </div>
        <button
          onClick={openCreateDialog}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
        >
          <Plus className="h-4 w-4" /> Add Asset
        </button>
      </div>

      {/* Tabs / Filters */}
      <div className="flex border-b border-[#1a1a24] gap-6 text-sm overflow-x-auto pb-1">
        {['ALL', 'Music', 'Font', 'Background', 'Watermark', 'Logo', 'Animation', 'Icon'].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedFilterType(type)}
            className={`pb-4 font-semibold transition whitespace-nowrap ${
              selectedFilterType === type ? 'border-b-2 border-purple-500 text-purple-400' : 'text-[#6e6e80] hover:text-[#9c9cb0]'
            }`}
          >
            {type === 'ALL' ? 'All Assets' : `${type}s`}
          </button>
        ))}
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
            <h3 className="font-semibold text-white">Error loading assets</h3>
            <p className="text-sm mt-1">{(error as any)?.message || 'Please check your connection and try again.'}</p>
          </div>
        </div>
      )}

      {/* Assets Grid */}
      {!isLoading && !isError && (
        <>
          {assets.length === 0 ? (
            <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-12 text-center text-[#6e6e80]">
              <p className="text-sm">No assets found in this filter category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <div key={asset.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 hover:border-purple-500/30 transition">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-[#161620] px-2 py-0.5 font-mono text-[10px] text-purple-400 border border-[#222230]">
                      {asset.type}
                    </span>
                    <div className="flex gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        asset.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {asset.status}
                      </span>
                      {asset.licenseStatus && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          asset.licenseStatus === 'Confirmed' ? 'bg-purple-500/10 text-purple-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {asset.licenseStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white line-clamp-1">{asset.name}</h3>
                    <p className="text-xs text-[#9c9cb0] font-mono mt-1 break-all bg-[#0a0a0c] p-2 rounded border border-[#1a1a24]">{asset.filePath}</p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-[#1a1a24]/50">
                    <button
                      onClick={() => openEditDialog(asset)}
                      className="text-purple-400 hover:text-purple-300"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingAssetId(asset.id)}
                      className="text-red-400 hover:text-red-300"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create / Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#222230] bg-[#0e0e12] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4 mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingAsset ? 'Edit Asset' : 'Add Asset'}
              </h3>
              <button onClick={closeDialog} className="text-[#6e6e80] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Asset Name</label>
                <input
                  type="text"
                  placeholder="e.g. Chill Lofi Strings"
                  {...register('name')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Asset Type</label>
                <select
                  disabled={!!editingAsset}
                  {...register('type')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500 disabled:opacity-50"
                >
                  <option value="Music">Music</option>
                  <option value="Font">Font</option>
                  <option value="Background">Background</option>
                  <option value="Watermark">Watermark</option>
                  <option value="Logo">Logo</option>
                  <option value="Animation">Animation</option>
                  <option value="Icon">Icon</option>
                </select>
                {errors.type && (
                  <p className="mt-1 text-xs text-red-400">{errors.type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">File Path</label>
                <input
                  type="text"
                  placeholder="e.g. music/lofi_strings_01.mp3"
                  {...register('filePath')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500 font-mono"
                />
                {errors.filePath && (
                  <p className="mt-1 text-xs text-red-400">{errors.filePath.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Status</label>
                  <select
                    {...register('status')}
                    className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">License</label>
                  <select
                    {...register('licenseStatus')}
                    className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Unconfirmed">Unconfirmed</option>
                  </select>
                </div>
              </div>

              {errorText && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-200">
                  {errorText}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-[#1a1a24]/50">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-lg border border-[#1a1a24] px-4 py-2 text-sm font-semibold text-[#9c9cb0] hover:bg-[#161620] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
                >
                  {editingAsset ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingAssetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-red-500/20 bg-[#0e0e12] p-6 shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Delete Asset?</h3>
              <p className="text-sm text-[#9c9cb0] mt-2">
                This action cannot be undone. Verify that no Content Profiles are currently referencing this asset.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingAssetId(null)}
                className="rounded-lg border border-[#1a1a24] px-4 py-2 text-sm font-semibold text-[#9c9cb0] hover:bg-[#161620] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingAssetId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetsView;
