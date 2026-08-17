import React, { useState, useRef, useEffect } from 'react';
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
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Music,
  Upload,
  FileText,
  Play,
  Pause,
  ExternalLink,
  Scissors,
  CheckCircle2,
  Clock,
  Info,
  Image as ImageIcon,
} from 'lucide-react';

const assetSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(100),
  type: z.enum(['Background', 'Font', 'Music', 'Logo', 'Watermark', 'Icon']),
  status: z.enum(['Active', 'Disabled']),
  filePath: z.string().optional(),
  licenseStatus: z.enum(['Confirmed', 'Unconfirmed']),
});

type AssetFormValues = z.infer<typeof assetSchema>;

interface Asset {
  id: string;
  name: string;
  type: 'Background' | 'Font' | 'Music' | 'Logo' | 'Watermark' | 'Icon';
  status: 'Active' | 'Disabled';
  filePath: string;
  licenseStatus: 'Confirmed' | 'Unconfirmed';
  metadata: any;
  createdAt: string;
}

interface ContentProfile {
  id: string;
  name: string;
  status: 'Active' | 'Disabled';
  musicSelectionRules?: {
    mood?: string;
    genre?: string;
  };
  backgroundSelectionRules?: {
    selectionMode?: 'Manual' | 'AI';
    manualAssetId?: string;
    mood?: string;
    style?: string;
    theme?: string;
    orientation?: string;
  };
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  // Music Metadata State
  const [assetMood, setAssetMood] = useState<string>('Inspiring');
  const [assetGenre, setAssetGenre] = useState<string>('Acoustic');

  // Background Metadata State
  const [bgMood, setBgMood] = useState<string>('Calm');
  const [bgStyle, setBgStyle] = useState<string>('Photo');
  const [bgTheme, setBgTheme] = useState<string>('Nature');
  const [bgTags, setBgTags] = useState<string>('');
  const [bgOrientation, setBgOrientation] = useState<string>('portrait');

  // Audio Trimming & Preview State
  const [sourceDuration, setSourceDuration] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(15);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Queries
  const { data: assets = [], isLoading, isFetching, isError, error, refetch } = useQuery<Asset[]>({
    queryKey: ['assets', selectedFilterType],
    queryFn: async () => {
      const url = selectedFilterType === 'ALL' ? '/assets' : `/assets?type=${selectedFilterType}`;
      const res = await apiClient.get(url);
      return res.data.data;
    },
  });

  const { data: contentProfiles = [] } = useQuery<ContentProfile[]>({
    queryKey: ['content-profiles'],
    queryFn: async () => {
      const res = await apiClient.get('/content-profiles');
      return res.data.data;
    },
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: { type: 'Music', status: 'Active', licenseStatus: 'Confirmed' },
  });

  const selectedAssetType = watch('type');

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingAsset(null);
    setSelectedFile(null);
    setErrorText(null);
    setSourceDuration(null);
    setAudioPreviewUrl(null);
    setIsPlayingPreview(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  // Audio Preview Playback controller
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.currentTime >= endTime || audio.currentTime < startTime) {
        audio.pause();
        audio.currentTime = startTime;
        setIsPlayingPreview(false);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [startTime, endTime]);

  const toggleAudioPreview = () => {
    if (!audioRef.current || !audioPreviewUrl) return;
    const audio = audioRef.current;

    if (isPlayingPreview) {
      audio.pause();
      setIsPlayingPreview(false);
    } else {
      if (audio.currentTime < startTime || audio.currentTime >= endTime) {
        audio.currentTime = startTime;
      }
      audio.play().then(() => setIsPlayingPreview(true)).catch(() => setIsPlayingPreview(false));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      if (!editingAsset) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setValue('name', nameWithoutExt);
      }

      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name);
      if (isAudio || selectedAssetType === 'Music') {
        const objectUrl = URL.createObjectURL(file);
        setAudioPreviewUrl(objectUrl);
        const tempAudio = new Audio();
        tempAudio.src = objectUrl;
        tempAudio.onloadedmetadata = () => {
          const duration = tempAudio.duration;
          setSourceDuration(duration);
          setStartTime(0);
          setEndTime(Math.min(15, duration));
        };
      }
    }
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiClient.post('/assets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      addToast('Media asset uploaded and saved', 'success');
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to upload asset');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!editingAsset) return;
      const res = await apiClient.put(`/assets/${editingAsset.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      addToast('Media asset updated', 'success');
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to update asset');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/assets/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      addToast('Media asset removed', 'success');
      setDeletingAssetId(null);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Failed to delete asset', 'error');
    },
  });

  const onSubmit = (values: AssetFormValues) => {
    setErrorText(null);
    const formData = new FormData();
    formData.append('name', values.name);
    formData.append('type', values.type);
    formData.append('status', values.status);
    formData.append('licenseStatus', values.licenseStatus);

    if (selectedFile) {
      formData.append('file', selectedFile);
    }

    if (values.type === 'Music') {
      const metadataPayload = { mood: assetMood, genre: assetGenre };
      formData.append('metadata', JSON.stringify(metadataPayload));
      formData.append('startTime', String(startTime));
      formData.append('endTime', String(endTime));
    } else if (values.type === 'Background') {
      const parsedTags = bgTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const metadataPayload: Record<string, any> = {
        mood: bgMood || undefined,
        style: bgStyle || undefined,
        theme: bgTheme || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        orientation: bgOrientation || undefined,
        ...(editingAsset?.metadata?.width ? { width: editingAsset.metadata.width } : {}),
        ...(editingAsset?.metadata?.height ? { height: editingAsset.metadata.height } : {}),
        ...(editingAsset?.metadata?.format ? { format: editingAsset.metadata.format } : {}),
        ...(editingAsset?.metadata?.bytes ? { bytes: editingAsset.metadata.bytes } : {}),
      };
      formData.append('metadata', JSON.stringify(metadataPayload));
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
    setSourceDuration(null);
    setAudioPreviewUrl(null);
    setAssetMood('Inspiring');
    setAssetGenre('Acoustic');
    setBgMood('Calm');
    setBgStyle('Photo');
    setBgTheme('Nature');
    setBgTags('');
    setBgOrientation('portrait');
    reset({ name: '', type: 'Background', status: 'Active', filePath: '', licenseStatus: 'Confirmed' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (asset: Asset) => {
    setEditingAsset(asset);
    setSelectedFile(null);
    setErrorText(null);
    setSourceDuration(asset.metadata?.sourceDuration || null);
    setStartTime(asset.metadata?.startTime || 0);
    setEndTime(asset.metadata?.endTime || 15);
    setAssetMood(asset.metadata?.mood || 'Inspiring');
    setAssetGenre(asset.metadata?.genre || 'Acoustic');
    setBgMood(asset.metadata?.mood || 'Calm');
    setBgStyle(asset.metadata?.style || 'Photo');
    setBgTheme(asset.metadata?.theme || 'Nature');
    setBgTags(Array.isArray(asset.metadata?.tags) ? asset.metadata.tags.join(', ') : '');
    setBgOrientation(asset.metadata?.orientation || 'portrait');
    setAudioPreviewUrl(asset.filePath);
    reset({
      name: asset.name,
      type: asset.type,
      status: asset.status,
      filePath: asset.filePath,
      licenseStatus: asset.licenseStatus,
    });
    setIsDialogOpen(true);
  };

  const getMatchingProfiles = (asset: Asset): ContentProfile[] => {
    if (asset.type === 'Music') {
      const metaMood = asset.metadata?.mood || 'Inspiring';
      const metaGenre = asset.metadata?.genre || 'Acoustic';
      return contentProfiles.filter((p) => {
        if (p.status !== 'Active') return false;
        const rules = p.musicSelectionRules || {};
        const targetMood = rules.mood || 'Inspiring';
        const targetGenre = rules.genre || 'Acoustic';
        return (targetMood === metaMood && targetGenre === metaGenre) || (targetMood === metaMood);
      });
    }

    if (asset.type === 'Background') {
      return contentProfiles.filter((p) => {
        if (p.status !== 'Active') return false;
        const rules = p.backgroundSelectionRules || {};
        if (rules.selectionMode === 'Manual' && rules.manualAssetId === asset.id) return true;
        if (rules.selectionMode === 'AI') {
          if (rules.mood && asset.metadata?.mood && rules.mood.toLowerCase() === asset.metadata.mood.toLowerCase()) return true;
          if (rules.theme && asset.metadata?.theme && rules.theme.toLowerCase() === asset.metadata.theme.toLowerCase()) return true;
          return !rules.mood && !rules.theme;
        }
        return false;
      });
    }

    return [];
  };

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Media Assets</h2>
            <p className="text-sm text-[#9c9cb0]">Manage backgrounds, audio, fonts, logos, and rendering assets stored on Cloudinary</p>
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

  const isProcessing = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Media Assets</h2>
          <p className="text-sm text-[#9c9cb0]">Manage backgrounds, audio, fonts, logos, and rendering assets backed by Cloudinary</p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} title="Refresh assets" />
          <Button icon={Plus} onClick={openCreateDialog}>
            Upload Asset
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a1a24] pb-4">
        {['ALL', 'Background', 'Music', 'Font', 'Logo', 'Watermark', 'Icon'].map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilterType(filter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              selectedFilterType === filter
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                : 'bg-[#14141e] text-[#6e6e80] hover:text-white hover:bg-[#1a1a28] border border-transparent'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Asset Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No Media Assets Found"
          description="Upload background images, music tracks, fonts, or logos to use in video content pipelines."
          actionLabel="Upload First Asset"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => {
            const matchingProfiles = getMatchingProfiles(asset);
            const isMusic = asset.type === 'Music';
            const isBackground = asset.type === 'Background';

            return (
              <div
                key={asset.id}
                className="group relative rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-5 shadow-lg transition hover:border-purple-500/30 flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail / Header */}
                  {isBackground && asset.filePath && (
                    <div className="relative mb-4 h-36 w-full overflow-hidden rounded-lg border border-[#1a1a24] bg-black/40">
                      <img
                        src={asset.filePath}
                        alt={asset.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      {asset.metadata?.dimensions || (asset.metadata?.width && asset.metadata?.height) ? (
                        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-zinc-300 backdrop-blur-sm">
                          {asset.metadata.width}x{asset.metadata.height}
                        </span>
                      ) : null}
                      {asset.metadata?.orientation && (
                        <span className="absolute top-2 left-2 rounded bg-purple-950/80 border border-purple-500/30 px-2 py-0.5 uppercase font-bold text-[9px] text-purple-300 backdrop-blur-sm">
                          {asset.metadata.orientation}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                        {isBackground ? <ImageIcon size={20} /> : isMusic ? <Music size={20} /> : <FileText size={20} />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm tracking-tight">{asset.name}</h3>
                        <span className="text-[10px] uppercase font-bold text-purple-400/80 bg-purple-500/10 px-2 py-0.5 rounded">
                          {asset.type}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        asset.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                      }`}
                    >
                      {asset.status}
                    </span>
                  </div>

                  {/* Deferred Asset Label for Other Types */}
                  {!isMusic && !isBackground && (
                    <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-300 flex items-start gap-1.5">
                      <Clock size={14} className="shrink-0 mt-0.5 text-amber-400" />
                      <span>Stored for future use — does not yet affect generated content.</span>
                    </div>
                  )}

                  {/* Eligibility Indicator */}
                  {(isMusic || isBackground) && (
                    <div className="mt-3">
                      {asset.status === 'Active' && asset.licenseStatus === 'Confirmed' ? (
                        matchingProfiles.length > 0 ? (
                          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-[11px] text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                            <span className="truncate">
                              Eligible for {matchingProfiles.length} profile(s): {matchingProfiles.map((p) => p.name).join(', ')}
                            </span>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/30 p-2 text-[11px] text-zinc-400 flex items-center gap-1.5">
                            <Info size={13} className="shrink-0 text-zinc-500" />
                            <span>No active profile currently uses this asset.</span>
                          </div>
                        )
                      ) : (
                        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-[11px] text-rose-300 flex items-center gap-1.5">
                          <AlertCircle size={13} className="shrink-0 text-rose-400" />
                          <span>Ineligible for pipeline (must be Active with Confirmed license).</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Metadata Details */}
                  <div className="mt-4 space-y-1.5 text-xs text-[#9c9cb0]">
                    {isBackground && (
                      <>
                        <div className="flex justify-between text-[11px]">
                          <span>Mood / Style:</span>
                          <span className="font-semibold text-purple-300">
                            {asset.metadata?.mood || 'Default'} / {asset.metadata?.style || 'Photo'}
                          </span>
                        </div>
                        {asset.metadata?.theme && (
                          <div className="flex justify-between text-[11px]">
                            <span>Theme:</span>
                            <span className="text-zinc-300">{asset.metadata.theme}</span>
                          </div>
                        )}
                        {Array.isArray(asset.metadata?.tags) && asset.metadata.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {asset.metadata.tags.map((t: string) => (
                              <span key={t} className="rounded bg-[#1a1a24] px-1.5 py-0.5 text-[10px] text-zinc-400">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {isMusic && (
                      <>
                        <div className="flex justify-between text-[11px]">
                          <span>Mood / Genre:</span>
                          <span className="font-semibold text-purple-300">
                            {asset.metadata?.mood || 'Inspiring'} / {asset.metadata?.genre || 'Acoustic'}
                          </span>
                        </div>
                        {asset.metadata?.sourceDuration && (
                          <div className="flex justify-between text-[11px] text-[#6e6e80]">
                            <span>Source / Range:</span>
                            <span className="font-mono">{formatTime(asset.metadata.sourceDuration)} ({formatTime(asset.metadata.startTime || 0)} - {formatTime(asset.metadata.endTime || 0)})</span>
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex justify-between text-[11px] text-[#6e6e80]">
                      <span>License Status:</span>
                      <span className={asset.licenseStatus === 'Confirmed' ? 'text-emerald-400' : 'text-amber-400 font-semibold'}>
                        {asset.licenseStatus}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-[#1a1a24] pt-4">
                  <a
                    href={asset.filePath}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-medium"
                  >
                    <span>Open URL</span>
                    <ExternalLink size={12} />
                  </a>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" icon={Edit2} onClick={() => openEditDialog(asset)}>
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
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Modal */}
      {deletingAssetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Delete Media Asset</h3>
            <p className="text-sm text-[#9c9cb0]">
              Are you sure you want to delete this asset from Cloudinary? Render pipelines relying on it will fail validation.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setDeletingAssetId(null)} disabled={deleteMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={deleteMutation.isPending}
                loadingText="Deleting..."
                onClick={() => deleteMutation.mutate(deletingAssetId)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog for Upload and Edit */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-start sm:items-center py-10 sm:py-12">
          <div className="w-full max-w-lg rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <div className="flex items-center gap-2">
                {selectedAssetType === 'Background' ? <ImageIcon className="text-purple-400" size={20} /> : <Music className="text-purple-400" size={20} />}
                <h3 className="text-lg font-bold text-white">
                  {editingAsset ? 'Edit Media Asset' : 'Upload Asset to Cloudinary'}
                </h3>
              </div>
              <button onClick={closeDialog} disabled={isProcessing} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{errorText}</span>
              </div>
            )}

            {/* Informational guidance on deferred asset types */}
            {selectedAssetType !== 'Music' && selectedAssetType !== 'Background' && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300 flex items-start gap-2">
                <Info size={16} className="shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <strong>Deferred Asset:</strong> This asset type is stored in the workspace for future use and does not currently affect pipeline generation stages.
                </span>
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
                  disabled={isProcessing}
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
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                  >
                    <option value="Music">Music</option>
                    <option value="Background">Background</option>
                    <option value="Font">Font</option>
                    <option value="Logo">Logo</option>
                    <option value="Watermark">Watermark</option>
                    <option value="Icon">Icon</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Status
                  </label>
                  <select
                    {...register('status')}
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {/* Music Mood & Genre selectors */}
              {selectedAssetType === 'Music' && (
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-purple-500/20 bg-purple-950/10 p-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                      Mood
                    </label>
                    <select
                      value={assetMood}
                      onChange={(e) => setAssetMood(e.target.value)}
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                    >
                      <option value="Inspiring">Inspiring</option>
                      <option value="Calm">Calm</option>
                      <option value="Energetic">Energetic</option>
                      <option value="Dramatic">Dramatic</option>
                      <option value="Melancholic">Melancholic</option>
                      <option value="Reflective">Reflective</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                      Genre
                    </label>
                    <select
                      value={assetGenre}
                      onChange={(e) => setAssetGenre(e.target.value)}
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                    >
                      <option value="Acoustic">Acoustic</option>
                      <option value="Ambient">Ambient</option>
                      <option value="Classical">Classical</option>
                      <option value="Electronic">Electronic</option>
                      <option value="Cinematic">Cinematic</option>
                      <option value="Lo-Fi">Lo-Fi</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Background Metadata selectors */}
              {selectedAssetType === 'Background' && (
                <div className="space-y-3 rounded-xl border border-purple-500/20 bg-purple-950/10 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                        Mood
                      </label>
                      <select
                        value={bgMood}
                        onChange={(e) => setBgMood(e.target.value)}
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                      >
                        <option value="Calm">Calm</option>
                        <option value="Inspiring">Inspiring</option>
                        <option value="Dark">Dark</option>
                        <option value="Dramatic">Dramatic</option>
                        <option value="Vibrant">Vibrant</option>
                        <option value="Minimalist">Minimalist</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                        Style
                      </label>
                      <select
                        value={bgStyle}
                        onChange={(e) => setBgStyle(e.target.value)}
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                      >
                        <option value="Photo">Photo</option>
                        <option value="Illustration">Illustration</option>
                        <option value="Gradient">Gradient</option>
                        <option value="Texture">Texture</option>
                        <option value="3D">3D Render</option>
                        <option value="Abstract">Abstract</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                        Theme
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Nature, Urban, Space"
                        value={bgTheme}
                        onChange={(e) => setBgTheme(e.target.value)}
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                        Orientation
                      </label>
                      <select
                        value={bgOrientation}
                        onChange={(e) => setBgOrientation(e.target.value)}
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                      >
                        <option value="portrait">Portrait (9:16)</option>
                        <option value="landscape">Landscape (16:9)</option>
                        <option value="square">Square (1:1)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                      Tags (Comma-Separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. sunset, mountains, peaceful"
                      value={bgTags}
                      onChange={(e) => setBgTags(e.target.value)}
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>

                  {editingAsset?.metadata?.width && editingAsset?.metadata?.height && (
                    <div className="flex items-center justify-between rounded bg-[#161620] px-3 py-1.5 text-xs text-[#9c9cb0]">
                      <span>Detected Dimensions:</span>
                      <span className="font-mono text-white font-semibold">
                        {editingAsset.metadata.width} x {editingAsset.metadata.height} ({editingAsset.metadata.orientation || 'auto'})
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  License Status
                </label>
                <select
                  {...register('licenseStatus')}
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                >
                  <option value="Confirmed">Confirmed (Usable in Rendering Pipeline)</option>
                  <option value="Unconfirmed">Unconfirmed (Excluded from Pipeline)</option>
                </select>
              </div>

              {/* File Upload Picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Upload Source File
                </label>
                <div className="relative border-2 border-dashed border-[#1a1a24] hover:border-purple-500/50 rounded-lg p-4 bg-[#14141e] text-center transition cursor-pointer">
                  <input
                    type="file"
                    disabled={isProcessing}
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="text-purple-400" size={24} />
                    {selectedFile ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                        <FileText size={14} />
                        <span className="truncate max-w-[220px]">{selectedFile.name}</span>
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

              {/* Music Segment Trimming UI */}
              {selectedAssetType === 'Music' && sourceDuration !== null && sourceDuration > 0 && (
                <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <Scissors className="text-purple-400" size={16} />
                      <span className="font-semibold text-xs text-purple-300">Music Trimming Segment</span>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 font-semibold px-2 py-0.5 rounded">Max 15s Allowed</span>
                    </div>
                    <span className="text-xs text-[#9c9cb0]">
                      Source Duration: <span className="font-mono text-white font-semibold">{formatTime(sourceDuration)}</span>
                    </span>
                  </div>

                  {/* Range Timeline Display */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-[#9c9cb0]">
                      <span>00:00</span>
                      <span className="text-purple-300 font-mono font-semibold">
                        Selected Segment: {formatTime(Math.max(0, endTime - startTime))} ({parseFloat((endTime - startTime).toFixed(1))}s / max 15s)
                      </span>
                      <span>{formatTime(sourceDuration)}</span>
                    </div>

                    <div className="relative h-3 w-full rounded-full bg-[#161624] overflow-hidden">
                      <div
                        className="absolute h-full bg-purple-500/80 rounded-full transition-all"
                        style={{
                          left: `${Math.max(0, (startTime / sourceDuration) * 100)}%`,
                          width: `${Math.min(100, ((endTime - startTime) / sourceDuration) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Dual Sliders and Inputs */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-[#9c9cb0]">Start Time</label>
                        <span className="font-mono text-xs text-white font-semibold">{formatTime(startTime)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, sourceDuration - 0.5)}
                        step={0.1}
                        value={startTime}
                        disabled={isProcessing}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0 && val < sourceDuration) {
                            setStartTime(val);
                            if (endTime - val > 15) {
                              setEndTime(Math.min(sourceDuration, val + 15));
                            } else if (endTime <= val) {
                              setEndTime(Math.min(sourceDuration, val + 0.5));
                            }
                          }
                        }}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, sourceDuration - 0.5)}
                        step={0.1}
                        value={parseFloat(startTime.toFixed(1))}
                        disabled={isProcessing}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0 && val < sourceDuration) {
                            setStartTime(val);
                            if (endTime - val > 15) {
                              setEndTime(Math.min(sourceDuration, val + 15));
                            } else if (endTime <= val) {
                              setEndTime(Math.min(sourceDuration, val + 0.5));
                            }
                          }
                        }}
                        className="mt-1 w-full rounded border border-[#1a1a24] bg-[#161620] px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-[#9c9cb0]">End Time</label>
                        <span className="font-mono text-xs text-white font-semibold">{formatTime(endTime)}</span>
                      </div>
                      <input
                        type="range"
                        min={Math.min(sourceDuration, startTime + 0.1)}
                        max={Math.min(sourceDuration, startTime + 15)}
                        step={0.1}
                        value={endTime}
                        disabled={isProcessing}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > startTime && val <= Math.min(sourceDuration, startTime + 15)) {
                            setEndTime(val);
                          }
                        }}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                      <input
                        type="number"
                        min={Math.min(sourceDuration, startTime + 0.1)}
                        max={Math.min(sourceDuration, startTime + 15)}
                        step={0.1}
                        value={parseFloat(endTime.toFixed(1))}
                        disabled={isProcessing}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > startTime && val <= Math.min(sourceDuration, startTime + 15)) {
                            setEndTime(val);
                          }
                        }}
                        className="mt-1 w-full rounded border border-[#1a1a24] bg-[#161620] px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Audio Preview Player */}
                  <div className="flex items-center justify-between border-t border-purple-500/20 pt-3">
                    <button
                      type="button"
                      onClick={toggleAudioPreview}
                      className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition cursor-pointer"
                    >
                      {isPlayingPreview ? <Pause size={14} /> : <Play size={14} />}
                      <span>{isPlayingPreview ? 'Pause Snippet' : 'Play Trimmed Snippet'}</span>
                    </button>
                    <span className="text-[11px] text-[#9c9cb0] italic">
                      Audition segment from {formatTime(startTime)} to {formatTime(endTime)}
                    </span>
                  </div>

                  {audioPreviewUrl && (
                    <audio
                      ref={audioRef}
                      src={audioPreviewUrl}
                      onEnded={() => setIsPlayingPreview(false)}
                      className="hidden"
                    />
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
                <Button variant="secondary" type="button" onClick={closeDialog} disabled={isProcessing}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isProcessing} loadingText="Saving Asset...">
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
