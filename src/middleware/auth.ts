import type { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../utils/jwt.js';
import { type JWTPayload } from '../schemas/jwt.js';

/**
 * Extend Express Request interface to include authenticated user data
 * This allows TypeScript to recognize req.user property
 */
declare global {
  namespace Express {
    interface Request {
      /** Authenticated user payload from JWT token */
      user?: JWTPayload;
    }
  }
}







/**
 * Authentication Middleware
 * 
 * Verifies JWT token from Authorization header and attaches user data to request.
 * Must be used on protected routes that require authentication.
 * 
 * Expected header format: Authorization: Bearer <token>
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 * 
 * @example
 * // Protect a route
 * router.get('/me', authMiddleware, (req, res) => {
 *   console.log(req.user?.userId);  // Authenticated user ID
 * });
 * 
 * @throws Returns 401 if token is missing or invalid
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Extract Authorization header
    // Expected format: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    const authHeader = req.headers.authorization;

    // ✅ Check if Authorization header exists and starts with "Bearer "
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Use Authorization: Bearer <token>'
      });
      return;
    }

    // Extract token by removing "Bearer " prefix (7 characters)
    // Example: "Bearer abc123" → "abc123"
    const token = authHeader.slice(7);

    // Verify token signature and expiration
    // Returns null if token is invalid or expired
    const payload = verifyJWT(token);

    // ✅ Check if token verification failed
    if (!payload) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
      return;
    }

    /**
     * Attach decoded user data to request object
     * Now available in route handlers as req.user
     * 
     * Contains:
     * - userId: MongoDB user ID
     * - role: User role ('teacher' or 'student')
     */
    req.user = payload;

    // Pass control to next middleware/route handler
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
}











/**
 * Role-Based Access Control Middleware Factory
 * 
 * Creates a middleware that checks if user has required role.
 * Use for routes that only specific roles can access.
 * 
 * @param allowedRoles - Array of roles allowed to access route
 * @returns Middleware function
 * 
 * @example
 * // Only teachers can create classes
 * router.post('/classes', authMiddleware, roleMiddleware(['teacher']), (req, res) => {
 *   // Only teachers reach here
 * });
 * 
 * @example
 * // Both teachers and students can view
 * router.get('/classes', authMiddleware, roleMiddleware(['teacher', 'student']), (req, res) => {
 *   // Both roles reach here
 * });
 */
export function roleMiddleware(allowedRoles: Array<'teacher' | 'student'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // ✅ Check if user is authenticated (authMiddleware should run first)
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // ✅ Check if user's role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      });
      return;
    }

    // User has required role, proceed to route handler
    next();
  };
}