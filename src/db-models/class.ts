import { Schema, model, Types, Document
    
 } from "mongoose";

/**
 * Class Document Interface
 * @interface ClassDocument
 * @description Represents a class in the database
 * @property {Types.ObjectId} _id - MongoDB unique identifier
 * @property {string} className - Name of the class (unique)
 * @property {Types.ObjectId} teacherId - Reference to the teacher's User document
 * @property {Array<Types.ObjectId>} studentIds - Array of student User ID references
 */
export interface ClassDocument extends Document{
    _id: Types.ObjectId;
    className: string;
    teacherId: Types.ObjectId;
    studentIds: Array<Types.ObjectId>;
}
 
/**
 * Class Mongoose Schema
 * @description Defines the structure and validation rules for class documents
 * References User model for teacher and students
 * Enforces unique class names
 */
export const ClassSchema = new Schema<ClassDocument>({
    className: { type: String, required: true},
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    studentIds: {
        type: [{ type: Schema.Types.ObjectId, ref: "User" }],
        default: [],
    }
});

/**
 * Class Model
 * @description Mongoose model for querying and managing class documents
 * @example
 * // Create a new class
 * const newClass = await ClassModel.create({ className: 'Physics 101', teacherId: teacherId, studentIds: [] });
 * 
 * // Get class with teacher and student details
 * const classWithDetails = await ClassModel.findById(classId).populate('teacherId').populate('studentIds');
 */
export const ClassModel = model<ClassDocument>("Class", ClassSchema);