import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';
import { verifyToken, DecodedToken } from '../utils/token';

export interface AuthenticatedRequest extends Request {
  user?: DecodedToken;
}

/**
 * Authentication middleware.
 * Extracts Bearer token from Authorization header, verifies JWT,
 * and for owner tokens checks that the account is not disabled.
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Missing or invalid authorization token',
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  let decoded: DecodedToken;
  try {
    decoded = verifyToken(token);
  } catch {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Invalid or expired token',
      },
    });
    return;
  }

  // For owner tokens, check if account is still active
  if (decoded.role === 'owner') {
    try {
      const result = await pool.query(
        'SELECT status FROM owners WHERE id = $1',
        [decoded.sub]
      );

      if (result.rows.length === 0) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Account not found',
          },
        });
        return;
      }

      if (result.rows[0].status === 'disabled') {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'Your account has been disabled. Please contact support.',
          },
        });
        return;
      }
    } catch {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
      return;
    }
  }

  req.user = decoded;
  next();
}

/**
 * Role-based access control middleware factory.
 * Returns middleware that checks if the authenticated user has the required role.
 * Must be used after the `authenticate` middleware.
 */
export function requireRole(role: 'admin' | 'owner') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
      return;
    }

    next();
  };
}
