import { Schema, model, Types } from "mongoose";

export interface ClassDocument {
    _id: Types.ObjectId;
    className: string;
    teacherId: Types.ObjectId;
    studentIds: Types.ObjectId[];
}

export const ClassSchema = new Schema<ClassDocument>({
    className: { type: String, required: true, unique: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    studentIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

export const ClassModel = model<ClassDocument>("Class", ClassSchema);