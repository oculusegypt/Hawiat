import { lazy, Suspense, useEffect } from 'react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ServiceRequestProvider } from '@/context/ServiceRequestContext';
import { SiteSettingsProvider, useSiteSettings } from '@/context/SiteSettingsContext';
import { ServiceRequestModal } from '@/components/home/ServiceRequestModal';
import { MarketingBadge } from '@/components/layout/MarketingBadge';
import { FloatingContactButtons } from '@/components/layout/FloatingContactButtons';
import { ScrollToTop } from "@/components/common/ScrollToTop";
import { getVisitorTracking } from "@/lib/visitorAttribution";
import { setAuthTokenGetter } from '@workspace/api-client-react';

// Configure the generated API client to attach the admin token to every request
setAuthTokenGetter(() => localStorage.getItem("admin_token"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Lazy loaded top-level routes
const AdminLogin = lazy(() => import('@/pages/admin/Login'));
const RequestPrint = lazy(() => import('@/pages/admin/RequestPrint'));
const AdminRoutes = lazy(() => import('@/routes/AdminRoutes').then(m => ({ default: m.AdminRoutes })));
const PublicRoutes = lazy(() => import('@/routes/PublicRoutes').then(m => ({ default: m.PublicRoutes })));

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>}>
      <Switch>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/requests/:id/print" component={RequestPrint} />

        <Route path="/admin/*?">
          <AdminRoutes />
        </Route>

        <Route>
          <PublicRoutes />
        </Route>
      </Switch>
    </Suspense>
  );
}

function AnonymousAnalyticsTracker() {
  const [location] = useLocation();

  useEffect(() => {
    try {
      const tracking = getVisitorTracking();
      fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: location, ...tracking }),
      }).catch(() => {});
    } catch {}
  }, [location]);

  return null;
}

function SiteIdentitySEO() {
  const [location] = useLocation();
  const { companyName, isLoaded } = useSiteSettings();

  useEffect(() => {
    if (location !== "/" && !location.startsWith("/admin")) return;
    if (!isLoaded) return;
    const isAdmin = location.startsWith("/admin");
    document.title = isAdmin
      ? (companyName ? `إدارة ${companyName}` : "لوحة الإدارة")
      : (companyName ? `${companyName} | تأجير حاويات الأنقاض والنفايات بالرياض` : "تأجير حاويات الأنقاض والنفايات بالرياض");
  }, [location, companyName, isLoaded]);

  return null;
}

function App() {
  useEffect(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SiteSettingsProvider>
          <ServiceRequestProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <AnonymousAnalyticsTracker />
              <ScrollToTop />
              <SiteIdentitySEO />
              <Router />
              <FloatingContactButtons />
            </WouterRouter>
            <MarketingBadge />
            <ServiceRequestModal />
            <Toaster />
          </ServiceRequestProvider>
        </SiteSettingsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
