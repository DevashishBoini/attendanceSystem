import { Schema, model, Types } from "mongoose";
import { UserRoles, type UserRole } from "../constants.js";


export interface UserDocument {
    _id: Types.ObjectId;
    name: string;
    email: string;
    password: string; // hashed with bcrypt
    role: UserRole;
}

export const UserSchema = new Schema<UserDocument>({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: UserRoles, required: true },
});

export const UserModel = model<UserDocument>("User", UserSchema);