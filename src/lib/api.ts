import type {
  AllocationRunResponse,
  DashboardResponse,
  ExamListItem,
  ExamResultResponse,
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

export async function runAllocation(examId: number) {
  return parseResponse<AllocationRunResponse>(await fetch(`${API_BASE}/allocations/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ examId }),
  }));
}

export async function getExamResult(examId: number) {
  return parseResponse<ExamResultResponse>(await fetch(`${API_BASE}/exams/${examId}/results`));
}

export function buildReportUrl(examId: number, report: 'excel' | 'junior-supervisors.pdf' | 'squads.pdf' | 'senior-supervisors.pdf' | 'unallocated.pdf') {
  return `${API_BASE}/exams/${examId}/reports/${report}`;
}
