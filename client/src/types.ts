export type Role = 'SYSTEM_ADMIN' | 'PRINCIPAL' | 'SECRETARY';

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  institutionId: string | null;
  fullName: string;
}

export interface Institution {
  id: string;
  name: string;
  currentYearLabel: string | null;
  logoDataUrl?: string | null;
  plannedEndDate?: string | null;
  nextPlannedEndDate?: string | null;
  studyDaysTotal?: number | null;
  studyDaysAccurate?: boolean;
  _count?: { users: number; grades: number };
}

export interface Grade {
  id: string;
  name: string;
  color: string;
  order: number;
  institutionId: string;
  classes: ClassRoom[];
}

export interface ClassRoom {
  id: string;
  name: string;
  gradeId: string;
  grade?: Grade;
  _count?: { students: number };
  students?: Student[];
}

export interface Student {
  id: string;
  fullName: string;
  nationalId: string;
  classId: string;
  totalLateCount: number;
  totalLateApprovedCount: number;
  totalLateUnapprovedCount: number;
  totalAbsenceCount: number;
  totalReleaseCount: number;
  totalPeriodsMissed: number;
  cycleLateCount: number;
  needsAssignment: boolean;
  assignmentsRequired: number;
  assignmentsSubmitted: number;
  blocked: boolean;
  events?: AttendanceEvent[];
  classRoom?: ClassRoom;
}

export interface AttendanceEvent {
  id: string;
  studentId: string;
  type: 'LATE' | 'ABSENCE' | 'RELEASE';
  date: string;
  time: string | null;
  overflow: boolean;
  lateApproved: boolean | null;
  periodsMissed: number | null;
  createdAt: string;
}

export interface Semester {
  id: string;
  institutionId: string;
  yearLabel: string;
  term: number;
  startedAt: string;
  endedAt: string | null;
}

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  email: string | null;
  institutionId: string | null;
  institution?: { name: string };
}
