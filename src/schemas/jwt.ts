import { z } from 'zod';
import { UserRoles } from '../constants.js';

// Schema for creating/signing a JWT token (input to generateJWT)
export const JWTPayloadSchema = z.object({
    userId: z.string().min(1, 'userId is required'),
    role: z.enum(UserRoles, 'Invalid user role'),
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

// Schema for decoded JWT after verification (output from verifyJWT)
export const JWTDecodedSchema = z.object({
    userId: z.string().min(1, 'userId is required'),
    role: z.enum(UserRoles, 'Invalid user role'),
    iat: z.number(),  // Issued at timestamp (Unix epoch in seconds)
    exp: z.number(),  // Expiration timestamp (Unix epoch in seconds)
});

export type JWTDecoded = z.infer<typeof JWTDecodedSchema>;