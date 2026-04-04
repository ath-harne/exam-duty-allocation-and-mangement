import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, FileSpreadsheet, LayoutGrid, Play, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { getExams, runAllocation, uploadScheduleFile } from '@/lib/api';
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
    mutationFn: runAllocation,
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
      toast.error('Enter an exam cycle name before uploading the schedule.');
      return;
    }
    uploadMutation.mutate({ name: examName.trim(), file });
  };

  const selectedExam = examsQuery.data?.find((exam) => exam.exam_id === selectedExamId) ?? null;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Allocation Engine</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload a schedule into MySQL, then run the Node.js allocation engine for that exam cycle.</p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-2">
            <label htmlFor="examName" className="text-sm font-medium">Exam cycle name</label>
            <Input
              id="examName"
              placeholder="Example: Winter Semester 2026"
              value={examName}
              onChange={(event) => setExamName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload exam schedule</label>
            <div
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById('schedule-file-input')?.click()}
            >
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Click to upload `.xlsx` or `.xls`</p>
              <input
                id="schedule-file-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => handleScheduleFile(event.target.files?.[0])}
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Required schedule columns: subject_name, block_required, dept_id, exam_date, shift.</p>
      </div>

      {schedulePreview && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card rounded-xl p-4 text-center">
              <LayoutGrid className="w-5 h-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold text-foreground">{schedulePreview.total_blocks}</p>
              <p className="text-xs text-muted-foreground">Blocks</p>
            </div>
            <div className="glass-card rounded-xl p-4 text-center">
              <Calculator className="w-5 h-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold text-foreground">{schedulePreview.total_rows}</p>
              <p className="text-xs text-muted-foreground">Schedule Rows</p>
            </div>
            <div className="glass-card rounded-xl p-4 text-center">
              <FileSpreadsheet className="w-5 h-5 mx-auto text-primary mb-1" />
              <p className="text-lg font-bold text-foreground">{schedulePreview.exam_name}</p>
              <p className="text-xs text-muted-foreground">Uploaded Exam</p>
            </div>
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold">Schedule Preview</h2>
            </div>
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
                  <TableRow key={`${row.subject_name}-${index}`}>
                    <TableCell>{row.exam_date}</TableCell>
                    <TableCell>{row.shift}</TableCell>
                    <TableCell>{row.dept_id}</TableCell>
                    <TableCell>{row.subject_name}</TableCell>
                    <TableCell className="text-right">{row.block_required}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Run for Uploaded Exam</h2>
            <p className="text-sm text-muted-foreground mt-1">Choose an uploaded exam cycle and persist its allocations.</p>
          </div>
          <select
            className="min-w-[260px] rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedExamId ?? ''}
            onChange={(event) => setSelectedExamId(Number(event.target.value))}
          >
            <option value="" disabled>Select exam</option>
            {examsQuery.data?.map((exam) => (
              <option key={exam.exam_id} value={exam.exam_id}>
                {exam.exam_name}
              </option>
            ))}
          </select>
        </div>

        {selectedExam && (
          <div className="text-sm text-muted-foreground">
            {selectedExam.total_schedules} schedules, {selectedExam.total_blocks} blocks, created {new Date(selectedExam.created_at).toLocaleString()}
          </div>
        )}

        <Button
          onClick={() => selectedExamId && allocationMutation.mutate(selectedExamId)}
          className="w-full"
          size="lg"
          disabled={!selectedExamId || allocationMutation.isPending}
        >
          <Play className="w-4 h-4 mr-2" />
          {allocationMutation.isPending ? 'Running allocation...' : 'Generate Allocation'}
        </Button>
      </div>
    </div>
  );
}
