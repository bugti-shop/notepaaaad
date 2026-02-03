import { useState, useEffect } from 'react';
import { ArrowLeft, User, RefreshCw, LogOut, Cloud, CloudOff, CheckCircle, Loader2, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BottomNavigation } from '@/components/BottomNavigation';
import { TodoBottomNavigation } from '@/components/TodoBottomNavigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';
import { useSmartSync } from '@/components/SmartSyncProvider';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { useToast } from '@/hooks/use-toast';
import { getSetting } from '@/utils/settingsStorage';
import googleLogo from '@/assets/google-logo.png';

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const location = useLocation();
  const { user, isLoading, isSignedIn, signIn, signOut } = useGoogleAuth();
  const { isOnline, isSyncing: autoSyncing, lastSync: autoLastSync, hasError: autoHasError, triggerSync } = useSmartSync();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastDashboard, setLastDashboard] = useState<'notes' | 'todo'>('notes');

  // Determine which dashboard the user came from
  useEffect(() => {
    const checkLastDashboard = async () => {
      // Check referrer from location state or stored setting
      const fromState = (location.state as any)?.from;
      if (fromState?.startsWith('/todo')) {
        setLastDashboard('todo');
      } else {
        const stored = await getSetting<string>('lastDashboard', 'notes');
        setLastDashboard(stored === 'todo' ? 'todo' : 'notes');
      }
    };
    checkLastDashboard();
  }, [location.state]);

  const handleSignIn = async () => {
    try {
      setSyncError(null);
      await signIn();
      toast({
        title: t('profile.signInSuccess'),
        description: t('profile.signInSuccessDesc'),
      });
    } catch (error: any) {
      console.error('Sign in failed:', error);
      setSyncError(error.message);
      toast({
        title: t('profile.signInFailed'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: t('profile.signedOut'),
        description: t('profile.signedOutDesc'),
      });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleSyncNow = async () => {
    if (!isSignedIn) return;
    
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const success = await triggerSync();
      
      if (success) {
        toast({
          title: t('profile.syncSuccess'),
          description: t('profile.syncSuccessDesc'),
        });
      } else {
        setSyncError('Sync failed');
        toast({
          title: t('profile.syncPartial'),
          description: 'Some items could not be synced',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setSyncError(error.message);
      toast({
        title: t('profile.syncFailed'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Combine local and auto sync state
  const effectiveSyncError = syncError || (autoHasError ? t('profile.syncFailed') : null);
  const effectiveIsSyncing = isSyncing || autoSyncing;
  const effectiveLastSync = autoLastSync;

  const formatLastSync = (date: Date | null): string => {
    if (!date) return t('profile.neverSynced');
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('profile.justNow');
    if (minutes < 60) return t('profile.minutesAgo', { count: minutes });
    if (hours < 24) return t('profile.hoursAgo', { count: hours });
    return t('profile.daysAgo', { count: days });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center justify-between px-4 h-14">
          <Link to={lastDashboard === 'todo' ? '/todo/today' : '/'} className="p-2 -ml-2 hover:bg-accent rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('profile.title')}</h1>
          {/* Sync Status Badge */}
          {isSignedIn && (
            <SyncStatusIndicator
              isOnline={isOnline}
              isSyncing={effectiveIsSyncing}
              lastSync={effectiveLastSync}
              hasError={!!effectiveSyncError}
              showLabel={false}
              className="px-2 py-1"
            />
          )}
          {!isSignedIn && <div className="w-9" />}
        </div>
      </header>

      <div className="p-4 space-y-6">

        {/* Profile Section */}
        <Card>
          <CardHeader className="text-center pb-4">
            <div className="flex flex-col items-center">
              {isSignedIn && user ? (
                <>
                  <Avatar className="w-20 h-20 mb-3 ring-2 ring-primary/20">
                    <AvatarImage src={user.imageUrl} alt={user.name} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-xl">{user.name}</CardTitle>
                  <CardDescription className="mt-1">{user.email}</CardDescription>
                  
                  {/* Profile ID */}
                  <div className="mt-3 px-3 py-2 rounded-lg bg-muted/50 w-full max-w-xs">
                    <p className="text-xs text-muted-foreground text-center">
                      {t('profile.profileId', 'Profile ID')}
                    </p>
                    <p className="text-xs font-mono text-foreground/70 text-center truncate">
                      {user.id}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <User className="w-10 h-10 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{t('profile.guest')}</CardTitle>
                  <CardDescription>{t('profile.signInPrompt')}</CardDescription>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!isSignedIn ? (
              <Button
                onClick={handleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 h-12"
                variant="outline"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <img src={googleLogo} alt="Google" className="w-5 h-5" />
                )}
                <span>{t('profile.signInWithGoogle')}</span>
              </Button>
            ) : (
              <Button
                onClick={handleSignOut}
                disabled={isLoading}
                variant="outline"
                className="w-full flex items-center justify-center gap-2 h-12 text-destructive hover:text-destructive"
              >
                <LogOut className="h-5 w-5" />
                <span>{t('profile.signOut')}</span>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Sync Section - Only show when signed in */}
        {isSignedIn && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {isSignedIn ? (
                <Cloud className="h-6 w-6 text-primary" />
              ) : (
                <CloudOff className="h-6 w-6 text-muted-foreground" />
              )}
              <div>
                <CardTitle className="text-lg">{t('profile.cloudSync')}</CardTitle>
                <CardDescription>
                  {isSignedIn ? t('profile.cloudSyncEnabled') : t('profile.cloudSyncDisabled')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSignedIn && (
              <>
                {/* Auto-Sync Status */}
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{t('profile.autoSync', 'Auto-Sync')}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {t('profile.every30s', 'Every 30s')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('profile.autoSyncDesc', 'Syncs automatically when app is active, on focus, and when network is restored.')}
                  </p>
                </div>

                {/* Sync Status */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    {effectiveSyncError ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : effectiveLastSync ? (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    ) : (
                      <Cloud className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {t('profile.lastSync')}: {formatLastSync(effectiveLastSync)}
                    </span>
                  </div>
                  {isOnline ? (
                    <Wifi className="h-4 w-4 text-primary" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {effectiveSyncError && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {effectiveSyncError}
                  </div>
                )}

                {/* Sync Button */}
                <Button
                  onClick={handleSyncNow}
                  disabled={effectiveIsSyncing || !isOnline}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${effectiveIsSyncing ? 'animate-spin' : ''}`} />
                  <span>{effectiveIsSyncing ? t('profile.syncing') : t('profile.syncNow')}</span>
                </Button>

                {/* What syncs */}
                <div className="pt-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">{t('profile.whatSyncs')}</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      {t('profile.syncNotes')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      {t('profile.syncTasks')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      {t('profile.syncFolders')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      {t('profile.syncSections', 'Task Sections')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      {t('profile.syncSettings', 'Settings')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      {t('profile.syncActivity', 'Activity Log')}
                    </li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {lastDashboard === 'todo' ? <TodoBottomNavigation /> : <BottomNavigation />}
    </div>
  );
}
