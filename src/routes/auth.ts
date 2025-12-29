import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import { SignupSchema, type SignupData, LoginSchema, type LoginData } from '../schemas/auth.js';
import { SuccessResponseSchema, ErrorResponseSchema, type SuccessResponse, type ErrorResponse } from '../schemas/responses.js';
import { UserModel } from '../db-models/user.js';
import config from '../config.js';
import jwt from 'jsonwebtoken';

const authRouter : Router = Router();


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
    const existingUser = await UserModel.findOne({ email: signupData.email });
    if (existingUser) {
        const errorResponse: ErrorResponse = {
            success: false,
            error: 'Email already exists',
        };

        ErrorResponseSchema.parse(errorResponse);
        res.status(400).json(errorResponse);
        return;
    }

    // Hash the password before saving [with no. of salt rounds set]
    const hashedPassword = await bcrypt.hash(signupData.password, config.BCRYPT_SALT_ROUNDS);

    const newSignupData = {...signupData, password: hashedPassword};
    // Create new user document
    const newUser = await UserModel.create(newSignupData);

    // Respond with success (user created, no token)
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

    // Find user by email (explicitly select password field since it has select: false)
    const user = await UserModel.findOne({ email: loginData.email }).select('+password');
    if (!user) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid email or password',
      };

      ErrorResponseSchema.parse(errorResponse);
      res.status(401).json(errorResponse);
      return;
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(loginData.password, user.password);
    if (!passwordMatch) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid email or password',
      };

      ErrorResponseSchema.parse(errorResponse);
      res.status(401).json(errorResponse);
      return;
    }

    // Respond with success and JWT token
    // Generate JWT token
    const jwtToken = jwt.sign({ userId: user._id }, config.JWT_SECRET_KEY, { expiresIn: '1h' })
  
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


export default authRouter;