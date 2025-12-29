import config from './config.js';

import express, { type Request, type Response } from 'express'; 
import { SuccessResponseSchema, ErrorResponseSchema, type SuccessResponse, type ErrorResponse } from './schemas/responses.js';
import { connectDB } from './db.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';

async function main(): Promise<void> {
  try {
    // Connect to MongoDB first
    await connectDB();

    const app = express(); // create Express app    
    app.use(express.json()); // Middleware - Parse JSON
    app.set('json spaces', config.JSON_SPACES); // Pretty-print JSON responses

    // Middleware - Request logging
    app.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.path}`);
    next();
    });

    app.use('/', healthRoutes); // Health Routes
    app.use('/auth', authRoutes); // Auth Routes

     // Unknown Route 404 handler
    app.use((req: Request, res: Response) => {

      const unknownRouteResponse: ErrorResponse = {
        success: false,
        error: `Route not found: ${req.method} ${req.path}`
      };

      ErrorResponseSchema.parse(unknownRouteResponse);  
      res.status(404).json(unknownRouteResponse);
    });

    app.listen(config.APP_PORT, () => {
      console.log(`Server running on port ${config.APP_PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();