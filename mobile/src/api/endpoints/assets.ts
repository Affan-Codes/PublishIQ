import apiClient, { uploadMultipart } from '../client';
import { unwrap } from '../unwrap';
import { ApiSuccess, Asset, AssetStatus, AssetType, LicenseStatus } from '../../types/domain';

export interface AssetsQueryParams {
  type?: AssetType;
}

export interface UpdateAssetParams {
  name?: string;
  status?: AssetStatus;
  licenseStatus?: LicenseStatus;
  startTime?: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}

export async function getAssets(params?: AssetsQueryParams, signal?: AbortSignal): Promise<Asset[]> {
  const res = await apiClient.get<ApiSuccess<Asset[]>>('/assets', {
    params,
    signal,
  });
  return unwrap(res);
}

export async function getAssetById(id: string, signal?: AbortSignal): Promise<Asset> {
  const res = await apiClient.get<ApiSuccess<Asset>>(`/assets/${id}`, { signal });
  return unwrap(res);
}

export async function uploadAsset(
  formData: FormData,
  options?: {
    onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void;
    signal?: AbortSignal;
  }
): Promise<Asset> {
  const envelope = await uploadMultipart<ApiSuccess<Asset>>('/assets', formData, options);
  if (envelope && envelope.success) {
    return envelope.data;
  }
  throw new Error('Asset upload failed');
}

export async function updateAsset(id: string, params: UpdateAssetParams): Promise<Asset> {
  const res = await apiClient.put<ApiSuccess<Asset>>(`/assets/${id}`, params);
  return unwrap(res);
}

export async function deleteAsset(id: string): Promise<{ message?: string }> {
  const res = await apiClient.delete<ApiSuccess<{ message?: string }>>(`/assets/${id}`);
  return unwrap(res);
}
