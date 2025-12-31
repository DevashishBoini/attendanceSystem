import jwt from 'jsonwebtoken';
import { JWTPayloadSchema, type JWTPayload, JWTDecodedSchema, type JWTDecoded } from '../schemas/jwt.js';
import config from '../config.js';

const JWT_SECRET = config.JWT_SECRET_KEY;

export function generateJWT(jwtPayload: JWTPayload): string {
    return jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: config.JWT_EXPIRATION });
}

export function verifyJWT(token: string): JWTDecoded | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const parsedPayload = JWTDecodedSchema.parse(decoded);
        return parsedPayload;
    } catch (error) {
        return null;
    }
}