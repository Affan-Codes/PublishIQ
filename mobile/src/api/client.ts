import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getEnv } from '../lib/env';
import { ApiError } from './errors';

type SessionExpiredHandler = () => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;
let isHandlingSessionExpiry = false;

export function registerSessionExpiredHandler(handler: SessionExpiredHandler) {
  sessionExpiredHandler = handler;
}

export function resetSessionExpiryState() {
  isHandlingSessionExpiry = false;
}

const env = getEnv();

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: DEV logging only (no bodies, no credentials)
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
});

// Response interceptor: Normalization and 401 debounce
apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[API Response] ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error: AxiosError<{ success?: boolean; error?: { message?: string; code?: string; details?: Record<string, unknown> } }>) => {
    // 1. Timeout / Network errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return Promise.reject(
        new ApiError('Request timed out. Please try again.', 'TIMEOUT', error.response?.status)
      );
    }

    if (!error.response) {
      return Promise.reject(
        new ApiError('Cannot reach the server. Check your connection.', 'NETWORK_ERROR')
      );
    }

    const { status, data, config } = error.response;
    const url = config?.url || '';

    // 2. Global 401 session expiration handling (exclude auth endpoints)
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/session') ||
      url.includes('/auth/logout');

    if (status === 401 && !isAuthRoute) {
      if (!isHandlingSessionExpiry) {
        isHandlingSessionExpiry = true;
        if (sessionExpiredHandler) {
          sessionExpiredHandler();
        }
      }
    }

    // 3. Normalized error extraction from backend envelope
    if (data && typeof data === 'object' && data.error) {
      const { message, code, details } = data.error;
      return Promise.reject(
        new ApiError(
          message || 'An unexpected error occurred.',
          code || (status === 429 ? 'TOO_MANY_REQUESTS' : 'API_ERROR'),
          status,
          details || {}
        )
      );
    }

    // 4. Rate-limit 429 without envelope
    if (status === 429) {
      return Promise.reject(
        new ApiError(
          'Too many requests. Please wait a moment before trying again.',
          'TOO_MANY_REQUESTS',
          429
        )
      );
    }

    // 5. 5xx Server errors
    if (status >= 500) {
      return Promise.reject(
        new ApiError('A server error occurred. Please try again later.', 'API_CLIENT_ERROR', status)
      );
    }

    return Promise.reject(
      new ApiError(
        error.message || 'An unexpected request error occurred.',
        'API_CLIENT_ERROR',
        status
      )
    );
  }
);

/**
 * Dedicated multipart upload with 60s timeout, custom abort signal, and progress tracking.
 */
export async function uploadMultipart<T>(
  endpoint: string,
  formData: FormData,
  options?: {
    onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void;
    signal?: AbortSignal;
  }
): Promise<T> {
  const response = await apiClient.post(endpoint, formData, {
    headers: {
      // Content-Type is omitted so React Native networking automatically adds multipart boundary
    },
    timeout: 60_000,
    signal: options?.signal,
    onUploadProgress: options?.onUploadProgress,
  });
  return response.data;
}

export default apiClient;
