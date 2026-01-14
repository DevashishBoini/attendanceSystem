import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { z } from 'zod';
import { WSMessageSchema, AttendanceMarkedDataSchema, type WSMessage } from '../schemas/websocket.js';
import { ActiveSessionSchema, type ActiveSession } from '../schemas/attendance.js';
import { JWTDecodedSchema, type JWTDecoded } from '../schemas/jwt.js';
import { verifyAndDecodeToken, verifyUserRole } from '../middleware/auth.js';
import { AttendanceStatuses, type AttendanceStatus, ATTENDANCE_MARKED_EVENT, PING_EVENT, PONG_EVENT, ERROR_EVENT, TODAY_SUMMARY_EVENT, MY_ATTENDANCE_EVENT, PRESENT_STATUS, ABSENT_STATUS, NOT_YET_UPDATED_STATUS, TEACHER_ROLE, STUDENT_ROLE, DONE_EVENT, UNKNOWN_EVENT } from '../constants.js';
import {dbService} from '../utils/db.js';

interface ExtendedWebSocket extends WebSocket {
  user: JWTDecoded;
  isAlive?: boolean;
}

let wsManagerInstance: WebSocketManager | null = null;

/**
 * WebSocketManager Class
 * 
 * Manages real-time WebSocket connections for attendance marking system.
 * Handles JWT authentication, event routing, session management, and client communication.
 * Implements singleton pattern to ensure only one instance per server.
 * 
 * Features:
 * - JWT authentication via query parameter (?token=...)
 * - Automatic heartbeat/ping to detect dead connections
 * - Teacher-only events: ATTENDANCE_MARKED, TODAY_SUMMARY, DONE
 * - Student-only events: MY_ATTENDANCE
 * - Broadcast to all connected clients
 * - Session state management with Zod validation
 * 
 * @example
 * const server = http.createServer(app);
 * const wsManager = new WebSocketManager(server);
 * setWebSocketManager(wsManager); // Register global singleton
 * wsManager.startSession(classId); // Teacher starts attendance session
 */
export class WebSocketManager {
  private wss: WebSocketServer;
  private activeSession: ActiveSession | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Constructor - Initialize WebSocket server
   * 
   * @param {Server} server - HTTP server instance to attach WebSocket to
   * @throws Error if server is invalid
   */
  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupConnection();
    this.startHeartbeat();
    console.log(' WebSocketManager initialized on /ws');
  }

  /**
   * Setup WebSocket connection handler
   * 
   * Validates JWT token from query parameter, sets up event listeners,
   * and manages client lifecycle (connection, messages, disconnection, errors).
   * 
   * @private
   * @throws Closes connection with code 4001 if token is invalid
   */
  private setupConnection(): void {
    this.wss.on('connection', (ws: ExtendedWebSocket, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      // Validate token exists
      if (!token) {
        this.sendError(ws, 'Unauthorized or invalid token');
        ws.close(4001, 'Unauthorized or invalid token');
        return;
      }

      // Verify and decode JWT using auth middleware utility
      // Returns null if token is invalid
      const decoded = verifyAndDecodeToken(token);
      
      if (!decoded) {
        //  Send ERROR event THEN close connection
        this.sendError(ws, 'Unauthorized or invalid token');
        ws.close(4001, 'Unauthorized or invalid token');
        return;
      }

      // Validate decoded JWT with Zod
      const validatedUser = JWTDecodedSchema.parse(decoded);
      ws.user = validatedUser;

      ws.isAlive = true;
      console.log(` WebSocket connected: ${ws.user.userId} (${ws.user.role})`);

      // Handle incoming messages
      ws.on('message', async (data: Buffer) => {
        await this.handleMessage(ws, data);
      });

      // Handle disconnection
      ws.on('close', () => {
        console.log(` WebSocket disconnected: ${ws.user?.userId}`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(
          ` WebSocket error for ${ws.user?.userId}:`,
          error
        );
      });

      // Handle pong response (for keep-alive)
      ws.on('pong', () => {
        ws.isAlive = true;
      });
    });
  }

  /**
   * Handle incoming WebSocket message
   * 
   * Parses JSON, validates against schema, and routes to appropriate handler.
   * Catches and logs validation/parsing errors with ERROR event response.
   * 
   * @private
   * @param {ExtendedWebSocket} ws - WebSocket client connection
   * @param {Buffer} data - Raw message data from client
   * @throws Sends ERROR event to client on validation failure
   */
  private async handleMessage(ws: ExtendedWebSocket, data: Buffer): Promise<void> {
    try {
      // Parse JSON
      const rawMessage = JSON.parse(data.toString());

      // Validate message with Zod
      const message: WSMessage = WSMessageSchema.parse(rawMessage);

      // Route to appropriate handler
      switch (message.event) {
        case PING_EVENT:
          this.handlePing(ws);
          break;
        case ATTENDANCE_MARKED_EVENT:
          await this.handleAttendanceMarked(ws, message);
          break;
        case TODAY_SUMMARY_EVENT:
          this.handleTodaySummary(ws);
          break;
        case MY_ATTENDANCE_EVENT:
          this.handleMyAttendance(ws);
          break;
        case DONE_EVENT:
          await this.handleDone(ws);
          break;
        default:
          this.sendError(ws, `${UNKNOWN_EVENT}`);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.message || 'Invalid message format';
        console.warn(' WebSocket message validation failed:', errorMessage);
        this.sendError(ws, `Invalid message format: ${errorMessage}`);
      } else {
        console.error(' WebSocket message parsing failed:', error);
        this.sendError(ws, 'Invalid message format');
      }
    }
  }

  /**
   * Handle ATTENDANCE_MARKED event
   * 
   * Processes teacher's request to mark a student's attendance status.
   * Performs comprehensive validation:
   * 1. Verifies teacher role
   * 2. Checks active attendance session exists
   * 3. Validates attendance data (studentId, status) with Zod schema
   * 4. Verifies class exists in database
   * 5. Verifies student is enrolled in the class
   * 
   * On success: Updates in-memory session and broadcasts to all connected clients.
   * On validation failure: Sends ERROR event with descriptive message.
   * 
   * @private
   * @async
   * @param {ExtendedWebSocket} ws - Teacher's WebSocket connection
   * @param {WSMessage} message - Event message containing studentId and status
   * @returns {Promise<void>}
   * @throws Sends ERROR event if:
   *   - User is not a teacher (role check)
   *   - No active attendance session
   *   - Attendance data fails Zod validation
   *   - Class does not exist in database
   *   - Student is not enrolled in the class
   */
  private async handleAttendanceMarked(
    ws: ExtendedWebSocket,
    message: WSMessage
  ): Promise<void> {
    // Verify teacher role using auth middleware utility
    // Returns false if user is not a teacher
    if (!verifyUserRole(ws.user, TEACHER_ROLE)) {
      //  Send ERROR event on authorization failure
      this.sendError(ws, "Forbidden, teacher event only");
      console.warn(`  Non-teacher attempted to mark attendance: ${ws.user?.userId}`);
      return;
    }

    // Check if session is active
    if (!this.activeSession) {
      this.sendError(ws, "No active attendance session");
      console.warn(
        `  Attempted to mark attendance without active session: ${ws.user?.userId}`
      );
      return;
    }

    // Extract data from message (works with generic schema)
    const data = message.data;

    // Validate attendance data with Zod schema
    const validationResult = AttendanceMarkedDataSchema.safeParse(data);
    if (!validationResult.success) {
      const errorMessage = 'Invalid attendance data';
      this.sendError(ws, `Invalid attendance data: ${errorMessage}`);
      return;
    }

    const { studentId, status } = validationResult.data;

    // verify if student exists in DB for the class
    const classId = this.activeSession.classId;

    const classDoc = await dbService.getClassById(classId);
    if (classDoc === null) {
      this.sendError(ws, "Class not found");
      console.warn(`  Attempted to mark attendance for non-existent class: ${classId}`);
      return;
    }
    // Verify if student exists in the class roster
    const studentExists = classDoc.studentIds.some((id) => id.toString() === studentId);
    if (!studentExists) {
      this.sendError(ws, "Student not found in class");
      console.warn(`  Attempted to mark attendance for non-existent student: ${studentId}`);
      return;
    }


    // Update attendance in active session
    this.activeSession.attendance[studentId] = status;
    console.log(
      ` Attendance marked - Class: ${this.activeSession.classId}, Student: ${studentId}, Status: ${status}`
    );
    console.log(` Current session attendance state:`, this.activeSession.attendance);

    const broadcastEvent : WSMessage = {
      event: ATTENDANCE_MARKED_EVENT,
      data: {
        studentId,
        status,
      },
    }
    
    console.log(`📤 Broadcasting ATTENDANCE_MARKED:`, JSON.stringify(broadcastEvent));

    // Broadcast to all connected clients
    this.broadcast(broadcastEvent);
    return;
  }


  /**
   * Handle TODAY_SUMMARY event
   * 
   * Returns current attendance statistics for the active session.
   * Counts present, absent, and total students marked so far.
   * Broadcasts to all connected clients.
   * 
   * @private
   * @param {ExtendedWebSocket} ws - Teacher's WebSocket connection
   * @throws Sends ERROR event if: not a teacher, no active session
   */
  private handleTodaySummary(ws: ExtendedWebSocket): void {
    // Implementation for handling today's summary

    // Verify teacher role using auth middleware utility
    // Returns false if user is not a teacher
    if (!verifyUserRole(ws.user, TEACHER_ROLE)) {
      //  Send ERROR event on authorization failure
      this.sendError(ws, "Forbidden, teacher event only");
      console.warn(`  Non-teacher attempted to mark attendance: ${ws.user?.userId}`);
      return;
    }

    // Check if session is active
    if (!this.activeSession) {
      this.sendError(ws, "No active attendance session");
      console.warn(
        `  Attempted to mark attendance without active session: ${ws.user?.userId}`
      );
      return;
    }

    // metrics of the current active session
    const totalStudents = Object.keys(this.activeSession.attendance).length;
    const presentCount = Object.values(this.activeSession.attendance).filter(status => status === PRESENT_STATUS).length;
    const absentCount = Object.values(this.activeSession.attendance).filter(status => status === ABSENT_STATUS).length;


    const broadcastEvent : WSMessage = {      
      event: TODAY_SUMMARY_EVENT,
      data: {
        "present": presentCount,
        "absent": absentCount,
        "total": totalStudents
      },
    }

    // Broadcast to all connected clients
    this.broadcast(broadcastEvent);


  }

  /**
   * Handle MY_ATTENDANCE event
   * 
   * Returns the student's current attendance status in the active session.
   * Possible statuses: 'present', 'absent', or 'not yet updated' (not marked).
   * Sends response only to requesting student (not broadcast).
   * 
   * @private
   * @param {ExtendedWebSocket} ws - Student's WebSocket connection
   * @throws Sends ERROR event if: not a student, no active session
   */
  private handleMyAttendance(ws: ExtendedWebSocket): void {
    // Implementation for handling my attendance

    // Verify student role using auth middleware utility
    // Returns false if user is not a student
    if (!verifyUserRole(ws.user, STUDENT_ROLE)) {
      //  Send ERROR event on authorization failure
      this.sendError(ws, "Forbidden, student event only");
      console.warn(`  Non-student attempted to mark attendance: ${ws.user?.userId}`);
      return;
    }

    // Check if session is active
    if (!this.activeSession) {
      this.sendError(ws, "No active attendance session");
      console.warn(
        `  Attempted to mark attendance without active session: ${ws.user?.userId}`
      );
      return;
    }
    
    let broadcastEvent : WSMessage;


    // **** TD - is student part of the class -- not checked yet **** //

    // Case where student has not yet been marked
    if (!(ws.user.userId in this.activeSession.attendance)){
      console.log(` Student ${ws.user.userId} not found in attendance, returning "not yet updated"`);
      broadcastEvent = {      
      event: MY_ATTENDANCE_EVENT,
      data: {
        "status": NOT_YET_UPDATED_STATUS
      },
    }

    }else {
      console.log(` Student ${ws.user.userId} found in attendance with status: ${this.activeSession.attendance[ws.user.userId]}`);
      // Case where student has been marked present
      if(this.activeSession.attendance[ws.user.userId] === PRESENT_STATUS){
        broadcastEvent = {
          event: MY_ATTENDANCE_EVENT,
          data: {
            "status": PRESENT_STATUS
          },
        }

      }
      // Case where student has been marked absent
      else {
        broadcastEvent = {
          event: MY_ATTENDANCE_EVENT,
          data: {
            "status": ABSENT_STATUS
          },
        }

      }
    }

    // send only to requesting student
    this.send(ws, broadcastEvent);
    return;

  }


  /**
   * Handle DONE event
   * 
   * Finalizes attendance session: marks unmarked students as absent,
   * saves all records to database, calculates final statistics, and broadcasts completion.
   * Clears the active session after successful persistence.
   * 
   * @private
   * @param {ExtendedWebSocket} ws - Teacher's WebSocket connection
   * @throws Sends ERROR event if: not a teacher, no active session, class not found, DB save fails
   */
  private async handleDone(ws: ExtendedWebSocket): Promise<void> {
    // Implementation for handling done event

    // Verify teacher role using auth middleware utility
    // Returns false if user is not a teacher
    if (!verifyUserRole(ws.user, TEACHER_ROLE)) {
      //  Send ERROR event on authorization failure
      this.sendError(ws, "Forbidden, teacher event only");
      console.warn(`  Non-teacher attempted to mark attendance: ${ws.user?.userId}`);
      return;
    }

    // Check if session is active
    if (!this.activeSession) {
      this.sendError(ws, "No active attendance session");
      console.warn(
        `  Attempted to mark attendance without active session: ${ws.user?.userId}`
      );
      return;
    }


    const classId = this.activeSession.classId;

    const classDoc = await dbService.getClassById(classId);
    if (classDoc === null) {
      this.sendError(ws, "Class not found");
      console.warn(
        `  Attempted to mark attendance for non-existent class: ${classId}`
      );
      return;
    }

    //mark attendance abesent for all students not marked present
    for (const studentId of classDoc.studentIds) {
      if (!(studentId.toString() in this.activeSession.attendance)) {
        this.activeSession.attendance[studentId.toString()] = ABSENT_STATUS;
      }
    }

    // Save attendance to database
    const result = await dbService.addAttendanceRecords(classId, this.activeSession);
    if(result === null){
      this.sendError(ws, "Failed to save attendance records");
      console.warn(
        `  Failed to save attendance records for class: ${classId}`
      );
      return; 
    }

    //Calculate final summary
    const totalStudents = Object.keys(this.activeSession.attendance).length;
    const presentCount = Object.values(this.activeSession.attendance).filter(status => status === PRESENT_STATUS).length;
    const absentCount = Object.values(this.activeSession.attendance).filter(status => status === ABSENT_STATUS).length;

    console.log(
      ` Attendance session completed - Class: ${this.activeSession.classId}, Total: ${totalStudents}, Present: ${presentCount}, Absent: ${absentCount}`
    );

    // End session
    this.endSession();

    const broadcastEvent : WSMessage = {      
      event: DONE_EVENT,
      data: {
        "message": "Attendance persisted",
        "present": presentCount,
        "absent": absentCount,
        "total": totalStudents
      },    
    }
    // Broadcast to all connected clients
    this.broadcast(broadcastEvent);
    return;



  }



  /**
   * Handle PING event
   * 
   * Responds to client ping with pong for connection health check.
   * Used to verify bidirectional communication.
   * 
   * @private
   * @param {ExtendedWebSocket} ws - Client's WebSocket connection
   */
  private handlePing(ws: ExtendedWebSocket): void {
    this.send(ws, {
      event: PONG_EVENT,
      data: {},
    });
  }

  /**
   * Send error message to client
   * 
   * Sends ERROR event with error message to specific client.
   * Used internally to report validation, authorization, or operational errors.
   * 
   * @private
   * @param {ExtendedWebSocket} ws - Client's WebSocket connection
   * @param {string} message - Human-readable error message
   */
  private sendError(ws: ExtendedWebSocket, message: string): void {
    this.send(ws, {
      event: ERROR_EVENT,
      data: { message },
    });
  }

  /**
   * Send message to specific client
   * 
   * Validates message with Zod before sending and only sends if connection is open.
   * Logs errors if validation fails or connection is closed.
   * 
   * @private
   * @param {ExtendedWebSocket} ws - Client's WebSocket connection
   * @param {WSMessage} message - Message object with event and data
   * @throws Logs error if message validation fails
   */
  private send(ws: ExtendedWebSocket, message: WSMessage): void {
    try {
      // Validate message with Zod before sending
      const validatedMessage = WSMessageSchema.parse(message);

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(validatedMessage));
      }
    } catch (error) {
      console.error(
        ' Failed to send message:',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Broadcast message to all connected clients
   * 
   * Validates message with Zod, serializes to JSON, and sends to all open connections.
   * Logs number of clients that received the message.
   * 
   * @private
   * @param {WSMessage} message - Message object with event and data
   * @throws Logs error if validation fails or broadcast fails
   */
  private broadcast(message: WSMessage): void {
    try {
      // Validate message with Zod before broadcasting
      const validatedMessage = WSMessageSchema.parse(message);
      const serialized = JSON.stringify(validatedMessage);

      this.wss.clients.forEach((client) => {
        const extClient = client as ExtendedWebSocket;
        if (extClient.readyState === WebSocket.OPEN) {
          extClient.send(serialized);
        }
      });

      console.log(` Broadcast sent to ${this.wss.clients.size} clients`);
    } catch (error) {
      console.error(
        ' Broadcast failed:',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Start a new attendance session
   * 
   * Creates and validates a new session for the given class.
   * Only one session can be active at a time - throws error if session already exists.
   * Called by teacher via REST API POST /attendance/start endpoint.
   * 
   * @public
   * @param {string} classId - MongoDB ObjectId of the class to start session for
   * @throws {Error} If session already active, classId is empty, or Zod validation fails
   * @example
   * wsManager.startSession('507f1f77bcf86cd799439011');
   */
  public startSession(classId: string): void {
    // Check if a session is already active
    if (this.activeSession) {
      console.error('⚠️  Cannot start session: A session is already active for class:', this.activeSession.classId);
      throw new Error(`Session already active for class ${this.activeSession.classId}`);
    }

    // Validate classId
    console.log(' Starting attendance session for classId:', classId);
    if (!classId || classId.trim().length === 0) {
      console.error(' Cannot start session: classId is required');
      throw new Error('classId is required');
    }

    // Create new session
    const newSession: ActiveSession = {
      classId,
      startedAt: new Date().toISOString(),
      attendance: {},
    };

    // Validate with Zod
    try {
      this.activeSession = ActiveSessionSchema.parse(newSession);
      console.log(` Attendance session started for class: ${classId}`);
      console.log(`   Started at: ${this.activeSession.startedAt}`);
    } catch (error) {
      console.error(' Failed to start session:', error);
      this.activeSession = null;
      throw error;
    }
  }

  /**
   * End the current attendance session
   * 
   * Closes the active session and returns the session data.
   * Does NOT save to database - use DONE event for that.
   * Safe to call even if no session is active.
   * 
   * @public
   * @returns {ActiveSession | null} The ended session data or null if no session was active
   * @example
   * const endedSession = wsManager.endSession();
   * console.log(`Session had ${Object.keys(endedSession.attendance).length} students marked`);
   */
  public endSession(): ActiveSession | null {
    if (!this.activeSession) {
      console.warn('⚠️  No active session to end');
      return null;
    }

    const endedSession = this.activeSession;
    console.log(`✅ Attendance session ended for class: ${endedSession.classId}`);
    console.log(`   Total students marked: ${Object.keys(endedSession.attendance).length}`);
    console.log(`   Session duration: ${this.getSessionDuration()} ms`);

    this.activeSession = null;
    return endedSession;
  }

  /**
   * Get the current active session
   * 
   * Returns a validated copy of the active session.
   * Returns null if no session is currently active.
   * Safe to call from external code without modifying internal state.
   * 
   * @public
   * @returns {ActiveSession | null} Current active session or null
   * @example
   * const session = wsManager.getActiveSession();
   * if (session) {
   *   console.log(`Session for class: ${session.classId}`);
   * }
   */
  public getActiveSession(): ActiveSession | null {
    if (!this.activeSession) {
      return null;
    }

    try {
      return ActiveSessionSchema.parse({ ...this.activeSession });
    } catch (error) {
      console.error('❌ Failed to validate active session:', error);
      return null;
    }
  }

  /**
   * Get session duration in milliseconds
   * 
   * Calculates elapsed time from session start to now.
   * Returns 0 if no session is active.
   * 
   * @private
   * @returns {number} Duration in milliseconds
   */
  private getSessionDuration(): number {
    if (!this.activeSession) return 0;

    const startTime = new Date(this.activeSession.startedAt).getTime();
    const endTime = new Date().getTime();
    return endTime - startTime;
  }

  /**
   * Get attendance data for current session
   * 
   * Returns the attendance record (studentId -> status mapping) for the active session.
   * Returns null if no session is active.
   * 
   * @public
   * @returns {Record<string, AttendanceStatus> | null} Attendance mapping or null
   * @example
   * const attendance = wsManager.getAttendanceData();
   * if (attendance) {
   *   const presentCount = Object.values(attendance).filter(s => s === 'present').length;
   * }
   */
  public getAttendanceData(): Record<string, AttendanceStatus> | null {
    return this.activeSession?.attendance ?? null;
  }

  /**
   * Check if a session is currently active
   * 
   * @public
   * @returns {boolean} True if a session is active, false otherwise
   */
  public isSessionActive(): boolean {
    return this.activeSession !== null;
  }

  /**
   * Get number of connected clients
   * 
   * @public
   * @returns {number} Number of active WebSocket connections
   */
  public getConnectedClientsCount(): number {
    return this.wss.clients.size;
  }

  /**
   * Start heartbeat (ping) to keep connections alive
   * 
   * Sends ping to all connected clients every 30 seconds.
   * Terminates clients that don't respond with pong.
   * Called automatically in constructor.
   * 
   * @private
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const extWs = ws as ExtendedWebSocket;
        if (extWs.isAlive === false) {
          console.log(`⏱️  Terminating inactive connection: ${extWs.user.userId}`);
          extWs.terminate();
          return;
        }

        extWs.isAlive = false;
        extWs.ping();
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Close all WebSocket connections gracefully
   * 
   * Ends active session, stops heartbeat, and closes all client connections.
   * Should be called during server shutdown.
   * Safe to call even if no session is active.
   * 
   * @public
   * @example
   * server.on('close', () => wsManager.closeAll());
   */
  public closeAll(): void {
    // End current session if active
    if (this.isSessionActive()) {
      this.endSession();
    }

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    this.wss.clients.forEach((client) => {
      const extClient = client as ExtendedWebSocket;
      extClient.close(1000, 'Server shutting down');
    });

    console.log(' All WebSocket connections closed');
  }
}

/**
 * Set the WebSocketManager instance (called from index.ts)
 * 
 * Registers the manager as a global singleton for access from routes.
 * Call this once after creating the WebSocketManager instance.
 * 
 * @param {WebSocketManager} manager - The WebSocketManager instance
 * @throws Error if called multiple times with different instances
 * @example
 * const wsManager = new WebSocketManager(server);
 * setWebSocketManager(wsManager);
 */
export function setWebSocketManager(manager: WebSocketManager): void {
  wsManagerInstance = manager;
  console.log(' WebSocketManager registered as global singleton');
}

/**
 * Get the global WebSocketManager instance
 * 
 * Retrieves the previously registered singleton instance.
 * Use this in route handlers to access WebSocketManager methods.
 * 
 * @returns {WebSocketManager} The registered WebSocketManager instance
 * @throws {Error} If manager has not been initialized via setWebSocketManager
 * @example
 * const wsManager = getWebSocketManager();
 * wsManager.startSession(classId);
 */
export function getWebSocketManager(): WebSocketManager {
  if (!wsManagerInstance) {
    throw new Error('WebSocketManager not initialized. Call setWebSocketManager in index.ts');
  }
  return wsManagerInstance;
}