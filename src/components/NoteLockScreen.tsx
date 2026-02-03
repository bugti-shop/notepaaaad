import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Lock, Fingerprint, KeyRound, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  getNotePinSettings,
  verifyNotePinForNote,
  NotePinSettings,
} from '@/utils/notePinStorage';
import { triggerHaptic, triggerNotificationHaptic } from '@/utils/haptics';
import { Capacitor } from '@capacitor/core';

interface NoteLockScreenProps {
  noteId: string;
  noteTitle?: string;
  onUnlock: () => void;
  onCancel: () => void;
}

export const NoteLockScreen = ({ 
  noteId, 
  noteTitle,
  onUnlock, 
  onCancel 
}: NoteLockScreenProps) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [settings, setSettings] = useState<NotePinSettings | null>(null);
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    loadSettings();
  }, [noteId]);

  // Handle lockout countdown
  useEffect(() => {
    if (lockCountdown > 0) {
      const timer = setTimeout(() => setLockCountdown(lockCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lockCountdown === 0 && isLocked) {
      setIsLocked(false);
      setAttempts(0);
    }
  }, [lockCountdown, isLocked]);

  const loadSettings = async () => {
    const s = await getNotePinSettings(noteId);
    setSettings(s);
    
    // Try biometric first if enabled
    if (s.biometricEnabled && Capacitor.isNativePlatform()) {
      attemptBiometric();
    }
  };

  const attemptBiometric = async () => {
    try {
      // Use native biometric authentication
      const { NativeBiometric } = await import('capacitor-native-biometric');
      
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable) {
        return;
      }
      
      await NativeBiometric.verifyIdentity({
        reason: t('notePin.biometricReason', 'Unlock your note'),
        title: t('notePin.biometricTitle', 'Authentication Required'),
        subtitle: noteTitle 
          ? t('notePin.biometricSubtitleNote', 'Use fingerprint to unlock "{{title}}"', { title: noteTitle })
          : t('notePin.biometricSubtitle', 'Use your fingerprint to unlock'),
      });
      
      // Biometric success
      triggerNotificationHaptic('success');
      onUnlock();
    } catch (error) {
      console.log('Biometric auth failed or not available:', error);
      // Fall back to PIN
    }
  };

  const handlePinChange = async (value: string) => {
    if (isLocked) return;
    
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    setPin(numericValue);
    setPinError('');

    if (numericValue.length === 4 && settings?.pinHash) {
      const isValid = await verifyNotePinForNote(noteId, numericValue);
      
      if (isValid) {
        triggerNotificationHaptic('success');
        onUnlock();
      } else {
        triggerNotificationHaptic('error');
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= 5) {
          // Lock for 30 seconds after 5 failed attempts
          setIsLocked(true);
          setLockCountdown(30);
          setPinError(t('notePin.tooManyAttempts', 'Too many attempts. Try again in 30 seconds.'));
        } else {
          setPinError(t('notePin.incorrectPin', 'Incorrect PIN. {{remaining}} attempts remaining.', { remaining: 5 - newAttempts }));
        }
        
        setTimeout(() => setPin(''), 300);
      }
    }
  };

  // Render PIN dots
  const renderPinDots = () => (
    <div className="flex gap-4 justify-center my-8">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "w-4 h-4 rounded-full border-2 transition-all duration-200",
            pin.length > i
              ? "bg-primary border-primary scale-110"
              : "border-muted-foreground/40"
          )}
        />
      ))}
    </div>
  );

  // Render number pad
  const renderNumberPad = () => {
    const handleKeyPress = (num: string) => {
      if (pin.length < 4 && !isLocked) {
        handlePinChange(pin + num);
        triggerHaptic('light');
      }
    };

    const handleDelete = () => {
      if (pin.length > 0) {
        setPin(pin.slice(0, -1));
        setPinError('');
        triggerHaptic('light');
      }
    };

    return (
      <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleKeyPress(num)}
            disabled={isLocked}
            className={cn(
              "w-16 h-16 rounded-full bg-muted text-2xl font-semibold text-foreground flex items-center justify-center transition-all",
              isLocked ? "opacity-50" : "hover:bg-muted/80 active:bg-primary/20 active:scale-95"
            )}
          >
            {num}
          </button>
        ))}
        <div /> {/* Empty space */}
        <button
          type="button"
          onClick={() => handleKeyPress('0')}
          disabled={isLocked}
          className={cn(
            "w-16 h-16 rounded-full bg-muted text-2xl font-semibold text-foreground flex items-center justify-center transition-all",
            isLocked ? "opacity-50" : "hover:bg-muted/80 active:bg-primary/20 active:scale-95"
          )}
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isLocked}
          className={cn(
            "w-16 h-16 rounded-full bg-muted text-lg font-medium text-foreground flex items-center justify-center transition-all",
            isLocked ? "opacity-50" : "hover:bg-muted/80 active:bg-destructive/20 active:scale-95"
          )}
        >
          ⌫
        </button>
      </div>
    );
  };

  if (!settings) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-6">
      {/* Back button */}
      <button
        onClick={onCancel}
        className="absolute top-4 left-4 p-2 rounded-full hover:bg-muted transition-colors"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <ArrowLeft className="h-6 w-6 text-foreground" />
      </button>

      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Lock className="h-10 w-10 text-primary" />
      </div>
      
      <h1 className="text-2xl font-bold mb-2">{t('notePin.enterPin', 'Enter PIN')}</h1>
      <p className="text-muted-foreground mb-4 text-center max-w-[280px]">
        {noteTitle 
          ? t('notePin.enterPinForNote', 'Enter PIN to unlock "{{title}}"', { title: noteTitle })
          : t('notePin.enterPinToUnlock', 'Enter your PIN to unlock the note')
        }
      </p>
      
      {renderPinDots()}
      
      {pinError && (
        <div className="flex items-center gap-2 text-destructive text-sm mb-4 animate-shake text-center">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{pinError}</span>
        </div>
      )}
      
      {isLocked && (
        <div className="text-center mb-4">
          <p className="text-destructive font-medium">{t('notePin.locked', 'Locked')}</p>
          <p className="text-muted-foreground text-sm">
            {t('notePin.tryAgainIn', 'Try again in {{seconds}} seconds', { seconds: lockCountdown })}
          </p>
        </div>
      )}
      
      {renderNumberPad()}
      
      <div className="flex gap-4 mt-8">
        {settings.biometricEnabled && Capacitor.isNativePlatform() && (
          <Button variant="ghost" onClick={attemptBiometric} className="gap-2">
            <Fingerprint className="h-5 w-5" />
            {t('notePin.useFingerprint', 'Use Fingerprint')}
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel} className="gap-2">
          <KeyRound className="h-5 w-5" />
          {t('notePin.forgotPin', 'Forgot PIN?')}
        </Button>
      </div>
    </div>
  );
};
