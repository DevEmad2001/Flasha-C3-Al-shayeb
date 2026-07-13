import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Home,
  CreditCard,
  Users,
  Package,
  Receipt,
  CalendarDays,
  BarChart3,
  Building2,
  CalendarClock,
  ClipboardList,
  Circle,
  Settings,
  LogOut,
} from "lucide-react";
import { isAuthenticated, logout } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const LOGO_URL = "/logo.png";

type NavItem = { to: string; label: string; icon: typeof Home };

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "نظرة عامة",
    items: [
      { to: "/", label: "الرئيسية", icon: Home },
      { to: "/projects", label: "الإسكانات", icon: Building2 },
      { to: "/owners-monthly", label: "جرد الملاك", icon: Building2 },
    ],
  },
  {
    label: "العمليات",
    items: [
      { to: "/payments", label: "المدفوعات", icon: CreditCard },
      { to: "/customers", label: "الزبائن والأقساط", icon: Users },
      { to: "/schedule", label: "جدول الاستحقاق", icon: CalendarClock },
    ],
  },
  {
    label: "المالية والمخزون",
    items: [
      { to: "/inventory", label: "مواد البناء", icon: Package },
      { to: "/expenses", label: "المصاريف الخارجية", icon: Receipt },
      { to: "/daily", label: "المدخلات اليومية", icon: CalendarDays },
    ],
  },
  {
    label: "التحليلات",
    items: [
      { to: "/reports", label: "التقارير", icon: BarChart3 },
      { to: "/monthly", label: "الجرد الشهري", icon: CalendarDays },
      { to: "/stocktake", label: "الجرد الشامل", icon: ClipboardList },
    ],
  },
  {
    label: "النظام",
    items: [{ to: "/settings", label: "الإعدادات", icon: Settings }],
  },
];

function AlShaibSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const handleLogout = () => {
    closeMobileSidebar();
    logout();
    navigate({ to: "/login" });
  };

  return (
    <Sidebar
      collapsible="icon"
      side="right"
      className="border-l border-sidebar-border"
    >
      <SidebarHeader className="border-b border-sidebar-border/40 px-3 py-4">
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden">
            <img src={LOGO_URL} alt="الشايب للإسكان" className="w-9 h-9 object-contain" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in min-w-0 flex-1">
              <h1 className="font-display text-[15px] font-semibold leading-tight truncate text-white tracking-tight">
                الشايب للإسكان
              </h1>
              <p className="text-[11px] text-sidebar-foreground/60 truncate mt-0.5">
                لوحة الإدارة
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2 gap-0">
        {NAV_SECTIONS.map((section, idx) => (
          <SidebarGroup key={section.label} className={idx > 0 ? "mt-1" : ""}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/45 px-3 mb-1">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map(({ to, label, icon: Icon }) => {
                  const active = isActive(to);
                  return (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={label}
                        className="relative h-9 rounded-md px-3 text-[13px] font-medium text-sidebar-foreground/75 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white data-[active=true]:bg-white/[0.06] data-[active=true]:text-white data-[active=true]:font-semibold"
                      >
                        <Link to={to} className="flex items-center gap-3" onClick={closeMobileSidebar}>
                          {active && !collapsed && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-sidebar-primary" />
                          )}
                          <Icon
                            className={`w-[17px] h-[17px] shrink-0 transition-colors ${
                              active ? "text-sidebar-primary" : "text-sidebar-foreground/55"
                            }`}
                          />
                          {!collapsed && <span className="truncate">{label}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup className="mt-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="تسجيل الخروج"
                  onClick={handleLogout}
                  className="h-9 rounded-md px-3 text-[13px] font-medium text-sidebar-foreground/75 hover:bg-white/[0.04] hover:text-white"
                >
                  <LogOut className="w-[17px] h-[17px] shrink-0 text-sidebar-foreground/55" />
                  {!collapsed && <span className="truncate">تسجيل الخروج</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/40 p-3">
        {collapsed ? (
          <div className="flex justify-center">
            <Circle className="w-2 h-2 fill-success text-success" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-1">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-white/90 truncate leading-tight">
                النظام يعمل
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">
                الشايب للإسكان
              </p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginRoute = location.pathname === "/login";
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setAuthed(isAuthenticated());
    sync();
    setReady(true);
    window.addEventListener("alshaib-auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("alshaib-auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (ready && !authed && !isLoginRoute) {
      navigate({ to: "/login" });
    }
  }, [ready, authed, isLoginRoute, navigate]);

  if (isLoginRoute) {
    return <Outlet />;
  }

  if (!ready || !authed) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <SidebarProvider className="!min-h-0 h-dvh max-h-dvh overflow-hidden w-full">
      <AlShaibSidebar />
      <div className="flex flex-1 flex-col min-w-0 min-h-0 w-full bg-background">
        <header className="shrink-0 min-h-14 flex items-center gap-2 sm:gap-3 border-b border-border bg-card/80 backdrop-blur-md px-3 sm:px-4 z-30 shadow-card safe-top safe-x">
          <SidebarTrigger className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation md:h-8 md:w-8 md:min-h-0 md:min-w-0 hover:bg-secondary rounded-xl transition-colors shrink-0 -ms-1" />
          <div className="h-5 w-px bg-border shrink-0 hidden sm:block" />
          <span className="text-xs sm:text-sm font-medium text-muted-foreground min-w-0 truncate">
            <span className="font-display font-bold text-foreground">الشايب للإسكان</span>
            <span className="hidden sm:inline"> — لوحة الإدارة</span>
          </span>
        </header>
        <main className="app-main-scroll flex-1 min-h-0 min-w-0 page-enter safe-bottom safe-x">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
