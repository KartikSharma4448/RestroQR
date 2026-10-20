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
  emoji?: string | null;
  options?: { variants: { id: string; name: string; price: string; isAvailable: boolean }[];
    addOns: { id: string; name: string; price: string; isAvailable: boolean }[] };
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
      qrMode: string;
      orderingEnabled?: boolean;
      customerEmailRequired?: boolean;
      waiterCallingEnabled?: boolean;
      ownerPhotoUrl?: string | null;
      address?: string;
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
  emoji?: string | null;
  options?: import('./menuOptions').MenuOptions;
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
    qr_mode: string;
    ordering_enabled?: boolean;
    customer_email_required?: boolean;
    waiter_calling_enabled?: boolean;
    owner_photo_url?: string | null;
    address?: string;
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
        qr_mode: raw.data.restaurant.qrMode || 'single',
        ordering_enabled: raw.data.restaurant.orderingEnabled,
        customer_email_required: raw.data.restaurant.customerEmailRequired,
        waiter_calling_enabled: raw.data.restaurant.waiterCallingEnabled,
        owner_photo_url: raw.data.restaurant.ownerPhotoUrl,
        address: raw.data.restaurant.address,
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
          emoji: item.emoji,
          options: item.options ? {
            variants: item.options.variants.map(option => ({ ...option, price: Number(option.price) })),
            addOns: item.options.addOns.map(option => ({ ...option, price: Number(option.price) })),
          } : undefined,
          badge: item.badge,
          is_available: item.isAvailable,
        })),
      })),
    },
  };
}
