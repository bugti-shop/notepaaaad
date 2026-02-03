import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { KeyRound, Trash2, Fingerprint, Shield } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { triggerHaptic } from '@/utils/haptics';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';
import {
  getMasterPinSettings,
  setMasterPin,
  removeMasterPin,
  verifyMasterPin,
  setMasterPinBiometric,
  MasterPinSettings,
} from '@/utils/notePinStorage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MasterPinSetupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPinChanged?: () => void;
}

type SetupStep = 'enter' | 'confirm' | 'verify_old' | 'new_pin' | 'confirm_new';

export const MasterPinSetupSheet = ({
  isOpen,
  onClose,
  onPinChanged,
}: MasterPinSetupSheetProps) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [hasMasterPin, setHasMasterPin] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [step, setStep] = useState<SetupStep>('enter');
  const [isLoading, setIsLoading] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      checkBiometric();
      setPin('');
      setConfirmPin('');
      setOldPin('');
    }
  }, [isOpen]);

  const loadSettings = async () => {
    const settings = await getMasterPinSettings();
    setHasMasterPin(settings.enabled && !!settings.pinHash);
    setBiometricEnabled(settings.biometricEnabled);
    setStep(settings.enabled && settings.pinHash ? 'verify_old' : 'enter');
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

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step, isOpen]);

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

  const setCurrentPin = (value: string) => {
    switch (step) {
      case 'verify_old':
        setOldPin(value);
        break;
      case 'enter':
      case 'new_pin':
        setPin(value);
        break;
      case 'confirm':
      case 'confirm_new':
        setConfirmPin(value);
        break;
    }
  };

  const handlePinInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const currentPin = getCurrentPin();
    const newPin = currentPin.split('');
    newPin[index] = value.slice(-1);
    const updatedPin = newPin.join('').slice(0, 4);
    setCurrentPin(updatedPin);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    if (updatedPin.length === 4) {
      setTimeout(() => handlePinComplete(updatedPin), 150);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    const currentPin = getCurrentPin();
    if (e.key === 'Backspace' && !currentPin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePinComplete = async (completedPin: string) => {
    await triggerHaptic('light');

    if (step === 'verify_old') {
      setIsLoading(true);
      const isValid = await verifyMasterPin(completedPin);
      setIsLoading(false);
      
      if (isValid) {
        setStep('new_pin');
        setPin('');
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } else {
        await triggerHaptic('heavy');
        toast.error(t('masterPin.incorrectPin', 'Incorrect Master PIN'));
        setOldPin('');
        inputRefs.current[0]?.focus();
      }
    } else if (step === 'enter') {
      setStep('confirm');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } else if (step === 'new_pin') {
      setStep('confirm_new');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } else if (step === 'confirm' || step === 'confirm_new') {
      if (completedPin === pin) {
        setIsLoading(true);
        await setMasterPin(pin);
        setIsLoading(false);
        await triggerHaptic('heavy');
        toast.success(t('masterPin.pinSet', 'Master PIN set successfully'));
        onPinChanged?.();
        onClose();
      } else {
        await triggerHaptic('heavy');
        toast.error(t('masterPin.pinMismatch', 'PINs do not match'));
        setConfirmPin('');
        setStep(hasMasterPin ? 'new_pin' : 'enter');
        setPin('');
        inputRefs.current[0]?.focus();
      }
    }
  };

  const handleRemoveMasterPin = async () => {
    setIsLoading(true);
    await removeMasterPin();
    await triggerHaptic('heavy');
    toast.success(t('masterPin.pinRemoved', 'Master PIN removed'));
    setShowRemoveDialog(false);
    onPinChanged?.();
    onClose();
    setIsLoading(false);
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    await setMasterPinBiometric(enabled);
    setBiometricEnabled(enabled);
    toast.success(enabled 
      ? t('masterPin.biometricEnabled', 'Biometric unlock enabled for Master PIN')
      : t('masterPin.biometricDisabled', 'Biometric unlock disabled for Master PIN')
    );
  };

  const getTitle = () => {
    switch (step) {
      case 'verify_old':
        return t('masterPin.enterCurrentPin', 'Enter Current Master PIN');
      case 'enter':
        return t('masterPin.setPin', 'Set Master PIN');
      case 'confirm':
        return t('masterPin.confirmPin', 'Confirm Master PIN');
      case 'new_pin':
        return t('masterPin.enterNewPin', 'Enter New Master PIN');
      case 'confirm_new':
        return t('masterPin.confirmNewPin', 'Confirm New Master PIN');
      default:
        return t('masterPin.setPin', 'Set Master PIN');
    }
  };

  const getSubtitle = () => {
    switch (step) {
      case 'verify_old':
        return t('masterPin.verifyToChange', 'Enter your current Master PIN to make changes');
      case 'enter':
      case 'new_pin':
        return t('masterPin.enter4Digits', 'Set a 4-digit Master PIN that can unlock all locked notes');
      case 'confirm':
      case 'confirm_new':
        return t('masterPin.reenterPin', 'Re-enter the Master PIN to confirm');
      default:
        return '';
    }
  };

  const currentPinValue = getCurrentPin();

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {getTitle()}
            </SheetTitle>
            <p className="text-sm text-muted-foreground mt-2">
              {getSubtitle()}
            </p>
          </SheetHeader>

          <div className="space-y-6">
            {/* Info banner for new setup */}
            {!hasMasterPin && step === 'enter' && (
              <div className="bg-primary/10 rounded-lg p-4 text-sm">
                <p className="text-primary font-medium mb-1">
                  {t('masterPin.whatIsMasterPin', 'What is a Master PIN?')}
                </p>
                <p className="text-muted-foreground">
                  {t('masterPin.masterPinDesc', 'A Master PIN can unlock any locked note. Use it as a backup if you forget individual note PINs.')}
                </p>
              </div>
            )}

            {/* PIN Input */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={`${step}-${index}`}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={currentPinValue[index] || ''}
                  onChange={(e) => handlePinInput(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={cn(
                    "w-14 h-14 text-center text-2xl font-bold rounded-xl border-2",
                    "bg-background focus:outline-none focus:ring-2 focus:ring-primary",
                    "transition-all duration-200",
                    currentPinValue[index] ? "border-primary" : "border-muted"
                  )}
                  disabled={isLoading}
                />
              ))}
            </div>

            {/* Step indicator */}
            <div className="flex justify-center gap-2">
              {(hasMasterPin ? ['verify_old', 'new_pin', 'confirm_new'] : ['enter', 'confirm']).map((s) => (
                <div
                  key={s}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    step === s ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Biometric Toggle */}
            {hasMasterPin && biometricAvailable && step === 'verify_old' && (
              <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Fingerprint className="h-5 w-5 text-primary" />
                  <div>
                    <Label className="text-sm font-medium">{t('masterPin.biometricUnlock', 'Biometric Unlock')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('masterPin.biometricDesc', 'Use fingerprint or Face ID with Master PIN')}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={biometricEnabled}
                  onCheckedChange={handleBiometricToggle}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-4">
              {hasMasterPin && step === 'verify_old' && (
                <Button
                  variant="destructive"
                  onClick={() => setShowRemoveDialog(true)}
                  className="w-full"
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('masterPin.removePin', 'Remove Master PIN')}
                </Button>
              )}

              <Button 
                variant="ghost" 
                onClick={onClose} 
                className="w-full text-muted-foreground"
                disabled={isLoading}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirm Remove Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('masterPin.confirmRemoveTitle', 'Remove Master PIN?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('masterPin.confirmRemoveDesc', 'You will no longer be able to use a single PIN to unlock all locked notes. Individual note PINs will still work.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMasterPin}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('masterPin.yesRemove', 'Yes, Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};