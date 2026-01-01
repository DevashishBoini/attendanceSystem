import { Schema, model, Types } from "mongoose";
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
 */
export interface UserDocument {
    _id: Types.ObjectId;
    name: string;
    email: string;
    password: string; // hashed with bcrypt
    role: UserRole;
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