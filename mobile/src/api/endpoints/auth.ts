import apiClient from '../client';
import { unwrap } from '../unwrap';
import { ApiSuccess, Operator } from '../../types/domain';

export interface LoginParams {
  email: string;
  password?: string;
}

export async function login(params: LoginParams): Promise<Operator> {
  const res = await apiClient.post<ApiSuccess<Operator>>('/auth/login', params);
  return unwrap(res);
}

export async function getSession(signal?: AbortSignal): Promise<Operator> {
  const res = await apiClient.get<ApiSuccess<Operator>>('/auth/session', { signal });
  return unwrap(res);
}

export async function logout(): Promise<{ message?: string }> {
  const res = await apiClient.post<ApiSuccess<{ message?: string }>>('/auth/logout');
  return unwrap(res);
}
