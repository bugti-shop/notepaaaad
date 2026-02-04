import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, LogOut, Cloud, CheckCircle, Loader2, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BottomNavigation } from '@/components/BottomNavigation';
import { TodoBottomNavigation } from '@/components/TodoBottomNavigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';
import { useSmartSync } from '@/components/SmartSyncProvider';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { useToast } from '@/hooks/use-toast';
import { getSetting } from '@/utils/settingsStorage';
import { motion } from 'framer-motion';
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
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-muted/30" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center justify-between px-4 h-14">
          <Link to={lastDashboard === 'todo' ? '/todo/today' : '/'} className="p-2 -ml-2 hover:bg-muted/50 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground">{t('profile.title')}</h1>
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

      <div className="flex flex-col items-center px-6 pt-12">
        
        {/* Not Signed In - Clean minimal design */}
        {!isSignedIn && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center w-full max-w-sm"
          >
            {/* Decorative blob */}
            <div className="relative mb-8">
              <div className="absolute -inset-8 bg-primary/5 rounded-full blur-2xl" />
              <div className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-12 h-12 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                </svg>
              </div>
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-2 text-center">
              {t('profile.signInTitle', 'Sign in to sync your data')}
            </h2>
            <p className="text-muted-foreground text-sm text-center mb-10 max-w-xs">
              {t('profile.signInSubtitle', 'Keep your notes and tasks synced across all your devices.')}
            </p>

            {/* Google Sign In Button - Matching reference design */}
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-muted hover:bg-muted/80 rounded-2xl transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-foreground" />
              ) : (
                <img src={googleLogo} alt="Google" className="w-5 h-5" />
              )}
              <span className="font-medium text-foreground">
                {t('profile.continueWithGoogle', 'Continue with Google')}
              </span>
            </button>
          </motion.div>
        )}

        {/* Signed In - Profile View */}
        {isSignedIn && user && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm space-y-6"
          >
            {/* Profile Info */}
            <div className="flex flex-col items-center">
              <Avatar className="w-24 h-24 mb-4 ring-4 ring-background shadow-lg">
                <AvatarImage src={user.imageUrl} alt={user.name} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold text-foreground">{user.name}</h2>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>

            {/* Sync Section */}
            <div className="bg-card rounded-2xl p-5 shadow-sm space-y-4 border">
              <div className="flex items-center gap-3">
                <Cloud className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-medium text-foreground">{t('profile.cloudSync')}</h3>
                  <p className="text-xs text-muted-foreground">{t('profile.cloudSyncEnabled')}</p>
                </div>
              </div>

              {/* Sync Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
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
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                  {effectiveSyncError}
                </div>
              )}

              {/* Sync Button */}
              <Button
                onClick={handleSyncNow}
                disabled={effectiveIsSyncing || !isOnline}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-xl"
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
                    {t('profile.syncSettings', 'Settings')}
                  </li>
                </ul>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-card hover:bg-destructive/5 rounded-2xl transition-colors text-destructive shadow-sm border"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">{t('profile.signOut')}</span>
            </button>
          </motion.div>
        )}
      </div>

      {lastDashboard === 'todo' ? <TodoBottomNavigation /> : <BottomNavigation />}
    </div>
  );
}