import { Router, type Request, type Response } from 'express';
import { SignupSchema, type SignupData, LoginSchema, type LoginData } from '../schemas/auth.js';
import { SuccessResponseSchema, ErrorResponseSchema, type SuccessResponse, type ErrorResponse } from '../schemas/responses.js';
import { authMiddleware } from '../middleware/auth.js';
import { type JWTPayload, type JWTDecoded } from '../schemas/jwt.js';
import { generateJWT } from '../utils/jwt.js';
import { dbService } from '../utils/db.js';

/**
 * Authentication Routes
 * @module routes/auth
 * @description Handles user authentication endpoints: signup, login, and profile retrieval
 */
const authRouter : Router = Router();


/**
 * POST /auth/signup
 * @description Register a new user account
 * @param {SignupData} req.body [body] - User registration data (name, email, password, role)
 * @returns {SuccessResponse} 201 - User created with profile data (no token)
 * @returns {ErrorResponse} 400 - Validation error or email already exists
 */
authRouter.post('/signup', async (req: Request, res: Response): Promise<void>  => {
  try {
    // Validate request body against SignupSchema
    const validationResult = SignupSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid request schema',
      };
      
      ErrorResponseSchema.parse(errorResponse);
      res.status(400).json(errorResponse);
      return;
    }
    
    const signupData: SignupData = validationResult.data;

    // Check if user with the same email already exists
    const existingUser = await dbService.getUserByEmail(signupData.email);
    if (existingUser) {
        const errorResponse: ErrorResponse = {
            success: false,
            error: 'Email already exists',
        };

        ErrorResponseSchema.parse(errorResponse);
        res.status(400).json(errorResponse);
        return;
    }

    // Create new user document
    const newUser = await dbService.createUser(signupData);

    // Hash password using UserModel method
    if (newUser) {
      await newUser.hashPassword(signupData.password);
      await newUser.save();
    }

    if (!newUser) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to create user',
      };

      ErrorResponseSchema.parse(errorResponse);
      res.status(400).json(errorResponse);
      return;
    }
    const successResponse: SuccessResponse = {
      success: true,
      data: {
        _id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    };

    SuccessResponseSchema.parse(successResponse);
    res.status(201).json(successResponse);

  } catch (error) {
    // Handle other exceptions (database, JWT, etc.)
    const errorResponse: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed - unknown error occurred',
    };

    ErrorResponseSchema.parse(errorResponse);
    res.status(400).json(errorResponse);
  }
});


/**
 * POST /auth/login
 * @description Authenticate user and return JWT token
 * @param {LoginData} req.body [body] - User credentials (email, password)
 * @returns {SuccessResponse} 200 - Authentication successful with JWT token
 * @returns {ErrorResponse} 401 - Invalid email or password
 * @returns {ErrorResponse} 400 - Validation error or login failed
 */
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body against LoginSchema
    const validationResult = LoginSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid request schema',
      };

      ErrorResponseSchema.parse(errorResponse);
      res.status(400).json(errorResponse);
      return;
    }

    const loginData: LoginData = validationResult.data;

    // Find user by email (fetch password for authentication)
    const userData = await dbService.getUserByEmail(loginData.email, true);
    if (!userData) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid email or password',
      };

      ErrorResponseSchema.parse(errorResponse);
      res.status(401).json(errorResponse);
      return;
    }

    // Compare passwords using UserModel method
    const passwordMatch = await userData.comparePassword(loginData.password);
    if (!passwordMatch) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid email or password',
      };

      ErrorResponseSchema.parse(errorResponse);
      res.status(401).json(errorResponse);
      return;
    }

   // Prepare JWT payload with user credentials
   const jwtPayload: JWTPayload = {
      userId: userData._id.toString(),
      role: userData.role,
    };

    // Generate JWT token
    const jwtToken = generateJWT(jwtPayload);
  
    const successResponse: SuccessResponse = {
      success: true,
      data: {
        token: jwtToken, 
      },
    };

    SuccessResponseSchema.parse(successResponse);
    res.status(200).json(successResponse);

  } catch (error) {
    // Handle other exceptions
    const errorResponse: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed - unknown error occurred',
    };

    ErrorResponseSchema.parse(errorResponse);
    res.status(400).json(errorResponse);
  }
});


/**
 * GET /auth/me
 * @description Retrieve current authenticated user's profile
 * @param {string} req.headers.authorization [header] - JWT token in format <token>
 * @requires Authentication - Must include valid JWT token in Authorization header
 * @returns {SuccessResponse} 200 - Current user's profile data
 * @returns {ErrorResponse} 401 - Unauthorized (invalid or missing token)
 * @returns {ErrorResponse} 404 - User not found
 * @returns {ErrorResponse} 400 - Fetch failed
 */
authRouter.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // authMiddleware ensures req.user exists
    const userData = await dbService.getUserById(req.user!.userId);
    
    if (!userData) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'User not found',
      };
      
      ErrorResponseSchema.parse(errorResponse);
      res.status(404).json(errorResponse);
      return;
    }

    const successResponse: SuccessResponse = {
      success: true,
      data: {
        _id: userData._id.toString(),
        name: userData.name,
        email: userData.email,
        role: userData.role,
      },
    };

    SuccessResponseSchema.parse(successResponse);
    res.status(200).json(successResponse);
  } catch (error) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user',
    };

    ErrorResponseSchema.parse(errorResponse);
    res.status(400).json(errorResponse);
  }
});


export default authRouter;