export interface StudentProfile {
  name: string;
  studentId: string;
  registerNumber?: string;
  email?: string;
  program: string;
  department: string;
  institution?: string;
  status?: string; // e.g. "Active"
  semester?: string;
  imageUrl?: string;
}


export interface Semester {
  id: string;
  name: string;
}

export interface Subject {
  code: string;
  name: string;
  credits: number;
}

export type SRMGrade = 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'F' | 'Ab' | 'None';

export interface AcademicSubject extends Subject {
  expectedGrade?: SRMGrade;
  finalGrade?: SRMGrade;
}

export interface SemesterRecord {
  id: string;
  name: string;
  credits: number;
  sgpa: number;
}

export interface AttendanceRecord {
  subjectCode: string;
  attendedHours: number;
  conductedHours: number;
  percentage: number;
}

export interface TimetablePeriod {
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  subjectCode: string;
  subjectName: string;
}

export interface Timetable {
  sessions: TimetablePeriod[];
}

export interface AcademicData {
  pastSemesters: SemesterRecord[];
  currentSubjects: AcademicSubject[];
}

export interface NormalizedStudentData {
  profile: StudentProfile;
  currentSemester: Semester;
  subjects: Subject[];
  attendance: AttendanceRecord[];
  timetable?: Timetable;
  academic?: AcademicData;
}

export type ConnectionState = 
  | 'DISCONNECTED' 
  | 'LAUNCHING' 
  | 'WAITING_FOR_LOGIN' 
  | 'WAITING_FOR_CREDENTIALS'
  | 'AUTHENTICATING'
  | 'LOGIN_FAILED' 
  | 'AUTHENTICATED' 
  | 'EXTRACTING'
  | 'DATA_READY' 
  | 'TIMEOUT' 
  | 'DISCONNECTING' 
  | 'ERROR';

export type HealthStatus = 'SAFE' | 'WATCH' | 'AT_RISK' | 'BELOW_TARGET' | 'UNAVAILABLE';

export interface SubjectAttendanceResult {
  subjectCode: string;
  subjectName: string;
  credits: number;
  attendedHours: number;
  conductedHours: number;
  currentPercentage: number | null;
  targetPercentage: number;
  differenceFromTarget: number | null;
  safeAbsenceHours: number | null;
  recoveryHours: number | null;
  healthStatus: HealthStatus;
}

