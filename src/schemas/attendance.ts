import { z } from 'zod';
import { Types } from 'mongoose';
import { AttendanceStatuses } from '../constants.js';


export const ClassIdBodyParamSchema = z.object({
    classId: z.string()
        .refine((val) => Types.ObjectId.isValid(val), {
            message: 'Invalid class ID format',
        }),
});

export type ClassIdBodyParam = z.infer<typeof ClassIdBodyParamSchema>;


// Active session with fully inline strict validation
export const ActiveSessionSchema = z.object({
  classId: z.string().refine(
    (val) => Types.ObjectId.isValid(val),
    {
      message: 'Invalid class ID format',
    }
  ),
  startedAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date format for startedAt',
  }),
  attendance: z.record(
    z.string().refine(
      (val) => Types.ObjectId.isValid(val),
      {
        message: 'Invalid student ID format',
      }
    ),
    z.enum(AttendanceStatuses, 'Invalid attendance status')
  ),
});

// Type inferred from activeSessionSchema for active session data 
// Override the attendance field to have a more precise type without undefined
export type ActiveSession = Omit<z.infer<typeof ActiveSessionSchema>, 'attendance'> & {
  attendance: Record<string, typeof AttendanceStatuses[number]>;
};