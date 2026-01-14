import { Router, type Request, type Response } from 'express';
import { ClassIdBodyParamSchema, type ClassIdBodyParam } from '../schemas/attendance.js';
import { SuccessResponseSchema, ErrorResponseSchema, type SuccessResponse, type ErrorResponse } from '../schemas/responses.js';
import { authMiddleware, teacherRoleMiddleware, studentRoleMiddleware } from '../middleware/auth.js';
import { type JWTPayload, type JWTDecoded } from '../schemas/jwt.js';
import { generateJWT } from '../utils/jwt.js';
import { dbService } from '../utils/db.js';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';
import { ActiveSessionSchema, type ActiveSession  } from '../schemas/attendance.js';
import { getWebSocketManager } from '../websocket/wsManager.js';
import { ClassIdPathParamSchema, type ClassIdPathParam } from '../schemas/class.js';


const attendanceRouter : Router = Router();

/**
 * POST /attendance/start
 * @description Start a new attendance session for a class (teacher only)
 * @param {string} req.headers.authorization [header] - JWT token in format <token>
 * @param {ClassIdBodyParam} req.body [body] - Class ID to start attendance session for
 * @returns {SuccessResponse} 200 - Attendance session started with classId and startedAt timestamp
 * @returns {ErrorResponse} 400 - Validation error (invalid class ID format)
 * @returns {ErrorResponse} 401 - Unauthorized (not authenticated)
 * @returns {ErrorResponse} 403 - Forbidden (not the class teacher)
 * @returns {ErrorResponse} 404 - Class not found
 * @returns {ErrorResponse} 409 - Session already active for another class
 * @returns {ErrorResponse} 500 - Failed to start session / Unknown error occurred
 * @note Only one attendance session can be active at a time
 * @note WebSocket connections receive notification when session starts
 */
attendanceRouter.post('/attendance/start', authMiddleware, teacherRoleMiddleware, async (req: Request, res: Response): Promise<void>  => {
    try {
        const validationResult = ClassIdBodyParamSchema.safeParse(req.body);
        
        if (!validationResult.success) {
            console.error('❌ Validation error starting attendance session:', validationResult.error);

            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Invalid request schema',
            };
            
            ErrorResponseSchema.parse(errorResponse);
            res.status(400).json(errorResponse);
            return;
        }
        
        const ClassIdBodyParam: ClassIdBodyParam = validationResult.data;

        const classDoc = await dbService.getClassById(ClassIdBodyParam.classId);
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

        // Start attendance session
        const wsManager = getWebSocketManager();
        wsManager.startSession(ClassIdBodyParam.classId);
        const sessionDetails = wsManager.getActiveSession();

        const successResponse: SuccessResponse = {
            success: true,
            data: {
                classId : sessionDetails?.classId,
                startedAt : sessionDetails?.startedAt,
            }
        };

        SuccessResponseSchema.parse(successResponse);
        res.status(200).json(successResponse);
        return; 






    }

    catch(error){

        console.error('❌ Error starting attendance session:', error);
        const errorResponse: ErrorResponse = {
            success: false,
            error: 'Unknown error occurred',
        };

        ErrorResponseSchema.parse(errorResponse);
        res.status(500).json(errorResponse);        
    }


});

/**
 * GET /class/:id/my-attendance
 * @description Get student's attendance status for a specific class (student only)
 * @param {string} req.headers.authorization [header] - JWT token in format <token>
 * @param {string} req.params.id [path] - Class ID to fetch attendance for
 * @returns {SuccessResponse} 200 - Student's attendance record with classId and status
 * @returns {ErrorResponse} 400 - Validation error (invalid class ID format)
 * @returns {ErrorResponse} 401 - Unauthorized (not authenticated)
 * @returns {ErrorResponse} 403 - Forbidden (student not enrolled in class)
 * @returns {ErrorResponse} 404 - Class not found
 * @returns {ErrorResponse} 500 - Failed to fetch attendance records / Unknown error occurred
 * @note Only returns attendance records for the authenticated student
 * @note Student must be enrolled in the class to view their attendance
 */
attendanceRouter.get('/class/:id/my-attendance', authMiddleware, studentRoleMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        
        // validate class ID path param
        const validationResult = ClassIdPathParamSchema.safeParse(req.params.id);

        if (!validationResult.success) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Invalid class ID format',
            };
            res.status(400).json(errorResponse);
            return;
        }

        const classId : ClassIdPathParam = validationResult.data;

        // verify if class exists
        const classDoc = await dbService.getClassById(classId);
        if (classDoc === null) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Class not found',
            };

            ErrorResponseSchema.parse(errorResponse);
            res.status(404).json(errorResponse);
            return;
        }

        // verify if student is enrolled in class
        if (!classDoc.studentIds.map(id => id.toString()).includes(req.user!.userId)) {
            const errorResponse: ErrorResponse = {
                success: false,
                error: 'Forbidden, student not enrolled in class',
            };

            ErrorResponseSchema.parse(errorResponse);
            res.status(403).json(errorResponse);
            return;
        }


        let successResponse : SuccessResponse;
        // fetch attendance records for student in class
        const attendanceRecord = await dbService.getAttendanceRecordsForStudentInClass(req.user!.userId, classId);

        if (attendanceRecord === null) {
            successResponse = {
                success: true,
                data: {
                    classId: classId,
                    status: null,
                },      
            };
            SuccessResponseSchema.parse(successResponse);
            res.status(200).json(successResponse);
            return;
        }

        // prepare response data

        successResponse = {
            success: true,
            data: {
                classId: classId,
                status: attendanceRecord.status,
            },
        };

        SuccessResponseSchema.parse(successResponse);
        res.status(200).json(successResponse);
        return;

    } catch (error) {
        console.error('❌ Error fetching student attendance records:', error);
        const errorResponse: ErrorResponse = {
            success: false, 
            error: 'Unknown error occurred',
        };        
        ErrorResponseSchema.parse(errorResponse);
        res.status(500).json(errorResponse);
    }
});



export default attendanceRouter;