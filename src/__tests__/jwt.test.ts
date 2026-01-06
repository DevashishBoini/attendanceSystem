import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateJWT, verifyJWT } from '../utils/jwt.js';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';
import { JWTPayloadSchema, type JWTPayload, JWTDecodedSchema } from '../schemas/jwt.js';
import config from '../config.js';
import jwt from 'jsonwebtoken';
import { testLog, clearLogs, printLogs, setTestName } from './utils/test-logger.js';

describe('JWT Utilities', () => {
  beforeEach(() => {
    clearLogs();
  });

  afterEach(async (context) => {
    // Print logs only if test failed
    if (context.task.result?.state === 'fail' || context.task.result?.errors?.length) {
      setTestName(context.task.name);
      printLogs();
    }
    clearLogs();
  });
  const testUserId = '507f1f77bcf86cd799439011';

  describe('generateJWT', () => {
    it('should generate a valid JWT token', () => {
      const payload: JWTPayload = {
        userId: testUserId,
        role: TEACHER_ROLE,
      };

      const token = generateJWT(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format: header.payload.signature
    });

    it('should include user data in token payload', () => {
      const payload: JWTPayload = {
        userId: testUserId,
        role: STUDENT_ROLE,
      };

      const token = generateJWT(payload);
      const decoded = jwt.verify(token, config.JWT_SECRET_KEY);
      const validated = JWTDecodedSchema.parse(decoded);

      expect(validated.userId).toBe(testUserId);
      expect(validated.role).toBe(STUDENT_ROLE);
    });
  });

  describe('verifyJWT', () => {
    it('should verify a valid token and return payload', () => {
      const payload: JWTPayload = {
        userId: testUserId,
        role: TEACHER_ROLE,
      };

      const token = generateJWT(payload);
      const verified = verifyJWT(token);

      expect(verified).toBeDefined();
      expect(verified?.userId).toBe(testUserId);
      expect(verified?.role).toBe(TEACHER_ROLE);
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.signature';

      const verified = verifyJWT(invalidToken);

      expect(verified).toBeNull();
    });

    it('should return null for expired token', () => {
      const payload: JWTPayload = {
        userId: testUserId,
        role: TEACHER_ROLE,
      };

      const token = jwt.sign(payload, config.JWT_SECRET_KEY, {
        expiresIn: -1, // Expire immediately (1 second in the past)
      });
      const verified = verifyJWT(token);

      expect(verified).toBeNull();
    });

    it('should return null for malformed token', () => {
      const malformedToken = 'not.a.valid.jwt';

      const verified = verifyJWT(malformedToken);

      expect(verified).toBeNull();
    });
  });
});
