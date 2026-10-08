"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const rateLimiter_1 = require("./middleware/rateLimiter");
const notFound_1 = require("./middleware/notFound");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = require("./middleware/auth");
const auth_2 = __importDefault(require("./routes/auth"));
const owners_1 = __importDefault(require("./routes/admin/owners"));
const restaurants_1 = __importDefault(require("./routes/admin/restaurants"));
const restaurant_1 = __importDefault(require("./routes/owner/restaurant"));
const categories_1 = __importDefault(require("./routes/owner/categories"));
const qr_1 = __importDefault(require("./routes/owner/qr"));
const items_1 = __importDefault(require("./routes/owner/items"));
const settings_1 = __importDefault(require("./routes/owner/settings"));
const tables_1 = __importDefault(require("./routes/owner/tables"));
const orders_1 = __importDefault(require("./routes/owner/orders"));
const earnings_1 = __importDefault(require("./routes/owner/earnings"));
const notifications_1 = __importDefault(require("./routes/owner/notifications"));
const menu_1 = __importDefault(require("./routes/public/menu"));
const orders_2 = __importDefault(require("./routes/public/orders"));
const loyalty_1 = __importDefault(require("./routes/public/loyalty"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT || 3000);
// Security middleware
app.use((0, helmet_1.default)());
// CORS configuration — restrict to known origins
const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
// Always allow the customer website origin (Vercel deployment)
const customerSiteOrigin = process.env.CUSTOMER_BASE_URL || 'https://restro-qr-peach.vercel.app';
if (!allowedOrigins.includes(customerSiteOrigin)) {
    allowedOrigins.push(customerSiteOrigin);
}
// In development, allow localhost if no origins configured
if (allowedOrigins.length === 0 || process.env.NODE_ENV !== 'production') {
    const devOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080', 'http://127.0.0.1:5173', 'http://127.0.0.1:3001'];
    for (const origin of devOrigins) {
        if (!allowedOrigins.includes(origin)) {
            allowedOrigins.push(origin);
        }
    }
}
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, server-to-server)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin))
            return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use(rateLimiter_1.publicRateLimiter);
app.use(express_1.default.json({ limit: '10kb' }));
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Routes
app.use('/api/auth', rateLimiter_1.authRateLimiter, auth_2.default);
app.use('/api/admin/owners', auth_1.authenticate, (0, auth_1.requireRole)('admin'), owners_1.default);
app.use('/api/admin/restaurants', auth_1.authenticate, (0, auth_1.requireRole)('admin'), restaurants_1.default);
app.use('/api/owner', auth_1.authenticate, (0, auth_1.requireRole)('owner'), restaurant_1.default);
app.use('/api/owner', auth_1.authenticate, (0, auth_1.requireRole)('owner'), categories_1.default);
app.use('/api/owner', auth_1.authenticate, (0, auth_1.requireRole)('owner'), qr_1.default);
app.use('/api/owner', auth_1.authenticate, (0, auth_1.requireRole)('owner'), items_1.default);
app.use('/api/owner', auth_1.authenticate, (0, auth_1.requireRole)('owner'), settings_1.default);
app.use('/api/owner', auth_1.authenticate, (0, auth_1.requireRole)('owner'), tables_1.default);
app.use('/api/owner', auth_1.authenticate, (0, auth_1.requireRole)('owner'), orders_1.default);
app.use('/api/owner', auth_1.authenticate, (0, auth_1.requireRole)('owner'), earnings_1.default);
app.use('/api/owner', auth_1.authenticate, (0, auth_1.requireRole)('owner'), notifications_1.default);
app.use('/api/public', menu_1.default);
app.use('/api/public', orders_2.default);
app.use('/api/public', loyalty_1.default);
// 404 catch-all (must be after all routes)
app.use(notFound_1.notFound);
// Global error handler (must be the LAST middleware)
app.use(errorHandler_1.errorHandler);
if (require.main === module) {
    app.listen(PORT, process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1', () => {
        console.log(`RestroQR API server running on port ${PORT}`);
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map