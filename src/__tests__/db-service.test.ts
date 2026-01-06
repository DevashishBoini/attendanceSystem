import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { connectDB, disconnectDB } from '../db.js';
import { dbService } from '../utils/db.js';
import { UserModel } from '../db-models/user.js';
import { ClassModel } from '../db-models/class.js';
import { Types } from 'mongoose';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';
import { testLog, clearLogs, printLogs, setTestName } from './utils/test-logger.js';
import test from 'node:test';

describe('DBService Unit Tests', () => {
  beforeEach(() => {
    clearLogs();
  });

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });


  afterEach(async (context) => {
    // Print logs only if test failed
    if (context.task.result?.state === 'fail' || context.task.result?.errors?.length) {
      setTestName(context.task.name);
      printLogs();
    }
    clearLogs();
    
    // Clean up test data after each test
    await UserModel.deleteMany({ email: { $regex: '^--test-dbservice-' } });
    await ClassModel.deleteMany({ className: { $regex: 'Test Class' } });
  });

  describe('getUserById', () => {
    it('should retrieve a user by ID', async () => {
      // Create a test user
      const userData = {
        name: 'Test User',
        email: `--test-dbservice-${Date.now()}@example.com`,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      };
      const createdUser = await UserModel.create(userData);

      // Retrieve the user
      const user = await dbService.getUserById(createdUser._id.toString());

      expect(user).toBeDefined();
      expect(user?._id.toString()).toBe(createdUser._id.toString());
      expect(user?.email).toBe(userData.email);
      expect(user?.name).toBe(userData.name);
      expect(user?.role).toBe(userData.role);
    });

    it('should return null for non-existent user', async () => {
      const fakeId = new Types.ObjectId().toString();
      const user = await dbService.getUserById(fakeId);

      expect(user).toBeNull();
    });

    // it('[DEMO TEST] intentionally fails to show logging', async () => {
    //   testLog('This test is intentionally failing to demonstrate logging');
    //   testLog('Log data captured', { timestamp: Date.now(), message: 'Check console for TEST LOGS output' });
      
    //   expect(1).toBe(2); // This will fail
    // });

    it('should handle invalid ObjectId format gracefully', async () => {
      const user = await dbService.getUserById('invalid-id');

      expect(user).toBeNull();
    });

    it('should retrieve user with password field excluded by default', async () => {
      const password = 'mySecretPassword123';
      const userData = {
        name: 'Password Test User',
        email: `--test-dbservice-${Date.now()}-pw@example.com`,
        password,
        role: TEACHER_ROLE,
      };
      const createdUser = await UserModel.create(userData);

      const user = await dbService.getUserById(createdUser._id.toString());

      expect(user?.password).toBeUndefined();
    });
  });

  describe('getUserByEmail', () => {
    it('should retrieve a user by email without password', async () => {
      const testEmail = `--test-dbservice-${Date.now()}@example.com`;
      const userData = {
        name: 'Email Test User',
        email: testEmail,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      };
      await UserModel.create(userData);

      const user = await dbService.getUserByEmail(testEmail);

      expect(user).toBeDefined();
      expect(user?.email).toBe(testEmail);
      expect(user?.password).toBeUndefined();
    });

    it('should retrieve a user by email with password when requested', async () => {
      const testEmail = `--test-dbservice-${Date.now()}-pwd@example.com`;
      const password = 'hashedSecurePassword123';
      const userData = {
        name: 'Password Retrieval User',
        email: testEmail,
        password,
        role: TEACHER_ROLE,
      };
      await UserModel.create(userData);

      const user = await dbService.getUserByEmail(testEmail, true);

      expect(user).toBeDefined();
      expect(user?.email).toBe(testEmail);
      expect(user?.password).toBe(password);
    });

    it('should return null for non-existent email', async () => {
      const user = await dbService.getUserByEmail('nonexistent@example.com');

      expect(user).toBeNull();
    });

    it('should handle email case sensitivity correctly', async () => {
      const testEmail = `--test-dbservice-${Date.now()}-case@example.com`;
      const userData = {
        name: 'Case Test User',
        email: testEmail,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      };

      await UserModel.create(userData);

      const upperCaseEmail = testEmail.toUpperCase();

      // MongoDB email queries are case-insensitive by default
      const user = await dbService.getUserByEmail(upperCaseEmail);

      // Should find the user because email queries are case-insensitive
      expect(user).not.toBeNull();
      expect(user?.email).toBe(testEmail.toLowerCase());

    });
  });

  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      const testEmail = `--test-dbservice-${Date.now()}-create@example.com`;
      const userData = {
        name: 'New User',
        email: testEmail,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      };

      const createdUser = await dbService.createUser(userData);

      expect(createdUser).toBeDefined();
      expect(createdUser?._id).toBeDefined();
      expect(createdUser?.name).toBe(userData.name);
      expect(createdUser?.email).toBe(userData.email);
      expect(createdUser?.role).toBe(userData.role);
    });

    it('should return null if creation fails (duplicate email)', async () => {
      const testEmail = `--test-dbservice-${Date.now()}-dup@example.com`;
      const userData = {
        name: 'First User',
        email: testEmail,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      };

      // Create first user
      await dbService.createUser(userData);

      // Try to create duplicate
      const duplicateResult = await dbService.createUser(userData);

      expect(duplicateResult).toBeNull();
    });

    it('should create users with both roles', async () => {
      const teacherEmail = `--test-dbservice-${Date.now()}-teacher@example.com`;
      const studentEmail = `--test-dbservice-${Date.now()}-student@example.com`;

      const teacherData = {
        name: 'Teacher User',
        email: teacherEmail,
        password: 'plainPassword123',
        role: TEACHER_ROLE,
      };

      const studentData = {
        name: 'Student User',
        email: studentEmail,
        password: 'plainPassword123',
        role: STUDENT_ROLE,
      };

      const teacher = await dbService.createUser(teacherData);
      const student = await dbService.createUser(studentData);

      expect(teacher?.role).toBe(TEACHER_ROLE);
      expect(student?.role).toBe(STUDENT_ROLE);
    });

    it('should hash password when creating user', async () => {
      const testEmail = `--test-dbservice-${Date.now()}-hash@example.com`;
      const plainPassword = 'plainTextPassword123';
      const userData = {
        name: 'Hash Test User',
        email: testEmail,
        password: plainPassword,
        role: STUDENT_ROLE,
      };

      const createdUser = await dbService.createUser(userData);

      expect(createdUser).toBeDefined();
      
      // Fetch user with password to verify it was hashed
      const userWithPassword = await dbService.getUserByEmail(testEmail, true);
      
      expect(userWithPassword?.password).not.toBe(plainPassword);
      expect(userWithPassword?.password.length).toBeGreaterThan(plainPassword.length);
      
      // Verify the hashed password can be compared correctly
      const isMatch = await userWithPassword!.comparePassword(plainPassword);
      expect(isMatch).toBe(true);
    });
  });

  describe('createClass', () => {
    it('should create a new class with valid data', async () => {
      // Create a teacher first
      const teacherEmail = `--test-dbservice-${Date.now()}-teacher-class@example.com`;
      const teacherData = {
        name: 'Class Teacher',
        email: teacherEmail,
        password: 'hashedPassword123',
        role: TEACHER_ROLE,
      };
      const teacher = await dbService.createUser(teacherData);

      const classData = {
        className: `Test Class ${Date.now()}`,
        teacherId: teacher!._id.toString(),
        studentIds: [],
      };

      const createdClass = await dbService.createClass(classData);

      expect(createdClass).toBeDefined();
      expect(createdClass?._id).toBeDefined();
      expect(createdClass?.className).toBe(classData.className);
      expect(createdClass?.teacherId.toString()).toBe(teacher!._id.toString());
      expect(createdClass?.studentIds).toEqual([]);
    });

    it('should create class with student IDs', async () => {
      // Create teacher and students
      const teacherEmail = `--test-dbservice-${Date.now()}-teacher-with-students@example.com`;
      const teacher = await dbService.createUser({
        name: 'Teacher',
        email: teacherEmail,
        password: 'hashedPassword123',
        role: TEACHER_ROLE,
      });

      const student1Email = `--test-dbservice-${Date.now()}-st1@example.com`;
      const student1 = await dbService.createUser({
        name: 'Student 1',
        email: student1Email,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      });

      const student2Email = `--test-dbservice-${Date.now()}-st2@example.com`;
      const student2 = await dbService.createUser({
        name: 'Student 2',
        email: student2Email,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      });

      const classData = {
        className: `Class With Students ${Date.now()}`,
        teacherId: teacher!._id.toString(),
        studentIds: [student1!._id.toString(), student2!._id.toString()],
      };

      const createdClass = await dbService.createClass(classData);

      expect(createdClass?.studentIds).toHaveLength(2);
      expect(createdClass?.studentIds?.map(id => id.toString())).toContain(student1!._id.toString());
      expect(createdClass?.studentIds?.map(id => id.toString())).toContain(student2!._id.toString());
    });

    it('should handle string to ObjectId conversion for teacherId', async () => {
      const teacherEmail = `--test-dbservice-${Date.now()}-teacher-conversion@example.com`;
      const teacher = await dbService.createUser({
        name: 'Teacher',
        email: teacherEmail,
        password: 'hashedPassword123',
        role: TEACHER_ROLE,
      });

      // Pass teacherId as string
      const classData = {
        className: `Conversion Test ${Date.now()}`,
        teacherId: teacher!._id.toString(),
        studentIds: [],
      };

      const createdClass = await dbService.createClass(classData);

      expect(createdClass?.teacherId).toBeInstanceOf(Types.ObjectId);
    });
  });

  describe('getClassById', () => {
    it('should retrieve a class by ID', async () => {
      // Setup
      const teacherEmail = `--test-dbservice-${Date.now()}-get-class@example.com`;
      const teacher = await dbService.createUser({
        name: 'Teacher',
        email: teacherEmail,
        password: 'hashedPassword123',
        role: TEACHER_ROLE,
      });

      const classData = {
        className: `Get Class Test ${Date.now()}`,
        teacherId: teacher!._id.toString(),
        studentIds: [],
      };

      const createdClass = await dbService.createClass(classData);

      // Test
      const retrievedClass = await dbService.getClassById(createdClass!._id.toString());

      expect(retrievedClass).toBeDefined();
      expect(retrievedClass?._id.toString()).toBe(createdClass!._id.toString());
      expect(retrievedClass?.className).toBe(classData.className);
    });

    it('should return null for non-existent class', async () => {
      const fakeId = new Types.ObjectId().toString();
      const classDoc = await dbService.getClassById(fakeId);

      expect(classDoc).toBeNull();
    });
  });

  describe('addStudentToClass', () => {
    it('should add a student to a class', async () => {
      // Setup
      const teacherEmail = `--test-dbservice-${Date.now()}-add-student@example.com`;
      const teacher = await dbService.createUser({
        name: 'Teacher',
        email: teacherEmail,
        password: 'hashedPassword123',
        role: TEACHER_ROLE,
      });

      const studentEmail = `--test-dbservice-${Date.now()}-add-std@example.com`;
      const student = await dbService.createUser({
        name: 'Student',
        email: studentEmail,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      });

      const classData = {
        className: `Add Student Test ${Date.now()}`,
        teacherId: teacher!._id.toString(),
        studentIds: [],
      };

      const classDoc = await dbService.createClass(classData);

      // Test
      const updatedClass = await dbService.addStudentToClass(classDoc!._id.toString(), student!._id.toString());

      expect(updatedClass?.studentIds?.map(id => id.toString())).toContain(student!._id.toString());
    });

    it('should not add duplicate student to class', async () => {
      // Setup
      const teacherEmail = `--test-dbservice-${Date.now()}-dup-student@example.com`;
      const teacher = await dbService.createUser({
        name: 'Teacher',
        email: teacherEmail,
        password: 'hashedPassword123',
        role: TEACHER_ROLE,
      });

      const studentEmail = `--test-dbservice-${Date.now()}-dup-std@example.com`;
      const student = await dbService.createUser({
        name: 'Student',
        email: studentEmail,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      });

      const classData = {
        className: `Duplicate Student Test ${Date.now()}`,
        teacherId: teacher!._id.toString(),
        studentIds: [],
      };

      const classDoc = await dbService.createClass(classData);

      // Add student first time
      await dbService.addStudentToClass(classDoc!._id.toString(), student!._id.toString());

      // Add same student again
      const secondAddResult = await dbService.addStudentToClass(classDoc!._id.toString(), student!._id.toString());

      // Should still have only one student (addToSet prevents duplicates)
      expect(secondAddResult?.studentIds).toHaveLength(1);
    });

    it('should return null if class does not exist', async () => {
      const fakeClassId = new Types.ObjectId().toString();
      const fakeStudentId = new Types.ObjectId().toString();

      const result = await dbService.addStudentToClass(fakeClassId, fakeStudentId);

      expect(result).toBeNull();
    });
  });

  describe('getStudentDetails', () => {
    it('should retrieve multiple student details by IDs', async () => {
      // Create multiple students
      const student1Email = `--test-dbservice-${Date.now()}-details1@example.com`;
      const student1 = await dbService.createUser({
        name: 'Student Details 1',
        email: student1Email,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      });

      const student2Email = `--test-dbservice-${Date.now()}-details2@example.com`;
      const student2 = await dbService.createUser({
        name: 'Student Details 2',
        email: student2Email,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      });


      const studentIds = [student1!._id, student2!._id];


      // Retrieve details
      const studentDetails = await dbService.getStudentDetails(studentIds);


      expect(studentDetails).toBeDefined();
      expect(studentDetails).toHaveLength(2);
      expect(studentDetails?.[0]).toHaveProperty('_id');
      expect(studentDetails?.[0]).toHaveProperty('name');
      expect(studentDetails?.[0]).toHaveProperty('email');
      expect(studentDetails?.[0]?.password).toBeUndefined();
    });

    it('should return empty array for non-existent student IDs', async () => {
      const fakeId1 = new Types.ObjectId();
      const fakeId2 = new Types.ObjectId();

      const studentDetails = await dbService.getStudentDetails([fakeId1, fakeId2]);

      expect(studentDetails).toBeDefined();
      expect(studentDetails).toEqual([]);
    });

    it('should return empty array if no students match the IDs', async () => {
      // Use valid but non-existent ObjectIds
      const fakeIds = [new Types.ObjectId(), new Types.ObjectId()];
      const result = await dbService.getStudentDetails(fakeIds);

      expect(result).toBeDefined();
      expect(result).toEqual([]);
    });
  });

  describe('getAllStudents', () => {
    it('should retrieve all students in database', async () => {
      // Create some students
      const student1Email = `--test-dbservice-${Date.now()}-all1@example.com`;
      const student2Email = `--test-dbservice-${Date.now()}-all2@example.com`;

      await dbService.createUser({
        name: 'Get All Student 1',
        email: student1Email,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      });

      await dbService.createUser({
        name: 'Get All Student 2',
        email: student2Email,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      });

      // Retrieve all students
      const students = await dbService.getAllStudents();

      expect(students).toBeDefined();
      expect(Array.isArray(students)).toBe(true);
      expect(students!.length).toBeGreaterThanOrEqual(2);

      // Verify structure
      const student = students![0];
      expect(student).toHaveProperty('_id');
      expect(student).toHaveProperty('name');
      expect(student).toHaveProperty('email');
      expect(student?.password).toBeUndefined();
    });

    it('should only return students, not teachers', async () => {
      // Create a teacher
      const teacherEmail = `--test-dbservice-${Date.now()}-teacher-filter@example.com`;
      await dbService.createUser({
        name: 'Teacher Filter',
        email: teacherEmail,
        password: 'hashedPassword123',
        role: TEACHER_ROLE,
      });

      // Create a student
      const studentEmail = `--test-dbservice-${Date.now()}-student-filter@example.com`;
      const student = await dbService.createUser({
        name: 'Student Filter',
        email: studentEmail,
        password: 'hashedPassword123',
        role: STUDENT_ROLE,
      });

      // Get all students
      const students = await dbService.getAllStudents();

      // Verify no teachers in results
      const hasTeacher = students?.some(s => s.role === TEACHER_ROLE);
      expect(hasTeacher).toBe(false);

      // Verify our student is in results
      const hasOurStudent = students?.some(s => s._id.toString() === student!._id.toString());
      expect(hasOurStudent).toBe(true);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', async () => {
      const service1 = dbService;
      const service2 = dbService;

      expect(service1).toBe(service2);
    });
  });
});
