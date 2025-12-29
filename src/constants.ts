export const AttendanceStatuses = ["present", "absent"] as const;
export type AttendanceStatus = (typeof AttendanceStatuses)[number];

export const UserRoles = ["teacher", "student"] as const;
export type UserRole = (typeof UserRoles)[number];
export type SupportedServerApiVersion = '1';