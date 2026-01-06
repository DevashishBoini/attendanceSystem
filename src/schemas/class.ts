import { z } from 'zod';
import { Types } from 'mongoose';

export const RegisterClassNameSchema = z.object({
    className: z.string().min(1, 'Class name is required'),
});

export type RegisterClassNameData = z.infer<typeof RegisterClassNameSchema>;

export const ClassIdParamSchema = z.object({
    id: z.string()
        .refine((val) => Types.ObjectId.isValid(val), {
            message: 'Invalid class ID format',
        }),
});

export type ClassIdParam = z.infer<typeof ClassIdParamSchema>;

export const StudentIdParamSchema = z.object({
    studentId: z.string()
        .refine((val) => Types.ObjectId.isValid(val), {
            message: 'Invalid student ID format',
        }),
});

export type StudentIdParam = z.infer<typeof StudentIdParamSchema>;