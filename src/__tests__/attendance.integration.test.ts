import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import http from 'http';
import type { Server as HTTPServer } from 'http';
import { Types } from 'mongoose';
import { UserModel } from '../db-models/user.js';
import { ClassModel } from '../db-models/class.js';
import { AttendanceModel } from '../db-models/attendance.js';
import { createApp } from '../index.js';
import { connectDB, disconnectDB } from '../db.js';
import { generateJWT } from '../utils/jwt.js';
import type { SignupData, LoginData } from '../schemas/auth.js';
import { SignupSchema, LoginSchema } from '../schemas/auth.js';
import type { ClassIdBodyParam } from '../schemas/attendance.js';
import { ClassIdBodyParamSchema } from '../schemas/attendance.js';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';
import { testLog, clearLogs, printLogs, setTestName } from './utils/test-logger.js';

/**
 * Attendance API Integration Tests
 * 
 * Tests for:
 * - POST /attendance/start - Start attendance session
 * - GET /class/:id/my-attendance - Get student's attendance
 */

describe('Attendance Integration Tests', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let httpServer: HTTPServer;
  let baseURL: string;
  let teacherToken: string;
  let studentToken: string;
  let classId: string;
  let studentId: string;

  beforeAll(async () => {
    await connectDB();

    // Clean up test data only
    const testClasses = await ClassModel.find({ className: { $regex: 'Attendance Test' } });
    const testClassIds = testClasses.map(c => c._id);
    await UserModel.deleteMany({ email: { $regex: '^--test-attendance-' } });
    await ClassModel.deleteMany({ className: { $regex: 'Attendance Test' } });
    await AttendanceModel.deleteMany({ classId: { $in: testClassIds } });

    app = await createApp();
    httpServer = http.createServer(app);
    
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address !== 'string') {
          baseURL = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Clean up test data only
    const testClasses = await ClassModel.find({ className: { $regex: 'Attendance Test' } });
    const testClassIds = testClasses.map(c => c._id);
    await UserModel.deleteMany({ email: { $regex: '^--test-attendance-' } });
    await ClassModel.deleteMany({ className: { $regex: 'Attendance Test' } });
    await AttendanceModel.deleteMany({ classId: { $in: testClassIds } });

    await disconnectDB();

    // Close HTTP server
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        resolve();
      });
    });
  });

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

    // Clean up test data
    await UserModel.deleteMany({ email: { $regex: '^--test-attendance-' } });
    await ClassModel.deleteMany({ className: { $regex: 'Attendance Test' } });
    await AttendanceModel.deleteMany({});
  });

  describe('POST /attendance/start', () => {
    beforeEach(async () => {
      // Create teacher
      const teacherEmail = `--test-attendance-teacher-${Date.now()}@example.com`;
      const signupRes = await fetch(`${baseURL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Teacher',
          email: teacherEmail,
          password: 'password123',
          role: TEACHER_ROLE,
        }),
      });
      expect(signupRes.status).toBe(201);

      // Login to get token
      const loginRes = await fetch(`${baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: teacherEmail,
          password: 'password123',
        }),
      });
      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      teacherToken = loginData.data.token;

      // Create class
      const classRes = await fetch(`${baseURL}/class`, {
        method: 'POST',
        headers: {
          'Authorization': teacherToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ className: `Attendance Test Class ${Date.now()}` }),
      });
      expect(classRes.status).toBe(201);
      const classData = await classRes.json();
      classId = classData.data._id;
    });

    it('should start attendance session successfully', async () => {
      const res = await fetch(`${baseURL}/attendance/start`, {
        method: 'POST',
        headers: {
          'Authorization': teacherToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ classId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.classId).toBe(classId);
      expect(data.data.startedAt).toBeDefined();
    });

    it('should reject request without authentication', async () => {
      const res = await fetch(`${baseURL}/attendance/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unauthorized');
    });

    it('should reject request from non-teacher', async () => {
      // Create student
      const studentEmail = `--test-attendance-student-${Date.now()}@example.com`;
      const studentSignupRes = await fetch(`${baseURL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Student',
          email: studentEmail,
          password: 'password123',
          role: STUDENT_ROLE,
        }),
      });
      expect(studentSignupRes.status).toBe(201);

      // Login to get token
      const studentLoginRes = await fetch(`${baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: studentEmail,
          password: 'password123',
        }),
      });
      expect(studentLoginRes.status).toBe(200);
      const studentLoginData = await studentLoginRes.json();
      const studentToken = studentLoginData.data.token;

      const res = await fetch(`${baseURL}/attendance/start`, {
        method: 'POST',
        headers: {
          'Authorization': studentToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ classId }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('teacher');
    });

    it('should reject if teacher does not own the class', async () => {
      // Create another teacher
      const otherTeacherEmail = `--test-attendance-other-${Date.now()}@example.com`;
      const otherTeacherSignupRes = await fetch(`${baseURL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Other Teacher',
          email: otherTeacherEmail,
          password: 'password123',
          role: TEACHER_ROLE,
        }),
      });
      expect(otherTeacherSignupRes.status).toBe(201);

      // Login to get token
      const otherTeacherLoginRes = await fetch(`${baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: otherTeacherEmail,
          password: 'password123',
        }),
      });
      expect(otherTeacherLoginRes.status).toBe(200);
      const otherTeacherLoginData = await otherTeacherLoginRes.json();
      const otherTeacherToken = otherTeacherLoginData.data.token;

      const res = await fetch(`${baseURL}/attendance/start`, {
        method: 'POST',
        headers: {
          'Authorization': otherTeacherToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ classId }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not class teacher');
    });

    it('should reject if class does not exist', async () => {
      const fakeClassId = '507f1f77bcf86cd799439011';

      const res = await fetch(`${baseURL}/attendance/start`, {
        method: 'POST',
        headers: {
          'Authorization': teacherToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ classId: fakeClassId }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Class not found');
    });

    it('should reject invalid class ID format', async () => {
      const res = await fetch(`${baseURL}/attendance/start`, {
        method: 'POST',
        headers: {
          'Authorization': teacherToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ classId: 'invalid-id' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('GET /class/:id/my-attendance', () => {
    beforeEach(async () => {
      // Create teacher
      const teacherEmail = `--test-attendance-teacher-${Date.now()}@example.com`;
      const teacherSignupRes = await fetch(`${baseURL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Teacher',
          email: teacherEmail,
          password: 'password123',
          role: TEACHER_ROLE,
        }),
      });
      expect(teacherSignupRes.status).toBe(201);

      // Login teacher to get token
      const teacherLoginRes = await fetch(`${baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: teacherEmail,
          password: 'password123',
        }),
      });
      expect(teacherLoginRes.status).toBe(200);
      const teacherLoginData = await teacherLoginRes.json();
      teacherToken = teacherLoginData.data.token;

      // Create student
      const studentEmail = `--test-attendance-student-${Date.now()}@example.com`;
      const studentSignupRes = await fetch(`${baseURL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Student',
          email: studentEmail,
          password: 'password123',
          role: STUDENT_ROLE,
        }),
      });
      expect(studentSignupRes.status).toBe(201);
      const studentSignupData = await studentSignupRes.json();
      studentId = studentSignupData.data._id;

      // Login student to get token
      const studentLoginRes = await fetch(`${baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: studentEmail,
          password: 'password123',
        }),
      });
      expect(studentLoginRes.status).toBe(200);
      const studentLoginData = await studentLoginRes.json();
      studentToken = studentLoginData.data.token;

      // Create class
      const classRes = await fetch(`${baseURL}/class`, {
        method: 'POST',
        headers: {
          'Authorization': teacherToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ className: `Attendance Test Class ${Date.now()}` }),
      });
      expect(classRes.status).toBe(201);
      const classData = await classRes.json();
      classId = classData.data._id;

      // Add student to class
      const addRes = await fetch(`${baseURL}/class/${classId}/add-student`, {
        method: 'POST',
        headers: {
          'Authorization': teacherToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId }),
      });
      expect(addRes.status).toBe(200);
    });

    it('should return "not found" when no attendance record exists', async () => {
      const res = await fetch(`${baseURL}/class/${classId}/my-attendance`, {
        headers: { 'Authorization': studentToken },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should return attendance status when record exists', async () => {
      // Create attendance record
      await AttendanceModel.create({
        classId: new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
        status: 'present',
      });

      const res = await fetch(`${baseURL}/class/${classId}/my-attendance`, {
        headers: { 'Authorization': studentToken },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('present');
    });

    it('should reject request without authentication', async () => {
      const res = await fetch(`${baseURL}/class/${classId}/my-attendance`);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject if student not enrolled in class', async () => {
      // Create another student not enrolled
      const otherStudentEmail = `--test-attendance-other-student-${Date.now()}@example.com`;
      const otherStudentSignupRes = await fetch(`${baseURL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Other Student',
          email: otherStudentEmail,
          password: 'password123',
          role: STUDENT_ROLE,
        }),
      });
      expect(otherStudentSignupRes.status).toBe(201);

      // Login to get token
      const otherStudentLoginRes = await fetch(`${baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: otherStudentEmail,
          password: 'password123',
        }),
      });
      expect(otherStudentLoginRes.status).toBe(200);
      const otherStudentLoginData = await otherStudentLoginRes.json();
      const otherStudentToken = otherStudentLoginData.data.token;

      const res = await fetch(`${baseURL}/class/${classId}/my-attendance`, {
        headers: { 'Authorization': otherStudentToken },
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not enrolled');
    });

    it('should reject if class does not exist', async () => {
      const fakeClassId = '507f1f77bcf86cd799439011';

      const res = await fetch(`${baseURL}/class/${fakeClassId}/my-attendance`, {
        headers: { 'Authorization': studentToken },
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Class not found');
    });

    it('should reject invalid class ID format', async () => {
      const res = await fetch(`${baseURL}/class/invalid-id/my-attendance`, {
        headers: { 'Authorization': studentToken },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('Attendance Schema Validation', () => {
    it('should validate correct ClassIdBodyParam', () => {
      const validData = { classId: '507f1f77bcf86cd799439011' };
      const result = ClassIdBodyParamSchema.safeParse(validData);

      expect(result.success).toBe(true);
      expect(result.data?.classId).toBe('507f1f77bcf86cd799439011');
    });

    it('should reject invalid ObjectId format', () => {
      const invalidData = { classId: 'invalid-id' };
      const result = ClassIdBodyParamSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('should reject empty classId', () => {
      const invalidData = { classId: '' };
      const result = ClassIdBodyParamSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });
  });
});
