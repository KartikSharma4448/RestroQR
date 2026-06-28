const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://restroqr-api.onrender.com';

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

/* --- Raw API response types (camelCase from backend) --- */
interface ApiMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  badge: 'veg' | 'non_veg';
  isAvailable: boolean;
}

interface ApiCategory {
  id: string;
  name: string;
  displayOrder: number;
  items: ApiMenuItem[];
}

interface ApiMenuResponse {
  success: true;
  data: {
    restaurant: {
      name: string;
      logoUrl: string | null;
      coverImageUrl: string | null;
    };
    categories: ApiCategory[];
  };
}

/* --- Normalized types (snake_case for frontend components) --- */
export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  badge: 'veg' | 'non_veg';
  is_available: boolean;
}

export interface Category {
  id: string;
  name: string;
  display_order: number;
  items: MenuItem[];
}

export interface MenuData {
  restaurant: {
    name: string;
    logo_url: string | null;
    cover_image_url: string | null;
  };
  categories: Category[];
}

/**
 * Fetch the public menu for a given restaurant token.
 * Maps camelCase API response to snake_case for frontend components.
 */
export async function fetchMenu(token: string): Promise<{ success: true; data: MenuData }> {
  const raw = await apiFetch<ApiMenuResponse>(`/api/public/menu/${token}`);

  return {
    success: true,
    data: {
      restaurant: {
        name: raw.data.restaurant.name,
        logo_url: raw.data.restaurant.logoUrl,
        cover_image_url: raw.data.restaurant.coverImageUrl,
      },
      categories: raw.data.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        display_order: cat.displayOrder,
        items: cat.items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: parseFloat(item.price),
          image_url: item.imageUrl,
          badge: item.badge,
          is_available: item.isAvailable,
        })),
      })),
    },
  };
}
