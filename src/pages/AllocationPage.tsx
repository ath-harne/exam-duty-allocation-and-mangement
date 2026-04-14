import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, FileSpreadsheet, LayoutGrid, Play, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { getExams, getExamSchedules, runAllocation, updateScheduleBlock, uploadScheduleFile } from '@/lib/api';
import { Button } from '@/components/ui/button';
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

export default function AllocationPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [examName, setExamName] = useState('');
  const [schedulePreview, setSchedulePreview] = useState<ScheduleUploadResponse | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [includesSpeciallyAbled, setIncludesSpeciallyAbled] = useState(false);
  const [includesMasters, setIncludesMasters] = useState(false);

  const examsQuery = useQuery({
    queryKey: ['exams'],
    queryFn: getExams,
  });

  useEffect(() => {
    if (!selectedExamId && examsQuery.data?.length) {
      setSelectedExamId(examsQuery.data[0].exam_id);
    }
  }, [examsQuery.data, selectedExamId]);

  const examSchedulesQuery = useQuery({
    queryKey: ['schedules', selectedExamId],
    queryFn: () => getExamSchedules(selectedExamId!),
    enabled: !!selectedExamId,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ name, file }: { name: string; file: File }) => uploadScheduleFile(name, file),
    onSuccess: (result) => {
      setSchedulePreview(result);
      setSelectedExamId(result.exam_id);
      setExamName('');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success(result.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: ({ scheduleId, blocks }: { scheduleId: number; blocks: number }) => updateScheduleBlock(scheduleId, blocks),
    onSuccess: () => {
      toast.success('Block requirement updated');
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleUpdateBlock = (scheduleId: number, value: string) => {
    const blocks = parseInt(value, 10);
    if (isNaN(blocks) || blocks < 0) return;
    updateBlockMutation.mutate({ scheduleId, blocks });
  };

  const allocationMutation = useMutation({
    mutationFn: ({ examId, specificallyAbled, masters }: { examId: number, specificallyAbled: boolean, masters: boolean }) => 
      runAllocation(examId, specificallyAbled, masters),
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

  const selectedExam = examsQuery.data?.find((exam) => exam.exam_id === selectedExamId) ?? null;

  return (
    <div className="space-y-6">
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

      {selectedExamId && examSchedulesQuery.data && examSchedulesQuery.data.length > 0 && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="metric-card">
              <LayoutGrid className="h-5 w-5 text-primary" />
              <p className="mt-4 text-4xl font-extrabold text-foreground">
                {examSchedulesQuery.data.reduce((sum, s) => sum + s.block_required, 0)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Total blocks required for this examination.</p>
            </div>
            <div className="metric-card">
              <Calculator className="h-5 w-5 text-primary" />
              <p className="mt-4 text-4xl font-extrabold text-foreground">{examSchedulesQuery.data.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">Schedule entries available in the uploaded file.</p>
            </div>
            <div className="metric-card">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <p className="mt-4 text-2xl font-extrabold text-foreground">{selectedExam?.exam_name || 'Selected Exam'}</p>
              <p className="mt-2 text-sm text-muted-foreground">Current examination selected for allocation.</p>
            </div>
          </section>

          <section className="glass-card overflow-hidden">
            <div className="border-b border-white/35 px-6 py-5">
              <h2 className="text-lg font-bold text-foreground">Schedule Preview</h2>
              <p className="mt-2 text-sm text-muted-foreground">Review and edit schedule entries before generating the duty allocation.</p>
            </div>

            <div className="overflow-y-auto px-2 pb-2 max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-[120px] text-right">Blocks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examSchedulesQuery.data.map((row) => (
                    <TableRow key={row.schedule_id} className="border-white/30">
                      <TableCell>
                        {new Date(row.exam_date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </TableCell>
                      <TableCell>{row.shift}</TableCell>
                      <TableCell>{row.dept_id}</TableCell>
                      <TableCell className="font-semibold">{row.subject_name}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="h-9 w-20 ml-auto bg-white/40 border-white/55"
                          defaultValue={row.block_required}
                          onBlur={(e) => {
                            if (e.target.value !== String(row.block_required)) {
                              handleUpdateBlock(row.schedule_id, e.target.value);
                            }
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}

      <section className="glass-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-foreground">Generate Duty List</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Choose an available examination plan and prepare the duty allocation for review and report download.
            </p>
          </div>

          <div className="w-full max-w-sm space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground">Select Examination</label>
              <select
                className="mt-2 min-h-11 w-full rounded-xl border border-white/55 bg-white/40 px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring"
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
            
            <div className="space-y-3 rounded-xl border border-white/45 bg-white/28 p-4 backdrop-blur-sm">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={includesSpeciallyAbled} 
                  onChange={(e) => setIncludesSpeciallyAbled(e.target.checked)}
                  className="h-4 w-4 rounded border-white/60 bg-white/40 text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">Includes Specially Abled (+1 Block per session)</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={includesMasters} 
                  onChange={(e) => setIncludesMasters(e.target.checked)}
                  className="h-4 w-4 rounded border-white/60 bg-white/40 text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">Includes Masters (+2 Blocks per session)</span>
              </label>
            </div>
          </div>
        </div>

        {selectedExam && (
          <div className="mt-5 rounded-2xl border border-white/45 bg-white/32 px-4 py-4 text-sm leading-7 text-muted-foreground backdrop-blur-md">
            This examination includes {selectedExam.total_schedules} schedule entries and {selectedExam.total_blocks} blocks. It was created on {new Date(selectedExam.created_at).toLocaleString()}.
          </div>
        )}

        <div className="mt-6">
          <Button
            onClick={() => selectedExamId && allocationMutation.mutate({ examId: selectedExamId, specificallyAbled: includesSpeciallyAbled, masters: includesMasters })}
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
