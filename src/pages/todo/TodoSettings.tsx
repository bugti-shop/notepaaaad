import { useState, useEffect } from 'react';
import { TodoBottomNavigation } from '@/components/TodoBottomNavigation';
import { ChevronRight, Check, ListTodo, Bell, Trash2, Flag, Palette, Globe, Shield, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { toast } from 'sonner';
import { useDarkMode, themes, ThemeId } from '@/hooks/useDarkMode';
import { languages } from '@/i18n';
import { TasksSettingsSheet } from '@/components/TasksSettingsSheet';
import { AppLockSettingsSheet } from '@/components/AppLockSettingsSheet';
import { AppLockSetup } from '@/components/AppLockSetup';
import appLogo from '@/assets/app-logo.png';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const TodoSettings = () => {
  const { t, i18n } = useTranslation();
  const { currentTheme, setTheme } = useDarkMode();
  
  // Dialog states
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [showTasksSettingsSheet, setShowTasksSettingsSheet] = useState(false);
  const [showAppLockSettingsSheet, setShowAppLockSettingsSheet] = useState(false);
  const [showAppLockSetup, setShowAppLockSetup] = useState(false);
  const [showNotificationsExpanded, setShowNotificationsExpanded] = useState(false);
  
  // Notification settings
  const [taskRemindersEnabled, setTaskRemindersEnabled] = useState(true);
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false);
  const [overdueAlertsEnabled, setOverdueAlertsEnabled] = useState(true);

  const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

  // Load settings
  useEffect(() => {
    getSetting<boolean>('taskRemindersEnabled', true).then(setTaskRemindersEnabled);
    getSetting<boolean>('dailyDigestEnabled', false).then(setDailyDigestEnabled);
    getSetting<boolean>('overdueAlertsEnabled', true).then(setOverdueAlertsEnabled);
  }, []);

  const handleLanguageChange = async (langCode: string) => {
    i18n.changeLanguage(langCode);
    await setSetting('npd_language', langCode);
    const lang = languages.find(l => l.code === langCode);
    toast.success(t('settings.languageChanged', { language: lang?.nativeName || langCode }));
    setShowLanguageDialog(false);
  };

  const handleTaskRemindersToggle = async (enabled: boolean) => {
    setTaskRemindersEnabled(enabled);
    await setSetting('taskRemindersEnabled', enabled);
    toast.success(enabled ? t('settings.taskRemindersEnabled', 'Task reminders enabled') : t('settings.taskRemindersDisabled', 'Task reminders disabled'));
  };

  const handleDailyDigestToggle = async (enabled: boolean) => {
    setDailyDigestEnabled(enabled);
    await setSetting('dailyDigestEnabled', enabled);
    toast.success(enabled ? t('settings.dailyDigestEnabled', 'Daily digest enabled') : t('settings.dailyDigestDisabled', 'Daily digest disabled'));
  };

  const handleOverdueAlertsToggle = async (enabled: boolean) => {
    setOverdueAlertsEnabled(enabled);
    await setSetting('overdueAlertsEnabled', enabled);
    toast.success(enabled ? t('settings.overdueAlertsEnabled', 'Overdue alerts enabled') : t('settings.overdueAlertsDisabled', 'Overdue alerts disabled'));
  };

  // Settings row component
  const SettingsRow = ({ label, value, onClick }: { label: string; value?: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors"
    >
      <span className="text-foreground text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-muted-foreground text-sm">{value}</span>}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );

  // Section heading component
  const SectionHeading = ({ title }: { title: string }) => (
    <div className="px-4 py-2 bg-muted/50">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
    </div>
  );

  return (
    <div className="min-h-screen min-h-screen-dynamic bg-background pb-16 sm:pb-20">
      <header className="border-b sticky top-0 bg-card z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="container mx-auto px-2 xs:px-3 sm:px-4 py-2 xs:py-3 sm:py-4">
          <div className="flex items-center gap-1.5 xs:gap-2 min-w-0">
            <img src={appLogo} alt="Npd" className="h-6 w-6 xs:h-7 xs:w-7 sm:h-8 sm:w-8 flex-shrink-0" />
            <h1 className="text-base xs:text-lg sm:text-xl font-bold truncate">{t('settings.taskSettings', 'Task Settings')}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 xs:px-3 sm:px-4 py-3 xs:py-4 sm:py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Task Settings Section */}
          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeading title={t('settings.taskPreferences', 'Task Preferences')} />
            <SettingsRow 
              label={t('settings.tasksSettings', 'Task Defaults & Display')} 
              onClick={() => setShowTasksSettingsSheet(true)} 
            />
          </div>

          {/* Appearance Section */}
          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeading title={t('settings.appearance', 'Appearance')} />
            <SettingsRow 
              label={t('settings.theme', 'Theme')} 
              value={themes.find(th => th.id === currentTheme)?.name}
              onClick={() => setShowThemeDialog(true)} 
            />
            <SettingsRow 
              label={t('settings.language', 'Language')} 
              value={currentLanguage.nativeName}
              onClick={() => setShowLanguageDialog(true)} 
            />
          </div>

          {/* Notifications Section */}
          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeading title={t('settings.notifications', 'Notifications')} />
            <button
              onClick={() => setShowNotificationsExpanded(!showNotificationsExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors"
            >
              <span className="text-foreground text-sm">{t('settings.notificationSettings', 'Notification Settings')}</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showNotificationsExpanded && "rotate-180")} />
            </button>
            
            {showNotificationsExpanded && (
              <div className="bg-muted/30">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <div className="flex-1 pr-4">
                    <span className="text-foreground text-sm block">{t('settings.taskReminders', 'Task Reminders')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('settings.taskRemindersDesc', 'Receive notifications for task due dates')}
                    </span>
                  </div>
                  <Switch
                    checked={taskRemindersEnabled}
                    onCheckedChange={handleTaskRemindersToggle}
                  />
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <div className="flex-1 pr-4">
                    <span className="text-foreground text-sm block">{t('settings.dailyDigest', 'Daily Digest')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('settings.dailyDigestDesc', 'Morning summary of today\'s tasks')}
                    </span>
                  </div>
                  <Switch
                    checked={dailyDigestEnabled}
                    onCheckedChange={handleDailyDigestToggle}
                  />
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 pr-4">
                    <span className="text-foreground text-sm block">{t('settings.overdueAlerts', 'Overdue Alerts')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('settings.overdueAlertsDesc', 'Get notified about overdue tasks')}
                    </span>
                  </div>
                  <Switch
                    checked={overdueAlertsEnabled}
                    onCheckedChange={handleOverdueAlertsToggle}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Security Section */}
          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeading title={t('settings.security', 'Security')} />
            <SettingsRow 
              label={t('settings.appLock', 'App Lock')} 
              onClick={() => setShowAppLockSettingsSheet(true)} 
            />
          </div>
        </div>
      </main>

      {/* Theme Dialog */}
      <Dialog open={showThemeDialog} onOpenChange={setShowThemeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('settings.selectTheme', 'Select Theme')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-1">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    setTheme(theme.id);
                    setShowThemeDialog(false);
                    toast.success(t('settings.themeChanged', { theme: theme.name }));
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                    currentTheme === theme.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-border"
                      style={{ backgroundColor: theme.preview }}
                    />
                    <span className="text-sm font-medium">{theme.name}</span>
                  </div>
                  {currentTheme === theme.id && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Language Dialog */}
      <Dialog open={showLanguageDialog} onOpenChange={setShowLanguageDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('settings.selectLanguage', 'Select Language')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-1">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                    i18n.language === lang.code ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <span className="text-sm font-medium block">{lang.nativeName}</span>
                      <span className="text-xs text-muted-foreground">{lang.name}</span>
                    </div>
                  </div>
                  {i18n.language === lang.code && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Tasks Settings Sheet */}
      <TasksSettingsSheet 
        isOpen={showTasksSettingsSheet} 
        onClose={() => setShowTasksSettingsSheet(false)} 
      />

      {/* App Lock Settings */}
      <AppLockSettingsSheet
        open={showAppLockSettingsSheet}
        onOpenChange={setShowAppLockSettingsSheet}
        onSetupLock={() => {
          setShowAppLockSettingsSheet(false);
          setShowAppLockSetup(true);
        }}
      />

      {showAppLockSetup && (
        <AppLockSetup
          onComplete={() => setShowAppLockSetup(false)}
          onCancel={() => setShowAppLockSetup(false)}
        />
      )}

      <TodoBottomNavigation />
    </div>
  );
};

export default TodoSettings;