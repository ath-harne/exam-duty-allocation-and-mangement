import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getDaywiseAllocations, getExamResult, getExams, updateAllocationBlock } from '@/lib/api';
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
import type { DaywiseAllocation } from '@/types/exam';

export default function DaywiseAllocationPage() {
  const queryClient = useQueryClient();
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('');

  const examsQuery = useQuery({ queryKey: ['exams'], queryFn: getExams });

  const resultQuery = useQuery({
    queryKey: ['exam-result', selectedExamId],
    queryFn: () => getExamResult(selectedExamId!),
    enabled: !!selectedExamId,
  });

  const availableSessions = resultQuery.data?.sessions || [];
  const uniqueDates = Array.from(new Set(availableSessions.map(s => s.exam_date)));
  const uniqueShifts = Array.from(new Set(availableSessions.filter(s => s.exam_date === selectedDate).map(s => s.shift)));

  const daywiseQuery = useQuery({
    queryKey: ['daywise-allocations', selectedExamId, selectedDate, selectedShift],
    queryFn: () => getDaywiseAllocations(selectedExamId!, selectedDate, selectedShift),
    enabled: !!selectedExamId && !!selectedDate && !!selectedShift,
  });

  const [localValues, setLocalValues] = useState<Record<number, { block: string; squad: string }>>({});

  useEffect(() => {
    if (daywiseQuery.data) {
      const initial: Record<number, { block: string; squad: string }> = {};
      daywiseQuery.data.forEach(alloc => {
        initial[alloc.allocation_id] = {
          block: alloc.block_number?.toString() || '',
          squad: alloc.squad_number?.toString() || '',
        };
      });
      setLocalValues(initial);
    }
  }, [daywiseQuery.data]);

  const updateMutation = useMutation({
    mutationFn: ({ allocationId, block, squad }: { allocationId: number; block: number | null; squad: number | null }) =>
      updateAllocationBlock(allocationId, block, squad),
    onSuccess: (result) => toast.success(result.message),
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSave = (allocationId: number) => {
    const vals = localValues[allocationId];
    const block = vals.block ? parseInt(vals.block, 10) : null;
    const squad = vals.squad ? parseInt(vals.squad, 10) : null;

    updateMutation.mutate(
      { allocationId, block, squad },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['daywise-allocations'] });
          queryClient.invalidateQueries({ queryKey: ['exam-result'] });
        }
      }
    );
  };

  const handleSaveAll = async () => {
    if (!daywiseQuery.data) return;
    
    let hasError = false;
    const promises = daywiseQuery.data.map(alloc => {
      const vals = localValues[alloc.allocation_id] || {};
      const block = vals.block ? parseInt(vals.block, 10) : null;
      const squad = vals.squad ? parseInt(vals.squad, 10) : null;
      
      // Only invoke API if we have valid changes but for simplicity we invoke all.
      return updateAllocationBlock(alloc.allocation_id, block, squad).catch((err) => {
        hasError = true;
        console.error(err);
      });
    });

    toast.promise(Promise.all(promises), {
      loading: 'Saving all allocations...',
      success: () => {
        queryClient.invalidateQueries({ queryKey: ['daywise-allocations'] });
        queryClient.invalidateQueries({ queryKey: ['exam-result'] });
        return hasError ? 'Saved with some errors' : 'All changes saved successfully!';
      },
      error: 'Failed to save allocations'
    });
  };

  const handleValueChange = (allocationId: number, field: 'block' | 'squad', value: string) => {
    setLocalValues(prev => ({
      ...prev,
      [allocationId]: {
        ...prev[allocationId],
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-6 md:p-8">
        <span className="hero-badge">
          <Calendar className="mr-2 h-3.5 w-3.5" />
          Day-wise Allocation
        </span>
        <h1 className="mt-4 section-title text-3xl md:text-4xl">Assign Blocks and Squad Numbers</h1>
        <p className="section-copy">
          Select a day and shift to map generated faculties to their exact blocks or squad numbers for the actual examination day.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm font-semibold text-foreground">Examination</label>
            <select
              className="mt-2 min-h-11 w-full rounded-xl border border-white/55 bg-white/40 px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedExamId ?? ''}
              onChange={(event) => {
                setSelectedExamId(Number(event.target.value));
                setSelectedDate('');
                setSelectedShift('');
              }}
            >
              <option value="" disabled>Select examination</option>
              {examsQuery.data?.map((exam) => (
                <option key={exam.exam_id} value={exam.exam_id}>
                  {exam.exam_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground">Date</label>
            <select
              className="mt-2 min-h-11 w-full rounded-xl border border-white/55 bg-white/40 px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedShift('');
              }}
              disabled={!selectedExamId || uniqueDates.length === 0}
            >
              <option value="" disabled>Select date</option>
              {uniqueDates.map(date => <option key={date} value={date}>{date}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground">Shift</label>
            <select
              className="mt-2 min-h-11 w-full rounded-xl border border-white/55 bg-white/40 px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              disabled={!selectedDate || uniqueShifts.length === 0}
            >
              <option value="" disabled>Select shift</option>
              {uniqueShifts.map(shift => <option key={shift} value={shift}>{shift}</option>)}
            </select>
          </div>
        </div>
      </section>

      {daywiseQuery.isSuccess && daywiseQuery.data && (
        <section className="glass-card overflow-hidden">
          <div className="flex flex-wrap justify-between items-center border-b border-white/35 px-6 py-5 gap-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">Duties to Map</h2>
              <p className="mt-2 text-sm text-muted-foreground">Attach blocks (for Jr SV) and squad numbers (for Squads) to allocated faculties.</p>
            </div>
            {daywiseQuery.data.length > 0 && (
              <Button onClick={handleSaveAll} className="shadow-lg">
                <Save className="h-4 w-4 mr-2" />
                Save All Changes
              </Button>
            )}
          </div>
          
          <div className="overflow-x-auto px-2 pb-2 max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Faculty Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="w-[120px]">Block No.</TableHead>
                  <TableHead className="w-[120px]">Squad No.</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daywiseQuery.data.map((alloc) => (
                  <TableRow key={alloc.allocation_id} className="border-white/30">
                    <TableCell className="font-semibold text-primary">{alloc.role === 'Jr_SV' ? 'Junior Supervisor' : 'Squad Member'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{alloc.faculty_name}</span>
                        <span className="text-xs text-muted-foreground">{alloc.employee_code}</span>
                      </div>
                    </TableCell>
                    <TableCell>{alloc.dept_id}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="e.g. 1"
                        value={localValues[alloc.allocation_id]?.block ?? ''}
                        onChange={(e) => handleValueChange(alloc.allocation_id, 'block', e.target.value)}
                        disabled={alloc.role !== 'Jr_SV'}
                        className="h-9 w-20 bg-white/40 border-white/55"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="e.g. 2"
                        value={localValues[alloc.allocation_id]?.squad ?? ''}
                        onChange={(e) => handleValueChange(alloc.allocation_id, 'squad', e.target.value)}
                        disabled={alloc.role !== 'Squad'}
                        className="h-9 w-20 bg-white/40 border-white/55"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleSave(alloc.allocation_id)}>
                        <Save className="h-4 w-4 text-primary" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {daywiseQuery.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No allocations found for this session.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
