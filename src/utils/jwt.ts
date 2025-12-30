import jwt from 'jsonwebtoken';
import { type UserRole  } from '../constants.js';
import { JWTPayloadSchema, type JWTPayload } from '../schemas/jwt.js';
import config from '../config.js';

const JWT_SECRET = config.JWT_SECRET_KEY;

export function generateJWT(jwtPayload: JWTPayload): string {
    return jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '1h' });
}

export function verifyJWT(token: string): JWTPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const parsedPayload = JWTPayloadSchema.parse(decoded);
        return parsedPayload;
    } catch (error) {
        return null;
    }
}