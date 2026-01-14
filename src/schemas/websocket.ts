import { z } from 'zod';
import { Types } from 'mongoose';
import { AttendanceStatuses, type AttendanceStatus } from '../constants.js';
import { JWTDecodedSchema, type JWTDecoded } from './jwt.js';

// ============================================
// Event Data Schemas
// ============================================

/**
 * ATTENDANCE_MARKED event data
 * {
 *   "studentId": "507f1f77bcf86cd799439012",
 *   "status": "present"
 * }
 */
export const AttendanceMarkedDataSchema = z.object({
  studentId: z.string().refine(
    (val) => Types.ObjectId.isValid(val),
    {
      message: 'Invalid student ID format',
    }
  ),
  status: z.enum(AttendanceStatuses, 'Invalid attendance status'),
});

export type AttendanceMarkedData = z.infer<typeof AttendanceMarkedDataSchema>;

// ============================================
// Generic WebSocket Message Schemas
// ============================================

/**
 * Success Message Schema
 * Format for all successful operations:
 * {
 *   "event": "EVENT_NAME",
 *   "data": { ... any data ... }
 * }
 */
export const SuccessWSMessageSchema = z.object({
  event: z.string().min(1, 'Event name is required'),
  data: z.record(z.string(), z.any()).optional(),
});

export type SuccessWSMessage = z.infer<typeof SuccessWSMessageSchema>;

/**
 * Error Message Schema
 * Format for all error responses:
 * {
 *   "event": "ERROR",
 *   "data": {
 *     "message": "Error description"
 *   }
 * }
 */
export const ErrorWSMessageSchema = z.object({
  event: z.literal('ERROR'),
  data: z.object({
    message: z.string().min(1, 'Error message is required'),
  }),
});

export type ErrorWSMessage = z.infer<typeof ErrorWSMessageSchema>;

/**
 * Union of all WebSocket messages
 * Either success (any event) or error
 */
export const WSMessageSchema = z.union([SuccessWSMessageSchema, ErrorWSMessageSchema]);

export type WSMessage = z.infer<typeof WSMessageSchema>;



// ============================================
// Connection Info Schema
// ============================================

/**
 * Extended WebSocket interface data
 * Stored on ws object during connection
 */
export const ExtendedWSDataSchema = z.object({
  user: JWTDecodedSchema.optional(),
  isAlive: z.boolean().optional(),
});

export type ExtendedWSData = z.infer<typeof ExtendedWSDataSchema>;
