import {
  Calendar,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Settings,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAppState } from '@/context/AppContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Faculty Records', url: '/dashboard/faculty-upload', icon: Upload },
  { title: 'Duty Allocation', url: '/dashboard/allocation', icon: Settings },
  { title: 'Block Rules', url: '/dashboard/dept-block-rules', icon: FileSpreadsheet },
  { title: 'Block Assignment', url: '/dashboard/block-assignment', icon: LayoutGrid },
  { title: 'Results', url: '/dashboard/results', icon: FileSpreadsheet },
  { title: 'Day-wise Mapping', url: '/dashboard/daywise-allocation', icon: Calendar },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { logout } = useAppState();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      className="md:!w-[15.5rem] md:group-data-[collapsible=icon]:!w-[5rem] md:pr-2"
    >
      <SidebarContent className="h-full rounded-[22px] border border-white/55 bg-[linear-gradient(180deg,rgba(239,238,252,0.88),rgba(241,238,248,0.72))] text-sidebar-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.62)] backdrop-blur-xl">
        <div className="px-4 pt-5">
          <div className="flex items-center gap-3 rounded-2xl border border-white/68 bg-white/78 px-3 py-3 shadow-[0_10px_22px_rgba(121,111,143,0.05)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_10px_22px_rgba(74,129,239,0.25)]">
              <GraduationCap className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">Exam Cell Portal</p>
                <p className="truncate text-xs text-muted-foreground">Administration</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup className="px-3 pt-4">
          <SidebarGroupLabel className="px-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-auto rounded-xl p-0 hover:bg-transparent">
                    <NavLink
                      to={item.url}
                      end={item.url === '/dashboard'}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sidebar-foreground transition-all hover:bg-white/78 hover:shadow-[0_10px_20px_rgba(121,111,143,0.05)]"
                      activeClassName="bg-primary text-white shadow-[0_12px_24px_rgba(74,129,239,0.22)]"
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span className="truncate text-sm font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-3 p-0">
        <div className="rounded-[18px] border border-white/62 bg-white/72 px-2.5 py-2.5 backdrop-blur-md">
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'default'}
            className="w-full justify-start rounded-xl text-sidebar-foreground hover:bg-white hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
