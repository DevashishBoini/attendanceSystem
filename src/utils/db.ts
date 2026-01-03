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
      let query = UserModel.findOne<UserDocument>({ email });
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


}

/**
 * Singleton instance of DBService
 * Use this instead of creating new instances
 * Private constructor prevents accidental multiple instances
 */
export const dbService = DBService.getInstance();
