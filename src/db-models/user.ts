import { Schema, model, Types, Document } from "mongoose";
import bcrypt from "bcrypt";
import config from "../config.js";
import { UserRoles, type UserRole } from "../constants.js";

/**
 * User Document Interface
 * @interface UserDocument
 * @description Represents a user in the database
 * @property {Types.ObjectId} _id - MongoDB unique identifier
 * @property {string} name - User's full name
 * @property {string} email - User's email address (unique, lowercase)
 * @property {string} password - Bcrypt-hashed password (excluded from queries by default)
 * @property {UserRole} role - User's role (e.g., 'teacher', 'student')
 * 
 * @method hashPassword
 *      @description Hashes a plain text password and updates the document
 *      @param {string} password - Plain text password to hash
 *      @returns {Promise<void>}
 * 
 * @method comparePassword
 *      @description Compares a plain text password with the stored hashed password
 *      @param {string} enteredPassword - Plain text password to compare
 *      @returns {Promise<boolean>} True if passwords match, false otherwise
 */
export interface UserDocument extends Document {
    _id: Types.ObjectId;
    name: string;
    email: string;
    password: string; // hashed with bcrypt
    role: UserRole;
    hashPassword(password: string): Promise<void>;
    comparePassword(enteredPassword: string): Promise<boolean>;
}

/**
 * User Mongoose Schema
 * @description Defines the structure and validation rules for user documents
 * Includes unique email constraint and lowercase normalization
 * Password field is excluded from default queries for security
 */
export const UserSchema = new Schema<UserDocument>({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: UserRoles, required: true },
});

/**
 * Hash password before saving
 * @method hashPassword
 * @description Hashes the provided password using bcrypt and updates the document
 * @param {string} password - Plain text password to hash
 * @example
 * const user = new UserModel({ name, email, password: 'plain', role });
 * await user.hashPassword('plain');
 * await user.save();
 */
UserSchema.methods.hashPassword = async function(password: string): Promise<void> {
    try {
        this.password = await bcrypt.hash(password, config.BCRYPT_SALT_ROUNDS);
    } catch (error) {
        console.error('Error hashing password:', error);
        throw error;
    }
};

/**
 * Compare password with hashed password
 * @method comparePassword
 * @description Compares a plain text password with the stored hashed password
 * @param {string} enteredPassword - Plain text password to compare
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 * @example
 * const user = await UserModel.findById(userId).select('+password');
 * const isMatch = await user.comparePassword('password123');
 */
UserSchema.methods.comparePassword = async function(enteredPassword: string): Promise<boolean> {
    try {
        return await bcrypt.compare(enteredPassword, this.password);
    } catch (error) {
        console.error('Error comparing password:', error);
        return false;
    }
};

/**
 * User Model
 * @description Mongoose model for querying and managing user documents
 * @example
 * // Create a new user
 * const user = await UserModel.create({ name: 'John', email: 'john@example.com', password: 'hashed', role: 'student' });
 * 
 * // Find user and include password
 * const user = await UserModel.findById(userId).select('+password');
 */
export const UserModel = model<UserDocument>("User", UserSchema);