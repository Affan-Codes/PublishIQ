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
import { Plus, Edit2, Trash2, X, AlertCircle, Music, Upload, FileText, ExternalLink } from 'lucide-react';

const assetSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(100),
  type: z.enum(['Background', 'Font', 'Music', 'Logo', 'Watermark', 'Animation', 'Icon']),
  status: z.enum(['Active', 'Disabled']),
  filePath: z.string().optional(),
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
  const { addToast } = useNotifications();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [selectedFilterType, setSelectedFilterType] = useState<string>('ALL');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Queries
  const { data: assets = [], isLoading, isFetching, isError, error, refetch } = useQuery<Asset[]>({
    queryKey: ['assets', selectedFilterType],
    queryFn: async () => {
      const url = selectedFilterType === 'ALL' ? '/assets' : `/assets?type=${selectedFilterType}`;
      const res = await apiClient.get(url);
      return res.data.data;
    },
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingAsset(null);
    setSelectedFile(null);
    setErrorText(null);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiClient.post('/assets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      addToast('Asset uploaded and registered successfully to Cloudinary', 'success');
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to create asset');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiClient.put(`/assets/${editingAsset?.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      addToast('Asset updated successfully', 'success');
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to update asset');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/assets/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      addToast('Asset deleted from Cloudinary successfully', 'success');
      setDeletingAssetId(null);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Failed to delete asset', 'error');
    },
  });

  const onSubmit = (values: AssetFormValues) => {
    setErrorText(null);

    if (!editingAsset && !selectedFile && !values.filePath) {
      setErrorText('Please select a file to upload or enter a Cloudinary asset URL.');
      return;
    }

    const formData = new FormData();
    formData.append('name', values.name);
    formData.append('type', values.type);
    formData.append('status', values.status);
    formData.append('licenseStatus', values.licenseStatus);

    if (selectedFile) {
      formData.append('file', selectedFile);
    } else if (values.filePath) {
      formData.append('filePath', values.filePath);
    }

    if (editingAsset) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const openCreateDialog = () => {
    setEditingAsset(null);
    setSelectedFile(null);
    setErrorText(null);
    reset({ name: '', type: 'Music', status: 'Active', filePath: '', licenseStatus: 'Confirmed' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (asset: Asset) => {
    setEditingAsset(asset);
    setSelectedFile(null);
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

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Media Assets</h2>
            <p className="text-sm text-[#9c9cb0]">Manage audio, fonts, logos, and rendering assets stored on Cloudinary</p>
          </div>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} />
        </div>
        <ErrorState
          title="Failed to load media assets"
          message={(error as any)?.message || 'An error occurred while fetching assets.'}
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
          <h2 className="text-2xl font-bold tracking-tight text-white">Media Assets</h2>
          <p className="text-sm text-[#9c9cb0]">Manage audio, fonts, logos, and rendering assets backed by Cloudinary</p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} title="Refresh assets" />
          <Button icon={Plus} onClick={openCreateDialog}>
            Upload Asset
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex gap-2 border-b border-[#1a1a24] pb-4 overflow-x-auto text-xs">
        {['ALL', 'Music', 'Background', 'Font', 'Logo', 'Watermark', 'Animation', 'Icon'].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedFilterType(type)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              selectedFilterType === type
                ? 'bg-purple-600 text-white'
                : 'bg-[#161622] text-[#9c9cb0] hover:text-white hover:bg-[#1d1d2e]'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Music}
          title="No media assets registered"
          description="Upload background music tracks, fonts, or logos to Cloudinary for automated video rendering."
          actionLabel="Upload Asset"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 flex flex-col justify-between hover:border-[#2b2b3a] transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-purple-500/10 text-purple-400 px-2.5 py-0.5 text-xs font-semibold">
                    {asset.type}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      asset.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {asset.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">{asset.name}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    <p className="text-xs text-[#9c9cb0] font-mono truncate max-w-[220px]">
                      {asset.filePath}
                    </p>
                    {asset.filePath.startsWith('http') && (
                      <a
                        href={asset.filePath}
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-400 hover:text-purple-300 ml-1"
                        title="Open Cloudinary asset"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="bg-[#14141e] p-3 rounded-lg flex justify-between items-center text-xs">
                  <span className="text-[#6e6e80]">License Status:</span>
                  <span
                    className={`font-semibold ${
                      asset.licenseStatus === 'Confirmed' ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {asset.licenseStatus}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#1a1a24]/50 pt-4">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Edit2}
                  onClick={() => openEditDialog(asset)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  onClick={() => setDeletingAssetId(asset.id)}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAssetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Delete Media Asset</h3>
            <p className="text-sm text-[#9c9cb0]">
              Are you sure you want to delete this asset from Cloudinary? Render pipelines relying on it will fail validation.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeletingAssetId(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={deleteMutation.isPending}
                loadingText="Deleting..."
                onClick={() => deleteMutation.mutate(deletingAssetId)}
              >
                Delete Asset
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload / Edit Dialog Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingAsset ? 'Edit Media Asset' : 'Upload Asset to Cloudinary'}
              </h3>
              <button onClick={closeDialog} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{errorText}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Asset Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inspiring Acoustic Track"
                  {...register('name')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                />
                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Asset Type
                  </label>
                  <select
                    {...register('type')}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                  >
                    <option value="Music">Music</option>
                    <option value="Background">Background</option>
                    <option value="Font">Font</option>
                    <option value="Logo">Logo</option>
                    <option value="Watermark">Watermark</option>
                    <option value="Animation">Animation</option>
                    <option value="Icon">Icon</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Status
                  </label>
                  <select
                    {...register('status')}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {/* File Upload Picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Upload File to Cloudinary
                </label>
                <div className="relative border-2 border-dashed border-[#1a1a24] hover:border-purple-500/50 rounded-lg p-4 bg-[#14141e] text-center transition cursor-pointer">
                  <input
                    type="file"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        if (!editingAsset) {
                          const file = e.target.files[0];
                          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                          setValue('name', nameWithoutExt);
                        }
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="text-purple-400" size={24} />
                    {selectedFile ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                        <FileText size={14} />
                        <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                        <span className="text-[#6e6e80]">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs text-white font-medium">Click or drag file to upload</span>
                        <span className="text-[10px] text-[#6e6e80]">MP3, WAV, PNG, JPG, TTF (Max 100MB)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional Cloudinary URL Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Or Existing Cloudinary URL
                </label>
                <input
                  type="text"
                  placeholder="https://res.cloudinary.com/.../file.mp3"
                  {...register('filePath')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white font-mono text-xs outline-none focus:border-purple-500"
                />
                {errors.filePath && <p className="mt-1 text-xs text-red-400">{errors.filePath.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  License Status
                </label>
                <select
                  {...register('licenseStatus')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                >
                  <option value="Confirmed">Confirmed (Licensed)</option>
                  <option value="Unconfirmed">Unconfirmed</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={closeDialog}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                  loadingText="Uploading to Cloudinary..."
                >
                  {editingAsset ? 'Save Changes' : 'Upload Asset'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetsView;
