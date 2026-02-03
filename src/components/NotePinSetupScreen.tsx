import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Lock, Fingerprint, AlertCircle, ArrowLeft, Trash2, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  getNotePinSettings,
  hasNotePin,
  setNotePin,
  setNoteBiometric,
  removeNotePin,
  verifyNotePinForNote,
  NotePinSettings,
} from '@/utils/notePinStorage';
import { triggerHaptic, triggerNotificationHaptic } from '@/utils/haptics';
import { Capacitor } from '@capacitor/core';

interface NotePinSetupScreenProps {
  noteId: string;
  noteTitle?: string;
  onComplete: () => void;
  onCancel: () => void;
}

type SetupStep = 'menu' | 'verify_old' | 'enter' | 'confirm' | 'new_pin' | 'confirm_new';

export const NotePinSetupScreen = ({ 
  noteId, 
  noteTitle,
  onComplete, 
  onCancel 
}: NotePinSetupScreenProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<SetupStep>('menu');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [settings, setSettings] = useState<NotePinSettings | null>(null);
  const [hasPinProtection, setHasPinProtection] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pendingAction, setPendingAction] = useState<'change' | 'remove' | 'biometric' | null>(null);

  useEffect(() => {
    loadSettings();
    checkBiometric();
  }, [noteId]);

  const loadSettings = async () => {
    const s = await getNotePinSettings(noteId);
    setSettings(s);
    const hasPin = await hasNotePin(noteId);
    setHasPinProtection(hasPin);
    setStep(hasPin ? 'menu' : 'enter');
  };

  const checkBiometric = async () => {
    if (!Capacitor.isNativePlatform()) {
      setBiometricAvailable(false);
      return;
    }
    
    try {
      const { NativeBiometric } = await import('capacitor-native-biometric');
      const result = await NativeBiometric.isAvailable();
      setBiometricAvailable(result.isAvailable);
    } catch {
      setBiometricAvailable(false);
    }
  };

  const getCurrentPin = () => {
    switch (step) {
      case 'verify_old':
        return oldPin;
      case 'enter':
      case 'new_pin':
        return pin;
      case 'confirm':
      case 'confirm_new':
        return confirmPin;
      default:
        return '';
    }
  };

  const handlePinChange = async (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    setPinError('');
    
    switch (step) {
      case 'verify_old':
        setOldPin(numericValue);
        if (numericValue.length === 4) {
          handleVerifyOldPin(numericValue);
        }
        break;
      case 'enter':
      case 'new_pin':
        setPin(numericValue);
        if (numericValue.length === 4) {
          triggerHaptic('light');
          setStep(step === 'enter' ? 'confirm' : 'confirm_new');
        }
        break;
      case 'confirm':
      case 'confirm_new':
        setConfirmPin(numericValue);
        if (numericValue.length === 4) {
          handleConfirmPin(numericValue);
        }
        break;
    }
  };

  const handleVerifyOldPin = async (enteredPin: string) => {
    const isValid = await verifyNotePinForNote(noteId, enteredPin);
    
    if (isValid) {
      triggerNotificationHaptic('success');
      
      if (pendingAction === 'remove') {
        await removeNotePin(noteId);
        toast.success(t('notePin.pinRemoved', 'PIN removed'));
        onComplete();
      } else if (pendingAction === 'change') {
        setStep('new_pin');
        setPin('');
      } else if (pendingAction === 'biometric') {
        await toggleBiometric();
      }
    } else {
      triggerNotificationHaptic('error');
      setPinError(t('notePin.incorrectPin', 'Incorrect PIN'));
      setTimeout(() => setOldPin(''), 300);
    }
  };

  const handleConfirmPin = async (enteredPin: string) => {
    if (enteredPin === pin) {
      triggerNotificationHaptic('success');
      await setNotePin(noteId, pin);
      toast.success(t('notePin.pinSet', 'PIN set successfully'));
      onComplete();
    } else {
      triggerNotificationHaptic('error');
      setPinError(t('notePin.pinMismatch', 'PINs do not match'));
      setTimeout(() => {
        setConfirmPin('');
        setPin('');
        setStep(hasPinProtection ? 'new_pin' : 'enter');
      }, 300);
    }
  };

  const toggleBiometric = async () => {
    if (!settings) return;
    
    const newValue = !settings.biometricEnabled;
    await setNoteBiometric(noteId, newValue);
    setSettings({ ...settings, biometricEnabled: newValue });
    toast.success(newValue 
      ? t('notePin.biometricEnabled', 'Fingerprint enabled') 
      : t('notePin.biometricDisabled', 'Fingerprint disabled')
    );
    setPendingAction(null);
    setStep('menu');
    setOldPin('');
  };

  const handleMenuAction = (action: 'change' | 'remove' | 'biometric') => {
    setPendingAction(action);
    setStep('verify_old');
    setOldPin('');
    setPinError('');
  };

  // Render PIN dots
  const renderPinDots = () => {
    const currentPin = getCurrentPin();
    return (
      <div className="flex gap-4 justify-center my-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "w-4 h-4 rounded-full border-2 transition-all duration-200",
              currentPin.length > i
                ? "bg-primary border-primary scale-110"
                : "border-muted-foreground/40"
            )}
          />
        ))}
      </div>
    );
  };

  // Render number pad
  const renderNumberPad = () => {
    const handleKeyPress = (num: string) => {
      const currentPin = getCurrentPin();
      if (currentPin.length < 4) {
        handlePinChange(currentPin + num);
        triggerHaptic('light');
      }
    };

    const handleDelete = () => {
      const currentPin = getCurrentPin();
      if (currentPin.length > 0) {
        switch (step) {
          case 'verify_old':
            setOldPin(oldPin.slice(0, -1));
            break;
          case 'enter':
          case 'new_pin':
            setPin(pin.slice(0, -1));
            break;
          case 'confirm':
          case 'confirm_new':
            setConfirmPin(confirmPin.slice(0, -1));
            break;
        }
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
            className="w-16 h-16 rounded-full bg-muted text-2xl font-semibold text-foreground flex items-center justify-center transition-all hover:bg-muted/80 active:bg-primary/20 active:scale-95"
          >
            {num}
          </button>
        ))}
        <div /> {/* Empty space */}
        <button
          type="button"
          onClick={() => handleKeyPress('0')}
          className="w-16 h-16 rounded-full bg-muted text-2xl font-semibold text-foreground flex items-center justify-center transition-all hover:bg-muted/80 active:bg-primary/20 active:scale-95"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="w-16 h-16 rounded-full bg-muted text-lg font-medium text-foreground flex items-center justify-center transition-all hover:bg-muted/80 active:bg-destructive/20 active:scale-95"
        >
          ⌫
        </button>
      </div>
    );
  };

  const getTitle = () => {
    switch (step) {
      case 'menu':
        return t('notePin.pinSettings', 'PIN Settings');
      case 'verify_old':
        return t('notePin.enterCurrentPin', 'Enter Current PIN');
      case 'enter':
        return t('notePin.setPin', 'Set PIN');
      case 'confirm':
        return t('notePin.confirmPin', 'Confirm PIN');
      case 'new_pin':
        return t('notePin.enterNewPin', 'Enter New PIN');
      case 'confirm_new':
        return t('notePin.confirmNewPin', 'Confirm New PIN');
      default:
        return t('notePin.setPin', 'Set PIN');
    }
  };

  const getSubtitle = () => {
    switch (step) {
      case 'menu':
        return noteTitle || t('notePin.manageSettings', 'Manage PIN settings for this note');
      case 'verify_old':
        return t('notePin.verifyToChange', 'Enter your current PIN to continue');
      case 'enter':
      case 'new_pin':
        return t('notePin.enter4Digits', 'Enter a 4-digit PIN to protect this note');
      case 'confirm':
      case 'confirm_new':
        return t('notePin.reenterPin', 'Re-enter the PIN to confirm');
      default:
        return '';
    }
  };

  const handleBack = () => {
    if (step === 'menu' || (step === 'enter' && !hasPinProtection)) {
      onCancel();
    } else if (step === 'confirm') {
      setStep('enter');
      setConfirmPin('');
    } else if (step === 'confirm_new') {
      setStep('new_pin');
      setConfirmPin('');
    } else if (step === 'verify_old' || step === 'new_pin') {
      setStep('menu');
      setOldPin('');
      setPin('');
      setPendingAction(null);
    }
    setPinError('');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-6">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 p-2 rounded-full hover:bg-muted transition-colors"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <ArrowLeft className="h-6 w-6 text-foreground" />
      </button>

      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Lock className="h-10 w-10 text-primary" />
      </div>
      
      <h1 className="text-2xl font-bold mb-2">{getTitle()}</h1>
      <p className="text-muted-foreground mb-4 text-center max-w-[280px] truncate">
        {getSubtitle()}
      </p>

      {step === 'menu' && hasPinProtection && (
        <div className="w-full max-w-[320px] space-y-4 mt-4">
          {/* Biometric option */}
          {biometricAvailable && (
            <div 
              className="flex items-center justify-between p-4 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => handleMenuAction('biometric')}
            >
              <div className="flex items-center gap-3">
                <Fingerprint className="h-5 w-5 text-primary" />
                <span className="font-medium">{t('notePin.useFingerprint', 'Use Fingerprint')}</span>
              </div>
              <Switch checked={settings?.biometricEnabled || false} />
            </div>
          )}

          {/* Change PIN */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14"
            onClick={() => handleMenuAction('change')}
          >
            <Lock className="h-5 w-5" />
            {t('notePin.changePin', 'Change PIN')}
          </Button>

          {/* Remove PIN */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => handleMenuAction('remove')}
          >
            <Trash2 className="h-5 w-5" />
            {t('notePin.removePin', 'Remove PIN')}
          </Button>
        </div>
      )}

      {step !== 'menu' && (
        <>
          {renderPinDots()}
          
          {pinError && (
            <div className="flex items-center gap-2 text-destructive text-sm mb-4 animate-shake text-center">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{pinError}</span>
            </div>
          )}
          
          {renderNumberPad()}
        </>
      )}
    </div>
  );
};
