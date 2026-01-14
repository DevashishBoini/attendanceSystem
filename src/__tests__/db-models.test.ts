import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { connectDB, disconnectDB } from '../db.js';
import { UserModel } from '../db-models/user.js';
import { ClassModel } from '../db-models/class.js';
import { AttendanceModel } from '../db-models/attendance.js';
import { Types } from 'mongoose';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';
import { testLog, clearLogs, printLogs, setTestName } from './utils/test-logger.js';

describe('Database Models Schema Tests', () => {
  let testTeacherId: Types.ObjectId;
  let testStudentId: Types.ObjectId;
  let testClassId: Types.ObjectId;

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
    const testClasses = await ClassModel.find({ className: { $regex: '--Test Model Class' } });
    const testClassIds = testClasses.map(c => c._id);
    await UserModel.deleteMany({ email: { $regex: '^--test-models-' } });
    await ClassModel.deleteMany({ className: { $regex: '--Test Model Class' } });
    await AttendanceModel.deleteMany({ classId: { $in: testClassIds } });
  });

  describe('UserModel Schema', () => {
    describe('User Field Validation', () => {
      it('should create a user with all required fields', async () => {
        const userData = {
          name: 'Test User',
          email: `--test-models-${Date.now()}@example.com`,
          password: 'hashedPassword123',
          role: STUDENT_ROLE,
        };

        const user = await UserModel.create(userData);

        expect(user._id).toBeDefined();
        expect(user.name).toBe(userData.name);
        expect(user.email).toBe(userData.email);
        expect(user.password).toBe(userData.password);
        expect(user.role).toBe(userData.role);
      });

      it('should reject user without required name field', async () => {
        const userData = {
          email: `--test-models-${Date.now()}@example.com`,
          password: 'hashedPassword123',
          role: STUDENT_ROLE,
        };

        await expect(
          UserModel.create(userData as any)
        ).rejects.toThrow();
      });

      it('should reject user without required email field', async () => {
        const userData = {
          name: 'Test User',
          password: 'hashedPassword123',
          role: STUDENT_ROLE,
        };

        await expect(
          UserModel.create(userData as any)
        ).rejects.toThrow();
      });

      it('should reject user without required password field', async () => {
        const userData = {
          name: 'Test User',
          email: `--test-models-${Date.now()}@example.com`,
          role: STUDENT_ROLE,
        };

        await expect(
          UserModel.create(userData as any)
        ).rejects.toThrow();
      });

      it('should reject user without required role field', async () => {
        const userData = {
          name: 'Test User',
          email: `--test-models-${Date.now()}@example.com`,
          password: 'hashedPassword123',
        };

        await expect(
          UserModel.create(userData as any)
        ).rejects.toThrow();
      });
    });

    describe('User Email Validation', () => {
      it('should enforce unique email constraint', async () => {
        const testEmail = `--test-models-${Date.now()}-unique@example.com`;
        const userData1 = {
          name: 'User 1',
          email: testEmail,
          password: 'password123',
          role: STUDENT_ROLE,
        };

        await UserModel.create(userData1);

        const userData2 = {
          name: 'User 2',
          email: testEmail,
          password: 'password456',
          role: TEACHER_ROLE,
        };

        await expect(UserModel.create(userData2)).rejects.toThrow();
      });

      it('should convert email to lowercase on save', async () => {
        const testEmail = `--TEST-MODELS-${Date.now()}-LOWER@EXAMPLE.COM`;
        const userData = {
          name: 'Lowercase Test',
          email: testEmail,
          password: 'password123',
          role: STUDENT_ROLE,
        };

        const user = await UserModel.create(userData);

        expect(user.email).toBe(testEmail.toLowerCase());
      });
    });

    describe('User Role Validation', () => {
      it('should accept valid teacher role', async () => {
        const userData = {
          name: 'Teacher',
          email: `--test-models-${Date.now()}-teacher@example.com`,
          password: 'password123',
          role: TEACHER_ROLE,
        };

        const user = await UserModel.create(userData);

        expect(user.role).toBe(TEACHER_ROLE);
      });

      it('should accept valid student role', async () => {
        const userData = {
          name: 'Student',
          email: `--test-models-${Date.now()}-student@example.com`,
          password: 'password123',
          role: STUDENT_ROLE,
        };

        const user = await UserModel.create(userData);

        expect(user.role).toBe(STUDENT_ROLE);
      });

      it('should reject invalid role value', async () => {
        const userData = {
          name: 'Invalid Role User',
          email: `--test-models-${Date.now()}-invalid@example.com`,
          password: 'password123',
          role: 'admin' as any,
        };

        await expect(UserModel.create(userData)).rejects.toThrow();
      });
    });

    describe('User Password Methods', () => {
      it('should hash password with hashPassword method', async () => {
        const plainPassword = 'myPlainPassword123!';
        const userData = {
          name: 'Hash Test User',
          email: `--test-models-${Date.now()}-hash@example.com`,
          password: plainPassword,
          role: STUDENT_ROLE,
        };

        const user = await UserModel.create(userData);
        await user.hashPassword(plainPassword);

        expect(user.password).not.toBe(plainPassword);
        expect(user.password.length).toBeGreaterThan(plainPassword.length);
      });

      it('should correctly compare passwords with comparePassword method', async () => {
        const plainPassword = 'correctPassword123!';
        const userData = {
          name: 'Compare Test User',
          email: `--test-models-${Date.now()}-compare@example.com`,
          password: 'initialHashedPassword',
          role: STUDENT_ROLE,
        };

        const user = await UserModel.create(userData);
        await user.hashPassword(plainPassword);

        const isMatch = await user.comparePassword(plainPassword);

        expect(isMatch).toBe(true);
      });

      it('should return false when comparing incorrect password', async () => {
        const correctPassword = 'correctPassword123!';
        const wrongPassword = 'wrongPassword456!';
        const userData = {
          name: 'Wrong Password User',
          email: `--test-models-${Date.now()}-wrong@example.com`,
          password: 'initialHashedPassword',
          role: STUDENT_ROLE,
        };

        const user = await UserModel.create(userData);
        await user.hashPassword(correctPassword);

        const isMatch = await user.comparePassword(wrongPassword);

        expect(isMatch).toBe(false);
      });
    });

    describe('User Password Field Selection', () => {
      it('should exclude password from default queries', async () => {
        const plainPassword = 'secretPassword123!';
        const userData = {
          name: 'Password Excluded User',
          email: `--test-models-${Date.now()}-exclude@example.com`,
          password: 'initialPassword',
          role: STUDENT_ROLE,
        };

        const created = await UserModel.create(userData);
        await created.hashPassword(plainPassword);
        await created.save();

        const found = await UserModel.findById(created._id);

        expect(found?.password).toBeUndefined();
      });

      it('should include password when explicitly selected', async () => {
        const plainPassword = 'secretPassword123!';
        const userData = {
          name: 'Password Included User',
          email: `--test-models-${Date.now()}-include@example.com`,
          password: 'initialPassword',
          role: STUDENT_ROLE,
        };

        const created = await UserModel.create(userData);
        await created.hashPassword(plainPassword);
        await created.save();

        const found = await UserModel.findById(created._id).select('+password');

        expect(found?.password).toBeDefined();
        expect(found?.password).not.toBe(plainPassword);
      });
    });
  });

  describe('ClassModel Schema', () => {
    beforeEach(async () => {
      // Create a test teacher for each test
      const teacherData = {
        name: 'Test Teacher',
        email: `--test-models-${Date.now()}-teacher@example.com`,
        password: 'password123',
        role: TEACHER_ROLE,
      };
      const teacher = await UserModel.create(teacherData);
      testTeacherId = teacher._id;
    });

    describe('Class Field Validation', () => {
      it('should create a class with all required fields', async () => {
        const classData = {
          className: `--Test Model Class ${Date.now()}`,
          teacherId: testTeacherId,
          studentIds: [],
        };

        const createdClass = await ClassModel.create(classData);

        expect(createdClass._id).toBeDefined();
        expect(createdClass.className).toBe(classData.className);
        expect(createdClass.teacherId.toString()).toBe(testTeacherId.toString());
        expect(createdClass.studentIds).toEqual([]);
      });

      it('should reject class without required className field', async () => {
        const classData = {
          teacherId: testTeacherId,
          studentIds: [],
        };

        await expect(
          ClassModel.create(classData as any)
        ).rejects.toThrow();
      });

      it('should reject class without required teacherId field', async () => {
        const classData = {
          className: `--Test Model Class ${Date.now()}`,
          studentIds: [],
        };

        await expect(
          ClassModel.create(classData as any)
        ).rejects.toThrow();
      });

      it('should have default empty studentIds array', async () => {
        const classData = {
          className: `--Test Model Class ${Date.now()}`,
          teacherId: testTeacherId,
        };

        const createdClass = await ClassModel.create(classData);

        expect(createdClass.studentIds).toEqual([]);
        expect(Array.isArray(createdClass.studentIds)).toBe(true);
      });
    });

    describe('Class References', () => {
      it('should store teacherId as ObjectId reference', async () => {
        const classData = {
          className: `--Test Model Class ${Date.now()}`,
          teacherId: testTeacherId,
          studentIds: [],
        };

        const createdClass = await ClassModel.create(classData);

        expect(createdClass.teacherId).toEqual(testTeacherId);
        expect(createdClass.teacherId instanceof Types.ObjectId).toBe(true);
      });

      it('should populate teacher information from reference', async () => {
        const classData = {
          className: `--Test Model Class ${Date.now()}`,
          teacherId: testTeacherId,
          studentIds: [],
        };

        const createdClass = await ClassModel.create(classData);
        const populated = await ClassModel.findById(createdClass._id).populate('teacherId');

        expect(populated?.teacherId).toBeDefined();
        expect((populated?.teacherId as any).role).toBe(TEACHER_ROLE);
      });

      it('should support multiple students in studentIds array', async () => {
        const student1 = await UserModel.create({
          name: 'Student 1',
          email: `--test-models-${Date.now()}-s1@example.com`,
          password: 'password123',
          role: STUDENT_ROLE,
        });

        const student2 = await UserModel.create({
          name: 'Student 2',
          email: `--test-models-${Date.now()}-s2@example.com`,
          password: 'password123',
          role: STUDENT_ROLE,
        });

        const classData = {
          className: `--Test Model Class ${Date.now()}`,
          teacherId: testTeacherId,
          studentIds: [student1._id, student2._id],
        };

        const createdClass = await ClassModel.create(classData);

        expect(createdClass.studentIds).toHaveLength(2);
        expect(createdClass.studentIds[0]?.toString()).toBe(student1._id.toString());
        expect(createdClass.studentIds[1]?.toString()).toBe(student2._id.toString());
      });

      it('should populate student information from studentIds array', async () => {
        const student = await UserModel.create({
          name: 'Populate Test Student',
          email: `--test-models-${Date.now()}-pop@example.com`,
          password: 'password123',
          role: STUDENT_ROLE,
        });

        const classData = {
          className: `--Test Model Class ${Date.now()}`,
          teacherId: testTeacherId,
          studentIds: [student._id],
        };

        const createdClass = await ClassModel.create(classData);
        const populated = await ClassModel.findById(createdClass._id).populate('studentIds');

        expect(populated?.studentIds).toHaveLength(1);
        expect((populated?.studentIds[0] as any).role).toBe(STUDENT_ROLE);
      });

      it('should handle invalid ObjectId in studentIds gracefully', async () => {
        const classData = {
          className: `--Test Model Class ${Date.now()}`,
          teacherId: testTeacherId,
          studentIds: [new Types.ObjectId()], // Non-existent student
        };

        const createdClass = await ClassModel.create(classData);

        expect(createdClass.studentIds).toHaveLength(1);
      });
    });
  });


  // skipping attendance model tests for now
  describe('AttendanceModel Schema', () => {
    beforeEach(async () => {
      // Create test teacher and class
      const teacherData = {
        name: 'Test Teacher',
        email: `--test-models-${Date.now()}-t@example.com`,
        password: 'password123',
        role: TEACHER_ROLE,
      };
      const teacher = await UserModel.create(teacherData);
      testTeacherId = teacher._id;

      const classData = {
        className: `--Test Model Class ${Date.now()}`,
        teacherId: testTeacherId,
        studentIds: [],
      };
      const createdClass = await ClassModel.create(classData);
      testClassId = createdClass._id;

      // Create test student
      const studentData = {
        name: 'Test Student',
        email: `--test-models-${Date.now()}-s@example.com`,
        password: 'password123',
        role: STUDENT_ROLE,
      };
      const student = await UserModel.create(studentData);
      testStudentId = student._id;
    });

    describe('Attendance Field Validation', () => {
      it('should create attendance record with all required fields', async () => {
        const attendanceData = {
          classId: testClassId,
          studentId: testStudentId,
          status: 'present',
        };

        const record = await AttendanceModel.create(attendanceData);

        expect(record._id).toBeDefined();
        expect(record.classId.toString()).toBe(testClassId.toString());
        expect(record.studentId.toString()).toBe(testStudentId.toString());
        expect(record.status).toBe('present');
      });

      it('should reject attendance without required classId', async () => {
        const attendanceData = {
          studentId: testStudentId,
          status: 'present',
        };

        await expect(
          AttendanceModel.create(attendanceData as any)
        ).rejects.toThrow();
      });

      it('should reject attendance without required studentId', async () => {
        const attendanceData = {
          classId: testClassId,
          status: 'present',
        };

        await expect(
          AttendanceModel.create(attendanceData as any)
        ).rejects.toThrow();
      });

      it('should reject attendance without required status field', async () => {
        const attendanceData = {
          classId: testClassId,
          studentId: testStudentId,
        };

        await expect(
          AttendanceModel.create(attendanceData as any)
        ).rejects.toThrow();
      });
    });

    describe('Attendance Status Validation', () => {
      it('should accept valid present status', async () => {
        const attendanceData = {
          classId: testClassId,
          studentId: testStudentId,
          status: 'present',
        };

        const record = await AttendanceModel.create(attendanceData);

        expect(record.status).toBe('present');
      });

      it('should accept valid absent status', async () => {
        const attendanceData = {
          classId: testClassId,
          studentId: testStudentId,
          status: 'absent',
        };

        const record = await AttendanceModel.create(attendanceData);

        expect(record.status).toBe('absent');
      });


      it('should reject invalid status value', async () => {
        const attendanceData = {
          classId: testClassId,
          studentId: testStudentId,
          status: 'excused' as any,
        };

        await expect(
          AttendanceModel.create(attendanceData)
        ).rejects.toThrow();
      });
    });

    describe('Attendance References', () => {
      it('should store classId as ObjectId reference', async () => {
        const attendanceData = {
          classId: testClassId,
          studentId: testStudentId,
          status: 'present',
        };

        const record = await AttendanceModel.create(attendanceData);

        expect(record.classId).toEqual(testClassId);
        expect(record.classId instanceof Types.ObjectId).toBe(true);
      });

      it('should store studentId as ObjectId reference', async () => {
        const attendanceData = {
          classId: testClassId,
          studentId: testStudentId,
          status: 'present',
        };

        const record = await AttendanceModel.create(attendanceData);

        expect(record.studentId).toEqual(testStudentId);
        expect(record.studentId instanceof Types.ObjectId).toBe(true);
      });

      it('should populate class information from classId reference', async () => {
        const attendanceData = {
          classId: testClassId,
          studentId: testStudentId,
          status: 'present',
        };

        const record = await AttendanceModel.create(attendanceData);
        const populated = await AttendanceModel.findById(record._id).populate('classId');

        expect(populated?.classId).toBeDefined();
        expect((populated?.classId as any).teacherId).toBeDefined();
      });

      it('should populate student information from studentId reference', async () => {
        const attendanceData = {
          classId: testClassId,
          studentId: testStudentId,
          status: 'present',
        };

        const record = await AttendanceModel.create(attendanceData);
        const populated = await AttendanceModel.findById(record._id).populate('studentId');

        expect(populated?.studentId).toBeDefined();
        expect((populated?.studentId as any).role).toBe(STUDENT_ROLE);
      });

      it('should allow multiple attendance records for same student in different classes', async () => {
        const class2 = await ClassModel.create({
          className: `--Test Model Class 2 ${Date.now()}`,
          teacherId: testTeacherId,
          studentIds: [],
        });

        const attendance1 = await AttendanceModel.create({
          classId: testClassId,
          studentId: testStudentId,
          status: 'present',
        });

        const attendance2 = await AttendanceModel.create({
          classId: class2._id,
          studentId: testStudentId,
          status: 'absent',
        });

        expect(attendance1.studentId.toString()).toBe(attendance2.studentId.toString());
        expect(attendance1.classId.toString()).not.toBe(attendance2.classId.toString());
      });

      it('should allow multiple attendance records for same class different students', async () => {
        const student2 = await UserModel.create({
          name: 'Second Student',
          email: `--test-models-${Date.now()}-s2@example.com`,
          password: 'password123',
          role: STUDENT_ROLE,
        });

        const attendance1 = await AttendanceModel.create({
          classId: testClassId,
          studentId: testStudentId,
          status: 'present',
        });

        const attendance2 = await AttendanceModel.create({
          classId: testClassId,
          studentId: student2._id,
          status: 'absent',
        });

        expect(attendance1.classId.toString()).toBe(attendance2.classId.toString());
        expect(attendance1.studentId.toString()).not.toBe(attendance2.studentId.toString());
      });
    });
  });

  describe('Cross-Model Integration', () => {
    it('should maintain referential integrity across models', async () => {
      // Create teacher
      const teacher = await UserModel.create({
        name: 'Integration Teacher',
        email: `--test-models-${Date.now()}-int-t@example.com`,
        password: 'password123',
        role: TEACHER_ROLE,
      });

      // Create student
      const student = await UserModel.create({
        name: 'Integration Student',
        email: `--test-models-${Date.now()}-int-s@example.com`,
        password: 'password123',
        role: STUDENT_ROLE,
      });

      // Create class
      const createdClass = await ClassModel.create({
        className: `--Integration Test Class ${Date.now()}`,
        teacherId: teacher._id,
        studentIds: [student._id],
      });

      // Create attendance
      const attendance = await AttendanceModel.create({
        classId: createdClass._id,
        studentId: student._id,
        status: 'present',
      });

      // Populate and verify all relationships
      const populatedAttendance = await AttendanceModel.findById(attendance._id)
        .populate('classId')
        .populate('studentId');

      expect((populatedAttendance?.classId as any).teacherId.toString()).toBe(teacher._id.toString());
      expect((populatedAttendance?.studentId as any).role).toBe(STUDENT_ROLE);
      expect((populatedAttendance?.classId as any).studentIds).toContainEqual(student._id);
    });

    it('should handle querying multiple records with relationships', async () => {
      const teacher = await UserModel.create({
        name: 'Bulk Teacher',
        email: `--test-models-${Date.now()}-bulk@example.com`,
        password: 'password123',
        role: TEACHER_ROLE,
      });

      const students = await Promise.all([
        UserModel.create({
          name: 'Bulk Student 1',
          email: `--test-models-${Date.now()}-bulk1@example.com`,
          password: 'password123',
          role: STUDENT_ROLE,
        }),
        UserModel.create({
          name: 'Bulk Student 2',
          email: `--test-models-${Date.now()}-bulk2@example.com`,
          password: 'password123',
          role: STUDENT_ROLE,
        }),
      ]);

      const createdClass = await ClassModel.create({
        className: `--Bulk Test Class ${Date.now()}`,
        teacherId: teacher._id,
        studentIds: students.map(s => s._id),
      });

      const attendanceRecords = await Promise.all(
        students.map(student =>
          AttendanceModel.create({
            classId: createdClass._id,
            studentId: student._id,
            status: 'present',
          })
        )
      );

      const query = await AttendanceModel.find({ classId: createdClass._id })
        .populate('studentId')
        .populate('classId');

      expect(query).toHaveLength(2);
      expect(query.every(r => (r.classId as any).teacherId.toString() === teacher._id.toString())).toBe(true);
    });
  });
});
