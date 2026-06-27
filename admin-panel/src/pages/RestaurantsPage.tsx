import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  status: 'active' | 'disabled';
  owner_name?: string;
  created_at: string;
}

interface PaginatedResponse {
  success: boolean;
  data: {
    restaurants: Restaurant[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Restaurant | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Status toggle loading
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const totalPages = Math.ceil(total / pageSize);

  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<PaginatedResponse>('/admin/restaurants', {
        params: { page, pageSize },
      });
      setRestaurants(response.data.data.restaurants);
      setTotal(response.data.data.total);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
        setError(axiosErr.response?.data?.error?.message || 'Failed to load restaurants.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  // Auto-dismiss success messages
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  async function handleToggleStatus(restaurant: Restaurant) {
    const newStatus = restaurant.status === 'active' ? 'disabled' : 'active';
    setStatusLoading(restaurant.id);
    setError('');
    try {
      await api.patch(`/admin/restaurants/${restaurant.id}/status`, { status: newStatus });
      setRestaurants((prev) =>
        prev.map((r) => (r.id === restaurant.id ? { ...r, status: newStatus } : r))
      );
      setSuccessMsg(
        `Restaurant "${restaurant.name}" has been ${newStatus === 'active' ? 'enabled' : 'disabled'}.`
      );
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
        setError(axiosErr.response?.data?.error?.message || 'Failed to update status.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setStatusLoading(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError('');
    try {
      await api.delete(`/admin/restaurants/${deleteTarget.id}`);
      setSuccessMsg(`Restaurant "${deleteTarget.name}" has been deleted.`);
      setDeleteTarget(null);
      // Refetch to update pagination correctly
      if (restaurants.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchRestaurants();
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
        setError(axiosErr.response?.data?.error?.message || 'Failed to delete restaurant.');
      } else {
        setError('An unexpected error occurred.');
      }
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Restaurants</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage all registered restaurants on the platform
          </p>
        </div>
        <Link
          to="/"
          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          ← Back to Dashboard
        </Link>
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

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="ml-3 text-gray-600">Loading restaurants...</span>
        </div>
      ) : restaurants.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No restaurants found.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {restaurants.map((restaurant) => (
                    <tr key={restaurant.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/restaurants/${restaurant.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {restaurant.name}
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5">{restaurant.address}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {restaurant.owner_name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={restaurant.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(restaurant)}
                            disabled={statusLoading === restaurant.id}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              restaurant.status === 'active'
                                ? 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200'
                                : 'text-green-700 bg-green-50 hover:bg-green-100 border border-green-200'
                            }`}
                          >
                            {statusLoading === restaurant.id
                              ? '...'
                              : restaurant.status === 'active'
                              ? 'Disable'
                              : 'Enable'}
                          </button>
                          <Link
                            to={`/restaurants/${restaurant.id}`}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(restaurant)}
                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
              <span className="text-gray-400">|</span>
              <label htmlFor="pageSize" className="text-sm text-gray-600">
                Per page:
              </label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Restaurant"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will permanently remove the restaurant and all its menu data. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
