import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, FileSpreadsheet, LayoutGrid, Play, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { type DeptBlockRange, getExams, runAllocation, uploadScheduleFile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ScheduleUploadResponse } from '@/types/exam';

// Default well-known department mappings (user can edit / delete / add)
const DEFAULT_DEPT_MAPPINGS: DeptBlockRange[] = [
  { dept_id: 'ENTC', block_from: 1,  block_to: 10 },
  { dept_id: 'IT',   block_from: 11, block_to: 20 },
  { dept_id: 'CE',   block_from: 21, block_to: 30 },
  { dept_id: 'ECE',  block_from: 31, block_to: 35 },
  { dept_id: 'AIDS', block_from: 39, block_to: 40 },
];

export default function AllocationPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [examName, setExamName] = useState('');
  const [schedulePreview, setSchedulePreview] = useState<ScheduleUploadResponse | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [includePwdBlock, setIncludePwdBlock] = useState(false);
  const [includeMastersBlock, setIncludeMastersBlock] = useState(false);

  // Department → block range mapping
  const [deptMappings, setDeptMappings] = useState<DeptBlockRange[]>(DEFAULT_DEPT_MAPPINGS);

  const examsQuery = useQuery({
    queryKey: ['exams'],
    queryFn: getExams,
  });

  useEffect(() => {
    if (!selectedExamId && examsQuery.data?.length) {
      setSelectedExamId(examsQuery.data[0].exam_id);
    }
  }, [examsQuery.data, selectedExamId]);

  const uploadMutation = useMutation({
    mutationFn: ({ name, file }: { name: string; file: File }) => uploadScheduleFile(name, file),
    onSuccess: (result) => {
      setSchedulePreview(result);
      setSelectedExamId(result.exam_id);
      setExamName('');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast.success(result.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const allocationMutation = useMutation({
    mutationFn: ({ examId, extraBlocks }: { examId: number; extraBlocks: number }) =>
      runAllocation(examId, extraBlocks, deptMappings),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['exam-result', result.exam.exam_id] });
      if (result.warnings.length) {
        toast.warning(result.warnings[0]);
      } else {
        toast.success(result.message);
      }
      navigate(`/dashboard/results?examId=${result.exam.exam_id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleScheduleFile = (file?: File) => {
    if (!file) return;
    if (!examName.trim()) {
      toast.error('Enter an examination name before uploading the schedule.');
      return;
    }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please upload a valid Excel file.');
      return;
    }
    uploadMutation.mutate({ name: examName.trim(), file });
  };

  // Mapping row helpers
  const updateMapping = (index: number, field: keyof DeptBlockRange, value: string | number) => {
    setDeptMappings((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const removeMapping = (index: number) => {
    setDeptMappings((prev) => prev.filter((_, i) => i !== index));
  };

  const addMapping = () => {
    setDeptMappings((prev) => [...prev, { dept_id: '', block_from: 1, block_to: 1 }]);
  };

  const additionalBlockCount = Number(includePwdBlock) + Number(includeMastersBlock);
  const selectedExam = examsQuery.data?.find((exam) => exam.exam_id === selectedExamId) ?? null;

  return (
    <div className="space-y-6">
      {/* ── Step 1: Upload Schedule ── */}
      <section className="glass-card p-6 md:p-8">
        <span className="hero-badge">Allocation Workflow</span>
        <h1 className="mt-4 section-title text-3xl md:text-4xl">Prepare schedules and generate duty assignments with clarity.</h1>
        <p className="section-copy">
          Enter the examination name, upload the schedule file, review the schedule preview, and then create the duty list for the selected examination.
        </p>

        <div className="mt-8 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="glass-panel p-5">
            <label htmlFor="examName" className="text-sm font-semibold text-foreground">Examination Name</label>
            <Input
              id="examName"
              placeholder="Example: Winter Semester 2026"
              value={examName}
              onChange={(event) => setExamName(event.target.value)}
              className="mt-3"
            />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Use a clear name so the exam department can identify this schedule later in reports and results.
            </p>
          </div>

          <div className="glass-panel p-5">
            <label className="text-sm font-semibold text-foreground">Examination Schedule File</label>
            <div
              className="mt-3 rounded-[24px] border-2 border-dashed border-white/55 bg-white/26 p-8 text-center transition-all hover:bg-white/36"
              onClick={() => document.getElementById('schedule-file-input')?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 text-sm font-semibold text-foreground">Upload schedule file</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Click to upload an Excel file in `.xlsx` or `.xls` format.</p>
              <input
                id="schedule-file-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  handleScheduleFile(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/45 bg-white/28 px-4 py-4 text-sm leading-7 text-muted-foreground backdrop-blur-md">
          The schedule sheet should include subject name, required blocks, department, exam date, and shift.
        </div>
      </section>

      {/* ── Schedule Preview ── */}
      {schedulePreview && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="metric-card">
              <LayoutGrid className="h-5 w-5 text-primary" />
              <p className="mt-4 text-4xl font-extrabold text-foreground">{schedulePreview.total_blocks + additionalBlockCount}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Total blocks required for this examination{additionalBlockCount > 0 ? `, including ${additionalBlockCount} extra` : ''}.
              </p>
            </div>
            <div className="metric-card">
              <Calculator className="h-5 w-5 text-primary" />
              <p className="mt-4 text-4xl font-extrabold text-foreground">{schedulePreview.total_rows}</p>
              <p className="mt-2 text-sm text-muted-foreground">Schedule entries available in the uploaded file.</p>
            </div>
            <div className="metric-card">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <p className="mt-4 text-2xl font-extrabold text-foreground">{schedulePreview.exam_name}</p>
              <p className="mt-2 text-sm text-muted-foreground">Current examination selected for allocation.</p>
            </div>
          </section>

          <section className="glass-card overflow-hidden">
            <div className="border-b border-white/35 px-6 py-5">
              <h2 className="text-lg font-bold text-foreground">Schedule Preview</h2>
              <p className="mt-2 text-sm text-muted-foreground">Review the schedule entries before generating the duty allocation.</p>
            </div>
            <div className="overflow-x-auto px-2 pb-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Blocks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedulePreview.preview.map((row, index) => (
                    <TableRow key={`${row.subject_name}-${index}`} className="border-white/30">
                      <TableCell>{row.exam_date}</TableCell>
                      <TableCell>{row.shift}</TableCell>
                      <TableCell>{row.dept_id}</TableCell>
                      <TableCell className="font-semibold">{row.subject_name}</TableCell>
                      <TableCell className="text-right">{row.block_required}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}

      {/* ── Step 2: Department Block Mapping ── */}
      <section className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/35 bg-white/10 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">Department Block Number Mapping</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Assign block number ranges to each department. Junior supervisors from that department will be assigned blocks only within their range.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addMapping}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Department
          </Button>
        </div>

        <div className="overflow-x-auto px-2 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department ID</TableHead>
                <TableHead>Block From</TableHead>
                <TableHead>Block To</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptMappings.map((row, index) => (
                <TableRow key={index} className="border-white/30">
                  <TableCell>
                    <Input
                      placeholder="e.g. ENTC"
                      value={row.dept_id}
                      onChange={(e) => updateMapping(index, 'dept_id', e.target.value.toUpperCase())}
                      className="h-9 w-32 bg-white/40 border-white/55 font-semibold uppercase"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      placeholder="1"
                      value={row.block_from}
                      onChange={(e) => updateMapping(index, 'block_from', parseInt(e.target.value) || 1)}
                      className="h-9 w-24 bg-white/40 border-white/55"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        placeholder="10"
                        value={row.block_to}
                        onChange={(e) => updateMapping(index, 'block_to', parseInt(e.target.value) || 1)}
                        className="h-9 w-24 bg-white/40 border-white/55"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        ({row.block_to - row.block_from + 1} blocks)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeMapping(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {deptMappings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-16 text-center text-sm text-muted-foreground">
                    No mappings configured. Block numbers will be assigned sequentially.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="border-t border-white/25 bg-white/8 px-6 py-3">
          <p className="text-xs text-muted-foreground">
            💡 Departments not listed here will receive sequential block numbers after all mapped ranges are filled. Ranges can overlap — the engine fills each dept's range in order.
          </p>
        </div>
      </section>

      {/* ── Step 3: Generate ── */}
      <section className="glass-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-foreground">Generate Duty List</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Choose an available examination plan and prepare the duty allocation for review and report download.
            </p>
          </div>

          <div className="w-full max-w-sm">
            <label className="text-sm font-semibold text-foreground">Select Examination</label>
            <select
              className="mt-3 min-h-11 w-full rounded-xl border border-white/55 bg-white/40 px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedExamId ?? ''}
              onChange={(event) => setSelectedExamId(Number(event.target.value))}
            >
              <option value="" disabled>Select examination</option>
              {examsQuery.data?.map((exam) => (
                <option key={exam.exam_id} value={exam.exam_id}>
                  {exam.exam_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedExam && (
          <div className="mt-5 rounded-2xl border border-white/45 bg-white/32 px-4 py-4 text-sm leading-7 text-muted-foreground backdrop-blur-md">
            This examination includes {selectedExam.total_schedules} schedule entries and {selectedExam.total_blocks} blocks.
            {additionalBlockCount > 0 ? ` + ${additionalBlockCount} extra block${additionalBlockCount > 1 ? 's' : ''} added for selected options.` : ''}
            It was created on {new Date(selectedExam.created_at).toLocaleString()}.
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="inline-flex cursor-pointer items-center justify-between rounded-2xl border border-white/35 bg-white/35 px-4 py-4 text-sm text-foreground shadow-sm transition hover:bg-white/45">
            <span>
              <span className="font-semibold">PWD students</span>
              <span className="block text-xs text-muted-foreground">Add 1 extra block</span>
            </span>
            <Checkbox
              checked={includePwdBlock}
              onCheckedChange={(value) => setIncludePwdBlock(Boolean(value))}
            />
          </label>

          <label className="inline-flex cursor-pointer items-center justify-between rounded-2xl border border-white/35 bg-white/35 px-4 py-4 text-sm text-foreground shadow-sm transition hover:bg-white/45">
            <span>
              <span className="font-semibold">Masters</span>
              <span className="block text-xs text-muted-foreground">Add 1 extra block</span>
            </span>
            <Checkbox
              checked={includeMastersBlock}
              onCheckedChange={(value) => setIncludeMastersBlock(Boolean(value))}
            />
          </label>
        </div>

        <div className="mt-6">
          <Button
            onClick={() => selectedExamId && allocationMutation.mutate({ examId: selectedExamId, extraBlocks: additionalBlockCount })}
            className="w-full"
            size="lg"
            disabled={!selectedExamId || allocationMutation.isPending}
          >
            <Play className="mr-2 h-4 w-4" />
            {allocationMutation.isPending ? 'Preparing duty allocation...' : 'Generate Duty Allocation'}
          </Button>
        </div>
      </section>
    </div>
  );
}
