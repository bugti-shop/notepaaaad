import { useState, useEffect } from 'react';
import { ArrowLeft, LogOut, Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BottomNavigation } from '@/components/BottomNavigation';
import { TodoBottomNavigation } from '@/components/TodoBottomNavigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';
import { useToast } from '@/hooks/use-toast';
import { getSetting } from '@/utils/settingsStorage';
import { motion } from 'framer-motion';
import googleLogo from '@/assets/google-logo.png';

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const location = useLocation();
  const { user, isLoading, isSignedIn, signIn, signOut } = useGoogleAuth();
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
      await signIn();
      toast({
        title: t('profile.signInSuccess'),
        description: t('profile.signInSuccessDesc'),
      });
    } catch (error: any) {
      console.error('Sign in failed:', error);
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

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-muted/30" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center justify-between px-4 h-14">
          <Link to={lastDashboard === 'todo' ? '/todo/today' : '/'} className="p-2 -ml-2 hover:bg-muted/50 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground">{t('profile.title')}</h1>
          <div className="w-9" />
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
              <div className="absolute -inset-12 bg-primary/5 rounded-full blur-3xl" />
              <div className="absolute top-0 left-0 w-6 h-6 bg-primary/10 rounded-full -translate-x-10 -translate-y-6" />
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-primary/10 rounded-full translate-x-14 translate-y-4" />
              <div className="relative w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-14 h-14 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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

            {/* Google Sign In Button */}
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-secondary/50 hover:bg-secondary/70 rounded-2xl transition-colors disabled:opacity-50"
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

        {/* Signed In - Simple profile with just avatar and sign out */}
        {isSignedIn && user && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm space-y-8"
          >
            {/* Profile Info - Centered and clean */}
            <div className="flex flex-col items-center py-8">
              <div className="relative mb-5">
                <div className="absolute -inset-6 bg-primary/5 rounded-full blur-xl" />
                <Avatar className="relative w-28 h-28 ring-4 ring-background shadow-xl">
                  <AvatarImage src={user.imageUrl} alt={user.name} />
                  <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                    {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>
              <h2 className="text-2xl font-semibold text-foreground">{user.name}</h2>
              <p className="text-muted-foreground text-sm mt-1">{user.email}</p>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-secondary/30 hover:bg-destructive/10 rounded-2xl transition-colors text-destructive"
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