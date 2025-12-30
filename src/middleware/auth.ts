import type { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../utils/jwt.js';
import { type JWTPayload } from '../schemas/jwt.js';
import { type UserRole, TEACHER_ROLE } from '../constants.js';

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
 *   console.log(req.user?._id);  // Authenticated user ID
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
    // Expected format: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    const authHeader = req.headers.authorization;

    // ✅ Check if Authorization header exists
    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: "Unauthorized, token missing or invalid"
      });
      return;
    }

    // Use token directly from header
    const token = authHeader;

    // Verify token signature and expiration
    // Returns null if token is invalid or expired
    const payload = verifyJWT(token);

    // ✅ Check if token verification failed
    if (!payload) {
      res.status(401).json({
        success: false,
        error: "Unauthorized, token missing or invalid"
      });
      return;
    }

    /**
     * Attach decoded user data to request object
     * Now available in route handlers as req.user
     * 
     * Contains:
     * - _id: MongoDB user ID
     * - role: User role ('teacher' or 'student')
     */
    req.user = payload;

    // Pass control to next middleware/route handler
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}











/**
 * Teacher Role Middleware
 * 
 * Checks if authenticated user has the teacher role.
 * Must be used after authMiddleware to ensure user is authenticated.
 * 
 * @returns Middleware function
 * 
 * @example
 * // Only teachers can create classes
 * router.post('/class', authMiddleware, teacherRoleMiddleware, async (req, res) => {
 *   // Only teachers reach here
 * });
 * 
 * @throws Returns 403 if user is not a teacher
 */
export function teacherRoleMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    //  Check if user is authenticated (authMiddleware should run first)
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Unauthorized, token missing or invalid"
      });
      return;
    }

    //  Check if user's role is teacher
    if (req.user.role !== TEACHER_ROLE) {
      res.status(403).json({
        success: false,
        error: "Forbidden, teacher access required"
      });
      return;
    }

    /**
     * User is a teacher, proceed to route handler
     */
    next();
  } catch (error) {
    console.error('❌ Role check error:', error);
    res.status(403).json({
      success: false,
      error: 'Authorization failed'
    });
  }
}