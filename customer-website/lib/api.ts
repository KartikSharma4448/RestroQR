const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

/**
 * Fetch wrapper for backend API calls.
 * Handles base URL resolution and error parsing.
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let code = 'UNKNOWN_ERROR';
    let message = 'An unexpected error occurred';

    try {
      const errorBody: ApiErrorResponse = await response.json();
      code = errorBody.error?.code || code;
      message = errorBody.error?.message || message;
    } catch {
      // If response body is not valid JSON, use defaults
    }

    throw new ApiError(response.status, code, message);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch the public menu for a given restaurant token.
 */
export async function fetchMenu(token: string) {
  return apiFetch<{
    success: true;
    data: {
      restaurant: {
        name: string;
        logo_url: string | null;
        cover_image_url: string | null;
      };
      categories: Array<{
        id: string;
        name: string;
        display_order: number;
        items: Array<{
          id: string;
          name: string;
          description: string | null;
          price: number;
          image_url: string | null;
          badge: 'veg' | 'non_veg';
          is_available: boolean;
        }>;
      }>;
    };
  }>(`/api/public/menu/${token}`);
}
