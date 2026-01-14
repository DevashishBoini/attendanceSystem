import { z } from 'zod';
import { Types } from 'mongoose';
import { UserRoles } from '../constants.js';

/**
 * Schema for JWT token payload (data to be signed)
 * @description Defines the structure of data that gets encoded into a JWT token
 * Used as input to generateJWT() to create a signed token
 * @example
 * const payload = { userId: '123', role: 'student' };
 * JWTPayloadSchema.parse(payload);
 */
export const JWTPayloadSchema = z.object({
    userId: z.string().refine(
    (val) => Types.ObjectId.isValid(val),
    {
      message: 'Invalid user ID format',
    }
  ),
    role: z.enum(UserRoles, 'Invalid user role'),
});

/** Type inferred from JWTPayloadSchema for JWT token payload */
export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

/**
 * Schema for decoded JWT token after verification
 * @description Defines the structure of verified JWT data returned by verifyJWT()
 * Includes standard JWT claims (iat, exp) plus custom fields (userId, role)
 * @example
 * const decoded = { userId: '123', role: 'student', iat: 1234567890, exp: 1234571490 };
 * JWTDecodedSchema.parse(decoded);
 */
export const JWTDecodedSchema = z.object({
    userId: z.string().refine(
    (val) => Types.ObjectId.isValid(val),
    {
      message: 'Invalid user ID format',
    }
  ),
    role: z.enum(UserRoles, 'Invalid user role'),
    iat: z.number(),  // Issued at timestamp (Unix epoch in seconds)
    exp: z.number(),  // Expiration timestamp (Unix epoch in seconds)
});

/** Type inferred from JWTDecodedSchema for decoded JWT token data */
export type JWTDecoded = z.infer<typeof JWTDecodedSchema>;