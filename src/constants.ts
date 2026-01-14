export const PRESENT_STATUS = 'present' as const;
export const ABSENT_STATUS = 'absent' as const;
export const NOT_YET_UPDATED_STATUS = 'not yet updated' as const;
export const AttendanceStatuses = [PRESENT_STATUS, ABSENT_STATUS] as const;
export type AttendanceStatus = (typeof AttendanceStatuses)[number];

export const TEACHER_ROLE = 'teacher' as const;
export const STUDENT_ROLE = 'student' as const;
export const UserRoles = [TEACHER_ROLE, STUDENT_ROLE] as const;
export type UserRole = (typeof UserRoles)[number];

// ============================================
// WebSocket Event Types
// ============================================

export const ATTENDANCE_MARKED_EVENT = 'ATTENDANCE_MARKED' as const;
export const ERROR_EVENT = 'ERROR' as const;
export const PING_EVENT = 'PING' as const;
export const PONG_EVENT = 'PONG' as const;
export const TODAY_SUMMARY_EVENT = 'TODAY_SUMMARY' as const;
export const MY_ATTENDANCE_EVENT = 'MY_ATTENDANCE' as const;
export const DONE_EVENT = 'DONE' as const;
export const UNKNOWN_EVENT = 'Unknown event' as const;
export const WSEvents = [ATTENDANCE_MARKED_EVENT, ERROR_EVENT, PING_EVENT, PONG_EVENT, TODAY_SUMMARY_EVENT, MY_ATTENDANCE_EVENT, DONE_EVENT, UNKNOWN_EVENT] as const;
export type WSEvent = (typeof WSEvents)[number];

export type SupportedServerApiVersion = '1';