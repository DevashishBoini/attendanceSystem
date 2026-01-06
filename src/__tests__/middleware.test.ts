import type { Request, Response, NextFunction } from 'express';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { authMiddleware, teacherRoleMiddleware } from '../middleware/auth.js';
import { verifyJWT } from '../utils/jwt.js';
import { type JWTDecoded } from '../schemas/jwt.js';
import { type ErrorResponse } from '../schemas/responses.js';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';
import { testLog, clearLogs, printLogs, setTestName } from './utils/test-logger.js';

// Mock verifyJWT
vi.mock('../utils/jwt.js');

describe('Authentication Middleware', () => {
  let req: Partial<Request> & { user?: any };
  let res: any;
  let next: any;

  beforeEach(() => {
    clearLogs();
    vi.clearAllMocks();
    req = {
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  afterEach(async (context) => {
    // Print logs only if test failed
    if (context.task.result?.state === 'fail' || context.task.result?.errors?.length) {
      setTestName(context.task.name);
      printLogs();
    }
    clearLogs();
  });

  describe('authMiddleware', () => {
    it('should return 401 if Authorization header is missing', () => {
      authMiddleware(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(401);
      const expectedError: ErrorResponse = {
        success: false,
        error: 'Unauthorized, token missing or invalid',
      };
      expect(res.json).toHaveBeenCalledWith(expectedError);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token verification fails', () => {
      req.headers = { authorization: 'invalid.token.here' };
      vi.mocked(verifyJWT).mockReturnValue(null);

      authMiddleware(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(401);
      const expectedError: ErrorResponse = {
        success: false,
        error: 'Unauthorized, token missing or invalid',
      };
      expect(res.json).toHaveBeenCalledWith(expectedError);
      expect(next).not.toHaveBeenCalled();
    });

    it('should attach user data to req and call next() on valid token', () => {
      const mockPayload: JWTDecoded = {
        userId: '507f1f77bcf86cd799439011',
        role: TEACHER_ROLE,
        iat: 1234567890,
        exp: 1234571490,
      };

      req.headers = { authorization: 'valid.token.here' };
      vi.mocked(verifyJWT).mockReturnValue(mockPayload);

      authMiddleware(req as Request, res as Response, next as NextFunction);

      expect(req.user).toEqual(mockPayload);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('teacherRoleMiddleware', () => {
    it('should return 401 if user is not authenticated', () => {
      req.user = undefined;

      teacherRoleMiddleware(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(401);
      const expectedError: ErrorResponse = {
        success: false,
        error: 'Unauthorized, token missing or invalid',
      };
      expect(res.json).toHaveBeenCalledWith(expectedError);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user role is not teacher', () => {
      req.user = {
        userId: '507f1f77bcf86cd799439011',
        role: STUDENT_ROLE,
        iat: 1234567890,
        exp: 1234571490,
      } as JWTDecoded;

      teacherRoleMiddleware(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
      const expectedError: ErrorResponse = {
        success: false,
        error: 'Forbidden, teacher access required',
      };
      expect(res.json).toHaveBeenCalledWith(expectedError);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if user is a teacher', () => {
      req.user = {
        userId: '507f1f77bcf86cd799439011',
        role: TEACHER_ROLE,
        iat: 1234567890,
        exp: 1234571490,
      } as JWTDecoded;

      teacherRoleMiddleware(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle missing role in user object gracefully', () => {
      req.user = {
        userId: '507f1f77bcf86cd799439011',
        iat: 1234567890,
        exp: 1234571490,
      } as any;

      teacherRoleMiddleware(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authMiddleware - Additional Edge Cases', () => {
    it('should accept Authorization header with direct token format', () => {
      const mockPayload: JWTDecoded = {
        userId: '507f1f77bcf86cd799439011',
        role: TEACHER_ROLE,
        iat: 1234567890,
        exp: 1234571490,
      };

      req.headers = { authorization: 'valid.token.here' };
      vi.mocked(verifyJWT).mockReturnValue(mockPayload);

      authMiddleware(req as Request, res as Response, next as NextFunction);

      expect(req.user).toEqual(mockPayload);
      expect(next).toHaveBeenCalled();
    });

    it('should reject Authorization header with Bearer prefix', () => {
      const mockPayload: JWTDecoded = {
        userId: '507f1f77bcf86cd799439011',
        role: TEACHER_ROLE,
        iat: 1234567890,
        exp: 1234571490,
      };

      req.headers = { authorization: 'Bearer valid.token.here' };
      vi.mocked(verifyJWT).mockReturnValue(null);

      authMiddleware(req as Request, res as Response, next as NextFunction);

      // Bearer prefix format is not supported, should fail verification
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should attach correct user data to request object', () => {
      const mockPayload: JWTDecoded = {
        userId: '507f1f77bcf86cd799439011',
        role: TEACHER_ROLE,
        iat: 1234567890,
        exp: 1234571490,
      };

      req.headers = { authorization: 'valid.token.here' };
      vi.mocked(verifyJWT).mockReturnValue(mockPayload);

      authMiddleware(req as Request, res as Response, next as NextFunction);

      expect(req.user?.userId).toBe('507f1f77bcf86cd799439011');
      expect(req.user?.role).toBe(TEACHER_ROLE);
      expect(req.user?.iat).toBe(1234567890);
      expect(req.user?.exp).toBe(1234571490);
    });

    it('should extract token from Authorization header correctly', () => {
      const mockPayload: JWTDecoded = {
        userId: '507f1f77bcf86cd799439011',
        role: STUDENT_ROLE,
        iat: 1234567890,
        exp: 1234571490,
      };

      req.headers = { authorization: 'valid.token.here' };
      vi.mocked(verifyJWT).mockReturnValue(mockPayload);

      authMiddleware(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('teacherRoleMiddleware - Additional Edge Cases', () => {
    it('should work when user has both userId and role set correctly', () => {
      req.user = {
        userId: '507f1f77bcf86cd799439011',
        role: TEACHER_ROLE,
        iat: 1234567890,
        exp: 1234571490,
      } as JWTDecoded;

      teacherRoleMiddleware(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should distinguish between student and teacher roles', () => {
      const studentUser: JWTDecoded = {
        userId: '507f1f77bcf86cd799439011',
        role: STUDENT_ROLE,
        iat: 1234567890,
        exp: 1234571490,
      };

      const teacherUser: JWTDecoded = {
        userId: '507f1f77bcf86cd799439011',
        role: TEACHER_ROLE,
        iat: 1234567890,
        exp: 1234571490,
      };

      // Test student
      req.user = studentUser;
      teacherRoleMiddleware(req as Request, res as Response, next as NextFunction);
      expect(res.status).toHaveBeenCalledWith(403);

      // Reset mocks
      vi.clearAllMocks();

      // Test teacher
      req.user = teacherUser;
      teacherRoleMiddleware(req as Request, res as Response, next as NextFunction);
      expect(next).toHaveBeenCalled();
    });

    it('should reject any role that is not teacher', () => {
      const invalidRoles = ['student', 'admin', 'guest', ''];

      invalidRoles.forEach(role => {
        vi.clearAllMocks();
        req.user = {
          userId: '507f1f77bcf86cd799439011',
          role: role as any,
          iat: 1234567890,
          exp: 1234571490,
        };

        teacherRoleMiddleware(req as Request, res as Response, next as NextFunction);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });
    });
  });
});
