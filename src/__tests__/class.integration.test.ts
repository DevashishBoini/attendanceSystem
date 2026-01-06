import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { UserModel } from '../db-models/user.js';
import { ClassModel } from '../db-models/class.js';
import { createApp } from '../index.js';
import { connectDB, disconnectDB } from '../db.js';
import type { SignupData, LoginData } from '../schemas/auth.js';
import { SignupSchema, LoginSchema } from '../schemas/auth.js';
import type { RegisterClassNameData, ClassIdParam, StudentIdParam } from '../schemas/class.js';
import { RegisterClassNameSchema, ClassIdParamSchema, StudentIdParamSchema } from '../schemas/class.js';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';
import { testLog, clearLogs, printLogs, setTestName } from './utils/test-logger.js';

// Class API Integration Tests

// Helper to create signup data
function createSignupData(email?: string, overrides?: Partial<SignupData>): SignupData {
  const defaultData: SignupData = {
    name: '--Test User',
    email: email || `--test-${Date.now()}@example.com`,
    password: 'password123',
    role: TEACHER_ROLE,
  };
  const data = { ...defaultData, ...overrides };
  return SignupSchema.parse(data);
}

// Helper to create login data
function createLoginData(email?: string, overrides?: Partial<LoginData>): LoginData {
  const defaultData: LoginData = {
    email: email || `--test-${Date.now()}@example.com`,
    password: 'password123',
  };
  const data = { ...defaultData, ...overrides };
  return LoginSchema.parse(data);
}

// Helper to create class data
function createClassData(overrides?: Partial<RegisterClassNameData>): RegisterClassNameData {
  const defaultData: RegisterClassNameData = {
    className: `--Test Class ${Date.now()}`,
  };
  const data = { ...defaultData, ...overrides };
  return RegisterClassNameSchema.parse(data);
}

// Helper to cleanup test data
async function cleanupTestData(): Promise<void> {
  await UserModel.deleteMany({ email: { $regex: '^--test-' } });
  await ClassModel.deleteMany({ className: { $regex: '--Test Class' } });
}

describe('Class API Integration Tests', () => {
  let app: Express;
  let teacherEmail = `--test-teacher-${Date.now()}@example.com`;
  let studentEmail1 = `--test-student-${Date.now()}-1@example.com`;
  let studentEmail2 = `--test-student-${Date.now()}-2@example.com`;
  let teacherToken = '';
  let studentToken1 = '';
  let studentToken2 = '';
  let teacherId = '';
  let studentId1 = '';
  let studentId2 = '';
  let classId = '';

  beforeAll(async () => {
    await connectDB();
    app = await createApp();

    // Create teacher user
    const teacherSignup = createSignupData(teacherEmail, { role: TEACHER_ROLE });
    const teacherSignupRes = await request(app)
      .post('/auth/signup')
      .send(teacherSignup);
    teacherId = teacherSignupRes.body.data._id;

    const teacherLogin = createLoginData(teacherEmail);
    const teacherLoginRes = await request(app)
      .post('/auth/login')
      .send(teacherLogin);
    teacherToken = teacherLoginRes.body.data.token;

    // Create first student user
    const studentSignup1 = createSignupData(studentEmail1, { role: STUDENT_ROLE, name: 'Student One' });
    const studentSignupRes1 = await request(app)
      .post('/auth/signup')
      .send(studentSignup1);
    studentId1 = studentSignupRes1.body.data._id;

    const studentLogin1 = createLoginData(studentEmail1);
    const studentLoginRes1 = await request(app)
      .post('/auth/login')
      .send(studentLogin1);
    studentToken1 = studentLoginRes1.body.data.token;

    // Create second student user
    const studentSignup2 = createSignupData(studentEmail2, { role: STUDENT_ROLE, name: 'Student Two' });
    const studentSignupRes2 = await request(app)
      .post('/auth/signup')
      .send(studentSignup2);
    studentId2 = studentSignupRes2.body.data._id;

    const studentLogin2 = createLoginData(studentEmail2);
    const studentLoginRes2 = await request(app)
      .post('/auth/login')
      .send(studentLogin2);
    studentToken2 = studentLoginRes2.body.data.token;
  });

  afterEach(async (context) => {
    // Print logs only if test failed
    if (context.task.result?.state === 'fail' || context.task.result?.errors?.length) {
      setTestName(context.task.name);
      printLogs();
    }
    clearLogs();
    // Clean up classes after each test
    await ClassModel.deleteMany({ className: { $regex: '--Test Class' } });
  });

  afterAll(async () => {
    try {
      await cleanupTestData();
      await disconnectDB();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('POST /class - Create Class', () => {
    it('should create a new class when teacher is authenticated', async () => {
      const classData = createClassData({ className: `Physics 101 ${Date.now()}` });
      const response = await request(app)
        .post('/class')
        .set('Authorization', teacherToken)
        .send(classData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.className).toBe(classData.className);
      expect(response.body.data.teacherId).toBe(teacherId);
      expect(Array.isArray(response.body.data.studentIds)).toBe(true);
      expect(response.body.data.studentIds.length).toBe(0);

      classId = response.body.data._id;
    });

    it('should return 401 if teacher is not authenticated', async () => {
      const classData = createClassData();
      const response = await request(app)
        .post('/class')
        .send(classData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should return 403 if student tries to create a class', async () => {
      const classData = createClassData();
      const response = await request(app)
        .post('/class')
        .set('Authorization', studentToken1)
        .send(classData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Forbidden');
    });

    it('should return 400 if class name is missing', async () => {
      const response = await request(app)
        .post('/class')
        .set('Authorization', teacherToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if class name is empty string', async () => {
      const response = await request(app)
        .post('/class')
        .set('Authorization', teacherToken)
        .send({ className: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /class/:id/add-student - Add Student to Class', () => {
    beforeEach(async () => {
      // Create a class for each test
      const classData = createClassData({ className: `Math 101 ${Date.now()}` });
      const classResponse = await request(app)
        .post('/class')
        .set('Authorization', teacherToken)
        .send(classData);
      classId = classResponse.body.data._id;
    });

    it('should add a student to the class', async () => {
      const response = await request(app)
        .post(`/class/${classId}/add-student`)
        .set('Authorization', teacherToken)
        .send({ studentId: studentId1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.studentIds).toContain(studentId1);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post(`/class/${classId}/add-student`)
        .send({ studentId: studentId1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 if student tries to add another student', async () => {
      const response = await request(app)
        .post(`/class/${classId}/add-student`)
        .set('Authorization', studentToken1)
        .send({ studentId: studentId2 });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 if teacher tries to add student to another teacher\'s class', async () => {
      // Create another teacher
      const otherTeacherEmail = `--test-teacher-${Date.now()}-2@example.com`;
      const otherTeacherSignup = createSignupData(otherTeacherEmail, { role: TEACHER_ROLE });
      await request(app)
        .post('/auth/signup')
        .send(otherTeacherSignup);

      const otherTeacherLogin = createLoginData(otherTeacherEmail);
      const otherTeacherLoginRes = await request(app)
        .post('/auth/login')
        .send(otherTeacherLogin);
      const otherTeacherToken = otherTeacherLoginRes.body.data.token;

      const response = await request(app)
        .post(`/class/${classId}/add-student`)
        .set('Authorization', otherTeacherToken)
        .send({ studentId: studentId1 });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Forbidden, not class teacher');
    });

    it('should return 404 if class does not exist', async () => {
      const fakeClassId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .post(`/class/${fakeClassId}/add-student`)
        .set('Authorization', teacherToken)
        .send({ studentId: studentId1 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Class not found');
    });

    it('should return 404 if student does not exist', async () => {
      const fakeStudentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .post(`/class/${classId}/add-student`)
        .set('Authorization', teacherToken)
        .send({ studentId: fakeStudentId });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Student not found');
    });

    it('should return 404 if userId does not belong to a student', async () => {
      const response = await request(app)
        .post(`/class/${classId}/add-student`)
        .set('Authorization', teacherToken)
        .send({ studentId: teacherId });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Student not found');
    });

    it('should return 409 if student is already enrolled', async () => {
      // Add student first time
      await request(app)
        .post(`/class/${classId}/add-student`)
        .set('Authorization', teacherToken)
        .send({ studentId: studentId1 });

      // Try to add same student again
      const response = await request(app)
        .post(`/class/${classId}/add-student`)
        .set('Authorization', teacherToken)
        .send({ studentId: studentId1 });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Student already enrolled in class');
    });

    it('should allow adding multiple different students', async () => {
      // Add first student
      const response1 = await request(app)
        .post(`/class/${classId}/add-student`)
        .set('Authorization', teacherToken)
        .send({ studentId: studentId1 });

      expect(response1.status).toBe(200);
      expect(response1.body.data.studentIds).toContain(studentId1);

      // Add second student
      const response2 = await request(app)
        .post(`/class/${classId}/add-student`)
        .set('Authorization', teacherToken)
        .send({ studentId: studentId2 });

      expect(response2.status).toBe(200);
      expect(response2.body.data.studentIds).toContain(studentId1);
      expect(response2.body.data.studentIds).toContain(studentId2);
      expect(response2.body.data.studentIds.length).toBe(2);
    });

    it('should return 400 if studentId is missing', async () => {
      const response = await request(app)
        .post(`/class/${classId}/add-student`)
        .set('Authorization', teacherToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /class/:id - Get Class Details', () => {
    beforeEach(async () => {
      // Create a class for each test
      const classData = createClassData({ className: `History 101 ${Date.now()}` });
      const classResponse = await request(app)
        .post('/class')
        .set('Authorization', teacherToken)
        .send(classData);
      classId = classResponse.body.data._id;
    });

    it('should return class details for authorized teacher', async () => {
      const response = await request(app)
        .get(`/class/${classId}`)
        .set('Authorization', teacherToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(classId);
      expect(response.body.data.teacherId).toBe(teacherId);
      expect(Array.isArray(response.body.data.students)).toBe(true);
      expect(response.body.data.students.length).toBe(0);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get(`/class/${classId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 if student is not enrolled in the class', async () => {
      const response = await request(app)
        .get(`/class/${classId}`)
        .set('Authorization', studentToken1);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden, student not enrolled in class');
    });

    it('should return 403 if teacher is not the class owner', async () => {
      // Create another teacher
      const otherTeacherEmail = `--test-teacher-${Date.now()}-3@example.com`;
      const otherTeacherSignup = createSignupData(otherTeacherEmail, { role: TEACHER_ROLE });
      await request(app)
        .post('/auth/signup')
        .send(otherTeacherSignup);

      const otherTeacherLogin = createLoginData(otherTeacherEmail);
      const otherTeacherLoginRes = await request(app)
        .post('/auth/login')
        .send(otherTeacherLogin);
      const otherTeacherToken = otherTeacherLoginRes.body.data.token;

      const response = await request(app)
        .get(`/class/${classId}`)
        .set('Authorization', otherTeacherToken);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden, not class teacher');
    });

    it('should return 404 if class does not exist', async () => {
      const fakeClassId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/class/${fakeClassId}`)
        .set('Authorization', teacherToken);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Class not found');
    });

    it('should allow enrolled student to view class', async () => {
      // Add student to class
      await request(app)
        .post(`/class/${classId}/add-student`)
        .set('Authorization', teacherToken)
        .send({ studentId: studentId1 });

      // Student should now be able to view
      const response = await request(app)
        .get(`/class/${classId}`)
        .set('Authorization', studentToken1);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(classId);
      expect(Array.isArray(response.body.data.students)).toBe(true);
      expect(response.body.data.students.length).toBe(1);
      expect(response.body.data.students[0]._id).toBe(studentId1);
      expect(response.body.data.students[0]).toHaveProperty('name');
      expect(response.body.data.students[0]).toHaveProperty('email');
    });
  });

  describe('GET /students - Get All Students', () => {
    it('should return all students when teacher is authenticated', async () => {
      const response = await request(app)
        .get('/students')
        .set('Authorization', teacherToken);


      testLog('response.body',response.body);
      testLog('response.status',response.status)
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);

      // Verify student data structure
      const student = response.body.data.find((s: any) => s._id === studentId1);
      expect(student).toBeDefined();
      expect(student).toHaveProperty('_id');
      expect(student).toHaveProperty('name');
      expect(student).toHaveProperty('email');
      expect(student).not.toHaveProperty('password');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get('/students');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 if student tries to access', async () => {
      const response = await request(app)
        .get('/students')
        .set('Authorization', studentToken1);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Forbidden');
    });
  });

  describe('Error Handling - Invalid ObjectIds', () => {
    it('should return 400 for invalid class ID format in GET /class/:id', async () => {
      const response = await request(app)
        .get('/class/invalid-object-id')
        .set('Authorization', teacherToken);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid request schema');
    });

    it('should return 400 for invalid class ID in POST /class/:id/add-student', async () => {
      const response = await request(app)
        .post('/class/not-a-valid-id/add-student')
        .set('Authorization', teacherToken)
        .send({ studentId: studentId1 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid request schema');
    });
  });
});
