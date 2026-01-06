import config from './config.js';

import express, { type Request, type Response, type Express } from 'express'; 
import { SuccessResponseSchema, ErrorResponseSchema, type SuccessResponse, type ErrorResponse } from './schemas/responses.js';
import { connectDB, disconnectDB } from './db.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import classRoutes from './routes/class.js';

export async function createApp(): Promise<Express> {
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
  app.use(classRoutes); // Class Routes

  // Unknown Route 404 handler
  app.use((req: Request, res: Response) => {
    const unknownRouteResponse: ErrorResponse = {
      success: false,
      error: `Route not found: ${req.method} ${req.path}`
    };

    ErrorResponseSchema.parse(unknownRouteResponse);  
    res.status(404).json(unknownRouteResponse);
  });

  return app;
}

/**
 * Graceful Shutdown Handler
 * Closes HTTP server and database connections cleanly
 */
function createShutdownHandler(server: any): (signal: string) => Promise<void> {
  return async (signal: string): Promise<void> => {
    console.log(`\n⏹️  ${signal} received. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(async () => {
      console.log('📭 HTTP server closed, no longer accepting connections');
      
      try {
        // Close database connection
        await disconnectDB();
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during database disconnection:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds if still running
    setTimeout(() => {
      console.error('⚠️  Graceful shutdown timeout - forcing exit');
      process.exit(1);
    }, 10000);
  };
}

async function main(): Promise<void> {
  try {
    // Connect to MongoDB first
    await connectDB();

    const app = await createApp();

    const server = app.listen(config.APP_PORT, () => {
      console.log(`Server running on port ${config.APP_PORT}`);
    });

    // Create and register shutdown handler
    const shutdown = createShutdownHandler(server);
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();