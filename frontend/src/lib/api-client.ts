import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If auth failure, we could trigger a logout/redirect or reject
    const customError = {
      message: error.response?.data?.error?.message || error.message || 'An unexpected error occurred',
      code: error.response?.data?.error?.code || 'API_CLIENT_ERROR',
      status: error.response?.status,
      details: error.response?.data?.error?.details || {},
    };
    return Promise.reject(customError);
  }
);

export default apiClient;
