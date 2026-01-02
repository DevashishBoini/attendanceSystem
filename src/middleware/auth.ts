import type { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../utils/jwt.js';
import { type JWTDecoded, JWTDecodedSchema } from '../schemas/jwt.js';
import { type UserRole, TEACHER_ROLE } from '../constants.js';
import { ErrorResponseSchema, type ErrorResponse } from '../schemas/responses.js';

/**
 * Extend Express Request interface to include authenticated user data
 * This allows TypeScript to recognize req.user property
 */
declare global {
  namespace Express {
    interface Request {
      /** Authenticated user payload from JWT token */
      user?: JWTDecoded;
    }
  }
}







/**
 * Authentication Middleware
 * 
 * Verifies JWT token from Authorization header and attaches user data to request.
 * Must be used on protected routes that require authentication.
 * 
 * Expected header format: Authorization: <token>
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
    // Expected format: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    const authHeader = req.headers.authorization;

    // ✅ Check if Authorization header exists
    if (!authHeader) {

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Unauthorized, token missing or invalid'
      };

      ErrorResponseSchema.parse(errorResponse);
      res.status(401).json(errorResponse);
      return;
    }

    // Use token directly from header
    const token = authHeader;

    // Verify token signature and expiration
    // Returns null if token is invalid or expired
    const payload = verifyJWT(token);

    // ✅ Check if token verification failed
    // Validate payload structure and required fields using schema
    const validatedPayload = JWTDecodedSchema.safeParse(payload);
    if (!validatedPayload.success) {

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Unauthorized, token missing or invalid'
      };

      ErrorResponseSchema.parse(errorResponse);
      res.status(401).json(errorResponse);
      return;
    }
   

    /**
     * Attach decoded user data to request object
     * Now available in route handlers as req.user
     * 
     * Contains:
     * - userId: User's MongoDB ID
     * - role: User role ('teacher' or 'student')
     * - iat: Token issued-at timestamp
     * - exp: Token expiration timestamp
     */
    req.user = validatedPayload.data;

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

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Unauthorized, token missing or invalid'
      };

      ErrorResponseSchema.parse(errorResponse);
      res.status(401).json(errorResponse);
      return;
    }
    

    //  Check if user's role is teacher
    if (req.user.role !== TEACHER_ROLE) {

      console.error('❌ Teacher role check failed');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Forbidden, teacher access required'
      };
      
      ErrorResponseSchema.parse(errorResponse);
      res.status(403).json(errorResponse);
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