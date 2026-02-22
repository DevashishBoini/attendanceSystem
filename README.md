# Attendance System

A real-time classroom attendance marking system built with Node.js, Express, WebSocket, and MongoDB. Teachers can mark student attendance in real-time with live updates across all connected clients.

## 📚 Based on Assignment

This project implements the **Backend + WebSocket - Live Attendance System** assignment by Harkirat Singh.


**Reference**: [Backend + WebSocket - Live Attendance System](https://brindle-goal-102.notion.site/Backend-WebSocket-Live-Attendance-System-2c646b36b2e980b09b42d7c0240a8170)

**Test Application**: [github.com/rahul-MyGit/mid-test](https://github.com/rahul-MyGit/mid-test)

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Configuration](#configuration)
- [Running the Server](#running-the-server)
- [API Documentation](#api-documentation)
- [WebSocket Events](#websocket-events)
- [Database Models](#database-models)
- [Testing](#testing)
- [Development](#development)

## ✨ Features

- **JWT Authentication**: Secure authentication with role-based access control (Teacher/Student)
- **Real-time Attendance Marking**: Teachers mark student attendance with instant WebSocket updates
- **Live Statistics**: Real-time attendance summary (present/absent counts)
- **Student Status Tracking**: Students can query their current attendance status
- **Session Management**: Teachers start/end attendance sessions per class
- **Database Persistence**: Attendance records saved to MongoDB with timestamps
- **Class Management**: Create classes, manage student enrollment, add teachers
- **WebSocket Heartbeat**: Automatic ping/pong for connection health monitoring
- **API Documentation**: Swagger UI for REST API and AsyncAPI for WebSocket
- **Comprehensive Testing**: Unit, integration, database, and WebSocket tests with >90% coverage
- **Input Validation**: Zod schema validation for all inputs

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Server (Express)                    │
├─────────────────────────────────────────────────────────────┤
│  Routes: Health, Auth, Class, Attendance                    │
│  Middleware: JWT Auth, Request Logging                      │
├─────────────────────────────────────────────────────────────┤
│               WebSocket Server (ws library)                 │
│  Events: PING/PONG, ATTENDANCE_MARKED, TODAY_SUMMARY,       │
│          MY_ATTENDANCE, DONE, ERROR                         │
├─────────────────────────────────────────────────────────────┤
│                   MongoDB Database                          │
│  Collections: Users, Classes, Attendance                    │
└─────────────────────────────────────────────────────────────┘
```

### Component Relationships

- **WebSocketManager**: Singleton managing all WebSocket connections and session state
- **ActiveSession**: In-memory session state (classId, attendance record, timestamp)
- **Database Service**: Persistence layer for users, classes, and attendance records
- **Middleware**: JWT verification, role-based access control
- **Schemas**: Zod validation for messages, payloads, and database documents

## 🛠️ Tech Stack

- **Runtime**: Node.js (v20+)
- **Language**: TypeScript
- **Web Framework**: Express 5.x
- **WebSocket**: ws library
- **Database**: MongoDB 6.x with Mongoose
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Validation**: Zod
- **Testing**: Vitest, Supertest
- **Documentation**: Swagger/OpenAPI, AsyncAPI
- **Package Manager**: pnpm

## 📁 Project Structure

```
src/
├── index.ts                    # Application entry point
├── config.ts                   # Configuration and env variables
├── constants.ts                # Application constants
├── db.ts                        # Database connection and initialization
│
├── db-models/                  # Mongoose schemas
│   ├── user.ts                 # User model (teacher/student)
│   ├── class.ts                # Class model with enrollment
│   └── attendance.ts           # Attendance records model
│
├── middleware/
│   └── auth.ts                 # JWT verification, role validation
│
├── routes/                     # REST API endpoints
│   ├── health.ts               # Health check endpoint
│   ├── auth.ts                 # Authentication (login/register)
│   ├── class.ts                # Class management
│   └── attendance.ts           # Attendance session control
│
├── schemas/                    # Zod validation schemas
│   ├── auth.ts                 # Login/register request schemas
│   ├── class.ts                # Class creation/management schemas
│   ├── attendance.ts           # Active session and status schemas
│   ├── jwt.ts                  # Decoded JWT schema
│   ├── websocket.ts            # WebSocket message schemas
│   └── responses.ts            # HTTP response schemas
│
├── swagger/
│   ├── swagger.ts              # Swagger/OpenAPI spec generator
│   └── openapi.yaml            # API specification
│
├── utils/
│   ├── db.ts                   # Database service layer
│   └── jwt.ts                  # JWT utility functions
│
├── websocket/
│   └── wsManager.ts            # WebSocket connection manager
│
└── __tests__/                  # Test files (mirroring src structure)
    ├── auth.integration.test.ts
    ├── class.integration.test.ts
    ├── db-models.test.ts
    ├── db-service.test.ts
    ├── db.test.ts
    ├── jwt.test.ts
    ├── middleware.test.ts
    ├── schemas.test.ts
    └── utils/
        └── test-logger.ts
```

## 🚀 Setup & Installation

### Prerequisites

- Node.js v20 or higher
- MongoDB 6.x running locally or remote URI
- pnpm package manager

### Installation Steps

1. **Clone and install dependencies**:
   ```bash
   cd attendance
   pnpm install
   ```

2. **Create `.env` file** in the root directory:
   ```bash
   cp .env.template .env
   ```

3. **Configure environment variables** (see [Configuration](#configuration) section)

4. **Build TypeScript**:
   ```bash
   pnpm run build
   ```

## ⚙️ Configuration

Create a `.env` file with the following variables:

```env
# Server
APP_PORT=3000

# Database
MONGO_DB_URI=mongodb://localhost:27017/attendance

# JWT
JWT_SECRET_KEY=your-secret-key-change-me
JWT_EXPIRATION=3600          # Token expiration in seconds (1 hour)

# Password Hashing
BCRYPT_SALT_ROUNDS=12        # Cost factor for bcrypt

# Response Formatting
JSON_SPACES=4                # JSON pretty-print spaces
```

### Environment Variables Explained

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_PORT` | Server port | `3000` |
| `MONGO_DB_URI` | MongoDB connection URI | Required |
| `JWT_SECRET_KEY` | Secret key for JWT signing | Required |
| `JWT_EXPIRATION` | Token expiration time in seconds | `3600` (1h) |
| `BCRYPT_SALT_ROUNDS` | Password hashing cost factor | `12` |
| `JSON_SPACES` | JSON response formatting | `4` |

## ▶️ Running the Server

### Development Mode (with hot reload)

```bash
pnpm run dev
```

The server will start on `http://localhost:3000` with automatic restart on file changes.

### Production Mode

```bash
pnpm run build
pnpm run start
```

### Access Documentation

- **Swagger API Docs**: http://localhost:3000/api-docs
- **AsyncAPI WebSocket Docs**: http://localhost:3000/asyncapi.json
- **Test Websockets**: http://localhost:3000/ws-test
- **Health Check**: http://localhost:3000/health

## 📡 API Documentation

### Authentication

#### Register User
- **POST** `/auth/register`
- **Body**: `{ email, password, name, role: "teacher" | "student" }`
- **Response**: `{ success, token, user }`
- **Status**: 201 (Created), 400 (Bad Request), 409 (Conflict)

#### Login User
- **POST** `/auth/login`
- **Body**: `{ email, password }`
- **Response**: `{ success, token, user }`
- **Status**: 200 (OK), 400 (Bad Request), 401 (Unauthorized)

### Class Management

#### Create Class
- **POST** `/class`
- **Headers**: `Authorization: Bearer {token}`
- **Body**: `{ name, description? }`
- **Response**: `{ success, class }`
- **Status**: 201, 400, 401 (Unauthorized)

#### Get All Classes
- **GET** `/class`
- **Headers**: `Authorization: Bearer {token}`
- **Response**: `{ success, classes: [] }`
- **Status**: 200, 401

#### Get Class by ID
- **GET** `/class/:classId`
- **Headers**: `Authorization: Bearer {token}`
- **Response**: `{ success, class }`
- **Status**: 200, 401, 404 (Not Found)

#### Add Student to Class
- **POST** `/class/:classId/student`
- **Headers**: `Authorization: Bearer {token}` (Teacher only)
- **Body**: `{ studentId }`
- **Status**: 200 (Idempotent), 400, 401, 403 (Forbidden), 404

#### Add Teacher to Class
- **POST** `/class/:classId/teacher`
- **Headers**: `Authorization: Bearer {token}` (Teacher only)
- **Body**: `{ teacherId }`
- **Status**: 200 (Idempotent), 400, 401, 403, 404

### Attendance Management

#### Start Attendance Session
- **POST** `/attendance/start`
- **Headers**: `Authorization: Bearer {token}` (Teacher only)
- **Body**: `{ classId }`
- **Response**: `{ success }`
- **Status**: 200, 400, 401, 403, 404

#### End Attendance Session
- **POST** `/attendance/end`
- **Headers**: `Authorization: Bearer {token}` (Teacher only)
- **Response**: `{ success, summary }`
- **Status**: 200, 401, 403

#### Health Check
- **GET** `/health`
- **Response**: `{ success, status: "OK" }`
- **Status**: 200

## 🔌 WebSocket Events

Connect to WebSocket at: `ws://localhost:3000/ws?token={jwt_token}`

### Event Format

All events follow this structure:
```typescript
{
  event: string,
  data?: Record<string, any>
}
```

### Server Events (Broadcasting)

#### ATTENDANCE_MARKED
Broadcast when teacher marks attendance for a student.
- **Listeners**: All connected clients
- **Data**: `{ studentId, status: "present" | "absent" }`

#### TODAY_SUMMARY
Teacher requests summary of attendance statistics.
- **Data**: `{ present: number, absent: number, total: number }`
- **Listeners**: All connected clients

#### MY_ATTENDANCE
Student checks their attendance status.
- **Data**: `{ status: "present" | "absent" | "not yet updated" }`
- **Listeners**: Requesting student only

#### DONE
Attendance session complete, records persisted to database.
- **Data**: `{ message, present: number, absent: number, total: number }`
- **Listeners**: All connected clients

#### PONG
Server response to client PING.
- **Data**: `{}` (empty)
- **Listeners**: Requesting client

#### ERROR
Server sends error message.
- **Data**: `{ message: string }`
- **Listeners**: Requesting client

### Client Events (Send to Server)

#### PING
Client heartbeat check.
- **Send**: `{ event: "PING", data: {} }`
- **Expect Response**: PONG event

#### ATTENDANCE_MARKED
Teacher marks student attendance (WebSocket alternative).
- **Send**: `{ event: "ATTENDANCE_MARKED", data: { studentId, status } }`
- **Expect Response**: Broadcast to all clients

#### TODAY_SUMMARY
Request attendance summary.
- **Send**: `{ event: "TODAY_SUMMARY", data: {} }`

#### MY_ATTENDANCE
Student requests their status.
- **Send**: `{ event: "MY_ATTENDANCE", data: {} }`

#### DONE
Complete attendance session.
- **Send**: `{ event: "DONE", data: {} }`

### WebSocket Error Responses

| Error | Cause |
|-------|-------|
| `"Unauthorized or invalid token"` | Missing/invalid JWT in query |
| `"Invalid message format"` | JSON parsing failure, schema validation |
| `"Forbidden, teacher event only"` | Non-teacher sent teacher-only event |
| `"Forbidden, student event only"` | Non-student sent student-only event |
| `"No active attendance session"` | No session started for class |
| `"Class not found"` | Referenced class doesn't exist |
| `"Student not found in class"` | Student not enrolled in class |
| `"UNKNOWN_EVENT"` | Unknown event type sent |

## 💾 Database Models

### User
```typescript
{
  _id: ObjectId,
  email: string,        // Unique
  password: string,     // Hashed with bcrypt
  name: string,
  role: "teacher" | "student",
  createdAt: Date,
  updatedAt: Date
}
```

### Class
```typescript
{
  _id: ObjectId,
  name: string,
  description?: string,
  createdBy: ObjectId,  // Teacher ID
  studentIds: ObjectId[],
  teacherIds: ObjectId[],
  createdAt: Date,
  updatedAt: Date
}
```

### Attendance
```typescript
{
  _id: ObjectId,
  classId: ObjectId,
  teacherId: ObjectId,
  attendance: {
    [studentId: string]: "present" | "absent"
  },
  date: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## 🧪 Testing

### Test Commands

```bash
# Run all tests
pnpm run test

# Run tests by project
pnpm run test:unit          # Unit tests
pnpm run test:db            # Database tests
pnpm run test:integration   # Integration tests
pnpm run test:websocket     # WebSocket tests

# Run all test suites in sequence
pnpm run test-all

# Watch mode (re-run on file change)
pnpm run test:watch

# Coverage report
pnpm run test:coverage
```

### Test Structure

Tests are organized by project configuration in `vitest.config.ts`:

- **Unit Tests** (`websocket.unit.test.ts`): Function-level tests
- **DB Tests** (`db.test.ts`, `db-models.test.ts`): Database operations
- **Integration Tests** (`auth.integration.test.ts`, `class.integration.test.ts`): Full endpoint flows
- **WebSocket Tests** (`websocket.integration.test.ts`): Real-time event handling

### Timeout Configuration

- **Global timeout**: 15 seconds
- **WebSocket tests timeout**: 20 seconds
- **WebSocket message wait timeout**: 10 seconds

### Test Timeouts in ref-tests.ts

If running external tests, ensure timeouts are sufficient for slow servers:
- `waitForWsMessage()` default: 10000ms
- Global vitest timeout: 15000ms
- WebSocket project timeout: 20000ms

## 👨‍💻 Development

### Code Quality

- **Language**: TypeScript with strict mode
- **Validation**: Zod schemas for runtime validation
- **Linting**: ESLint configured
- **Formatting**: Prettier
- **Testing**: >90% code coverage

### Build System

```bash
# Build TypeScript
pnpm run build          # Compiles to ./dist

# Development with hot reload
pnpm run dev            # Uses tsx for instant reloading

# Start compiled app
pnpm run start          # Runs ./dist/index.js
```

### Key Design Patterns

1. **Singleton Pattern**: WebSocketManager (single instance per server)
2. **Schema Validation**: Zod for all input/output validation
3. **Service Layer**: Database service abstracts MongoDB operations
4. **Middleware Pattern**: Express middleware for auth and logging
5. **Event-Driven**: WebSocket broadcast for real-time updates

### Important Implementation Details

- **JWT Tokens**: Include user ID, email, and role; expires in configurable time
- **Session State**: Maintained in-memory in WebSocketManager singleton
- **WebSocket Heartbeat**: Automatic ping every 30 seconds to detect dead connections
- **Attendance Marking**: Teacher marks with status, auto-broadcasts to all clients
- **Auto-Absent**: Unmarked students auto-marked absent when session ends
- **Error Handling**: Comprehensive validation at schema and business logic levels

### Debugging

Enable verbose logging:
```bash
DEBUG=* pnpm run dev
```

Watch specific tests:
```bash
pnpm run test:watch -t "WebSocket"
```

Run a single test file:
```bash
pnpm run test-file src/__tests__/websocket.integration.test.ts
```

---


## 📝 Notes

- **Attendance Persistence**: Records are saved only when teacher sends DONE event
- **Session Cleanup**: Active session is cleared after DONE event completes
- **Idempotent Operations**: Adding duplicate students/teachers returns 200 OK
- **Message Ordering**: PING/PONG heartbeat independent of attendance events
- **Real-time Broadcasting**: All attendance changes broadcast to connected clients immediately
