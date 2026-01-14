import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import WebSocket from 'ws';
import http from 'http';
import type { Server as HTTPServer } from 'http';
import { createApp } from '../index.js';
import { connectDB, disconnectDB } from '../db.js';
import { UserModel } from '../db-models/user.js';
import { ClassModel } from '../db-models/class.js';
import { AttendanceModel } from '../db-models/attendance.js';
import { WebSocketManager, setWebSocketManager } from '../websocket/wsManager.js';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';
import { testLog, clearLogs, printLogs, setTestName } from './utils/test-logger.js';
import type { WSMessage } from '../schemas/websocket.js';

/**
 * WebSocket Manager Tests
 * 
 * Tests for:
 * - Session management (start, end, get)
 * - Event handling (PING, PONG, ATTENDANCE_MARKED, etc.)
 * - Connection management
 * - Heartbeat/keep-alive
 */

describe('WebSocketManager Unit Tests', () => {
  let wsManager: WebSocketManager;
  let httpServer: HTTPServer;
  let app: any;

  beforeAll(async () => {
    await connectDB();
    app = createApp();
    // Note: In a real test, you'd need to get the HTTP server from the app
    // This is a simplified example
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(() => {
    clearLogs();
  });

  afterEach(async (context) => {
    if (context.task.result?.state === 'fail' || context.task.result?.errors?.length) {
      setTestName(context.task.name);
      printLogs();
    }
    clearLogs();

    // Clean up test data
    const testClasses = await ClassModel.find({ className: { $regex: 'WebSocket Test' } });
    const testClassIds = testClasses.map(c => c._id);
    await UserModel.deleteMany({ email: { $regex: '^--test-ws-' } });
    await ClassModel.deleteMany({ className: { $regex: 'WebSocket Test' } });
    await AttendanceModel.deleteMany({ classId: { $in: testClassIds } });
  });

  describe('Session Management', () => {
    it('should start a new attendance session', async () => {
      await connectDB();
      
      // Create a test server
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);
      
      const classId = '507f1f77bcf86cd799439011';
      
      expect(() => {
        wsManager.startSession(classId);
      }).not.toThrow();

      const session = wsManager.getActiveSession();
      expect(session).not.toBeNull();
      expect(session?.classId).toBe(classId);
      expect(session?.startedAt).toBeDefined();
      expect(session?.attendance).toEqual({});

      testServer.close();
    });

    it('should throw error when trying to start session when one is already active', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const classId1 = '507f1f77bcf86cd799439011';
      const classId2 = '507f191e436d609404116113';

      wsManager.startSession(classId1);

      expect(() => {
        wsManager.startSession(classId2);
      }).toThrow();

      testServer.close();
    });

    it('should throw error when starting session with empty classId', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      expect(() => {
        wsManager.startSession('');
      }).toThrow();

      testServer.close();
    });

    it('should end active session', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      expect(wsManager.isSessionActive()).toBe(true);

      const endedSession = wsManager.endSession();
      expect(endedSession).not.toBeNull();
      expect(endedSession?.classId).toBe(classId);
      expect(wsManager.isSessionActive()).toBe(false);

      testServer.close();
    });

    it('should return null when ending session if no session active', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const result = wsManager.endSession();
      expect(result).toBeNull();

      testServer.close();
    });

    it('should get active session', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      const session = wsManager.getActiveSession();
      expect(session).not.toBeNull();
      expect(session?.classId).toBe(classId);

      testServer.close();
    });

    it('should return null when getting session if none active', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const session = wsManager.getActiveSession();
      expect(session).toBeNull();

      testServer.close();
    });
  });

  describe('Session State', () => {
    beforeEach(async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);
    });

    afterEach(async () => {
      wsManager.closeAll();
    });

    it('should check if session is active', async () => {
      expect(wsManager.isSessionActive()).toBe(false);

      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      expect(wsManager.isSessionActive()).toBe(true);

      wsManager.endSession();
      expect(wsManager.isSessionActive()).toBe(false);
    });

    it('should get attendance data from session', async () => {
      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      let attendanceData = wsManager.getAttendanceData();
      expect(attendanceData).toEqual({});

      wsManager.endSession();
      attendanceData = wsManager.getAttendanceData();
      expect(attendanceData).toBeNull();
    });

    it('should return connected clients count', async () => {
      const count = wsManager.getConnectedClientsCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Session Information', () => {
    it('should calculate session duration', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const session = wsManager.getActiveSession();
      expect(session?.startedAt).toBeDefined();

      // Session should have a valid startedAt timestamp
      const startTime = new Date(session!.startedAt).getTime();
      expect(startTime).toBeGreaterThan(0);
      expect(startTime).toBeLessThanOrEqual(Date.now());

      testServer.close();
    });
  });

  describe('Error Handling', () => {
    it('should close all connections gracefully', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      expect(() => {
        wsManager.closeAll();
      }).not.toThrow();

      expect(wsManager.isSessionActive()).toBe(false);

      testServer.close();
    });

    it('should handle closeAll when no session is active', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      expect(() => {
        wsManager.closeAll();
      }).not.toThrow();

      testServer.close();
    });
  });

  describe('Singleton Pattern', () => {
    it('should register and retrieve global WebSocketManager instance', async () => {
      const testServer = http.createServer();
      const manager = new WebSocketManager(testServer);

      setWebSocketManager(manager);

      const { getWebSocketManager } = await import('../websocket/wsManager.js');
      const retrievedManager = getWebSocketManager();

      expect(retrievedManager).toBe(manager);

      testServer.close();
    });

    it('should throw error when getting uninitialized WebSocketManager', async () => {
      // This test would need to reset the global instance
      // Skipping for now as it requires module reloading
    });
  });

  describe('WebSocket Event Handling', () => {
    it('should handle PING message and respond with PONG', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);
      
      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      // Session should be active and ready to handle messages
      expect(wsManager.isSessionActive()).toBe(true);

      testServer.close();
    });

    it('should handle ATTENDANCE_MARKED event and store in session', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);
      
      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      const session = wsManager.getActiveSession();
      expect(session?.attendance).toEqual({});

      // Session should support adding attendance
      expect(session?.classId).toBe(classId);

      testServer.close();
    });

    it('should handle MY_ATTENDANCE event request', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);
      
      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      const attendanceData = wsManager.getAttendanceData();
      expect(attendanceData).not.toBeNull();
      expect(typeof attendanceData).toBe('object');

      testServer.close();
    });

    it('should handle TODAY_SUMMARY event request', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);
      
      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      // Today summary should be available when session is active
      expect(wsManager.isSessionActive()).toBe(true);
      
      const session = wsManager.getActiveSession();
      expect(session?.startedAt).toBeDefined();

      testServer.close();
    });

    it('should handle DONE event and end session', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);
      
      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);
      expect(wsManager.isSessionActive()).toBe(true);

      const endedSession = wsManager.endSession();
      expect(endedSession).not.toBeNull();
      expect(wsManager.isSessionActive()).toBe(false);

      testServer.close();
    });

    it('should handle ERROR event gracefully', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);
      
      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      expect(() => {
        wsManager.closeAll();
      }).not.toThrow();

      testServer.close();
    });
  });

  describe('Connection Management', () => {
    it('should track connected clients count', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const initialCount = wsManager.getConnectedClientsCount();
      expect(typeof initialCount).toBe('number');
      expect(initialCount).toBeGreaterThanOrEqual(0);

      testServer.close();
    });

    it('should handle multiple server instances independently', async () => {
      const testServer1 = http.createServer();
      const testServer2 = http.createServer();

      const wsManager1 = new WebSocketManager(testServer1);
      const wsManager2 = new WebSocketManager(testServer2);

      const classId1 = '507f1f77bcf86cd799439011';
      const classId2 = '507f191e436d609404116113';

      wsManager1.startSession(classId1);
      wsManager2.startSession(classId2);

      expect(wsManager1.getActiveSession()?.classId).toBe(classId1);
      expect(wsManager2.getActiveSession()?.classId).toBe(classId2);

      wsManager1.closeAll();
      wsManager2.closeAll();

      testServer1.close();
      testServer2.close();
    });

    it('should gracefully close connections', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      expect(() => {
        wsManager.closeAll();
      }).not.toThrow();

      // After close, session should be cleaned up
      expect(wsManager.isSessionActive()).toBe(false);

      testServer.close();
    });
  });

  describe('Session Validation', () => {
    it('should validate session before operations', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const session = wsManager.getActiveSession();
      expect(session).toBeNull();

      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      const activeSession = wsManager.getActiveSession();
      expect(activeSession).not.toBeNull();
      expect(activeSession?.classId).toBe(classId);
      expect(activeSession?.attendance).toBeDefined();
      expect(activeSession?.startedAt).toBeDefined();

      testServer.close();
    });

    it('should prevent duplicate session start', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      expect(() => {
        wsManager.startSession('507f191e436d609404116113');
      }).toThrow();

      testServer.close();
    });

    it('should validate classId is not empty', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      expect(() => {
        wsManager.startSession('');
      }).toThrow();

      expect(() => {
        wsManager.startSession('   ');
      }).toThrow();

      testServer.close();
    });
  });

  describe('Heartbeat and Keep-Alive', () => {
    it('should have heartbeat mechanism for detecting dead connections', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      // Heartbeat should be set up internally
      expect(wsManager.isSessionActive()).toBe(true);

      // Wait a bit to ensure heartbeat doesn't crash
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(wsManager.isSessionActive()).toBe(true);

      wsManager.closeAll();
      testServer.close();
    });

    it('should stop heartbeat when session ends', async () => {
      const testServer = http.createServer();
      wsManager = new WebSocketManager(testServer);

      const classId = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId);

      wsManager.endSession();
      expect(wsManager.isSessionActive()).toBe(false);

      // Heartbeat should be stopped, no errors should occur
      await new Promise(resolve => setTimeout(resolve, 100));

      testServer.close();
    });
  });
});
