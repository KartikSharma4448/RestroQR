import { Link } from 'react-router-dom';

export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/restaurants"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">Restaurants</h2>
          <p className="text-gray-600">Manage all registered restaurants</p>
        </Link>
        <Link
          to="/owners"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">Owners</h2>
          <p className="text-gray-600">Manage restaurant owner accounts</p>
        </Link>
      </div>
    </div>
  );
}
