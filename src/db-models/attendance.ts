import { Schema, model, Types, Document } from "mongoose";
import { AttendanceStatuses, type AttendanceStatus } from "../constants.js";

/**
 * Attendance Document Interface
 * @interface AttendanceDocument
 * @description Represents an attendance record for a student in a class
 * @property {Types.ObjectId} _id - MongoDB unique identifier
 * @property {Types.ObjectId} classId - Reference to the Class document
 * @property {Types.ObjectId} studentId - Reference to the Student (User) document
 * @property {AttendanceStatus} status - Attendance status (e.g., 'present', 'absent')
 */
export interface AttendanceDocument extends Document{
    _id: Types.ObjectId;
    classId: Types.ObjectId;
    studentId: Types.ObjectId;
    status: AttendanceStatus;
}

/**
 * Attendance Mongoose Schema
 * @description Defines the structure and validation rules for attendance records
 * Records map students to classes with their attendance status
 * References Class and User models for data integrity
 */
export const AttendanceSchema = new Schema<AttendanceDocument>({
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: AttendanceStatuses, required: true },
});

/**
 * Attendance Model
 * @description Mongoose model for querying and managing attendance records
 * @example
 * // Mark a student present
 * const record = await AttendanceModel.create({ classId, studentId, status: 'present' });
 * 
 * // Get attendance records with populated class and student details
 * const records = await AttendanceModel.find({ classId }).populate('classId').populate('studentId');
 */
export const AttendanceModel = model<AttendanceDocument>("Attendance", AttendanceSchema);