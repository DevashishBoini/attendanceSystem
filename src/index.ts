import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { connectDB } from './db.js';
import routes from './routes/index.js';

async function main(): Promise<void> {
  try {
    // Connect to MongoDB first
    await connectDB();

    const app = express();
    app.use(express.json());
    app.use(routes);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();