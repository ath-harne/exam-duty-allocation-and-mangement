import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Download, FileCheck2 } from 'lucide-react';
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
import type { ExamResultSession } from '@/types/exam';

/** Groups sessions by exam_date and returns an ordered Map */
function groupByDate(sessions: ExamResultSession[]): Map<string, ExamResultSession[]> {
  const map = new Map<string, ExamResultSession[]>();
  for (const session of sessions) {
    const date = session.exam_date;
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(session);
  }
  return map;
}

/** Formats an ISO date string to a human-readable label */
function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

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
    return <div className="glass-card p-6 text-sm text-muted-foreground">Loading results...</div>;
  }

  if (!examsQuery.data?.length) {
    return (
      <div className="glass-card max-w-4xl p-8 text-center">
        <h1 className="text-2xl font-extrabold text-foreground">No Results Available Yet</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          Add an examination schedule and generate the duty allocation first. The full result view and report downloads will appear here after allocation is completed.
        </p>
      </div>
    );
  }

  if (resultQuery.isLoading || !resultQuery.data) {
    return <div className="glass-card p-6 text-sm text-muted-foreground">Loading examination result...</div>;
  }

  const { exam, summary, sessions, unallocated, sr_supervisors: srSupervisors = [] } = resultQuery.data;

  const sessionsByDate = groupByDate(sessions);

  return (
    <div className="space-y-6">
      <section className="glass-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <span className="hero-badge">
              <FileCheck2 className="h-3.5 w-3.5" />
              Final Review
            </span>
            <h1 className="mt-4 section-title text-3xl md:text-4xl">Duty allocation results for {exam.exam_name}</h1>
            <p className="section-copy">
              Review the generated duties carefully, switch between examination plans when needed, and download clean reports for departmental circulation.
            </p>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <select
              className="min-h-11 w-full rounded-xl border border-white/55 bg-white/40 px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring"
              value={exam.exam_id}
              onChange={(event) => setSearchParams({ examId: event.target.value })}
            >
              {examsQuery.data.map((item) => (
                <option key={item.exam_id} value={item.exam_id}>
                  {item.exam_name}
                </option>
              ))}
            </select>

            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full justify-start text-left">
                <a href={buildReportUrl(exam.exam_id, 'excel/junior-supervisors')}>
                  <Download className="mr-2 h-4 w-4 shrink-0" />
                  Excel: Junior Supervisors
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start text-left">
                <a href={buildReportUrl(exam.exam_id, 'excel/squads')}>
                  <Download className="mr-2 h-4 w-4 shrink-0" />
                  Excel: Squad Teams
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start text-left">
                <a href={buildReportUrl(exam.exam_id, 'excel/senior-supervisors')}>
                  <Download className="mr-2 h-4 w-4 shrink-0" />
                  Excel: Senior Supervisors
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <div className="metric-card"><p className="text-sm font-semibold text-muted-foreground">Sessions</p><p className="mt-4 text-4xl font-extrabold text-foreground">{summary.total_sessions}</p></div>
        <div className="metric-card"><p className="text-sm font-semibold text-muted-foreground">Junior Supervisors</p><p className="mt-4 text-4xl font-extrabold text-foreground">{summary.total_junior_supervisors}</p></div>
        <div className="metric-card"><p className="text-sm font-semibold text-muted-foreground">Senior Supervisors</p><p className="mt-4 text-4xl font-extrabold text-foreground">{summary.total_senior_supervisors}</p></div>
        <div className="metric-card"><p className="text-sm font-semibold text-muted-foreground">Squad Members</p><p className="mt-4 text-4xl font-extrabold text-foreground">{summary.total_squad_members}</p></div>
        <div className="metric-card"><p className="text-sm font-semibold text-muted-foreground">Unassigned Faculty</p><p className="mt-4 text-4xl font-extrabold text-foreground">{summary.total_unallocated}</p></div>
      </section>

      <section className="glass-card p-5">
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline"><a href={buildReportUrl(exam.exam_id, 'junior-supervisors.pdf')}>Junior Supervisor PDF</a></Button>
          <Button asChild variant="outline"><a href={buildReportUrl(exam.exam_id, 'squads.pdf')}>Squad Duty PDF</a></Button>
          <Button asChild variant="outline"><a href={buildReportUrl(exam.exam_id, 'senior-supervisors.pdf')}>Senior Supervisor PDF</a></Button>
          <Button asChild variant="outline"><a href={buildReportUrl(exam.exam_id, 'unallocated.pdf')}>Unassigned Faculty PDF</a></Button>
        </div>
      </section>

      <Tabs defaultValue="jr" className="space-y-4">
        <TabsList className="grid h-auto w-full max-w-4xl grid-cols-2 gap-2 rounded-[24px] border border-white/45 bg-white/35 p-2 backdrop-blur-md md:grid-cols-4">
          <TabsTrigger value="jr" className="rounded-2xl">Junior Supervisors</TabsTrigger>
          <TabsTrigger value="sr" className="rounded-2xl">Senior Supervisors</TabsTrigger>
          <TabsTrigger value="squad" className="rounded-2xl">Squad Teams</TabsTrigger>
          <TabsTrigger value="unallocated" className="rounded-2xl">Unassigned Faculty</TabsTrigger>
        </TabsList>

        {/* ── Junior Supervisors – grouped by date ── */}
        <TabsContent value="jr" className="space-y-8">
          {Array.from(sessionsByDate.entries()).map(([date, dateSessions]) => (
            <div key={date} className="space-y-3">
              {/* Date header */}
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
                <h2 className="text-base font-extrabold tracking-wide text-foreground">{formatDate(date)}</h2>
                <div className="h-px flex-1 bg-white/30" />
              </div>

              {/* Sessions for this date */}
              {dateSessions.map((session) => (
                <div key={session.schedule_id} className="glass-card overflow-hidden">
                  <div className="border-b border-white/35 bg-white/18 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="rounded-md bg-primary/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
                        {session.shift === 'M' ? 'Morning' : session.shift === 'E' ? 'Evening' : session.shift}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{session.subject_name}</span>
                      <span className="text-sm text-muted-foreground">{session.dept_id}</span>
                      <span className="text-sm text-muted-foreground">{session.block_required} blocks</span>
                      {typeof session.student_count === 'number' ? (
                        <span className="text-sm text-muted-foreground">{session.student_count} students</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="overflow-x-auto px-2 pb-2">
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
                          <TableRow key={`${session.schedule_id}-${item.block_number}`} className="border-white/30">
                            <TableCell className="font-bold">{item.block_number}</TableCell>
                            <TableCell className="font-semibold">{item.faculty_name}</TableCell>
                            <TableCell>{item.employee_code}</TableCell>
                            <TableCell>{item.dept_id}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {session.substitutes?.length ? (
                    <div className="border-t border-white/30 px-5 py-4">
                      <p className="text-sm font-semibold text-foreground">Substitute Junior Supervisors</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {session.substitutes.map((faculty) => faculty.faculty_name).join(', ')}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </TabsContent>

        {/* ── Senior Supervisors – global pool ── */}
        <TabsContent value="sr" className="space-y-4">
          <div className="glass-card overflow-hidden">
            <div className="border-b border-white/35 bg-white/18 px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-sm font-bold text-foreground">Global Sr SV Pool</span>
                <span className="text-sm text-muted-foreground">The same selected senior supervisors are reused across sessions.</span>
              </div>
            </div>
            <div className="overflow-x-auto px-2 pb-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faculty</TableHead>
                    <TableHead>Employee Code</TableHead>
                    <TableHead>Designation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {srSupervisors.map((item) => (
                    <TableRow key={item.faculty_id} className="border-white/30">
                      <TableCell className="font-semibold">{item.faculty_name}</TableCell>
                      <TableCell>{item.employee_code}</TableCell>
                      <TableCell>{item.designation}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Squad Teams – grouped by date ── */}
        <TabsContent value="squad" className="space-y-8">
          {Array.from(sessionsByDate.entries()).map(([date, dateSessions]) => (
            <div key={date} className="space-y-3">
              {/* Date header */}
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
                <h2 className="text-base font-extrabold tracking-wide text-foreground">{formatDate(date)}</h2>
                <div className="h-px flex-1 bg-white/30" />
              </div>

              {/* Sessions for this date */}
              {dateSessions.map((session) => (
                <div key={session.schedule_id} className="glass-card overflow-hidden">
                  <div className="border-b border-white/35 bg-white/18 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="rounded-md bg-primary/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
                        {session.shift === 'M' ? 'Morning' : session.shift === 'E' ? 'Evening' : session.shift}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{session.subject_name}</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto px-2 pb-2">
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
                          <TableRow key={`${session.schedule_id}-${squad.squad_number}`} className="border-white/30">
                            <TableCell className="font-bold">{squad.squad_number}</TableCell>
                            {[0, 1, 2].map((index) => (
                              <TableCell key={index}>{squad.members[index]?.faculty_name ?? '-'}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </TabsContent>

        {/* ── Unassigned Faculty ── */}
        <TabsContent value="unallocated" className="glass-card overflow-hidden">
          <div className="border-b border-white/35 px-6 py-5">
            <h2 className="text-lg font-bold text-foreground">Unassigned Faculty</h2>
            <p className="mt-2 text-sm text-muted-foreground">Faculty members who have not been assigned for the selected examination.</p>
          </div>
          <div className="overflow-x-auto px-2 pb-2">
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
                  <TableRow key={faculty.faculty_id} className="border-white/30">
                    <TableCell className="font-semibold">{faculty.faculty_name}</TableCell>
                    <TableCell>{faculty.employee_code}</TableCell>
                    <TableCell>{faculty.dept_id}</TableCell>
                    <TableCell>{faculty.designation}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
