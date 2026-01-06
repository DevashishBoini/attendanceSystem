import { Router, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { RegisterClassNameSchema, type RegisterClassNameData, ClassIdParamSchema, type ClassIdParam, StudentIdParamSchema, type StudentIdParam} from '../schemas/class.js';
import { SuccessResponseSchema, ErrorResponseSchema, type SuccessResponse, type ErrorResponse, SuccessListResponseSchema, type SuccessListResponse } from '../schemas/responses.js';
import { authMiddleware, teacherRoleMiddleware } from '../middleware/auth.js';
import { dbService } from '../utils/db.js';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';

/**
 * Class Management Routes
 * @module routes/class
 * @description Handles class management endpoints: create class, add students, retrieve class details, and fetch students
 */
const classRouter : Router = Router();

/**
 * POST /class
 * @description Create a new class (teacher only)
 * @param {string} req.headers.authorization [header] - JWT token in format <token>
 * @param {RegisterClassNameData} req.body [body] - Class data (className)
 * @returns {SuccessResponse} 201 - Class created with id, name, teacher id, and student ids
 * @returns {ErrorResponse} 400 - Validation error
 * @returns {ErrorResponse} 401 - Unauthorized (not authenticated)
 * @returns {ErrorResponse} 403 - Forbidden (not a teacher)
 * @returns {ErrorResponse} 500 - Failed to create class / Unknown error occurred
 */
classRouter.post('/class', authMiddleware, teacherRoleMiddleware, async (req: Request, res: Response): Promise<void>  => {
    try {
        // authMiddleware ensures req.user exists and user is in database
        const validation = RegisterClassNameSchema.safeParse(req.body);
        
        if (!validation.success) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Invalid request schema',
            };
            ErrorResponseSchema.parse(errorResponse);
            res.status(400).json(errorResponse);
            return;
        }

        const classData = {
            className: validation.data.className,
            teacherId: req.user!.userId,
            studentIds: [],
        };

        const newClass = await dbService.createClass(classData);
        
        // Class creation check

        if (newClass === null) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Failed to create class',
            };

            ErrorResponseSchema.parse(errorResponse);
            res.status(500).json(errorResponse);
            return;
        }
        
        const newClassDetails = {
            _id: newClass._id.toString(),
            className: newClass.className,
            teacherId: newClass.teacherId,
            studentIds: newClass.studentIds ?? [],
          }
        
        
        const successResponse: SuccessResponse = {
            success: true,
            data: newClassDetails,
        };

        SuccessResponseSchema.parse(successResponse);
        res.status(201).json(successResponse);
    } catch (error) {
        console.error('❌ Error creating class:', error);
        const errorResponse: ErrorResponse = {
            success: false,
            error: 'Unknown error occurred',
        };

        ErrorResponseSchema.parse(errorResponse);
        res.status(500).json(errorResponse);
    }
});

/**
 * POST /class/:id/add-student
 * @description Add a student to a class (teacher only)
 * @param {string} req.headers.authorization [header] - JWT token in format <token>
 * @param {string} req.params.id [path] - Class ID
 * @param {StudentIdParam} req.body [body] - Student data (studentId)
 * @returns {SuccessResponse} 200 - Student added with updated class data
 * @returns {ErrorResponse} 400 - Validation error 
 * @returns {ErrorResponse} 401 - Unauthorized (not authenticated)
 * @returns {ErrorResponse} 403 - Forbidden (not class teacher or user is not a student)
 * @returns {ErrorResponse} 404 - Class or student not found
 * @returns {ErrorResponse} 409 - Student already enrolled in class
 * @returns {ErrorResponse} 500 - Server error adding student to class
 */
classRouter.post('/class/:id/add-student', authMiddleware, teacherRoleMiddleware, async (req: Request, res: Response): Promise<void> => {
    // Implementation for adding a student to a class
    try {
        const classIdValidation = ClassIdParamSchema.safeParse(req.params);
        const studentIdValidation = StudentIdParamSchema.safeParse(req.body);

        // Validate parameters
        if (!classIdValidation.success || !studentIdValidation.success) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Invalid request schema',
            };
            ErrorResponseSchema.parse(errorResponse);
            res.status(400).json(errorResponse);
            return;
        }
        

        const classId = classIdValidation.data.id;
        const studentId = studentIdValidation.data.studentId;
        

    
        const classDoc = await dbService.getClassById(classId);

        // Non-existent class check
        if (classDoc === null) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Class not found',
            };

            ErrorResponseSchema.parse(errorResponse);
            res.status(404).json(errorResponse);
            return;
        }   


        // Class teacher Ownership check
        if (classDoc.teacherId.toString() !== req.user!.userId) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Forbidden, not class teacher',
            };

            ErrorResponseSchema.parse(errorResponse);
            res.status(403).json(errorResponse);
            return;
        }

        // Non-existent student check
        const studentDoc = await dbService.getUserById(studentId);    

        if (studentDoc === null) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Student not found',
            };

            ErrorResponseSchema.parse(errorResponse);
            res.status(404).json(errorResponse);
            return;
        }

        // Not a student role check
        if (studentDoc.role !== STUDENT_ROLE) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Student not found',
            };

            ErrorResponseSchema.parse(errorResponse);
            res.status(404).json(errorResponse);
            return;
        }

        // Student already enrolled check
        if (classDoc.studentIds && classDoc.studentIds.includes(new Types.ObjectId(studentId))) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Student already enrolled in class',
            };

            ErrorResponseSchema.parse(errorResponse);
            res.status(409).json(errorResponse);
            return;
        }   


        const updatedClass = await dbService.addStudentToClass(classId, studentId);

        // Failed to add student check
        if (updatedClass === null) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Failed to add student to class',
            };

            ErrorResponseSchema.parse(errorResponse);
            res.status(500).json(errorResponse);
            return;
        }

        const updatedClassDetails = {
            _id: updatedClass._id.toString(),
            className: updatedClass.className,
            teacherId: updatedClass.teacherId,
            studentIds: updatedClass.studentIds ?? [],
          }

        const successResponse: SuccessResponse = {
            success: true,
            data: updatedClassDetails,
        };

        SuccessResponseSchema.parse(successResponse);
        res.status(200).json(successResponse);
    } catch (error) {
        console.error('❌ Error adding student to class:', error);
        const errorResponse: ErrorResponse = {
            success: false,
            error: 'Unknown error occurred',
        };

        ErrorResponseSchema.parse(errorResponse);
        res.status(500).json(errorResponse);
    }
});

/**
 * GET /class/:id
 * @description Retrieve class details (authenticated users - teachers can access their own, students can access enrolled classes)
 * @param {string} req.headers.authorization [header] - JWT token in format <token>
 * @param {string} req.params.id [path] - Class ID
 * @returns {SuccessResponse} 200 - Class data with id, name, teacher id, and student ids
 * @returns {ErrorResponse} 400 - Validation error
 * @returns {ErrorResponse} 401 - Unauthorized (not authenticated)
 * @returns {ErrorResponse} 403 - Forbidden (teacher: not class owner, student: not enrolled)
 * @returns {ErrorResponse} 404 - Class not found
 * @returns {ErrorResponse} 500 - Server error retrieving class
 */
classRouter.get('/class/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    // Implementation for retrieving class details
    try {
        const validation = ClassIdParamSchema.safeParse(req.params);

        // Validate parameters
        if (!validation.success) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Invalid request schema',
            };
            ErrorResponseSchema.parse(errorResponse);
            res.status(400).json(errorResponse);
            return;
        }

        const classId = validation.data.id;

        const classDoc = await dbService.getClassById(classId);

        // Non-existent class check
        if (classDoc === null) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Class not found',
            };

            ErrorResponseSchema.parse(errorResponse);
            res.status(404).json(errorResponse);
            return;
        }   

        if(req.user!.role === TEACHER_ROLE) {
            // Class teacher Ownership check
            if (classDoc.teacherId.toString() !== req.user!.userId) {
                const errorResponse: ErrorResponse = {
                    success: false,
                    error: 'Forbidden, not class teacher',
                };

                ErrorResponseSchema.parse(errorResponse);
                res.status(403).json(errorResponse);
                return;
            }       
        }

        if(req.user!.role === STUDENT_ROLE) {
            // Student enrollment check
            if (!classDoc.studentIds || !classDoc.studentIds.includes(new Types.ObjectId(req.user!.userId))) {
                const errorResponse: ErrorResponse = {
                    success: false,
                    error: 'Forbidden, student not enrolled in class',
                };

                ErrorResponseSchema.parse(errorResponse);
                res.status(403).json(errorResponse);
                return;
            }       
        }

        const studentsDetails = await dbService.getStudentDetails(classDoc.studentIds ?? []);

        if (studentsDetails === null && (classDoc.studentIds)?.length > 0) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Failed to retrieve student details',
            };

            ErrorResponseSchema.parse(errorResponse);
            res.status(500).json(errorResponse);
            return;
        }

        const studentsData = studentsDetails?.map(student => ({
            _id: student._id.toString(),
            name: student.name,
            email: student.email,
        })) ?? [];

        const classDetails = {
            _id: classDoc._id.toString(),
            className: classDoc.className,
            teacherId: classDoc.teacherId,
            students: studentsData,
          }

        const successResponse: SuccessResponse = {
            success: true,
            data: classDetails
        };

        SuccessResponseSchema.parse(successResponse);
        res.status(200).json(successResponse);
    } catch (error) {
        console.error('❌ Error retrieving class details:', error);
        const errorResponse: ErrorResponse = {
            success: false,
            error: 'Unknown error occurred',
        };

        ErrorResponseSchema.parse(errorResponse);
        res.status(500).json(errorResponse);
    }
});

/**
 * GET /students
 * @description Retrieve all students (teacher only)
 * @param {string} req.headers.authorization [header] - JWT token in format <token>
 * @returns {SuccessListResponse} 200 - Array of students with id, name, and email
 * @returns {ErrorResponse} 401 - Unauthorized (not authenticated)
 * @returns {ErrorResponse} 403 - Forbidden (not a teacher)
 * @returns {ErrorResponse} 500 - Server error fetching students
 */
classRouter.get('/students', authMiddleware, teacherRoleMiddleware, async (req: Request, res: Response): Promise<void>  => {
    try {
        // authMiddleware ensures req.user exists and user is in database

        const students = await dbService.getAllStudents();

        if (students === null) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Failed to fetch students',
            };

            ErrorResponseSchema.parse(errorResponse);
            res.status(500).json(errorResponse);
            return;
        }

        const studentData = students.map(student => ({
            _id: student._id.toString(),
            name: student.name,
            email: student.email,
        })) ?? [];

        const successListResponse: SuccessListResponse = {
            success: true,
            data: studentData,
        };

        SuccessListResponseSchema.parse(successListResponse);
        res.status(200).json(successListResponse);
    } catch (error) {
        console.error('❌ Error fetching students:', error);
        const errorResponse: ErrorResponse = {
            success: false,
            error: 'Unknown error occurred',
        };

        ErrorResponseSchema.parse(errorResponse);
        res.status(500).json(errorResponse);
    }
});

export default classRouter;

