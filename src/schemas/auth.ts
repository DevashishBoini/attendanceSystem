import { z } from 'zod';
import { UserRoles } from '../constants.js';

export const SignupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  role: z.enum(UserRoles, 'Invalid user role'),
});

export type SignupData = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string(),
});

export type LoginData = z.infer<typeof LoginSchema>;