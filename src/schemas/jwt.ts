import { z } from 'zod';
import { UserRoles } from '../constants.js';

export const JWTPayloadSchema = z.object({
    userId: z.string().min(1, 'userId is required'),
    role: z.enum(UserRoles, 'Invalid user role'),
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;