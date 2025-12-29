import jwt from 'jsonwebtoken';
import { type UserRole  } from '../constants.js';
import { JWTPayloadSchema, type JWTPayload } from '../schemas/jwt.js';
import config from '../config.js';

const JWT_SECRET = config.JWT_SECRET_KEY;

export function generateJWT(userId: string, role: UserRole): string {
    const payload: JWTPayload = {
    userId: userId,
    role: role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export function verifyJWT(token: string): JWTPayload {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const parsedPayload = JWTPayloadSchema.parse(decoded);
        return parsedPayload;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}