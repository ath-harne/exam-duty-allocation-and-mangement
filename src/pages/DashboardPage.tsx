import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Trash2, Users } from 'lucide-react';
import { deleteExam, getDashboard } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statCards = [
  { key: 'total_faculties', label: 'Total Faculty', icon: Users, accent: 'bg-sky-100 text-sky-700' },
  { key: 'available_faculties', label: 'Available Faculty', icon: BookOpen, accent: 'bg-emerald-100 text-emerald-700' },
  { key: 'on_leave_count', label: 'On Leave', icon: Users, accent: 'bg-rose-100 text-rose-700' },
] as const;

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  const deleteExamMutation = useMutation({
    mutationFn: deleteExam,
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleDeleteExam = (examId: number, examName: string) => {
    const shouldDelete = window.confirm(
      `Delete examination "${examName}"?\n\nThis will remove related schedule and allocation records.`
    );
    if (!shouldDelete) return;
    deleteExamMutation.mutate(examId);
  };

  if (isLoading) {
    return <div className="glass-card p-6 text-sm text-muted-foreground">Loading dashboard...</div>;
  }

  if (error || !data) {
    return <div className="glass-card p-6 text-sm text-destructive">{(error as Error)?.message ?? 'Failed to load dashboard.'}</div>;
  }

  const stats = {
    total_faculties: data.faculty.total_faculties,
    available_faculties: data.faculty.available_faculties,
    on_leave_count: data.faculty.on_leave_count,
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-extrabold text-foreground md:text-4xl">Dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              View faculty availability, uploaded examination schedules, and duty allocation status.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/dashboard/faculty-upload">Faculty Records</Link>
            </Button>
            <Button asChild>
              <Link to="/dashboard/allocation">Duty Allocation</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {statCards.map(({ key, label, icon: Icon, accent }) => (
          <div key={key} className="metric-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">{label}</p>
                <p className="mt-4 text-4xl font-extrabold text-foreground">{stats[key]}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accent}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="glass-card p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Uploaded Examinations</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Open any uploaded examination to review its allocation result.
            </p>
          </div>

          <div className="mt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Examination</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Blocks</TableHead>
                  <TableHead>Created On</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.exams.length > 0 ? data.exams.map((exam) => (
                  <TableRow key={exam.exam_id} className="border-white/30">
                    <TableCell className="font-semibold">{exam.exam_name}</TableCell>
                    <TableCell>{exam.total_schedules}</TableCell>
                    <TableCell>{exam.total_blocks}</TableCell>
                    <TableCell>{new Date(exam.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/dashboard/results?examId=${exam.exam_id}`}>View</Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => handleDeleteExam(exam.exam_id, exam.exam_name)}
                          disabled={deleteExamMutation.isPending}
                          aria-label={`Delete ${exam.exam_name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No examination schedules have been added yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-xl font-bold text-foreground">Summary</h2>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-white/40 bg-white/26 px-4 py-4">
              <p className="text-sm text-muted-foreground">Faculty on Leave</p>
              <p className="mt-2 text-3xl font-extrabold text-foreground">{data.faculty.faculty_on_leave}</p>
            </div>
            <div className="rounded-2xl border border-white/40 bg-white/26 px-4 py-4">
              <p className="text-sm text-muted-foreground">Schedule Entries</p>
              <p className="mt-2 text-3xl font-extrabold text-foreground">{data.schedule.total_schedules}</p>
            </div>
            <div className="rounded-2xl border border-white/40 bg-white/26 px-4 py-4">
              <p className="text-sm text-muted-foreground">Exam Cycles</p>
              <p className="mt-2 text-3xl font-extrabold text-foreground">{data.exams.length}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
