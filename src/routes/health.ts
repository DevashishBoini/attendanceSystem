import { Router } from 'express';
import type { Request, Response } from 'express';
import path from 'path';

const healthRouter: Router = Router();

/**
 * Health check endpoint
 * Returns server status
 */
healthRouter.get('/', (req: Request, res: Response): void => {
  console.log('✅ Health check endpoint hit!!');
  res.json({ message: 'Attendance API running' });
});

/**
 * AsyncAPI WebSocket Test UI
 * Interactive tool for testing WebSocket connections and events
 * Access at: /ws-test
 */
healthRouter.get('/ws-test', (req: Request, res: Response): void => {
  const filePath = path.join(process.cwd(), 'public', 'asyncapi-test.html');
  res.sendFile(filePath);
});

export default healthRouter;
