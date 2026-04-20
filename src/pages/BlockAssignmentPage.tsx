import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { getExams, getDaywiseAllocations, getBlockMap, autoAssignBlocks, updateAllocationBlock } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

export default function BlockAssignmentPage() {
  const queryClient = useQueryClient();
  const [selectedExamId, setSelectedExamId] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('');

  const examsQuery = useQuery({
    queryKey: ['exams'],
    queryFn: getExams,
    onSuccess: (data) => {
      if (data.length > 0 && !selectedExamId) {
        setSelectedExamId(data[0].exam_id);
      }
    },
  });

  const selectedExam = useMemo(() => 
    examsQuery.data?.find(e => e.exam_id === selectedExamId), 
    [examsQuery.data, selectedExamId]
  );

  const dates = useMemo(() => {
    if (!selectedExam) return [];
    // This is a simplification; ideally the exam object has dates or we fetch them
    // For now, we'll rely on the user selecting them or fetching from allocations
    return []; 
  }, [selectedExam]);

  const allocationsQuery = useQuery({
    queryKey: ['daywise-allocations', selectedExamId, selectedDate, selectedShift],
    queryFn: () => getDaywiseAllocations(selectedExamId, selectedDate, selectedShift),
    enabled: !!selectedExamId && !!selectedDate && !!selectedShift,
  });

  const blockMapQuery = useQuery({
    queryKey: ['block-map', selectedExamId, selectedDate, selectedShift],
    queryFn: () => getBlockMap(selectedExamId, selectedDate, selectedShift),
    enabled: !!selectedExamId && !!selectedDate && !!selectedShift,
  });

  const autoAssignMutation = useMutation({
    mutationFn: () => autoAssignBlocks(selectedExamId, selectedDate, selectedShift),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['daywise-allocations'] });
      toast.success(data.message);
      if (data.warnings?.length) {
        data.warnings.forEach(w => toast.warning(w));
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateBlockMutation = useMutation({
    mutationFn: ({ id, block }: { id: number; block: number | null }) => 
      updateAllocationBlock(id, block, null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daywise-allocations'] });
      toast.success('Block updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Extract unique dates and shifts from allocations if not available elsewhere
  const availableOptionsQuery = useQuery({
    queryKey: ['exam-result', selectedExamId],
    queryFn: () => fetch(`/api/exams/${selectedExamId}/results`).then(res => res.json()),
    enabled: !!selectedExamId,
  });

  const sessionOptions = useMemo(() => {
    if (!availableOptionsQuery.data?.sessions) return [];
    return availableOptionsQuery.data.sessions.map((s: any) => ({
      date: s.exam_date,
      shift: s.shift,
      label: `${s.exam_date} (${s.shift})`
    })).filter((v: any, i: number, a: any[]) => 
      a.findIndex((t: any) => t.date === v.date && t.shift === v.shift) === i
    );
  }, [availableOptionsQuery.data]);

  return (
    <div className="space-y-6">
      <section className="glass-card p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground">Select Examination</label>
            <select
              className="w-full rounded-xl border border-white/55 bg-white/40 px-4 py-2 text-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(Number(e.target.value))}
            >
              <option value={0}>Choose an exam...</option>
              {examsQuery.data?.map((exam) => (
                <option key={exam.exam_id} value={exam.exam_id}>{exam.exam_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground">Select Session</label>
            <select
              className="w-full rounded-xl border border-white/55 bg-white/40 px-4 py-2 text-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring"
              value={`${selectedDate}|${selectedShift}`}
              onChange={(e) => {
                const [d, s] = e.target.value.split('|');
                setSelectedDate(d);
                setSelectedShift(s);
              }}
            >
              <option value="|">Choose a session...</option>
              {sessionOptions.map((opt: any) => (
                <option key={opt.label} value={`${opt.date}|${opt.shift}`}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={!selectedDate || autoAssignMutation.isPending}
              onClick={() => autoAssignMutation.mutate()}
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Auto-Assign Blocks
            </Button>
          </div>
        </div>
      </section>

      {blockMapQuery.data && (
        <section className="glass-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Session Block Map</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {blockMapQuery.data.blockMap.map((map) => (
              <div key={map.schedule_id} className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
                <p className="text-xs font-bold text-primary">{map.dept_id}</p>
                <p className="mt-1 text-lg font-extrabold">B{map.start_block} - B{map.end_block}</p>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">{map.subject_name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {allocationsQuery.data && (
        <section className="glass-card overflow-hidden">
          <div className="border-b border-white/35 bg-white/18 px-6 py-4">
            <h2 className="text-lg font-bold">Junior Supervisor Block Assignment</h2>
            <p className="text-sm text-muted-foreground">Assign block numbers to faculty. Same-department conflicts are highlighted.</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faculty Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Assigned Block</TableHead>
                  <TableHead>Conflict Check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocationsQuery.data.filter(a => a.role === 'Jr_SV').map((item) => {
                  const blockDept = blockMapQuery.data?.blockMap.find(
                    m => item.block_number >= m.start_block && item.block_number <= m.end_block
                  )?.dept_id;
                  const hasConflict = blockDept === item.dept_id;

                  return (
                    <TableRow key={item.allocation_id} className="border-white/30">
                      <TableCell className="font-semibold">{item.faculty_name}</TableCell>
                      <TableCell>{item.dept_id}</TableCell>
                      <TableCell>
                        <input
                          type="number"
                          className="w-20 rounded-lg border border-white/45 bg-white/20 px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          value={item.block_number || ''}
                          onChange={(e) => updateBlockMutation.mutate({ 
                            id: item.allocation_id, 
                            block: e.target.value ? Number(e.target.value) : null 
                          })}
                          placeholder="B#"
                        />
                      </TableCell>
                      <TableCell>
                        {item.block_number ? (
                          hasConflict ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                              <AlertTriangle className="h-4 w-4" />
                              Dept Conflict ({blockDept})
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              Safe ({blockDept})
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not assigned</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
