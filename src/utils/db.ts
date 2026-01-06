import { UserModel } from '../db-models/user.js';
import type { UserDocument } from '../db-models/user.js';
import { ClassModel } from '../db-models/class.js';
import type { ClassDocument } from '../db-models/class.js';
import { Types } from 'mongoose';

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
export class DBService {
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
   * @returns Full user document or null if not found
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
      console.error('Error fetching user by ID:', error);
      return null;
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
      return null;
    }
  }

  /**
   * Create a new user in the database
   * 
   * Creates a new user document with the provided data.
   * Routes should pass hashed password - service does not hash.
   * 
   * @param userData - User data object
   * @returns Created user document or null if creation failed
   * 
   * @example
   * const user = await dbService.createUser({
   *   name: 'John Doe',
   *   email: 'john@example.com',
   *   password: hashedPassword,
   *   role: 'student'
   * });
   */
  async createUser(userData: CreateUserOptions): Promise<UserDocument | null> {
    try {
      const newUser = await UserModel.create(userData);
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }



  /**
   * Create a new class in the database
   * 
   * Creates a new class document with the provided data.
   * Handles conversion of string IDs to MongoDB ObjectIds internally.
   * 
   * @param classData - Class data object
   * @returns Created class document or null if creation failed
   * 
   * @example
   * const newClass = await dbService.createClass({
   *   className: 'Physics 101',
   *   teacherId: '507f1f77bcf86cd799439011',
   *   studentIds: []
   * });
   */
  async createClass(classData: CreateClassOptions): Promise<ClassDocument | null> {
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
      return null;
    }
  }  

  /**
   * Retrieves a class document by its ID from the database
   * 
   * @param classId - MongoDB class ID (string)
   * @returns Class document or null if not found or query failed
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
      return null;
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
   * @returns Updated class document or null if update failed
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
      return null;
    }
  }

  /**
   * Retrieves an array of student documents from the database by their IDs
   * 
   * @param studentIds - Array of student IDs to retrieve
   * @returns Array of student documents (selecting only _id, name, and email)
   * or null if the query fails
   * 
   * @example
   * const studentDetails = await dbService.getStudentDetails(['507f1f77bcf86cd799439011', '507f191e436d609404116113']);
   */
  async getStudentDetails(studentIds: Array<Types.ObjectId>): Promise<Array<UserDocument> | null> {
    try {
      const students = await UserModel.find<UserDocument>({ _id: { $in: studentIds } }).select('_id name email');
      return students;
    } catch (error) {
      console.error('Error fetching student details:', error);
      return null;
    }
  }

  /**
   * Retrieves all student documents from the database
   * 
   * @returns Array of student documents or null if the query fails
   * 
   * @example
   * const students = await dbService.getAllStudents();
   */
  async getAllStudents(): Promise<Array<UserDocument> | null> {
    try {
      const students = await UserModel.find<UserDocument>({ role: 'student' }).select('_id name email');
      return students;
    } catch (error) {
      console.error('Error fetching all students:', error);
      return null;
    }
  }



}

/**
 * Singleton instance of DBService
 * Use this instead of creating new instances
 * Private constructor prevents accidental multiple instances
 */
export const dbService = DBService.getInstance();
