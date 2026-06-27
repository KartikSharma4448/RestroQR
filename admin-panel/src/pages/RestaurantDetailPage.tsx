import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  logo_url: string | null;
  cover_image_url: string | null;
  restaurant_token: string;
  status: 'active' | 'disabled';
  owner_id: string;
  owner_name?: string;
  owner_email?: string;
  created_at: string;
  updated_at: string;
}

interface RestaurantResponse {
  success: boolean;
  data: Restaurant;
}

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchRestaurant();
  }, [id]);

  // Auto-dismiss success messages
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  async function fetchRestaurant() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<RestaurantResponse>(`/admin/restaurants/${id}`);
      const data = response.data.data;
      setRestaurant(data);
      setFormData({
        name: data.name,
        address: data.address,
        phone: data.phone,
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
        if (axiosErr.response?.status === 404) {
          setError('Restaurant not found.');
        } else {
          setError(axiosErr.response?.data?.error?.message || 'Failed to load restaurant.');
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = 'Restaurant name is required.';
    }
    if (!formData.address.trim()) {
      errors.address = 'Address is required.';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    setError('');
    try {
      const response = await api.put<RestaurantResponse>(`/admin/restaurants/${id}`, {
        name: formData.name.trim(),
        address: formData.address.trim(),
        phone: formData.phone.trim(),
      });
      setRestaurant(response.data.data);
      setEditing(false);
      setSuccessMsg('Restaurant updated successfully.');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string; details?: { field: string; message: string }[] } } } };
        const details = axiosErr.response?.data?.error?.details;
        if (details && details.length > 0) {
          const fieldErrors: Record<string, string> = {};
          details.forEach((d) => {
            fieldErrors[d.field] = d.message;
          });
          setFormErrors(fieldErrors);
        } else {
          setError(axiosErr.response?.data?.error?.message || 'Failed to update restaurant.');
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    if (restaurant) {
      setFormData({
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
      });
    }
    setFormErrors({});
    setEditing(false);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="ml-3 text-gray-600">Loading restaurant details...</span>
        </div>
      </div>
    );
  }

  if (error && !restaurant) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
        <Link to="/restaurants" className="text-sm text-blue-600 hover:text-blue-800">
          ← Back to Restaurants
        </Link>
      </div>
    );
  }

  if (!restaurant) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to="/restaurants"
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            ← Back to Restaurants
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{restaurant.name}</h1>
        </div>
        <StatusBadge status={restaurant.status} />
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Restaurant Profile Card */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Cover image */}
        {restaurant.cover_image_url && (
          <div className="h-48 bg-gray-200 overflow-hidden">
            <img
              src={restaurant.cover_image_url}
              alt={`${restaurant.name} cover`}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            {/* Logo */}
            {restaurant.logo_url && (
              <img
                src={restaurant.logo_url}
                alt={`${restaurant.name} logo`}
                className="w-16 h-16 rounded-lg object-cover border border-gray-200"
              />
            )}
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">Restaurant Profile</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Token: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{restaurant.restaurant_token}</code>
              </p>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            /* Edit Form */
            <form onSubmit={handleSave} className="space-y-4" noValidate>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Restaurant Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter restaurant name"
                  disabled={saving}
                />
                {formErrors.name && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    formErrors.address ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter restaurant address"
                  disabled={saving}
                />
                {formErrors.address && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.address}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  id="phone"
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    formErrors.phone ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter phone number"
                  disabled={saving}
                />
                {formErrors.phone && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.phone}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* View mode */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Name</p>
                  <p className="text-sm text-gray-900 mt-1">{restaurant.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</p>
                  <p className="text-sm text-gray-900 mt-1">{restaurant.phone}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Address</p>
                  <p className="text-sm text-gray-900 mt-1">{restaurant.address}</p>
                </div>
                {restaurant.owner_name && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</p>
                    <p className="text-sm text-gray-900 mt-1">{restaurant.owner_name}</p>
                    {restaurant.owner_email && (
                      <p className="text-xs text-gray-500">{restaurant.owner_email}</p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Created</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {new Date(restaurant.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
