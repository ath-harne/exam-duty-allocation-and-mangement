import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CheckCircle, LayoutGrid, Users } from 'lucide-react';
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

const StatCard = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  accent: string;
}) => (
  <div className="glass-card rounded-xl p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${accent}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
    </div>
  </div>
);

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading dashboard...</div>;
  }

  if (error || !data) {
    return <div className="text-sm text-destructive">{(error as Error)?.message ?? 'Failed to load dashboard.'}</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Backend-driven overview for uploads, schedules, and allocations</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/dashboard/faculty-upload">Upload Faculty</Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/allocation">Run Allocation</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Faculty" value={data.faculty.total_faculties} accent="bg-primary/10 text-primary" />
        <StatCard icon={BookOpen} label="Available Faculty" value={data.faculty.available_faculties} accent="bg-accent text-accent-foreground" />
        <StatCard icon={LayoutGrid} label="Scheduled Blocks" value={data.schedule.total_blocks} accent="bg-success/10 text-success" />
        <StatCard icon={CheckCircle} label="Allocations" value={data.allocations.total_allocations} accent="bg-warning/10 text-warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Faculty on Leave</p>
          <p className="text-3xl font-display font-bold mt-2">{data.faculty.faculty_on_leave}</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Schedule Rows</p>
          <p className="text-3xl font-display font-bold mt-2">{data.schedule.total_schedules}</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Exam Cycles</p>
          <p className="text-3xl font-display font-bold mt-2">{data.exams.length}</p>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Recent Exam Uploads</h2>
            <p className="text-xs text-muted-foreground mt-1">Each uploaded schedule becomes a reusable exam cycle for allocation and reports.</p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exam</TableHead>
              <TableHead>Schedules</TableHead>
              <TableHead>Blocks</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.exams.length > 0 ? data.exams.map((exam) => (
              <TableRow key={exam.exam_id}>
                <TableCell className="font-medium">{exam.exam_name}</TableCell>
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
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No exam schedules uploaded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
