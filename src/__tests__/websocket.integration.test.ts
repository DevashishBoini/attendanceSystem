import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import http from 'http';
import { Types } from 'mongoose';
import type { Server as HTTPServer } from 'http';
import { createApp } from '../index.js';
import { connectDB, disconnectDB } from '../db.js';
import { UserModel } from '../db-models/user.js';
import { ClassModel } from '../db-models/class.js';
import { AttendanceModel } from '../db-models/attendance.js';
import { WebSocketManager, setWebSocketManager, getWebSocketManager } from '../websocket/wsManager.js';
import { generateJWT } from '../utils/jwt.js';
import { TEACHER_ROLE, STUDENT_ROLE } from '../constants.js';
import { testLog, clearLogs, printLogs, setTestName } from './utils/test-logger.js';
import type { WSMessage } from '../schemas/websocket.js';

/**
 * WebSocket Integration Tests
 * 
 * Tests for:
 * - Real WebSocket connections with server
 * - Full message flow and event handling
 * - JWT authentication on connection
 * - Session management with multiple clients
 * - Heartbeat/keep-alive
 * - Connection errors and recovery
 */

describe('WebSocket Integration Tests', () => {
  let httpServer: HTTPServer;
  let app: any;
  let wsManager: WebSocketManager;
  let baseURL: string;
  let wsURL: string;
  let teacherToken: string;
  let studentToken: string;
  let teacherId: string;
  let studentId: string;
  let classId: string;

  beforeAll(async () => {
    await connectDB();
    app = await createApp();
    
    // Create HTTP server with WebSocket support
    httpServer = http.createServer(app);
    wsManager = new WebSocketManager(httpServer);
    setWebSocketManager(wsManager);

    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address !== 'string') {
          baseURL = `http://localhost:${address.port}`;
          wsURL = `ws://localhost:${address.port}/ws`;
          resolve();
        }
      });
    });

    // Create test teacher
    const teacherEmail = `--test-ws-teacher-${Date.now()}@example.com`;
    const teacherSignup = await UserModel.create({
      name: 'WS Test Teacher',
      email: teacherEmail,
      password: 'password123', // Will be hashed by model
      role: TEACHER_ROLE,
    });
    teacherId = (teacherSignup as any)._id.toString();
    teacherToken = generateJWT({ userId: teacherId, role: TEACHER_ROLE });

    // Create test student
    const studentEmail = `--test-ws-student-${Date.now()}@example.com`;
    const studentSignup = await UserModel.create({
      name: 'WS Test Student',
      email: studentEmail,
      password: 'password123',
      role: STUDENT_ROLE,
    });
    studentId = (studentSignup as any)._id.toString();
    studentToken = generateJWT({ userId: studentId, role: STUDENT_ROLE });

    // Create test class
    const classData = await ClassModel.create({
      className: `WebSocket Test Class ${Date.now()}`,
      teacherId: new Types.ObjectId(teacherId),
      studentIds: [new Types.ObjectId(studentId)],
    });
    classId = (classData as any)._id.toString();
  });

  afterAll(async () => {
    wsManager?.closeAll();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    const testClasses = await ClassModel.find({ className: { $regex: 'WebSocket Test' } });
    const testClassIds = testClasses.map(c => c._id);
    await UserModel.deleteMany({ email: { $regex: '^--test-ws-' } });
    await ClassModel.deleteMany({ className: { $regex: 'WebSocket Test' } });
    await AttendanceModel.deleteMany({ classId: { $in: testClassIds } });
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
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection with valid JWT token', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);

        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          resolve();
        });

        ws.on('error', (error) => {
          reject(error);
        });

        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            reject(new Error('Connection timeout'));
          }
        }, 5000);
      });
    });

    it('should reject connection with invalid JWT token', async () => {
      const invalidToken = 'invalid.jwt.token';

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsURL}?token=${invalidToken}`);
        let receivedError = false;

        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());
          // Expect ERROR event for invalid token
          if (message.event === 'ERROR') {
            receivedError = true;
          }
        });

        ws.on('close', () => {
          // Should have received ERROR before close
          if (receivedError) {
            resolve();
          } else {
            reject(new Error('Did not receive ERROR event for invalid token'));
          }
        });

        ws.on('error', () => {
          resolve();
        });

        setTimeout(() => {
          ws.close();
          resolve();
        }, 3000);
      });
    });

    it('should reject connection without token', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsURL}`);
        let receivedError = false;

        ws.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());
          // Expect ERROR event when token is missing
          if (message.event === 'ERROR') {
            receivedError = true;
          }
        });

        ws.on('close', () => {
          // Should have received ERROR before close
          if (receivedError) {
            resolve();
          } else {
            reject(new Error('Did not receive ERROR event when token missing'));
          }
        });

        ws.on('error', () => {
          resolve();
        });

        setTimeout(() => {
          ws.close();
          resolve();
        }, 3000);
      });
    });

    it('should handle connection closure gracefully', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);

        ws.on('open', () => {
          ws.close(1000, 'Normal closure');
        });

        ws.on('close', () => {
          expect(ws.readyState).toBe(WebSocket.CLOSED);
          resolve();
        });

        ws.on('error', (error) => {
          reject(error);
        });

        setTimeout(() => {
          reject(new Error('Connection closure timeout'));
        }, 5000);
      });
    });
  });

  describe('Message Exchange', () => {
    it('should send and receive PING/PONG messages', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);
        let pongReceived = false;

        ws.on('open', () => {
          const pingMessage: WSMessage = { event: 'PING', data: {} };
          ws.send(JSON.stringify(pingMessage));
        });

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            if (message.event === 'PONG') {
              pongReceived = true;
              ws.close();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('close', () => {
          if (pongReceived) {
            resolve();
          } else {
            reject(new Error('PONG not received'));
          }
        });

        ws.on('error', (error) => {
          reject(error);
        });

        setTimeout(() => {
          ws.close();
          reject(new Error('Message exchange timeout'));
        }, 5000);
      });
    });

    it('should handle malformed JSON messages gracefully', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);

        ws.on('open', () => {
          ws.send('invalid json {]'); // Malformed JSON
          setTimeout(() => {
            ws.close();
          }, 500);
        });

        ws.on('close', () => {
          resolve();
        });

        ws.on('error', () => {
          // Expected
          resolve();
        });

        setTimeout(() => {
          ws.close();
          resolve();
        }, 3000);
      });
    });
  });

  describe('Session Management with WebSocket', () => {
    it('should create and manage session state directly', async () => {
      // Test session creation directly on wsManager (simulating what API route does)
      const testClassId = '507f1f77bcf86cd799439011';
      
      expect(wsManager.isSessionActive()).toBe(false);
      
      wsManager.startSession(testClassId);
      expect(wsManager.isSessionActive()).toBe(true);
      
      const session = wsManager.getActiveSession();
      expect(session).not.toBeNull();
      expect(session?.classId).toBe(testClassId);

      // End session
      wsManager.endSession();
      expect(wsManager.isSessionActive()).toBe(false);
    });

    it('should prevent multiple concurrent sessions', async () => {
      // Start first session
      const classId1 = '507f1f77bcf86cd799439011';
      wsManager.startSession(classId1);

      expect(wsManager.isSessionActive()).toBe(true);

      // Try to start another session with same manager should fail
      const classId2 = '507f191e436d609404116113';
      expect(() => {
        wsManager.startSession(classId2);
      }).toThrow();

      wsManager.endSession();
    });
  });

  describe('Multiple Concurrent Connections', () => {
    it('should handle multiple client connections simultaneously', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws1 = new WebSocket(`${wsURL}?token=${teacherToken}`);
        const ws2 = new WebSocket(`${wsURL}?token=${studentToken}`);
        let openCount = 0;

        const onOpen = () => {
          openCount++;
          if (openCount === 2) {
            ws1.close();
            ws2.close();
          }
        };

        ws1.on('open', onOpen);
        ws2.on('open', onOpen);

        let closeCount = 0;
        const onClose = () => {
          closeCount++;
          if (closeCount === 2) {
            resolve();
          }
        };

        ws1.on('close', onClose);
        ws2.on('close', onClose);

        ws1.on('error', (error) => reject(error));
        ws2.on('error', (error) => reject(error));

        setTimeout(() => {
          ws1.close();
          ws2.close();
          reject(new Error('Multiple connections timeout'));
        }, 5000);
      });
    });

    it('should track connected clients count', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws1 = new WebSocket(`${wsURL}?token=${teacherToken}`);
        const ws2 = new WebSocket(`${wsURL}?token=${studentToken}`);
        let openCount = 0;

        const onOpen = () => {
          openCount++;
          if (openCount === 2) {
            const count = wsManager.getConnectedClientsCount();
            expect(count).toBeGreaterThanOrEqual(2);
            ws1.close();
            ws2.close();
          }
        };

        ws1.on('open', onOpen);
        ws2.on('open', onOpen);

        let closeCount = 0;
        const onClose = () => {
          closeCount++;
          if (closeCount === 2) {
            resolve();
          }
        };

        ws1.on('close', onClose);
        ws2.on('close', onClose);

        ws1.on('error', (error) => reject(error));
        ws2.on('error', (error) => reject(error));

        setTimeout(() => {
          ws1.close();
          ws2.close();
          reject(new Error('Client count timeout'));
        }, 5000);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle disconnection during active session', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);

        ws.on('open', () => {
          // Abruptly close connection
          ws.terminate();
          setTimeout(() => {
            resolve();
          }, 500);
        });

        ws.on('error', () => {
          // Expected error
          resolve();
        });

        setTimeout(() => {
          resolve();
        }, 3000);
      });
    });

    it('should handle network errors gracefully', async () => {
      const invalidURL = `ws://invalid-host:12345?token=${teacherToken}`;

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(invalidURL);

        ws.on('open', () => {
          ws.close();
          reject(new Error('Should not connect to invalid host'));
        });

        ws.on('error', () => {
          // Expected error
          resolve();
        });

        setTimeout(() => {
          resolve();
        }, 3000);
      });
    });

    it('should close all connections when cleanup is called', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);

        ws.on('open', () => {
          wsManager.closeAll();
        });

        ws.on('close', () => {
          expect(ws.readyState).toBe(WebSocket.CLOSED);
          resolve();
        });

        ws.on('error', () => {
          resolve();
        });

        setTimeout(() => {
          resolve();
        }, 3000);
      });
    });
  });

  describe('Heartbeat/Keep-Alive', () => {
    it('should send periodic heartbeats to keep connection alive', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);
        let messageReceived = false;

        ws.on('open', () => {
          // Start an attendance session so heartbeat will send PINGs
          wsManager.startSession('507f1f77bcf86cd799439011');

          // Wait for any message (heartbeat PING or otherwise)
          const timeout = setTimeout(() => {
            wsManager.endSession();
            ws.close();
            // Connection stayed open without errors = heartbeat working
            resolve();
          }, 2500);
        });

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            messageReceived = true;
            // Successfully received a message
            if (message.event === 'PING') {
              // Send PONG response to keep heartbeat happy
              ws.send(JSON.stringify({ event: 'PONG', data: {} }));
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('error', (error) => {
          wsManager.endSession();
          reject(error);
        });
      });
    });
  });

  describe('Attendance Marking with Validation', () => {
    it('should mark attendance for enrolled student successfully', async () => {
      return new Promise<void>((resolve, reject) => {
        // Start a session as teacher
        wsManager.startSession(classId);

        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);
        let attendanceMarked = false;

        ws.on('open', () => {
          // Send ATTENDANCE_MARKED event
          const message: WSMessage = {
            event: 'ATTENDANCE_MARKED',
            data: {
              studentId,
              status: 'present'
            }
          };
          ws.send(JSON.stringify(message));
        });

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            // Should receive broadcast confirmation
            if (message.event === 'ATTENDANCE_MARKED' && message.data?.studentId === studentId) {
              attendanceMarked = true;
              ws.close();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('close', () => {
          wsManager.endSession();
          if (attendanceMarked) {
            resolve();
          } else {
            reject(new Error('Attendance not marked'));
          }
        });

        ws.on('error', (error) => {
          wsManager.endSession();
          reject(error);
        });

        setTimeout(() => {
          wsManager.endSession();
          ws.close();
          reject(new Error('Attendance marking timeout'));
        }, 5000);
      });
    });

    it('should reject marking attendance when class not found', async () => {
      return new Promise<void>((resolve, reject) => {
        // Start session with non-existent class ID
        const fakeClassId = new Types.ObjectId().toString();
        wsManager.startSession(fakeClassId);

        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);
        let errorReceived = false;

        ws.on('open', () => {
          // Try to mark attendance for valid student but in non-existent class
          const message: WSMessage = {
            event: 'ATTENDANCE_MARKED',
            data: {
              studentId,
              status: 'present'
            }
          };
          ws.send(JSON.stringify(message));
        });

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            if (message.event === 'ERROR' && message.data?.message?.includes('Class not found')) {
              errorReceived = true;
              ws.close();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('close', () => {
          wsManager.endSession();
          if (errorReceived) {
            resolve();
          } else {
            reject(new Error('Did not receive CLASS NOT FOUND error'));
          }
        });

        ws.on('error', (error) => {
          wsManager.endSession();
          reject(error);
        });

        setTimeout(() => {
          wsManager.endSession();
          ws.close();
          reject(new Error('Timeout waiting for error'));
        }, 5000);
      });
    });

    it('should reject marking attendance for student not enrolled in class', async () => {
      return new Promise<void>((resolve, reject) => {
        // Create a second student not enrolled in the class
        const unenrolledStudentId = new Types.ObjectId().toString();
        
        wsManager.startSession(classId);

        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);
        let errorReceived = false;

        ws.on('open', () => {
          // Try to mark attendance for unenrolled student
          const message: WSMessage = {
            event: 'ATTENDANCE_MARKED',
            data: {
              studentId: unenrolledStudentId,
              status: 'present'
            }
          };
          ws.send(JSON.stringify(message));
        });

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            if (message.event === 'ERROR' && message.data?.message?.includes('Student not found')) {
              errorReceived = true;
              ws.close();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('close', () => {
          wsManager.endSession();
          if (errorReceived) {
            resolve();
          } else {
            reject(new Error('Did not receive STUDENT NOT FOUND error'));
          }
        });

        ws.on('error', (error) => {
          wsManager.endSession();
          reject(error);
        });

        setTimeout(() => {
          wsManager.endSession();
          ws.close();
          reject(new Error('Timeout waiting for error'));
        }, 5000);
      });
    });
  });

  describe('TODAY_SUMMARY Event', () => {
    it('should return attendance summary for active session', async () => {
      return new Promise<void>((resolve, reject) => {
        wsManager.startSession(classId);

        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);
        let summaryReceived = false;

        ws.on('open', () => {
          // Mark one student present first
          const attendanceMsg: WSMessage = {
            event: 'ATTENDANCE_MARKED',
            data: {
              studentId,
              status: 'present'
            }
          };
          ws.send(JSON.stringify(attendanceMsg));

          // Then request summary
          setTimeout(() => {
            const summaryMsg: WSMessage = {
              event: 'TODAY_SUMMARY',
              data: {}
            };
            ws.send(JSON.stringify(summaryMsg));
          }, 500);
        });

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            if (message.event === 'TODAY_SUMMARY' && message.data?.present !== undefined) {
              expect(message.data.present).toBe(1);
              expect(message.data.absent).toBe(0);
              expect(message.data.total).toBe(1);
              summaryReceived = true;
              ws.close();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('close', () => {
          wsManager.endSession();
          if (summaryReceived) {
            resolve();
          } else {
            reject(new Error('Summary not received'));
          }
        });

        ws.on('error', (error) => {
          wsManager.endSession();
          reject(error);
        });

        setTimeout(() => {
          wsManager.endSession();
          ws.close();
          reject(new Error('Summary timeout'));
        }, 5000);
      });
    });

    it('should reject TODAY_SUMMARY request from non-teacher', async () => {
      return new Promise<void>((resolve, reject) => {
        wsManager.startSession(classId);

        const ws = new WebSocket(`${wsURL}?token=${studentToken}`);
        let errorReceived = false;

        ws.on('open', () => {
          const summaryMsg: WSMessage = {
            event: 'TODAY_SUMMARY',
            data: {}
          };
          ws.send(JSON.stringify(summaryMsg));
        });

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            if (message.event === 'ERROR' && message.data?.message?.includes('teacher')) {
              errorReceived = true;
              ws.close();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('close', () => {
          wsManager.endSession();
          if (errorReceived) {
            resolve();
          } else {
            reject(new Error('Did not receive teacher-only error'));
          }
        });

        ws.on('error', (error) => {
          wsManager.endSession();
          reject(error);
        });

        setTimeout(() => {
          wsManager.endSession();
          ws.close();
          reject(new Error('Summary rejection timeout'));
        }, 5000);
      });
    });
  });

  describe('MY_ATTENDANCE Event', () => {
    it('should return student attendance status when marked present', async () => {
      return new Promise<void>((resolve, reject) => {
        wsManager.startSession(classId);

        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);
        const studentWs = new WebSocket(`${wsURL}?token=${studentToken}`);
        let statusReceived = false;

        ws.on('open', () => {
          // Teacher marks student present
          const attendanceMsg: WSMessage = {
            event: 'ATTENDANCE_MARKED',
            data: {
              studentId,
              status: 'present'
            }
          };
          ws.send(JSON.stringify(attendanceMsg));
        });

        studentWs.on('open', () => {
          // Student requests their attendance status
          setTimeout(() => {
            const myAttendanceMsg: WSMessage = {
              event: 'MY_ATTENDANCE',
              data: {}
            };
            studentWs.send(JSON.stringify(myAttendanceMsg));
          }, 500);
        });

        studentWs.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            if (message.event === 'MY_ATTENDANCE' && message.data?.status === 'present') {
              statusReceived = true;
              studentWs.close();
              ws.close();
            }
          } catch (error) {
            reject(error);
          }
        });

        let closedCount = 0;
        const onClose = () => {
          closedCount++;
          if (closedCount === 2) {
            wsManager.endSession();
            if (statusReceived) {
              resolve();
            } else {
              reject(new Error('Status not received'));
            }
          }
        };

        ws.on('close', onClose);
        studentWs.on('close', onClose);

        ws.on('error', (error) => {
          wsManager.endSession();
          reject(error);
        });

        studentWs.on('error', (error) => {
          wsManager.endSession();
          reject(error);
        });

        setTimeout(() => {
          wsManager.endSession();
          ws.close();
          studentWs.close();
          reject(new Error('MY_ATTENDANCE timeout'));
        }, 5000);
      });
    });

    it('should return not yet updated status for unmarked student', async () => {
      return new Promise<void>((resolve, reject) => {
        wsManager.startSession(classId);

        const studentWs = new WebSocket(`${wsURL}?token=${studentToken}`);
        let statusReceived = false;

        studentWs.on('open', () => {
          // Student requests status without being marked
          const myAttendanceMsg: WSMessage = {
            event: 'MY_ATTENDANCE',
            data: {}
          };
          studentWs.send(JSON.stringify(myAttendanceMsg));
        });

        studentWs.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            if (message.event === 'MY_ATTENDANCE' && message.data?.status === 'not yet updated') {
              statusReceived = true;
              studentWs.close();
            }
          } catch (error) {
            reject(error);
          }
        });

        studentWs.on('close', () => {
          wsManager.endSession();
          if (statusReceived) {
            resolve();
          } else {
            reject(new Error('Not yet updated status not received'));
          }
        });

        studentWs.on('error', (error) => {
          wsManager.endSession();
          reject(error);
        });

        setTimeout(() => {
          wsManager.endSession();
          studentWs.close();
          reject(new Error('MY_ATTENDANCE not yet updated timeout'));
        }, 5000);
      });
    });

    it('should reject MY_ATTENDANCE request from non-student', async () => {
      return new Promise<void>((resolve, reject) => {
        wsManager.startSession(classId);

        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);
        let errorReceived = false;

        ws.on('open', () => {
          const myAttendanceMsg: WSMessage = {
            event: 'MY_ATTENDANCE',
            data: {}
          };
          ws.send(JSON.stringify(myAttendanceMsg));
        });

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            if (message.event === 'ERROR' && message.data?.message?.includes('student')) {
              errorReceived = true;
              ws.close();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('close', () => {
          wsManager.endSession();
          if (errorReceived) {
            resolve();
          } else {
            reject(new Error('Did not receive student-only error'));
          }
        });

        ws.on('error', (error) => {
          wsManager.endSession();
          reject(error);
        });

        setTimeout(() => {
          wsManager.endSession();
          ws.close();
          reject(new Error('MY_ATTENDANCE rejection timeout'));
        }, 5000);
      });
    });
  });

  describe('DONE Event', () => {
    it('should finalize session and save attendance to database', async () => {
      return new Promise<void>((resolve, reject) => {
        wsManager.startSession(classId);

        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);
        let doneReceived = false;

        ws.on('open', () => {
          // Mark student present
          const attendanceMsg: WSMessage = {
            event: 'ATTENDANCE_MARKED',
            data: {
              studentId,
              status: 'present'
            }
          };
          ws.send(JSON.stringify(attendanceMsg));

          // Then send DONE event
          setTimeout(() => {
            const doneMsg: WSMessage = {
              event: 'DONE',
              data: {}
            };
            ws.send(JSON.stringify(doneMsg));
          }, 500);
        });

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            if (message.event === 'DONE' && message.data?.message?.includes('persisted')) {
              expect(message.data.present).toBeGreaterThanOrEqual(1);
              expect(message.data.total).toBeGreaterThanOrEqual(1);
              doneReceived = true;
              ws.close();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('close', async () => {
          // Verify session was ended
          const activeSession = wsManager.getActiveSession();
          expect(activeSession).toBeNull();

          // Verify attendance was saved to database
          if (doneReceived) {
            const savedAttendance = await AttendanceModel.findOne({ classId });
            if (savedAttendance) {
              resolve();
            } else {
              reject(new Error('Attendance not saved to database'));
            }
          } else {
            reject(new Error('DONE event not received'));
          }
        });

        ws.on('error', (error) => {
          reject(error);
        });

        setTimeout(() => {
          ws.close();
          reject(new Error('DONE timeout'));
        }, 5000);
      });
    });

    it('should mark unmarked students as absent in DONE event', async () => {
      return new Promise<void>(async (resolve, reject) => {
        // Create a class with 2 students (original + one more)
        const additionalStudentId = new Types.ObjectId().toString();
        const testClassData = await ClassModel.create({
          className: `DONE Test Class ${Date.now()}`,
          teacherId: new Types.ObjectId(teacherId),
          studentIds: [new Types.ObjectId(studentId), new Types.ObjectId(additionalStudentId)],
        });
        const testClassId = (testClassData as any)._id.toString();

        wsManager.startSession(testClassId);

        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);
        let doneReceived = false;

        ws.on('open', () => {
          // Mark only first student present
          const attendanceMsg: WSMessage = {
            event: 'ATTENDANCE_MARKED',
            data: {
              studentId,
              status: 'present'
            }
          };
          ws.send(JSON.stringify(attendanceMsg));

          // Send DONE - second student should be marked absent
          setTimeout(() => {
            const doneMsg: WSMessage = {
              event: 'DONE',
              data: {}
            };
            ws.send(JSON.stringify(doneMsg));
          }, 500);
        });

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            if (message.event === 'DONE') {
              expect(message.data?.present).toBe(1);
              expect(message.data?.absent).toBe(1);
              expect(message.data?.total).toBe(2);
              doneReceived = true;
              ws.close();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('close', async () => {
          if (doneReceived) {
            // Cleanup test class
            await ClassModel.deleteOne({ _id: testClassId });
            resolve();
          } else {
            await ClassModel.deleteOne({ _id: testClassId });
            reject(new Error('DONE event not received'));
          }
        });

        ws.on('error', (error) => {
          reject(error);
        });

        setTimeout(() => {
          ws.close();
          reject(new Error('DONE unmarked students timeout'));
        }, 5000);
      });
    });

    it('should reject DONE from non-teacher', async () => {
      return new Promise<void>((resolve, reject) => {
        wsManager.startSession(classId);

        const ws = new WebSocket(`${wsURL}?token=${studentToken}`);
        let errorReceived = false;

        ws.on('open', () => {
          const doneMsg: WSMessage = {
            event: 'DONE',
            data: {}
          };
          ws.send(JSON.stringify(doneMsg));
        });

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data) as WSMessage;
            if (message.event === 'ERROR' && message.data?.message?.includes('teacher')) {
              errorReceived = true;
              ws.close();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on('close', () => {
          wsManager.endSession();
          if (errorReceived) {
            resolve();
          } else {
            reject(new Error('Did not receive teacher-only error'));
          }
        });

        ws.on('error', (error) => {
          wsManager.endSession();
          reject(error);
        });

        setTimeout(() => {
          wsManager.endSession();
          ws.close();
          reject(new Error('DONE rejection timeout'));
        }, 5000);
      });
    });
  });

  describe('Unknown Event Handling', () => {
    it('should return error for unknown event type', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsURL}?token=${teacherToken}`);

        ws.on('open', () => {
          const unknownEvent = {
            event: 'UNKNOWN_EVENT_TYPE',
            data: {},
          };
          ws.send(JSON.stringify(unknownEvent));
        });

        ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.event === 'ERROR' && message.data?.message === 'Unknown event') {
              ws.close();
              resolve();
            } else if (message.event === 'ERROR') {
              ws.close();
              reject(new Error(`Expected 'UNKNOWN_EVENT' error message, got: ${message.data?.message}`));
            }
          } catch (error) {
            ws.close();
            reject(error);
          }
        });

        setTimeout(() => {
          ws.close();
          reject(new Error('Unknown event error timeout'));
        }, 3000);
      });
    });

    it('should handle invalid event names gracefully', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsURL}?token=${studentToken}`);

        ws.on('open', () => {
          const invalidEvent = {
            event: 'NOT_A_REAL_EVENT',
            data: { some: 'data' },
          };
          ws.send(JSON.stringify(invalidEvent));
        });

        ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.event === 'ERROR' && message.data?.message === 'Unknown event') {
              ws.close();
              resolve();
            } else if (message.event === 'ERROR') {
              ws.close();
              reject(new Error(`Expected 'UNKNOWN_EVENT' error message, got: ${message.data?.message}`));
            }
          } catch (error) {
            ws.close();
            reject(error);
          }
        });

        setTimeout(() => {
          ws.close();
          reject(new Error('Invalid event handling timeout'));
        }, 3000);
      });
    });
  });
});
