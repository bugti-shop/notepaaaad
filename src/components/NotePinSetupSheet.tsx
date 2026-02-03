import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Lock, Trash2, Check, X } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { triggerHaptic } from '@/utils/haptics';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  hasNotePin,
  setNotePin,
  removeNotePin,
  verifyNotePinForNote,
} from '@/utils/notePinStorage';

interface NotePinSetupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  onPinChanged?: () => void;
}

type SetupStep = 'enter' | 'confirm' | 'verify_old' | 'new_pin' | 'confirm_new';

export const NotePinSetupSheet = ({
  isOpen,
  onClose,
  noteId,
  onPinChanged,
}: NotePinSetupSheetProps) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [hasPinProtection, setHasPinProtection] = useState(false);
  const [step, setStep] = useState<SetupStep>('enter');
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      hasNotePin(noteId).then((hasPin) => {
        setHasPinProtection(hasPin);
        setStep(hasPin ? 'verify_old' : 'enter');
      });
      setPin('');
      setConfirmPin('');
      setOldPin('');
    }
  }, [isOpen, noteId]);

  // Focus first empty input when step changes
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

    // Auto-advance to next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when 4 digits entered
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
      // Verify old PIN before allowing change
      setIsLoading(true);
      const isValid = await verifyNotePinForNote(noteId, completedPin);
      setIsLoading(false);
      
      if (isValid) {
        setStep('new_pin');
        setPin('');
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } else {
        await triggerHaptic('heavy');
        toast.error(t('notePin.incorrectPin', 'Incorrect PIN'));
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
        await setNotePin(noteId, pin);
        setIsLoading(false);
        await triggerHaptic('heavy');
        toast.success(t('notePin.pinSet', 'PIN set successfully'));
        onPinChanged?.();
        onClose();
      } else {
        await triggerHaptic('heavy');
        toast.error(t('notePin.pinMismatch', 'PINs do not match'));
        setConfirmPin('');
        setStep(hasPinProtection ? 'new_pin' : 'enter');
        setPin('');
        inputRefs.current[0]?.focus();
      }
    }
  };

  const handleRemovePin = async () => {
    if (!hasPinProtection) return;
    
    // Need to verify old PIN first
    if (step !== 'verify_old' || oldPin.length !== 4) {
      setStep('verify_old');
      setOldPin('');
      toast.info(t('notePin.enterCurrentPin', 'Enter current PIN to remove'));
      return;
    }

    setIsLoading(true);
    const isValid = await verifyNotePinForNote(noteId, oldPin);
    
    if (isValid) {
      await removeNotePin(noteId);
      await triggerHaptic('heavy');
      toast.success(t('notePin.pinRemoved', 'PIN removed'));
      onPinChanged?.();
      onClose();
    } else {
      await triggerHaptic('heavy');
      toast.error(t('notePin.incorrectPin', 'Incorrect PIN'));
      setOldPin('');
      inputRefs.current[0]?.focus();
    }
    setIsLoading(false);
  };

  const getTitle = () => {
    switch (step) {
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
      case 'verify_old':
        return t('notePin.verifyToChange', 'Enter your current PIN to make changes');
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

  const currentPinValue = getCurrentPin();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {getTitle()}
          </SheetTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {getSubtitle()}
          </p>
        </SheetHeader>

        <div className="space-y-6">
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
            {(hasPinProtection ? ['verify_old', 'new_pin', 'confirm_new'] : ['enter', 'confirm']).map((s, i) => (
              <div
                key={s}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  step === s ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4">
            {hasPinProtection && step === 'verify_old' && (
              <Button
                variant="destructive"
                onClick={handleRemovePin}
                className="w-full"
                disabled={isLoading || oldPin.length !== 4}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('notePin.removePin', 'Remove PIN')}
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
  );
};
