import { z } from 'zod';

/**
 * Success Response Schema
 * Used for successful API responses
 * 
 * @example
 * {
 *   "success": true,
 *   "data": { "_id": "123", "name": "John" }
 * }
 */
export const SuccessResponseSchema = z.object({
  success: z.literal(true),  
  data: z.record(z.string(), z.any())  
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

/**
 * Error Response Schema
 * Used for failed API responses
 * 
 * @example
 * {
 *   "success": false,
 *   "error": "Invalid request schema"
 * }
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),  
  error: z.string()
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
