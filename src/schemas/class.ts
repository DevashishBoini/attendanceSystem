import { z } from 'zod';

export const RegisterClassNameSchema = z.object({
    className: z.string().min(1, 'Class name is required'),
});

export type RegisterClassNameData = z.infer<typeof RegisterClassNameSchema>;

export const ClassIdParamSchema = z.object({
    id: z.string().min(1, 'Class ID is required'),
});

export type ClassIdParam = z.infer<typeof ClassIdParamSchema>;

export const StudentIdParamSchema = z.object({
    studentId: z.string().min(1, 'Student ID is required'),
});

export type StudentIdParam = z.infer<typeof StudentIdParamSchema>;