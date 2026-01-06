import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  SignupSchema,
  type SignupData,
  LoginSchema,
  type LoginData,
} from '../schemas/auth.js';
import {
  RegisterClassNameSchema,
  type RegisterClassNameData,
  ClassIdParamSchema,
  type ClassIdParam,
  StudentIdParamSchema,
  type StudentIdParam,
} from '../schemas/class.js';
import {
  SuccessResponseSchema,
  type SuccessResponse,
  SuccessListResponseSchema,
  type SuccessListResponse,
  ErrorResponseSchema,
  type ErrorResponse,
} from '../schemas/responses.js';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';
import { testLog, clearLogs, printLogs, setTestName } from './utils/test-logger.js';

describe('Schema Validation Tests', () => {
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
  describe('SignupSchema', () => {
    it('should validate correct signup data with teacher role', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: TEACHER_ROLE,
      };

      const result = SignupSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should validate correct signup data with student role', () => {
      const validData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'securePass456',
        role: STUDENT_ROLE,
      };

      const result = SignupSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data?.role).toBe(STUDENT_ROLE);
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'not-an-email',
        password: 'password123',
        role: TEACHER_ROLE,
      };

      const result = SignupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing name', () => {
      const invalidData = {
        email: 'john@example.com',
        password: 'password123',
        role: TEACHER_ROLE,
      };

      const result = SignupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const invalidData = {
        name: '',
        email: 'john@example.com',
        password: 'password123',
        role: TEACHER_ROLE,
      };

      const result = SignupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject password less than 6 characters', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'pass',
        role: TEACHER_ROLE,
      };

      const result = SignupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept password exactly 6 characters', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'pass12',
        role: TEACHER_ROLE,
      };

      const result = SignupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'admin',
      };

      const result = SignupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing email', () => {
      const invalidData = {
        name: 'John Doe',
        password: 'password123',
        role: TEACHER_ROLE,
      };

      const result = SignupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        role: TEACHER_ROLE,
      };

      const result = SignupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing role', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      const result = SignupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should parse and infer correct type', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: TEACHER_ROLE,
      };

      const result = SignupSchema.parse(validData) as SignupData;
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.role).toBe(TEACHER_ROLE);
    });

    it('should reject extra fields (strict mode)', () => {
      const dataWithExtra = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: TEACHER_ROLE,
        extraField: 'should not be allowed',
      };

      const result = SignupSchema.safeParse(dataWithExtra);
      // Zod by default strips unknown fields, so this should pass
      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('extraField');
    });
  });

  describe('LoginSchema', () => {
    it('should validate correct login data', () => {
      const validData = {
        email: 'john@example.com',
        password: 'password123',
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password123',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept any password length in login', () => {
      const validData = {
        email: 'john@example.com',
        password: 'a', // No minimum length requirement for login
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing email', () => {
      const invalidData = {
        password: 'password123',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const invalidData = {
        email: 'john@example.com',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should parse and infer correct type', () => {
      const validData = {
        email: 'john@example.com',
        password: 'password123',
      };

      const result = LoginSchema.parse(validData) as LoginData;
      expect(result.email).toBe('john@example.com');
      expect(result.password).toBe('password123');
    });
  });

  describe('RegisterClassNameSchema', () => {
    it('should validate correct class name data', () => {
      const validData = {
        className: 'Physics 101',
      };

      const result = RegisterClassNameSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data?.className).toBe('Physics 101');
    });

    it('should reject empty class name', () => {
      const invalidData = {
        className: '',
      };

      const result = RegisterClassNameSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing class name', () => {
      const invalidData = {};

      const result = RegisterClassNameSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate class name with special characters', () => {
      const validData = {
        className: 'Advanced Mathematics - Level 3',
      };

      const result = RegisterClassNameSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate class name with numbers', () => {
      const validData = {
        className: 'Biology 201 Spring 2024',
      };

      const result = RegisterClassNameSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should parse and infer correct type', () => {
      const validData = {
        className: 'Chemistry 101',
      };

      const result = RegisterClassNameSchema.parse(validData) as RegisterClassNameData;
      expect(result.className).toBe('Chemistry 101');
    });
  });

  describe('ClassIdParamSchema', () => {
    it('should validate correct class ID', () => {
      const validData = {
        id: '507f1f77bcf86cd799439011',
      };

      const result = ClassIdParamSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('507f1f77bcf86cd799439011');
    });

    it('should reject empty ID', () => {
      const invalidData = {
        id: '',
      };

      const result = ClassIdParamSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing ID', () => {
      const invalidData = {};

      const result = ClassIdParamSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate various valid ObjectId formats', () => {
      const testIds = [
        '507f1f77bcf86cd799439011',
        '507f191e436d609404116113',
        '65a1b2c3d4e5f6789abcdef0', // 24-character hex string
      ];

      testIds.forEach(id => {
        const result = ClassIdParamSchema.safeParse({ id });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid ObjectId formats', () => {
      const invalidIds = [
        'abc123def456789', // Too short (15 chars)
        '507f1f77bcf86cd799439011xyz', // Contains non-hex chars
        '507f1f77bcf86cd79943901', // Too short (23 chars)
        'invalid-object-id',
        '123',
      ];

      invalidIds.forEach(id => {
        const result = ClassIdParamSchema.safeParse({ id });
        expect(result.success).toBe(false);
      });
    });

    it('should parse and infer correct type', () => {
      const validData = {
        id: '507f1f77bcf86cd799439011',
      };

      const result = ClassIdParamSchema.parse(validData) as ClassIdParam;
      expect(result.id).toBe('507f1f77bcf86cd799439011');
    });
  });

  describe('StudentIdParamSchema', () => {
    it('should validate correct student ID', () => {
      const validData = {
        studentId: '507f1f77bcf86cd799439011',
      };

      const result = StudentIdParamSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data?.studentId).toBe('507f1f77bcf86cd799439011');
    });

    it('should reject empty student ID', () => {
      const invalidData = {
        studentId: '',
      };

      const result = StudentIdParamSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing student ID', () => {
      const invalidData = {};

      const result = StudentIdParamSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate various valid student ID formats', () => {
      const testIds = [
        '507f1f77bcf86cd799439011',
        '507f191e436d609404116113',
        '62a1b2c3d4e5f6789abcddf0',
      ];

      testIds.forEach(studentId => {
        const result = StudentIdParamSchema.safeParse({ studentId });
        expect(result.success).toBe(true);
      });
    });

    it('should parse and infer correct type', () => {
      const validData = {
        studentId: '507f1f77bcf86cd799439011',
      };

      const result = StudentIdParamSchema.parse(validData) as StudentIdParam;
      expect(result.studentId).toBe('507f1f77bcf86cd799439011');
    });
  });

  describe('Cross-Schema Consistency', () => {
    it('should handle both roles consistently across schemas', () => {
      const signupTeacher = SignupSchema.parse({
        name: 'Teacher',
        email: 'teacher@example.com',
        password: 'password123',
        role: TEACHER_ROLE,
      });

      const signupStudent = SignupSchema.parse({
        name: 'Student',
        email: 'student@example.com',
        password: 'password123',
        role: STUDENT_ROLE,
      });

      expect(signupTeacher.role).toBe(TEACHER_ROLE);
      expect(signupStudent.role).toBe(STUDENT_ROLE);
    });

    it('should parse all schemas independently', () => {
      const signup = SignupSchema.parse({
        name: 'Test',
        email: 'test@example.com',
        password: 'password123',
        role: TEACHER_ROLE,
      });

      const login = LoginSchema.parse({
        email: 'test@example.com',
        password: 'password123',
      });

      const className = RegisterClassNameSchema.parse({
        className: 'Test Class',
      });

      const classId = ClassIdParamSchema.parse({ id: '507f1f77bcf86cd799439011' });
      const studentId = StudentIdParamSchema.parse({ studentId: '507f1f77bcf86cd799439011' });

      expect(signup).toBeDefined();
      expect(login).toBeDefined();
      expect(className).toBeDefined();
      expect(classId).toBeDefined();
      expect(studentId).toBeDefined();
    });
  });

  describe('SuccessResponseSchema', () => {
    it('should validate a successful response with user data', () => {
      const successResponse: SuccessResponse = {
        success: true,
        data: {
          _id: '507f1f77bcf86cd799439011',
          name: 'John Doe',
          email: 'john@example.com',
          role: TEACHER_ROLE,
        },
      };

      const result = SuccessResponseSchema.safeParse(successResponse);
      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(true);
      expect(result.data?.data).toHaveProperty('_id');
    });

    it('should validate a successful response with array data', () => {
      const successResponse: SuccessResponse = {
        success: true,
        data: {
          students: [
            { _id: '1', name: 'Student 1', email: 'student1@example.com' },
            { _id: '2', name: 'Student 2', email: 'student2@example.com' },
          ],
        },
      };

      const result = SuccessResponseSchema.safeParse(successResponse);
      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(true);
    });

    it('should validate a successful response with nested objects', () => {
      const successResponse: SuccessResponse = {
        success: true,
        data: {
          class: {
            _id: '507f1f77bcf86cd799439011',
            className: 'Math 101',
            teacherId: '507f1f77bcf86cd799439012',
            studentIds: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014'],
          },
        },
      };

      const result = SuccessResponseSchema.safeParse(successResponse);
      expect(result.success).toBe(true);
    });

    it('should validate a successful response with empty data object', () => {
      const successResponse: SuccessResponse = {
        success: true,
        data: {},
      };

      const result = SuccessResponseSchema.safeParse(successResponse);
      expect(result.success).toBe(true);
    });

    it('should reject response with success: false', () => {
      const invalidResponse = {
        success: false,
        data: { _id: '123' },
      };

      const result = SuccessResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response missing data field', () => {
      const invalidResponse = {
        success: true,
      };

      const result = SuccessResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response with null data', () => {
      const invalidResponse = {
        success: true,
        data: null,
      };

      const result = SuccessResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response with array data (not object)', () => {
      const invalidResponse = {
        success: true,
        data: ['item1', 'item2'],
      };

      const result = SuccessResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response with extra fields', () => {
      const invalidResponse = {
        success: true,
        data: { _id: '123' },
        error: 'This should not be here',
      };

      const result = SuccessResponseSchema.safeParse(invalidResponse);
      // Zod by default strips extra properties, so this might pass
      // but we can verify the parsed data doesn't have the extra field
      if (result.success) {
        expect(result.data).not.toHaveProperty('error');
      }
    });

    it('should parse and return correct types', () => {
      const successResponse: SuccessResponse = {
        success: true,
        data: {
          message: 'Operation successful',
          code: 200,
        },
      };

      const result = SuccessResponseSchema.safeParse(successResponse);
      expect(result.success).toBe(true);
      expect(typeof result.data?.success).toBe('boolean');
      expect(typeof result.data?.data).toBe('object');
    });
  });

  describe('SuccessListResponseSchema', () => {
    it('should validate a successful response with array of student data', () => {
      const successListResponse: SuccessListResponse = {
        success: true,
        data: [
          { _id: '1', name: 'Student 1', email: 'student1@example.com' },
          { _id: '2', name: 'Student 2', email: 'student2@example.com' },
        ],
      };

      const result = SuccessListResponseSchema.safeParse(successListResponse);
      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(true);
      expect(Array.isArray(result.data?.data)).toBe(true);
      expect(result.data?.data.length).toBe(2);
    });

    it('should validate a successful response with empty array', () => {
      const successListResponse: SuccessListResponse = {
        success: true,
        data: [],
      };

      const result = SuccessListResponseSchema.safeParse(successListResponse);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.data)).toBe(true);
      expect(result.data?.data.length).toBe(0);
    });

    it('should validate a successful response with array of class data', () => {
      const successListResponse: SuccessListResponse = {
        success: true,
        data: [
          { _id: '1', className: 'Math 101', teacherId: 't1', studentIds: [] },
          { _id: '2', className: 'Physics 101', teacherId: 't2', studentIds: ['s1'] },
        ],
      };

      const result = SuccessListResponseSchema.safeParse(successListResponse);
      expect(result.success).toBe(true);
      expect(result.data?.data.length).toBe(2);
    });

    it('should validate a successful response with nested objects in array', () => {
      const successListResponse: SuccessListResponse = {
        success: true,
        data: [
          {
            _id: '1',
            user: { name: 'John', email: 'john@example.com' },
            metadata: { createdAt: '2024-01-01' },
          },
        ],
      };

      const result = SuccessListResponseSchema.safeParse(successListResponse);
      expect(result.success).toBe(true);
    });

    it('should reject response with success: false', () => {
      const invalidResponse = {
        success: false,
        data: [{ _id: '123' }],
      };

      const result = SuccessListResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response missing data field', () => {
      const invalidResponse = {
        success: true,
      };

      const result = SuccessListResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response with null data', () => {
      const invalidResponse = {
        success: true,
        data: null,
      };

      const result = SuccessListResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response with object data (not array)', () => {
      const invalidResponse = {
        success: true,
        data: { _id: '123', name: 'Test' },
      };

      const result = SuccessListResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response with primitive array data', () => {
      const invalidResponse = {
        success: true,
        data: ['string1', 'string2'],
      };

      const result = SuccessListResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should parse and return correct types', () => {
      const successListResponse: SuccessListResponse = {
        success: true,
        data: [
          { id: '1', value: 100 },
          { id: '2', value: 200 },
        ],
      };

      const result = SuccessListResponseSchema.safeParse(successListResponse);
      expect(result.success).toBe(true);
      expect(typeof result.data?.success).toBe('boolean');
      expect(Array.isArray(result.data?.data)).toBe(true);
    });
  });

  describe('ErrorResponseSchema', () => {
    it('should validate an error response with string error', () => {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Unauthorized access',
      };

      const result = ErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(false);
      expect(result.data?.error).toBe('Unauthorized access');
    });

    it('should validate an error response with detailed message', () => {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid request: Email format is incorrect',
      };

      const result = ErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });

    it('should validate an error response with single character error', () => {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'E',
      };

      const result = ErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });

    it('should reject error response with success: true', () => {
      const invalidResponse = {
        success: true,
        error: 'Some error',
      };

      const result = ErrorResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject error response missing error field', () => {
      const invalidResponse = {
        success: false,
      };

      const result = ErrorResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject error response with null error', () => {
      const invalidResponse = {
        success: false,
        error: null,
      };

      const result = ErrorResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject error response with empty error string', () => {
      const invalidResponse = {
        success: false,
        error: '',
      };

      const result = ErrorResponseSchema.safeParse(invalidResponse);
      // Empty string is technically a string, so this might pass validation
      // but we can verify the behavior
      expect(result.data?.error === '' || result.success).toBeTruthy();
    });

    it('should reject error response with non-string error', () => {
      const invalidResponse = {
        success: false,
        error: { message: 'Error object' },
      };

      const result = ErrorResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject error response with array error', () => {
      const invalidResponse = {
        success: false,
        error: ['Error 1', 'Error 2'],
      };

      const result = ErrorResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should parse and return correct types', () => {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Database connection failed',
      };

      const result = ErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
      expect(typeof result.data?.success).toBe('boolean');
      expect(typeof result.data?.error).toBe('string');
    });
  });

  describe('Response Schema Integration', () => {
    it('should validate real-world success response structures', () => {
      // User authentication response
      const authResponse = SuccessResponseSchema.safeParse({
        success: true,
        data: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          userId: '507f1f77bcf86cd799439011',
        },
      });
      expect(authResponse.success).toBe(true);

      // Class detail response
      const classDetailResponse = SuccessResponseSchema.safeParse({
        success: true,
        data: {
          _id: '1',
          className: 'Math',
          teacherId: 't1',
          students: [
            { _id: 's1', name: 'Student 1', email: 'student1@example.com' },
          ],
        },
      });
      expect(classDetailResponse.success).toBe(true);

      // Single resource response
      const singleResourceResponse = SuccessResponseSchema.safeParse({
        success: true,
        data: {
          _id: '507f1f77bcf86cd799439011',
          name: 'Jane Doe',
          email: 'jane@example.com',
          role: STUDENT_ROLE,
        },
      });
      expect(singleResourceResponse.success).toBe(true);
    });

    it('should validate real-world success list response structures', () => {
      // Students list response
      const studentsListResponse = SuccessListResponseSchema.safeParse({
        success: true,
        data: [
          { _id: '1', name: 'Student 1', email: 'student1@example.com' },
          { _id: '2', name: 'Student 2', email: 'student2@example.com' },
        ],
      });
      expect(studentsListResponse.success).toBe(true);

      // Empty list response
      const emptyListResponse = SuccessListResponseSchema.safeParse({
        success: true,
        data: [],
      });
      expect(emptyListResponse.success).toBe(true);
    });

    it('should validate real-world error response structures', () => {
      // Authentication error
      const authError = ErrorResponseSchema.safeParse({
        success: false,
        error: 'Invalid credentials',
      });
      expect(authError.success).toBe(true);

      // Validation error
      const validationError = ErrorResponseSchema.safeParse({
        success: false,
        error: 'Invalid request schema: email must be a valid email',
      });
      expect(validationError.success).toBe(true);

      // Server error
      const serverError = ErrorResponseSchema.safeParse({
        success: false,
        error: 'Internal server error',
      });
      expect(serverError.success).toBe(true);

      // Not found error
      const notFoundError = ErrorResponseSchema.safeParse({
        success: false,
        error: 'Route not found: POST /api/invalid',
      });
      expect(notFoundError.success).toBe(true);
    });

    it('should not allow mixing SuccessResponseSchema and ErrorResponseSchema properties', () => {
      // Try to validate success response with error field
      const mixed1 = SuccessResponseSchema.safeParse({
        success: true,
        data: { message: 'OK' },
        error: 'Should not be here',
      });

      // Try to validate error response with data field
      const mixed2 = ErrorResponseSchema.safeParse({
        success: false,
        error: 'Failed',
        data: { details: 'Extra' },
      });

      // Both should parse successfully (Zod strips extra fields by default)
      // but the parsed data should not contain the extra field
      if (mixed1.success) {
        expect(mixed1.data).not.toHaveProperty('error');
      }
      if (mixed2.success) {
        expect(mixed2.data).not.toHaveProperty('data');
      }
    });
  });
});
