import { startTransition, useCallback } from 'react';
import { Home, Calendar, Settings, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/utils/haptics';
import { useTranslation } from 'react-i18next';

const triggerNavHaptic = async () => {
  await triggerHaptic('heavy');
};

// Preload route modules on hover for instant navigation
const preloadRoutes: Record<string, () => Promise<any>> = {
  '/todo/today': () => import('@/pages/todo/Today'),
  '/todo/calendar': () => import('@/pages/todo/TodoCalendar'),
  '/profile': () => import('@/pages/Profile'),
  '/todo/settings': () => import('@/pages/todo/TodoSettings'),
};

export const TodoBottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const navItems = [
    { icon: Home, label: t('nav.home'), path: '/todo/today' },
    { icon: Calendar, label: t('nav.calendar'), path: '/todo/calendar' },
    { icon: User, label: t('nav.profile'), path: '/profile' },
    { icon: Settings, label: t('nav.settings'), path: '/todo/settings' },
  ];

  // Preload route module on hover/touch for instant navigation
  const handlePreload = useCallback((path: string) => {
    const preloadFn = preloadRoutes[path];
    if (preloadFn) {
      preloadFn().catch(() => {}); // Silently preload
    }
  }, []);

  // Use startTransition for non-blocking navigation
  const handleNavigation = useCallback((path: string) => {
    triggerNavHaptic();
    startTransition(() => {
      navigate(path);
    });
  }, [navigate]);

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
      }}
    >
      <div className="grid grid-cols-4 h-14 max-w-screen-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.path}
              type="button"
              onPointerDown={() => handlePreload(item.path)}
              onPointerUp={() => handleNavigation(item.path)}
              onMouseEnter={() => handlePreload(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-colors min-w-0 px-1 touch-target touch-manipulation select-none",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="text-[10px] sm:text-xs font-medium truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
