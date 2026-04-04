import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { buildReportUrl, getExamResult, getExams } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const examIdFromQuery = Number(searchParams.get('examId'));

  const examsQuery = useQuery({
    queryKey: ['exams'],
    queryFn: getExams,
  });

  const resolvedExamId = useMemo(() => {
    if (examIdFromQuery) return examIdFromQuery;
    return examsQuery.data?.[0]?.exam_id ?? 0;
  }, [examIdFromQuery, examsQuery.data]);

  const resultQuery = useQuery({
    queryKey: ['exam-result', resolvedExamId],
    queryFn: () => getExamResult(resolvedExamId),
    enabled: !!resolvedExamId,
  });

  if (examsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading results...</div>;
  }

  if (!examsQuery.data?.length) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-display font-bold">Results</h1>
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          No uploaded exam schedules yet. Use the allocation page to upload and run an exam cycle first.
        </div>
      </div>
    );
  }

  if (resultQuery.isLoading || !resultQuery.data) {
    return <div className="text-sm text-muted-foreground">Loading exam result...</div>;
  }

  const { exam, summary, sessions, unallocated } = resultQuery.data;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Allocation Results</h1>
          <p className="text-sm text-muted-foreground mt-1">{exam.exam_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="min-w-[260px] rounded-md border bg-background px-3 py-2 text-sm"
            value={exam.exam_id}
            onChange={(event) => setSearchParams({ examId: event.target.value })}
          >
            {examsQuery.data.map((item) => (
              <option key={item.exam_id} value={item.exam_id}>
                {item.exam_name}
              </option>
            ))}
          </select>
          <Button asChild variant="outline">
            <a href={buildReportUrl(exam.exam_id, 'excel')}>
              <Download className="w-4 h-4 mr-2" /> Excel
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card rounded-xl p-4"><p className="text-xs text-muted-foreground">Sessions</p><p className="text-2xl font-bold">{summary.total_sessions}</p></div>
        <div className="glass-card rounded-xl p-4"><p className="text-xs text-muted-foreground">Jr SV</p><p className="text-2xl font-bold">{summary.total_junior_supervisors}</p></div>
        <div className="glass-card rounded-xl p-4"><p className="text-xs text-muted-foreground">Sr SV</p><p className="text-2xl font-bold">{summary.total_senior_supervisors}</p></div>
        <div className="glass-card rounded-xl p-4"><p className="text-xs text-muted-foreground">Squad Members</p><p className="text-2xl font-bold">{summary.total_squad_members}</p></div>
        <div className="glass-card rounded-xl p-4"><p className="text-xs text-muted-foreground">Unallocated</p><p className="text-2xl font-bold">{summary.total_unallocated}</p></div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline"><a href={buildReportUrl(exam.exam_id, 'junior-supervisors.pdf')}>Junior SV PDF</a></Button>
        <Button asChild variant="outline"><a href={buildReportUrl(exam.exam_id, 'squads.pdf')}>Squad PDF</a></Button>
        <Button asChild variant="outline"><a href={buildReportUrl(exam.exam_id, 'senior-supervisors.pdf')}>Senior SV PDF</a></Button>
        <Button asChild variant="outline"><a href={buildReportUrl(exam.exam_id, 'unallocated.pdf')}>Unallocated PDF</a></Button>
      </div>

      <Tabs defaultValue="jr">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="jr">Jr SV</TabsTrigger>
          <TabsTrigger value="sr">Sr SV</TabsTrigger>
          <TabsTrigger value="squad">Squads</TabsTrigger>
          <TabsTrigger value="unallocated">Unallocated</TabsTrigger>
        </TabsList>

        <TabsContent value="jr" className="space-y-4 mt-4">
          {sessions.map((session) => (
            <div key={session.schedule_id} className="glass-card rounded-xl overflow-hidden">
              <div className="p-3 border-b border-border bg-muted/30">
                <span className="font-semibold">{session.exam_date} {session.shift}</span>
                <span className="text-muted-foreground ml-2 text-sm">{session.subject_name} • {session.dept_id} • {session.block_required} blocks</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Block</TableHead>
                    <TableHead>Faculty</TableHead>
                    <TableHead>Employee Code</TableHead>
                    <TableHead>Department</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.junior_supervisors.map((item) => (
                    <TableRow key={`${session.schedule_id}-${item.block_number}`}>
                      <TableCell className="font-bold">{item.block_number}</TableCell>
                      <TableCell>{item.faculty_name}</TableCell>
                      <TableCell>{item.employee_code}</TableCell>
                      <TableCell>{item.dept_id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="sr" className="space-y-4 mt-4">
          {sessions.map((session) => (
            <div key={session.schedule_id} className="glass-card rounded-xl overflow-hidden">
              <div className="p-3 border-b border-border bg-muted/30">
                <span className="font-semibold">{session.exam_date} {session.shift}</span>
                <span className="text-muted-foreground ml-2 text-sm">{session.subject_name}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faculty</TableHead>
                    <TableHead>Employee Code</TableHead>
                    <TableHead>Designation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.senior_supervisors.map((item) => (
                    <TableRow key={`${session.schedule_id}-${item.faculty_id}`}>
                      <TableCell>{item.faculty_name}</TableCell>
                      <TableCell>{item.employee_code}</TableCell>
                      <TableCell>{item.designation}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="squad" className="space-y-4 mt-4">
          {sessions.map((session) => (
            <div key={session.schedule_id} className="glass-card rounded-xl overflow-hidden">
              <div className="p-3 border-b border-border bg-muted/30">
                <span className="font-semibold">{session.exam_date} {session.shift}</span>
                <span className="text-muted-foreground ml-2 text-sm">{session.subject_name}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Squad</TableHead>
                    <TableHead>Member 1</TableHead>
                    <TableHead>Member 2</TableHead>
                    <TableHead>Member 3</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.squads.map((squad) => (
                    <TableRow key={`${session.schedule_id}-${squad.squad_number}`}>
                      <TableCell className="font-bold">{squad.squad_number}</TableCell>
                      {[0, 1, 2].map((index) => (
                        <TableCell key={index}>{squad.members[index]?.faculty_name ?? '-'}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="unallocated" className="glass-card rounded-xl overflow-hidden mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Faculty</TableHead>
                <TableHead>Employee Code</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unallocated.map((faculty) => (
                <TableRow key={faculty.faculty_id}>
                  <TableCell>{faculty.faculty_name}</TableCell>
                  <TableCell>{faculty.employee_code}</TableCell>
                  <TableCell>{faculty.dept_id}</TableCell>
                  <TableCell>{faculty.designation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
