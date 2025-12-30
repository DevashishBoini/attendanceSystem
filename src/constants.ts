export const PRESENT_STATUS = 'present' as const;
export const ABSENT_STATUS = 'absent' as const;
export const AttendanceStatuses = [PRESENT_STATUS, ABSENT_STATUS] as const;
export type AttendanceStatus = (typeof AttendanceStatuses)[number];

export const TEACHER_ROLE = 'teacher' as const;
export const STUDENT_ROLE = 'student' as const;
export const UserRoles = [TEACHER_ROLE, STUDENT_ROLE] as const;
export type UserRole = (typeof UserRoles)[number];

export type SupportedServerApiVersion = '1';