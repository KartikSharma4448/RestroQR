import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

interface Owner {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
}

interface OwnerDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  restaurant: {
    id: string;
    name: string;
    status: string;
    restaurantToken: string;
  } | null;
}

export default function OwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<OwnerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOwners = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/owners');
      setOwners(response.data.data.owners);
    } catch {
      setError('Failed to load owners. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOwners();
  }, [fetchOwners]);

  async function handleViewOwner(ownerId: string) {
    setDetailLoading(true);
    setSelectedOwner(null);
    try {
      const response = await api.get(`/admin/owners/${ownerId}`);
      setSelectedOwner(response.data.data.owner);
    } catch {
      setError('Failed to load owner details.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleToggleStatus(ownerId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    setActionLoading(ownerId);
    try {
      await api.patch(`/admin/owners/${ownerId}/status`, { status: newStatus });
      // Update local list
      setOwners((prev) =>
        prev.map((o) => (o.id === ownerId ? { ...o, status: newStatus } : o))
      );
      // Update detail view if it's the same owner
      if (selectedOwner?.id === ownerId) {
        setSelectedOwner((prev) => (prev ? { ...prev, status: newStatus } : prev));
      }
    } catch {
      setError('Failed to update owner status.');
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Owners</h1>
          <p className="text-gray-500 mt-1">Manage restaurant owner accounts</p>
        </div>
        <Link
          to="/"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm"
          role="alert"
        >
          <svg
            className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-500 hover:text-red-700"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Owners Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <svg
                  className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-gray-500">Loading owners...</p>
              </div>
            ) : owners.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No owner accounts found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Registered
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {owners.map((owner) => (
                      <tr
                        key={owner.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          selectedOwner?.id === owner.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {owner.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {owner.email || owner.phone || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={owner.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(owner.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                          <button
                            onClick={() => handleViewOwner(owner.id)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleToggleStatus(owner.id, owner.status)}
                            disabled={actionLoading === owner.id}
                            className={`font-medium ${
                              owner.status === 'active'
                                ? 'text-red-600 hover:text-red-800'
                                : 'text-green-600 hover:text-green-800'
                            } disabled:opacity-50`}
                          >
                            {actionLoading === owner.id
                              ? '...'
                              : owner.status === 'active'
                              ? 'Disable'
                              : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Owner Detail Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            {detailLoading ? (
              <div className="text-center py-8">
                <svg
                  className="animate-spin h-6 w-6 text-blue-600 mx-auto mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-sm text-gray-500">Loading details...</p>
              </div>
            ) : selectedOwner ? (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Owner Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">
                      Name
                    </label>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {selectedOwner.name}
                    </p>
                  </div>

                  {selectedOwner.email && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">
                        Email
                      </label>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {selectedOwner.email}
                      </p>
                    </div>
                  )}

                  {selectedOwner.phone && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">
                        Phone
                      </label>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {selectedOwner.phone}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">
                      Status
                    </label>
                    <div className="mt-1">
                      <StatusBadge status={selectedOwner.status} />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">
                      Registration Date
                    </label>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {formatDate(selectedOwner.createdAt)}
                    </p>
                  </div>

                  {/* Associated Restaurant */}
                  <div className="pt-4 border-t border-gray-200">
                    <label className="text-xs font-medium text-gray-500 uppercase">
                      Associated Restaurant
                    </label>
                    {selectedOwner.restaurant ? (
                      <div className="mt-2 bg-gray-50 rounded-lg p-3">
                        <Link
                          to={`/restaurants/${selectedOwner.restaurant.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {selectedOwner.restaurant.name}
                        </Link>
                        <div className="mt-1">
                          <StatusBadge status={selectedOwner.restaurant.status} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 mt-1 italic">
                        No restaurant set up
                      </p>
                    )}
                  </div>

                  {/* Action button */}
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() =>
                        handleToggleStatus(selectedOwner.id, selectedOwner.status)
                      }
                      disabled={actionLoading === selectedOwner.id}
                      className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                        selectedOwner.status === 'active'
                          ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      }`}
                    >
                      {actionLoading === selectedOwner.id
                        ? 'Updating...'
                        : selectedOwner.status === 'active'
                        ? 'Disable Account'
                        : 'Enable Account'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <p className="text-sm">Select an owner to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
