import { Router } from 'express';
import type { Request, Response } from 'express';

const router: Router = Router();

/**
 * Health check endpoint
 * Returns server status
 */
router.get('/', (req: Request, res: Response): void => {
  console.log('✅ Health check endpoint hit!!');
  res.json({ message: 'Attendance API running' });
});

export default router;
