import { z } from 'zod';
import { UserRoles } from '../constants.js';

/**
 * Schema for user signup request validation
 * @description Validates user registration data including name, email, password, and role
 * @example
 * const data = { name: 'John', email: 'john@example.com', password: 'pass123', role: 'student' };
 * SignupSchema.parse(data);
 */
export const SignupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  role: z.enum(UserRoles, 'Invalid user role'),
});

/** Type inferred from SignupSchema for user signup data */
export type SignupData = z.infer<typeof SignupSchema>;

/**
 * Schema for user login request validation
 * @description Validates user authentication credentials (email and password)
 * @example
 * const data = { email: 'john@example.com', password: 'pass123' };
 * LoginSchema.parse(data);
 */
export const LoginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string(),
});

/** Type inferred from LoginSchema for user login data */
export type LoginData = z.infer<typeof LoginSchema>;