import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { publicRateLimiter, authRateLimiter } from './middleware/rateLimiter';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import { authenticate, requireRole } from './middleware/auth';
import authRoutes from './routes/auth';
import adminOwnersRoutes from './routes/admin/owners';
import adminRestaurantRoutes from './routes/admin/restaurants';
import ownerRestaurantRoutes from './routes/owner/restaurant';
import ownerCategoryRoutes from './routes/owner/categories';
import ownerQrRoutes from './routes/owner/qr';
import ownerItemRoutes from './routes/owner/items';
import publicMenuRoutes from './routes/public/menu';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(publicRateLimiter);
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/admin/owners', authenticate, requireRole('admin'), adminOwnersRoutes);
app.use('/api/admin/restaurants', authenticate, requireRole('admin'), adminRestaurantRoutes);
app.use('/api/owner', authenticate, requireRole('owner'), ownerRestaurantRoutes);
app.use('/api/owner', authenticate, requireRole('owner'), ownerCategoryRoutes);
app.use('/api/owner', authenticate, requireRole('owner'), ownerQrRoutes);
app.use('/api/owner', authenticate, requireRole('owner'), ownerItemRoutes);
app.use('/api/public', publicMenuRoutes);

// 404 catch-all (must be after all routes)
app.use(notFound);

// Global error handler (must be the LAST middleware)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`RestroQR API server running on port ${PORT}`);
});

export default app;
