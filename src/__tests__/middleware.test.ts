import type { Request, Response, NextFunction } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authMiddleware, teacherRoleMiddleware } from '../middleware/auth.js';
import { verifyJWT } from '../utils/jwt.js';
import { type JWTDecoded } from '../schemas/jwt.js';
import { type ErrorResponse } from '../schemas/responses.js';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';

// Mock verifyJWT
vi.mock('../utils/jwt.js');

describe('Authentication Middleware', () => {
  let req: Partial<Request> & { user?: any };
  let res: any;
  let next: any;

  beforeEach(() => {
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
  });
});
