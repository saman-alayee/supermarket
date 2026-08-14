import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/helpers';
import { AppError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      sessionId?: string;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(401, 'لطفاً وارد حساب کاربری شوید', 'UNAUTHORIZED'));
  }

  try {
    const token = authHeader.split(' ')[1];
    req.user = verifyToken(token);
    next();
  } catch {
    next(new AppError(401, 'توکن نامعتبر است', 'INVALID_TOKEN'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      req.user = verifyToken(token);
    } catch {
      // Ignore invalid token for optional auth
    }
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, 'لطفاً وارد حساب کاربری شوید', 'UNAUTHORIZED'));
  }
  if (req.user.role !== 'ADMIN') {
    return next(new AppError(403, 'دسترسی غیرمجاز', 'FORBIDDEN'));
  }
  next();
}

export function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  const sessionId = req.headers['x-session-id'] as string;
  if (sessionId) {
    req.sessionId = sessionId;
  }
  next();
}
