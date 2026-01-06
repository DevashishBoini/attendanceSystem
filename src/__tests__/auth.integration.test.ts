import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../db-models/user.js';
import { createApp } from '../index.js';
import { connectDB, disconnectDB } from '../db.js';
import type { SignupData, LoginData } from '../schemas/auth.js';
import { SignupSchema, LoginSchema } from '../schemas/auth.js';
import type { JWTDecoded } from '../schemas/jwt.js';
import { verifyJWT } from '../utils/jwt.js';
import config from '../config.js';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';
import { testLog, clearLogs, printLogs, setTestName } from './utils/test-logger.js';

// Authentication API Integration Tests

// Helper function to create typed signup data
function createSignupData(email?: string, overrides?: Partial<SignupData>): SignupData {
  const defaultData: SignupData = {
    name: 'John Doe',
    email: email || `--test-${Date.now()}@example.com`,
    password: 'password123',
    role: TEACHER_ROLE,
  };
  const data = { ...defaultData, ...overrides };
  return SignupSchema.parse(data);
}

// Helper function to create typed login data
function createLoginData(email?: string, overrides?: Partial<LoginData>): LoginData {
  const defaultData: LoginData = {
    email: email || `--test-${Date.now()}@example.com`,
    password: 'password123',
  };
  const data = { ...defaultData, ...overrides };
  return LoginSchema.parse(data);
}

// Helper function to clean up test data
async function cleanupTestData(): Promise<void> {
  await UserModel.deleteMany({ email: { $regex: '^--test-' } });
}

// Helper function to create intentionally invalid signup data for testing validation
interface InvalidSignupOverrides {
  email?: unknown;
  password?: unknown;
  role?: unknown;
  name?: unknown;
}

function createInvalidSignupData(overrides?: InvalidSignupOverrides): Record<string, unknown> {
  const baseData: Record<string, unknown> = {
    name: 'John Doe',
    email: `--test-${Date.now()}@example.com`,
    password: 'password123',
    role: TEACHER_ROLE,
  };

  const defaultInvalidValues: InvalidSignupOverrides = {
    name: 'Jack Wills',
    email: '--test-invalid-email',
    password: 'pass',
    role: 'admin',
  };

  const invalidValues = { ...defaultInvalidValues, ...overrides };
  return { ...baseData, ...invalidValues };
}

// Helper function to create intentionally invalid login data for testing validation
interface InvalidLoginOverrides {
  email?: unknown;
  password?: unknown;
}

function createInvalidLoginData(overrides?: InvalidLoginOverrides): Record<string, unknown> {
  const baseData: Record<string, unknown> = {
    email: `--test-${Date.now()}@example.com`,
    password: 'password123',
  };

  const defaultInvalidValues: InvalidLoginOverrides = {
    email: '--test-invalid-email',
    password: 'wrongpassword',
  };

  const invalidValues = { ...defaultInvalidValues, ...overrides };
  return { ...baseData, ...invalidValues };
}

describe('Authentication API Integration Tests', () => {
  let app: Express;
  let testUserEmail = `--test-${Date.now()}@example.com`;
  let authToken = '';
  let testUserId = '';

  beforeAll(async () => {
    // Connect to database and create app
    await connectDB();
    app = await createApp();
  });

  beforeEach(async () => {
    clearLogs();
    // Clean up test data before each test
    await cleanupTestData();
  });

  afterEach(async (context) => {
    // Print logs only if test failed
    if (context.task.result?.state === 'fail' || context.task.result?.errors?.length) {
      setTestName(context.task.name);
      printLogs();
    }
    clearLogs();
  });

  afterAll(async () => {
    // Clean up and close connections
    try {
      await cleanupTestData();
      await disconnectDB();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('POST /auth/signup', () => {
    it('should successfully create a new user', async () => {
      const signupData = createSignupData(testUserEmail);
      const response = await request(app)
        .post('/auth/signup')
        .send(signupData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.email).toBe(testUserEmail);
      expect(response.body.data.role).toBe(TEACHER_ROLE);
      expect(response.body.data).not.toHaveProperty('password');

      testUserId = response.body.data._id as string;
    });

    it('should return 400 for invalid email format', async () => {
      const signupData = createInvalidSignupData({ email: 'invalid-email' });
      const response = await request(app)
        .post('/auth/signup')
        .send(signupData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid request schema');
    });

    it('should return 400 for password less than 6 characters', async () => {
      const signupData = createInvalidSignupData({ password: 'pass' });
      const response = await request(app)
        .post('/auth/signup')
        .send(signupData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid request schema');
    });

    it('should return 400 if email already exists', async () => {
      // Setup: Create first user with TEACHER role
      const signupDataTeacher = createSignupData(testUserEmail);
      const firstResponse = await request(app)
        .post('/auth/signup')
        .send(signupDataTeacher);

      // Verify first user creation succeeded
      expect(firstResponse.status).toBe(201);
      expect(firstResponse.body.success).toBe(true);

      // Case 1: Try to create another user with EXACT SAME DATA (email, name, password, role)
      const identicalSignupData = createSignupData(testUserEmail);
      const response1 = await request(app)
        .post('/auth/signup')
        .send(identicalSignupData);

      expect(response1.status).toBe(400);
      expect(response1.body.success).toBe(false);
      expect(response1.body.error).toBe('Email already exists');

      // Case 2: Try to create another user with SAME EMAIL but DIFFERENT ROLE
      const signupDataStudent = createSignupData(testUserEmail, { name: 'Jane Doe', password: 'password456', role: STUDENT_ROLE });
      const response2 = await request(app)
        .post('/auth/signup')
        .send(signupDataStudent);

      expect(response2.status).toBe(400);
      expect(response2.body.success).toBe(false);
      expect(response2.body.error).toBe('Email already exists');

      // Case 3: Try to create another user with SAME EMAIL and SAME ROLE (but different name/password)
      const signupDataDuplicate = createSignupData(testUserEmail, { name: 'Different Name', password: 'differentPassword123', role: TEACHER_ROLE });
      const response3 = await request(app)
        .post('/auth/signup')
        .send(signupDataDuplicate);

      expect(response3.status).toBe(400);
      expect(response3.body.success).toBe(false);
      expect(response3.body.error).toBe('Email already exists');
    });

    it('should return 400 for invalid role', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send(createInvalidSignupData({ role: 'admin' }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid request schema');
    });

    it('should hash password before storing', async () => {
      const password = 'testPassword123';
      const signupData = createSignupData(testUserEmail, { password });
      
      await request(app)
        .post('/auth/signup')
        .send(signupData);

      const user = await UserModel.findOne({ email: testUserEmail }).select('+password');
      
      expect(user?.password).not.toBe(password);
      expect(user?.password).toBeTruthy();
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a test user before login tests
      const signupData = createSignupData(testUserEmail);
      await request(app)
        .post('/auth/signup')
        .send(signupData);
    });

    it('should successfully login and return JWT token', async () => {
      const loginData = createLoginData(testUserEmail);
      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(typeof response.body.data.token).toBe('string');

      authToken = response.body.data.token;
    });

    it('should return 401 for invalid email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send(createLoginData('--test-nonexistent@example.com'));

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should return 401 for incorrect password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send(createInvalidLoginData({ email: testUserEmail, password: 'wrongpassword' }));

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send(createInvalidLoginData({ email: '--test-invalid-email' }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid request schema');
    });

    it('should return valid JWT token with user data', async () => {
      const loginData = createLoginData(testUserEmail);
      const loginResponse = await request(app)
        .post('/auth/login')
        .send(loginData);

      const token = loginResponse.body.data.token;
      const decoded = verifyJWT(token);
      
      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBeTruthy();
      expect(decoded?.role).toBe(TEACHER_ROLE);
    });
  });

  describe('GET /auth/me', () => {
    beforeEach(async () => {
      // Create user and get token
      const signupData = createSignupData(testUserEmail);
      const signupResponse = await request(app)
        .post('/auth/signup')
        .send(signupData);

      testUserId = signupResponse.body.data._id;

      const loginData = createLoginData(testUserEmail);
      const loginResponse = await request(app)
        .post('/auth/login')
        .send(loginData);

      authToken = loginResponse.body.data.token;
    });

    it('should return user data when authenticated', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data._id).toBe(testUserId);
      expect(response.body.data.email).toBe(testUserEmail);
      expect(response.body.data.role).toBe(TEACHER_ROLE);
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should return 401 when Authorization header is missing', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should return 401 for expired token', async () => {
      // Create a token that expired 1 second ago (valid signature, but past expiration)
      const expiredToken = jwt.sign(
        { userId: 'test-id', role: TEACHER_ROLE },
        config.JWT_SECRET_KEY,
        { expiresIn: '-1s' }
      );

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', expiredToken);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('End-to-End Flow', () => {
    it('should complete full auth flow: signup -> login -> access protected route', async () => {
      // 1. Signup
      const signupData = createSignupData(testUserEmail, { name: 'Complete Flow Test', password: 'securePassword123', role: STUDENT_ROLE });
      const signupResponse = await request(app)
        .post('/auth/signup')
        .send(signupData);

      expect(signupResponse.status).toBe(201);
      expect(signupResponse.body.success).toBe(true);
      const userId = signupResponse.body.data._id;

      // 2. Login
      const loginData = createLoginData(testUserEmail, { password: 'securePassword123' });
      const loginResponse = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      const token = loginResponse.body.data.token;

      // 3. Access protected route with token
      const meResponse = await request(app)
        .get('/auth/me')
        .set('Authorization', token);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.success).toBe(true);
      expect(meResponse.body.data._id).toBe(userId);
      expect(meResponse.body.data.email).toBe(testUserEmail);
      expect(meResponse.body.data.role).toBe(STUDENT_ROLE);
    });

    it('should return 404 if authenticated user is deleted from database', async () => {
      // 1. Create user and get token
      const testUserEmail = `--test-${Date.now()}-deleted@example.com`;
      const signupData = createSignupData(testUserEmail, { role: STUDENT_ROLE, password: 'password123' });
      const signupResponse = await request(app)
        .post('/auth/signup')
        .send(signupData);

      expect(signupResponse.status).toBe(201);
      const userId = signupResponse.body.data._id;

      const loginData = createLoginData(testUserEmail);
      const loginResponse = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(loginResponse.status).toBe(200);
      const token = loginResponse.body.data.token;

      // 2. Delete user from database (but token is still valid)
      await UserModel.findByIdAndDelete(userId);

      // 3. Try to access /auth/me with valid token but deleted user
      const meResponse = await request(app)
        .get('/auth/me')
        .set('Authorization', token);

      expect(meResponse.status).toBe(404);
      expect(meResponse.body.success).toBe(false);
      expect(meResponse.body.error).toBe('User not found');
    });
  });
});
