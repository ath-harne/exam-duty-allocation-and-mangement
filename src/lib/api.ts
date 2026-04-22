import type {
  AllocationRunResponse,
  DashboardResponse,
  DaywiseAllocation,
  ExamListItem,
  ExamResultResponse,
  FacultyUploadResponse,
  ScheduleUploadResponse,
} from '@/types/exam';

const API_BASE = '/api';

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

export interface DeptBlockRange {
  dept_id: string;
  block_from: number;
  block_to: number;
}

export async function runAllocation(
  examId: number,
  extraBlocks = 0,
  deptBlockMapping: DeptBlockRange[] = [],
) {
  return parseResponse<AllocationRunResponse>(await fetch(`${API_BASE}/allocations/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ examId, extraBlocks, deptBlockMapping }),
  }));
}

export async function getExamResult(examId: number) {
  return parseResponse<ExamResultResponse>(await fetch(`${API_BASE}/exams/${examId}/results`));
}

export function buildReportUrl(examId: number, report: 'excel/junior-supervisors' | 'excel/squads' | 'excel/senior-supervisors' | 'junior-supervisors.pdf' | 'squads.pdf' | 'senior-supervisors.pdf' | 'unallocated.pdf') {
  return `${API_BASE}/exams/${examId}/reports/${report}`;
}

export async function getDaywiseAllocations(examId: number, examDate: string, shift: string) {
  return parseResponse<DaywiseAllocation[]>(
    await fetch(`${API_BASE}/exams/${examId}/daywise-allocations?examDate=${encodeURIComponent(examDate)}&shift=${encodeURIComponent(shift)}`)
  );
}

export async function getExamScheduleDates(examId: number) {
  return parseResponse<{ exam_date: string; shift: string }[]>(
    await fetch(`${API_BASE}/exams/${examId}/schedule-dates`)
  );
}

export async function updateAllocationBlock(allocationId: number, blockNumber: number | null, squadNumber: number | null) {
  return parseResponse<{ message: string }>(
    await fetch(`${API_BASE}/allocations/${allocationId}/block`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block_number: blockNumber, squad_number: squadNumber }),
    })
  );
}
