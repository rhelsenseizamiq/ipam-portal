import axios from 'axios';

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // required for HttpOnly refresh cookie
  timeout: 30000,
});

// Inject Bearer token into every outbound request
apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Handle 401: attempt silent token refresh, then retry the original request once.
// Never intercept /auth/refresh itself — that path's 401 is handled by the caller.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };
    const isRefreshEndpoint = originalRequest.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshEndpoint) {
      originalRequest._retry = true;

      try {
        // De-duplicate concurrent 401s so we only call /auth/refresh once
        if (!refreshPromise) {
          refreshPromise = apiClient
            .post<{ access_token: string }>('/auth/refresh')
            .then((res) => {
              setAccessToken(res.data.access_token);
              return res.data.access_token;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newToken = await refreshPromise;

        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        setAccessToken(null);
        // Do not hard-navigate here — let ProtectedRoute redirect to /login
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
