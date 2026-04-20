import type {
  AllocationRunResponse,
  DashboardResponse,
  DeptBlockRule,
  ExamListItem,
  ExamResultResponse,
  FacultyPreview,
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

export function buildReportUrl(examId: number, report: 'excel/junior-supervisors' | 'excel/squads' | 'excel/senior-supervisors' | 'junior-supervisors.pdf' | 'squads.pdf' | 'senior-supervisors.pdf' | 'unallocated.pdf') {
  return `${API_BASE}/exams/${examId}/reports/${report}`;
}

export async function downloadReport(examId: number, report: Parameters<typeof buildReportUrl>[1], filename: string) {
  const url = buildReportUrl(examId, report);
  const response = await fetch(url);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? 'Download failed');
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(blobUrl);
}

export async function getFaculties() {
  return parseResponse<FacultyPreview[]>(await fetch(`${API_BASE}/faculties`));
}

export async function updateFacultyLeave(facultyId: number, isOnLeave: boolean) {
  return parseResponse<{ message: string }>(await fetch(`${API_BASE}/faculties/${facultyId}/leave`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_on_leave: isOnLeave }),
  }));
}

export async function getDeptBlockRules() {
  return parseResponse<DeptBlockRule[]>(await fetch(`${API_BASE}/dept-block-rules`));
}

export async function createDeptBlockRule(data: { dept_id: string; start_block: number; end_block: number }) {
  return parseResponse<{ message: string }>(await fetch(`${API_BASE}/dept-block-rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }));
}

export async function deleteDeptBlockRule(ruleId: number) {
  return parseResponse<{ message: string }>(await fetch(`${API_BASE}/dept-block-rules/${ruleId}`, {
    method: 'DELETE',
  }));
}

export async function getDaywiseAllocations(examId: number, date: string, shift: string) {
  const query = new URLSearchParams({ examId: examId.toString(), date, shift });
  return parseResponse<any[]>(await fetch(`${API_BASE}/daywise-allocations?${query}`));
}

export async function updateAllocationBlock(allocationId: number, block: number | null, squad: number | null) {
  return parseResponse<{ message: string }>(await fetch(`${API_BASE}/allocations/${allocationId}/block`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ block_number: block, squad_number: squad }),
  }));
}

export async function updateAllocationFaculty(allocationId: number, facultyId: number) {
  return parseResponse<{ message: string }>(await fetch(`${API_BASE}/allocations/${allocationId}/faculty`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faculty_id: facultyId }),
  }));
}

export async function getBlockMap(examId: number, date: string, shift: string) {
  const query = new URLSearchParams({ date, shift });
  return parseResponse<{ totalBlocks: number; blockMap: any[] }>(await fetch(`${API_BASE}/exams/${examId}/block-map?${query}`));
}

export async function autoAssignBlocks(examId: number, date: string, shift: string) {
  return parseResponse<{ message: string; warnings: string[] }>(await fetch(`${API_BASE}/exams/${examId}/assign-blocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, shift }),
  }));
}
