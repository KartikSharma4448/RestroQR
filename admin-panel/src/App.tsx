import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './services/auth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RestaurantsPage from './pages/RestaurantsPage';
import RestaurantDetailPage from './pages/RestaurantDetailPage';
import OwnersPage from './pages/OwnersPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurants"
          element={
            <ProtectedRoute>
              <RestaurantsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurants/:id"
          element={
            <ProtectedRoute>
              <RestaurantDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owners"
          element={
            <ProtectedRoute>
              <OwnersPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
