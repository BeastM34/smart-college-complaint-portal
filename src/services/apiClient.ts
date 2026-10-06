/**
 * Centralized Authenticated API Client
 * 
 * Manages HTTP communications with the Express backend, automatically
 * attaches the Authorization Bearer access token to authenticated requests,
 * and handles authentication failures (401 Unauthorized) gracefully.
 * 
 * NEVER references or exposes private server credentials or database keys.
 */

import { getSupabaseClient } from '@/utils/supabase';

const TOKEN_KEY = 'scp_access_token';
const REFRESH_TOKEN_KEY = 'scp_refresh_token';

const getEnvVar = (name: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    return import.meta.env[name];
  }
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  return '';
};

const resolveDefaultBaseUrl = (): string => {
  const url = getEnvVar('VITE_API_BASE_URL') || getEnvVar('VITE_API_URL');
  if (url) {
    return url.replace(/\/+$/, '');
  }
  return 'http://localhost:5000/api';
};

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class ApiClientError extends Error {
  public status: number;
  public data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

class ApiClient {
  private inMemoryToken: string | null = null;
  private customBaseUrl: string | null = null;
  private onUnauthorizedCallback: (() => void) | null = null;

  constructor() {
    this.inMemoryToken = this.loadStoredToken();
  }

  public setBaseUrl(url: string | null): void {
    this.customBaseUrl = url ? url.replace(/\/+$/, '') : null;
  }

  public getBaseUrl(): string {
    if (this.customBaseUrl) {
      return this.customBaseUrl;
    }
    return resolveDefaultBaseUrl();
  }

  private loadStoredToken(): string | null {
    try {
      if (typeof window !== 'undefined') {
        const token =
          (window.sessionStorage && window.sessionStorage.getItem(TOKEN_KEY)) ||
          (window.localStorage && window.localStorage.getItem(TOKEN_KEY));
        if (token) return token;
      }
    } catch {
      // safe fallback if storage is inaccessible
    }
    return null;
  }

  public getAccessToken(): string | null {
    if (this.inMemoryToken) {
      return this.inMemoryToken;
    }
    const stored = this.loadStoredToken();
    if (stored) {
      this.inMemoryToken = stored;
      return stored;
    }
    return null;
  }

  public setTokens(accessToken: string, refreshToken?: string): void {
    this.inMemoryToken = accessToken;
    try {
      if (typeof window !== 'undefined') {
        if (window.sessionStorage) {
          window.sessionStorage.setItem(TOKEN_KEY, accessToken);
          if (refreshToken) window.sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }
        if (window.localStorage) {
          window.localStorage.setItem(TOKEN_KEY, accessToken);
          if (refreshToken) window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }
      }
    } catch {
      // storage unavailable
    }
  }

  public clearTokens(): void {
    this.inMemoryToken = null;
    try {
      if (typeof window !== 'undefined') {
        if (window.sessionStorage) {
          window.sessionStorage.removeItem(TOKEN_KEY);
          window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
        }
        if (window.localStorage) {
          window.localStorage.removeItem(TOKEN_KEY);
          window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
      }
    } catch {
      // storage unavailable
    }
  }

  public onUnauthorized(callback: () => void): void {
    this.onUnauthorizedCallback = callback;
  }

  /**
   * Generic request executor with automatic Bearer token injection
   */
  public async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const baseUrl = this.getBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;

    const method = (options.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Attach Content-Type: application/json only when a body is present or for mutations where expected
    const hasBody = options.body !== undefined && options.body !== null;
    const isBodylessMethod = method === 'GET' || method === 'DELETE' || method === 'HEAD';
    if (hasBody || (!isBodylessMethod && !headers['Content-Type'])) {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    // If no authorization header provided, attach active access token
    if (!headers['Authorization']) {
      let token = this.getAccessToken();
      // If token not in local memory, check Supabase client session if available
      if (!token) {
        try {
          const supabase = getSupabaseClient();
          // synchronous check if token is available
          if (supabase) {
            // Note: getSession is async, but if in browser localStorage supabase-js stores it under sb-*-auth-token
          }
        } catch {
          // ignore
        }
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // Set a bounded request timeout (default 15s) without breaking an explicitly provided AbortSignal
    const DEFAULT_TIMEOUT_MS = 15000;
    let signal = options.signal;
    if (!signal) {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        signal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
      }
    } else if (
      typeof AbortSignal !== 'undefined' &&
      typeof (AbortSignal as any).any === 'function' &&
      typeof AbortSignal.timeout === 'function'
    ) {
      signal = (AbortSignal as any).any([options.signal, AbortSignal.timeout(DEFAULT_TIMEOUT_MS)]);
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal,
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      this.clearTokens();
      if (this.onUnauthorizedCallback) {
        this.onUnauthorizedCallback();
      }
    }

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage =
        json?.message ||
        json?.error ||
        (typeof json === 'string' ? json : `Request failed with HTTP ${response.status}`);
      throw new ApiClientError(errorMessage, response.status, json);
    }

    return json;
  }

  public async get<T = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', ...options });
  }

  public async post<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  public async patch<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  public async put<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  public async delete<T = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', ...options });
  }
}

export const apiClient = new ApiClient();
