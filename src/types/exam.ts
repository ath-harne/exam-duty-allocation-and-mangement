export interface FacultyPreview {
  employee_code: string;
  name: string;
  gender: 'M' | 'F' | 'O';
  dept_id: string;
  teaching_type: 'T' | 'NT';
  designation: string;
  qualification: 'Graduate' | 'Postgraduate' | 'PhD';
  date_of_joining: string | null;
  experience_years: number;
  is_on_leave: boolean;
}

export interface FacultyUploadResponse {
  message: string;
  total_records: number;
  preview: FacultyPreview[];
}

export interface SchedulePreview {
  subject_name: string;
  block_required: number;
  dept_id: string;
  exam_date: string;
  shift: 'M' | 'E';
}

export interface ScheduleUploadResponse {
  message: string;
  exam_id: number;
  exam_name: string;
  total_rows: number;
  total_blocks: number;
  preview: SchedulePreview[];
}

export interface ExamListItem {
  exam_id: number;
  exam_name: string;
  total_blocks: number;
  total_schedules: number;
  total_allocations?: number;
  created_at: string;
}

export interface DashboardResponse {
  faculty: {
    total_faculties: number;
    available_faculties: number;
    faculty_on_leave: number;
  };
  schedule: {
    total_schedules: number;
    total_blocks: number;
  };
  allocations: {
    total_allocations: number;
  };
  exams: ExamListItem[];
}

export interface SessionJrAllocation {
  block_number: number;
  faculty_id: number;
  faculty_name: string;
  employee_code: string;
  dept_id: string;
}

export interface SessionSrAllocation {
  faculty_id: number;
  faculty_name: string;
  employee_code: string;
  designation: string;
}

export interface SessionSquad {
  squad_number: number;
  members: {
    faculty_id: number;
    faculty_name: string;
    employee_code: string;
    dept_id?: string;
  }[];
}

export interface ExamResultSession {
  schedule_id: number;
  subject_name: string;
  block_required: number;
  dept_id: string;
  exam_date: string;
  shift: 'M' | 'E';
  junior_supervisors: SessionJrAllocation[];
  senior_supervisors: SessionSrAllocation[];
  squads: SessionSquad[];
}

export interface UnallocatedFaculty {
  faculty_id: number;
  employee_code: string;
  faculty_name: string;
  dept_id: string;
  designation: string;
}

export interface AllocationSummary {
  total_sessions: number;
  total_junior_supervisors: number;
  total_senior_supervisors: number;
  total_squad_members: number;
  total_unallocated: number;
}

export interface AllocationRunResponse {
  message: string;
  exam: {
    exam_id: number;
    exam_name: string;
  };
  summary: AllocationSummary;
  warnings: string[];
}

export interface ExamResultResponse {
  exam: {
    exam_id: number;
    exam_name: string;
    total_blocks: number;
    created_at: string;
  };
  summary: AllocationSummary;
  sessions: ExamResultSession[];
  unallocated: UnallocatedFaculty[];
}
