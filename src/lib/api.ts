import type {
  AllocationRunResponse,
  DashboardResponse,
  DaywiseAllocation,
  ExamListItem,
  ExamResultResponse,
  FacultyListResponse,
  FacultyUploadResponse,
  ScheduleUploadResponse,
} from '@/types/exam';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? 'Request failed');
  }

  return response.json() as Promise<T>;
}

export async function getDashboard() {
  return parseResponse<DashboardResponse>(await fetch(`${API_BASE}/dashboard`));
}

export async function getExams() {
  return parseResponse<ExamListItem[]>(await fetch(`${API_BASE}/exams`));
}

export async function getFaculties() {
  return parseResponse<FacultyListResponse[]>(await fetch(`${API_BASE}/faculties`));
}

export async function toggleFacultyLeave(facultyId: number, isOnLeave: boolean) {
  return parseResponse<{ message: string }>(await fetch(`${API_BASE}/faculties/${facultyId}/leave`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isOnLeave }),
  }));
}

export async function uploadFacultyFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return parseResponse<FacultyUploadResponse>(await fetch(`${API_BASE}/uploads/faculties`, {
    method: 'POST',
    body: formData,
  }));
}

export async function uploadScheduleFile(examName: string, file: File) {
  const formData = new FormData();
  formData.append('examName', examName);
  formData.append('file', file);

  return parseResponse<ScheduleUploadResponse>(await fetch(`${API_BASE}/uploads/schedules`, {
    method: 'POST',
    body: formData,
  }));
}

export async function runAllocation(examId: number, includesSpeciallyAbled: boolean = false, includesMasters: boolean = false) {
  return parseResponse<AllocationRunResponse>(await fetch(`${API_BASE}/allocations/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ examId, includesSpeciallyAbled, includesMasters }),
  }));
}

export async function getExamResult(examId: number) {
  return parseResponse<ExamResultResponse>(await fetch(`${API_BASE}/exams/${examId}/results`));
}

export function buildReportUrl(examId: number, report: 'excel/junior-supervisors' | 'excel/squads' | 'excel/senior-supervisors' | 'junior-supervisors.pdf' | 'squads.pdf' | 'senior-supervisors.pdf' | 'unallocated.pdf') {
  return `${API_BASE}/exams/${examId}/reports/${report}`;
}

export async function updateAllocationFaculty(allocationId: number, newFacultyId: number) {
  return parseResponse<{ message: string }>(await fetch(`${API_BASE}/allocations/${allocationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newFacultyId }),
  }));
}

export async function updateAllocationBlock(allocationId: number, blockNumber: number | null, squadNumber: number | null) {
  return parseResponse<{ message: string }>(await fetch(`${API_BASE}/allocations/${allocationId}/block`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blockNumber, squadNumber }),
  }));
}

export async function getDaywiseAllocations(examId: number, date: string, shift: string) {
  const query = new URLSearchParams({ examId: examId.toString(), date, shift });
  return parseResponse<DaywiseAllocation[]>(await fetch(`${API_BASE}/allocations/daywise?${query}`));
}

export async function getExamSchedules(examId: number) {
  return parseResponse<any[]>(await fetch(`${API_BASE}/exams/${examId}/schedules`));
}

export async function updateScheduleBlock(scheduleId: number, block_required: number | null, student_count?: number | null) {
  return parseResponse<{ message: string }>(await fetch(`${API_BASE}/schedules/${scheduleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ block_required, student_count }),
  }));
}
