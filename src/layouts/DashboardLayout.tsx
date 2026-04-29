import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Bell, CalendarDays } from 'lucide-react';
import { useAppState } from '@/context/AppContext';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Exam Control Dashboard',
    subtitle: 'Monitor faculty readiness, examination plans, and duty allocation progress in one place.',
  },
  'faculty-upload': {
    title: 'Faculty Records',
    subtitle: 'Maintain an accurate faculty list before preparing invigilation and squad assignments.',
  },
  allocation: {
    title: 'Duty Allocation',
    subtitle: 'Prepare examination schedules and generate balanced duty assignments for review.',
  },
  'block-assignment': {
    title: 'Block Assignment',
    subtitle: 'Assign specific block numbers to Junior Supervisors for each session, with department conflict checks.',
  },
  results: {
    title: 'Allocation Results',
    subtitle: 'Review generated duties and download ready-to-share reports for the examination team.',
  },
};

export default function DashboardLayout() {
  const { isLoggedIn } = useAppState();
  const location = useLocation();

  if (!isLoggedIn) return <Navigate to="/" replace />;

  const pageKey = location.pathname.split('/').pop() || 'dashboard';
  const pageMeta = pageTitles[pageKey] ?? pageTitles.dashboard;

  return (
    <SidebarProvider>
      <div className="h-screen w-full overflow-hidden p-5 md:p-8">
        <div className="glass-card mx-auto flex h-[calc(100vh-2.5rem)] w-full max-w-[1420px] gap-0 border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.66),rgba(255,255,255,0.5))] p-3 md:p-4">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-white/12 px-3 py-3 md:px-4">
            <header className="sticky top-3 z-10 mb-5 overflow-visible rounded-[22px] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.56))] px-4 py-4 shadow-[0_14px_32px_rgba(121,111,143,0.05)] backdrop-blur-xl md:px-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <SidebarTrigger className="mt-1 border border-white/75 bg-white/80 shadow-[0_8px_18px_rgba(121,111,143,0.06)] backdrop-blur-md" />
                  <div>
                    <p className="hero-badge mb-3">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Examination Management
                    </p>
                    <h2 className="text-xl font-extrabold text-foreground md:text-2xl">{pageMeta.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{pageMeta.subtitle}</p>
                  </div>
                </div>

                <div className="glass-panel flex items-center gap-3 self-stretch border-white/55 bg-white/64 px-4 py-3 md:self-auto">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Portal Status</p>
                    <p className="text-sm font-semibold text-foreground">Ready for examination workflow</p>
                  </div>
                </div>
              </div>
            </header>

            <main className="page-shell flex-1 overflow-y-auto overflow-x-hidden pb-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
