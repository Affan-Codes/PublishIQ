import { AxiosResponse } from 'axios';
import { ApiResponse, ApiSuccess } from '../types/domain';
import { ApiError } from './errors';

/**
 * Asserts success and extracts data & meta from backend envelope.
 */
export function unwrap<T, M = unknown>(response: AxiosResponse<ApiResponse<T, M>>): T {
  const envelope = response.data;
  if (!envelope) {
    throw new ApiError('Empty server response received', 'API_CLIENT_ERROR', response.status);
  }

  if (envelope.success === true) {
    return envelope.data;
  }

  throw new ApiError(
    envelope.error?.message || 'Server returned an unsuccessful response',
    envelope.error?.code || 'API_CLIENT_ERROR',
    response.status,
    envelope.error?.details || {}
  );
}

/**
 * Asserts success and returns full envelope data with meta.
 */
export function unwrapWithMeta<T, M = unknown>(
  response: AxiosResponse<ApiResponse<T, M>>
): { data: T; meta?: M } {
  const envelope = response.data;
  if (!envelope) {
    throw new ApiError('Empty server response received', 'API_CLIENT_ERROR', response.status);
  }

  if (envelope.success === true) {
    return {
      data: envelope.data,
      meta: (envelope as ApiSuccess<T, M>).meta,
    };
  }

  throw new ApiError(
    envelope.error?.message || 'Server returned an unsuccessful response',
    envelope.error?.code || 'API_CLIENT_ERROR',
    response.status,
    envelope.error?.details || {}
  );
}
