import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { connectDB, disconnectDB, isDBConnected, getDbClient } from '../db.js';
import { UserModel } from '../db-models/user.js';
import { testLog, clearLogs, printLogs, setTestName } from './utils/test-logger.js';

describe('Database Connection', () => {
  beforeEach(() => {
    clearLogs();
  });

  // Clean state between tests
  afterEach(async (context) => {
    // Print logs only if test failed
    if (context.task.result?.state === 'fail' || context.task.result?.errors?.length) {
      setTestName(context.task.name);
      printLogs();
    }
    clearLogs();
    
    try {
      await disconnectDB();
    } catch (error) {
      // Ignore errors if already disconnected
    }
  });

  describe('Connection Lifecycle', () => {
    it('should successfully connect to MongoDB', async () => {
      await connectDB();
      expect(isDBConnected()).toBe(true);
    });

    it('should successfully disconnect from MongoDB', async () => {
      await connectDB();
      expect(isDBConnected()).toBe(true);
      
      await disconnectDB();
      expect(isDBConnected()).toBe(false);
    });

    it('should complete full lifecycle: connect → query → disconnect → reconnect → query', async () => {
      // Connect and verify
      await connectDB();
      expect(isDBConnected()).toBe(true);

      // Perform database operation
      const initialCount = await UserModel.countDocuments();
      expect(typeof initialCount).toBe('number');
      expect(initialCount).toBeGreaterThanOrEqual(0);

      // Disconnect and verify
      await disconnectDB();
      expect(isDBConnected()).toBe(false);

      // Reconnect and verify
      await connectDB();
      expect(isDBConnected()).toBe(true);

      // Perform another database operation and verify data consistency
      const reconnectedCount = await UserModel.countDocuments();
      expect(typeof reconnectedCount).toBe('number');
      expect(reconnectedCount).toBeGreaterThanOrEqual(0);
      expect(reconnectedCount).toBe(initialCount); // Data should be consistent
    });
  });

  describe('Connection State', () => {
    it('should report correct connection state after connectDB', async () => {
      await connectDB();
      expect(isDBConnected()).toBe(true);
      
      // Verify by performing a database operation
      const count = await UserModel.countDocuments();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should report disconnected state after disconnectDB', async () => {
      await connectDB();
      await disconnectDB();
      expect(isDBConnected()).toBe(false);
      
      // Verify reconnection works
      await connectDB();
      expect(isDBConnected()).toBe(true);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same database client instance on multiple calls', async () => {
      const client1 = getDbClient();
      
      await connectDB();
      expect(isDBConnected()).toBe(true);
      
      const client2 = getDbClient();
      await connectDB();
      expect(isDBConnected()).toBe(true);
      
      // Verify it's the exact same instance reference
      expect(client1).toBe(client2);
    });

    it('should maintain connection state across multiple operations', async () => {
      await connectDB();
      expect(isDBConnected()).toBe(true);

      // Perform multiple operations
      const count1 = await UserModel.countDocuments();
      const count2 = await UserModel.countDocuments();
      
      // Connection should remain active
      expect(isDBConnected()).toBe(true);
      expect(typeof count1).toBe('number');
      expect(count1).toBeGreaterThanOrEqual(0);
      expect(typeof count2).toBe('number');
      expect(count2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle multiple disconnects gracefully', async () => {
      await connectDB();
      await disconnectDB();
      expect(isDBConnected()).toBe(false);

      // Second disconnect should not throw
      await disconnectDB();
      expect(isDBConnected()).toBe(false);
    });

    it('should allow reconnection after disconnection', async () => {
      await connectDB();
      expect(isDBConnected()).toBe(true);
      
      await disconnectDB();
      expect(isDBConnected()).toBe(false);

      // Reconnection should succeed
      await connectDB();
      expect(isDBConnected()).toBe(true);
    });
  });
});
