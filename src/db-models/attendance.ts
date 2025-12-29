import { Schema, model, Types } from "mongoose";
import { AttendanceStatuses, type AttendanceStatus } from "../constants.js";

export interface AttendanceDocument {
    _id: Types.ObjectId;
    classId: Types.ObjectId;
    studentId: Types.ObjectId;
    status: AttendanceStatus;
}

export const AttendanceSchema = new Schema<AttendanceDocument>({
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: AttendanceStatuses, required: true },
});

export const AttendanceModel = model<AttendanceDocument>("Attendance", AttendanceSchema);