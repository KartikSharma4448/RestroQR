import api from './api';

const TOKEN_KEY = 'restroqr_admin_token';

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: {
      id: string;
      email: string;
      role: string;
    };
  };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', { email, password });
  const { token, user } = response.data.data;
  if (!response.data.success || user?.role !== 'admin' || !isAdminToken(token)) {
    logout();
    throw new Error('An administrator account is required. Please sign in with your admin credentials.');
  }
  localStorage.setItem(TOKEN_KEY, token);
  return response.data;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  if (!isAdminToken(token)) {
    logout();
    return false;
  }
  return true;
}

function isAdminToken(token: string): boolean {
  try {
    const parts = token.split('.');
    const payloadPart = parts[1];
    if (parts.length !== 3 || !payloadPart) return false;
    const encoded = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded));
    // UI session filtering only; authorization is enforced by the backend.
    return payload.role === 'admin' && typeof payload.sub === 'string' &&
      typeof payload.exp === 'number' && payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
