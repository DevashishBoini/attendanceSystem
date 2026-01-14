import { UserModel } from '../db-models/user.js';
import type { UserDocument } from '../db-models/user.js';
import { ClassModel } from '../db-models/class.js';
import type { ClassDocument } from '../db-models/class.js';
import { Types } from 'mongoose';
import { AttendanceModel, type AttendanceDocument } from '../db-models/attendance.js';
import {ActiveSessionSchema, type ActiveSession} from '../schemas/attendance.js';

/**
 * Interface for creating a new user
 */
interface CreateUserOptions {
  name: string;
  email: string;
  password: string;
  role: string;
}

/**
 * Interface for creating a new class
 */
interface CreateClassOptions {
  className: string;
  teacherId: string;
  studentIds?: Array<string>;
}


interface InsertAttendanceRecord {
  classId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: "present" | "absent";
}


/**
 * Database Service Class
 * 
 * Centralized database operations for the application
 * Provides methods for querying and managing data with consistent error handling
 * Enforces singleton pattern to prevent multiple instances
 * 
 * @example
 * const dbService = DBService.getInstance();
 * const user = await dbService.getUserById('507f1f77bcf86cd799439011');
 */
class DBService {
  private static instance: DBService;

  private constructor() {}

  /**
   * Get or create singleton instance
   * @returns The singleton DBService instance
   */
  static getInstance(): DBService {
    if (!DBService.instance) {
      DBService.instance = new DBService();
    }
    return DBService.instance;
  }

  /**
   * Get user from database by ID
   * 
   * Retrieves the full user document from MongoDB. Mongoose automatically handles
   * string-to-ObjectId conversion for queries.
   * 
   * @param userId - MongoDB user ID from JWT payload (string or ObjectId)
   * @returns Full user document or null if not found or invalid ID format
   * @throws Error if database query fails (excluding CastError)
   * 
   * @example
   * const user = await dbService.getUserById('507f1f77bcf86cd799439011');
   */
  async getUserById(userId: string): Promise<UserDocument | null> {
    try {
      // Mongoose handles string-to-ObjectId conversion automatically
      const user = await UserModel.findById<UserDocument>(userId);
      return user;
    } catch (error) {
      // Return null for invalid ObjectId format (CastError)
      if (error instanceof Error && error.name === 'CastError') {
        return null;
      }
      console.error('Error fetching user by ID:', error);
      throw error;
    }
  }

  /**
   * Get user from database by email
   * 
   * Retrieves user document by email address with optional password field inclusion
   * 
   * @param email - User's email address
   * @param includePassword - Whether to include the password field (defaults to false)
   * @returns Full user document or null if not found
   * @throws Error if database query fails
   * 
   * @example
   * // Get user without password
   * const user = await dbService.getUserByEmail('john@example.com');
   * 
   * // Get user with password for authentication
   * const user = await dbService.getUserByEmail('john@example.com', true);
   */
  async getUserByEmail(email: string, includePassword: boolean = false): Promise<UserDocument | null> {
    try {
      let query = UserModel.findOne<UserDocument>({ email : email });
      if (includePassword) {
        query = query.select('+password');
      }
      const user = await query;
      return user;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw error;
    }
  }

  /**
   * Create a new user in the database
   * 
   * Creates a new user document with the provided data.
   * Automatically hashes the password before saving to database.
   * 
   * @param userData - User data object with plain text password
   * @returns Created user document or null if duplicate email
   * @throws Error if user creation or password hashing fails (excluding E11000 duplicate key errors)
   * 
   * @example
   * const user = await dbService.createUser({
   *   name: 'John Doe',
   *   email: 'john@example.com',
   *   password: 'plainTextPassword',
   *   role: 'student'
   * });
   */
  async createUser(userData: CreateUserOptions): Promise<UserDocument | null> {
    try {
      const newUser = new UserModel(userData);
      await newUser.hashPassword(userData.password);
      await newUser.save();
      return newUser;
    } catch (error) {
      // Return null for duplicate email (E11000 error)
      if (error instanceof Error && error.message.includes('E11000')) {
        console.error('Duplicate email error:', error.message);
        return null;
      }
      console.error('Error creating user:', error);
      throw error;
    }
  }



  /**
   * Create a new class in the database
   * 
   * Creates a new class document with the provided data.
   * Handles conversion of string IDs to MongoDB ObjectIds internally.
   * 
   * @param classData - Class data object
   * @returns Created class document
   * @throws Error if class creation fails
   * 
   * @example
   * const newClass = await dbService.createClass({
   *   className: 'Physics 101',
   *   teacherId: '507f1f77bcf86cd799439011',
   *   studentIds: []
   * });
   */
  async createClass(classData: CreateClassOptions): Promise<ClassDocument> {
    try {
      // Service handles type conversion - convert string IDs to ObjectIds
      const dataWithObjectIds = {
        className: classData.className,
        teacherId: new Types.ObjectId(classData.teacherId),
        studentIds: (classData.studentIds ?? []).map(id => new Types.ObjectId(id))
      };
      const newClass = await ClassModel.create(dataWithObjectIds);
      return newClass;
    } catch (error) {
      console.error('Error creating class:', error);
      throw error;
    }
  }  

  /**
   * Retrieves a class document by its ID from the database
   * 
   * @param classId - MongoDB class ID (string)
   * @returns Class document or null if not found
   * @throws Error if database query fails
   * 
   * @example
   * const classDoc = await dbService.getClassById('507f1f77bcf86cd799439011');
   */
  async getClassById(classId: string): Promise<ClassDocument | null> {
    try {
      const classDoc = await ClassModel.findById<ClassDocument>(classId);
      return classDoc;
    } catch (error) {
      console.error('Error fetching class by ID:', error);
      throw error;
    }
  }

  /**
   * Adds a student to a class by ID
   * 
   * Updates the class document by adding the student's ID to the studentIds array.
   * Handles conversion of string IDs to MongoDB ObjectIds internally.
   * 
   * @param classId - MongoDB class ID (string)
   * @param studentId - MongoDB student ID (string)
   * @returns Updated class document or null if not updated
   * @throws Error if database update fails
   * 
   * @example
   * const updatedClass = await dbService.addStudentToClass('507f1f77bcf86cd799439011', '507f191e436d609404116113');
   */
  async addStudentToClass(classId: string, studentId: string): Promise<ClassDocument | null> {
    try {
      const updatedClass = await ClassModel.findByIdAndUpdate<ClassDocument>(
        classId,
        { $addToSet: { studentIds: new Types.ObjectId(studentId) } },
        { new: true }
      );
      return updatedClass;
    } catch (error) {
      console.error('Error adding student to class:', error);
      throw error;
    }
  }

  /**
   * Retrieves an array of student documents from the database by their IDs
   * 
   * @param studentIds - Array of student IDs to retrieve
   * @returns Array of student documents (selecting only _id, name, and email)
   * @throws Error if database query fails
   * 
   * @example
   * const studentDetails = await dbService.getStudentDetails(['507f1f77bcf86cd799439011', '507f191e436d609404116113']);
   */
  async getStudentDetails(studentIds: Array<Types.ObjectId>): Promise<Array<UserDocument>> {
    try {
      const students = await UserModel.find<UserDocument>({ _id: { $in: studentIds } }).select('_id name email');
      return students;
    } catch (error) {
      console.error('Error fetching student details:', error);
      throw error;
    }
  }

  /**
   * Retrieves all student documents from the database
   * 
   * @returns Array of student documents
   * @throws Error if database query fails
   * 
   * @example
   * const students = await dbService.getAllStudents();
   */
  async getAllStudents(): Promise<Array<UserDocument>> {
    try {
      const students = await UserModel.find<UserDocument>({ role: 'student' }).select('_id name email');
      return students;
    } catch (error) {
      console.error('Error fetching all students:', error);
      throw error;
    }
  }



  async addAttendanceRecords(classId: string, activeSession: ActiveSession ): Promise<Array<AttendanceDocument>> {
    try {
      const attendanceDocs : Array<InsertAttendanceRecord> = Object.keys(activeSession.attendance).map(studentId => ({
        classId: new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
        status: activeSession.attendance[studentId]!,
      }));
      const result = await AttendanceModel.insertMany(attendanceDocs);
      return result as Array<AttendanceDocument>;
    } catch (error) {
      console.error('Error adding attendance records:', error);
      throw error;
    }
  }

  /**
   * Get attendance record for a student in a specific class
   * 
   * Retrieves a single attendance record for a student within a class.
   * Distinguishes between "not found" (returns null) and database errors (throws).
   * 
   * @param studentId - MongoDB student ID (string)
   * @param classId - MongoDB class ID (string)
   * @returns Attendance document if found, null if no record exists
   * @throws Error if database query fails (e.g., invalid ID format, connection error)
   * 
   * @example
   * // Record found
   * const record = await dbService.getAttendanceRecordsForStudentInClass(studentId, classId);
   * if (record) {
   *   console.log(record.status); // 'present' or 'absent'
   * }
   * 
   * // Record not found
   * const record = await dbService.getAttendanceRecordsForStudentInClass(studentId, classId);
   * if (record === null) {
   *   console.log('Student not marked yet');
   * }
   * 
   * // Database error
   * try {
   *   const record = await dbService.getAttendanceRecordsForStudentInClass(studentId, classId);
   * } catch (error) {
   *   console.error('DB error:', error); // Connection, invalid ID, etc.
   * }
   */
  async getAttendanceRecordsForStudentInClass(studentId: string, classId: string): Promise<AttendanceDocument | null> {
    try {
      const record = await AttendanceModel.findOne<AttendanceDocument>({
        classId: new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
      });
      return record;
    } catch (error) {
      console.error('Error fetching attendance records for student in class:', error);
      throw error;
    }
  }



}

/**
 * Singleton instance of DBService
 * Use this instead of creating new instances
 * Private constructor prevents accidental multiple instances
 */
export const dbService = DBService.getInstance();
