import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, LayoutGrid, Users } from 'lucide-react';
import { getDashboard } from '@/lib/api';
import { Button } from '@/components/ui/button';
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
  { key: 'total_blocks', label: 'Scheduled Blocks', icon: LayoutGrid, accent: 'bg-amber-100 text-amber-700' },
  { key: 'total_allocations', label: 'Allocated Duties', icon: CheckCircle2, accent: 'bg-cyan-100 text-cyan-700' },
] as const;

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  if (isLoading) {
    return <div className="glass-card p-6 text-sm text-muted-foreground">Loading dashboard...</div>;
  }

  if (error || !data) {
    return <div className="glass-card p-6 text-sm text-destructive">{(error as Error)?.message ?? 'Failed to load dashboard.'}</div>;
  }

  const stats = {
    total_faculties: data.faculty.total_faculties,
    available_faculties: data.faculty.available_faculties,
    total_blocks: data.schedule.total_blocks,
    total_allocations: data.allocations.total_allocations,
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/dashboard/results?examId=${exam.exam_id}`}>View</Link>
                      </Button>
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
