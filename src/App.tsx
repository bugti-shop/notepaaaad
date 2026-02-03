import { useEffect, useState, lazy, Suspense, startTransition } from "react";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WelcomeProvider, useWelcome } from "@/contexts/WelcomeContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import { NotesProvider } from "@/contexts/NotesContext";
import { GoogleAuthProvider } from "@/contexts/GoogleAuthContext";
import { SmartSyncProvider } from "@/components/SmartSyncProvider";
import OnboardingFlow from "@/components/OnboardingFlow";
import { NavigationLoader } from "@/components/NavigationLoader";
import { PersistentNotificationHandler } from "@/components/PersistentNotificationHandler";
import { NotificationActionsHandler } from "@/components/NotificationActionsHandler";
import { NavigationBackProvider } from "@/components/NavigationBackProvider";
import { notificationManager } from "@/utils/notifications";
import { persistentNotificationManager } from "@/utils/persistentNotification";
import { widgetDataSync } from "@/utils/widgetDataSync";
import { getSetting, setSetting } from "@/utils/settingsStorage";
import { shouldAppBeLocked, updateLastUnlockTime } from "@/utils/appLockStorage";
import { AppLockScreen } from "@/components/AppLockScreen";
import Index from "./pages/Index";

// Lazy load most page components for faster navigation, but keep the initial screen eager
const Notes = lazy(() => import("./pages/Notes"));
const NotesCalendar = lazy(() => import("./pages/NotesCalendar"));
const WebClipper = lazy(() => import("./pages/WebClipper"));
const Settings = lazy(() => import("./pages/Settings"));
const Reminders = lazy(() => import("./pages/Reminders"));
const Today = lazy(() => import("./pages/todo/Today"));
const Upcoming = lazy(() => import("./pages/todo/Upcoming"));
const TodoCalendar = lazy(() => import("./pages/todo/TodoCalendar"));
const TodoSettings = lazy(() => import("./pages/todo/TodoSettings"));
const CustomToolDetail = lazy(() => import("./pages/todo/CustomToolDetail"));
const WeeklyReview = lazy(() => import("./pages/todo/WeeklyReview"));
const WidgetsDashboard = lazy(() => import("./pages/todo/WidgetsDashboard"));
const TaskHistory = lazy(() => import("./pages/todo/TaskHistory"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// IMPORTANT: Only decide the initial dashboard once per app session.
// This prevents slow async IndexedDB reads every time the user taps "Home".
let hasResolvedInitialDashboard = false;

// No loading screen - render nothing for instant feel
const EmptyFallback = () => null;

// Global error handler for unhandled errors (prevents white screen on mobile)
if (typeof window !== 'undefined') {
  window.onerror = (message, source, lineno, colno, error) => {
    console.error('Global error:', { message, source, lineno, colno, error });
    return false;
  };
  
  window.onunhandledrejection = (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  };
}

// Component to track and save last visited dashboard
const DashboardTracker = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Save dashboard type when navigating between Notes and Todo sections
    const path = location.pathname;
    if (path.startsWith('/todo')) {
      setSetting('lastDashboard', 'todo');
    } else if (path === '/' || path === '/notes' || path === '/calendar' || path === '/settings') {
      setSetting('lastDashboard', 'notes');
    }
  }, [location.pathname]);
  
  return null;
};

// Root redirect component that checks last dashboard and redirects accordingly
// Renders Index immediately - no loading screen, redirect happens seamlessly in background
const RootRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // If we've already resolved once, skip
    if (hasResolvedInitialDashboard) return;
    hasResolvedInitialDashboard = true;
    
    const checkLastDashboard = async () => {
      try {
        const lastDashboard = await getSetting<string>('lastDashboard', 'notes');
        if (lastDashboard === 'todo') {
          startTransition(() => {
            navigate('/todo/today', { replace: true });
          });
        }
      } catch (e) {
        console.warn('Failed to check last dashboard:', e);
      }
    };
    
    checkLastDashboard();
  }, [navigate]);
  
  // Always render Index immediately - no loading screen
  return <Index />;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <NavigationBackProvider>
        <NavigationLoader />
        <DashboardTracker />
        <PersistentNotificationHandler />
        <NotificationActionsHandler />
        <Suspense fallback={<EmptyFallback />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/calendar" element={<NotesCalendar />} />
            <Route path="/clip" element={<WebClipper />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/todo/today" element={<Today />} />
            <Route path="/todo/upcoming" element={<Upcoming />} />
            <Route path="/todo/calendar" element={<TodoCalendar />} />
            <Route path="/todo/settings" element={<TodoSettings />} />
            <Route path="/todo/tool/:toolId" element={<CustomToolDetail />} />
            <Route path="/todo/weekly-review" element={<WeeklyReview />} />
            <Route path="/todo/dashboard" element={<WidgetsDashboard />} />
            <Route path="/todo/history" element={<TaskHistory />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </NavigationBackProvider>
    </BrowserRouter>
  );
};

const AppContent = () => {
  const { hasSeenWelcome, completeWelcome } = useWelcome();
  const [isAppLocked, setIsAppLocked] = useState<boolean | null>(null);
  
  // Initialize keyboard height detection for mobile toolbar positioning
  useKeyboardHeight();

  useEffect(() => {
    notificationManager.initialize().catch(console.error);
    persistentNotificationManager.initialize().catch(console.error);
    widgetDataSync.initialize().catch(console.error);
    
    // Check app lock status
    const checkLock = async () => {
      const locked = await shouldAppBeLocked();
      setIsAppLocked(locked);
    };
    checkLock();
    
    // Also check on visibility change (app comes back to foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle unlock
  const handleUnlock = async () => {
    await updateLastUnlockTime();
    setIsAppLocked(false);
  };

  if (!hasSeenWelcome) {
    return <OnboardingFlow onComplete={completeWelcome} />;
  }

  // Show lock screen if locked (but not while checking)
  if (isAppLocked === true) {
    return <AppLockScreen onUnlock={handleUnlock} />;
  }

  return (
    <>
      <Toaster />
      <Sonner />
      <AppRoutes />
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <GoogleAuthProvider>
          <SmartSyncProvider>
            <RevenueCatProvider>
              <NotesProvider>
                <WelcomeProvider>
                  <SubscriptionProvider>
                    <AppContent />
                  </SubscriptionProvider>
                </WelcomeProvider>
              </NotesProvider>
            </RevenueCatProvider>
          </SmartSyncProvider>
        </GoogleAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;