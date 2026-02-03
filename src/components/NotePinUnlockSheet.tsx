import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Lock, X } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { triggerHaptic } from '@/utils/haptics';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { verifyNotePinForNote } from '@/utils/notePinStorage';

interface NotePinUnlockSheetProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  noteTitle?: string;
  onUnlocked: () => void;
}

export const NotePinUnlockSheet = ({
  isOpen,
  onClose,
  noteId,
  noteTitle,
  onUnlocked,
}: NotePinUnlockSheetProps) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setAttempts(0);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen, noteId]);

  const handlePinInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPin = pin.split('');
    newPin[index] = value.slice(-1);
    const updatedPin = newPin.join('').slice(0, 4);
    setPin(updatedPin);

    // Auto-advance to next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when 4 digits entered
    if (updatedPin.length === 4) {
      setTimeout(() => handleVerify(updatedPin), 150);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (enteredPin: string) => {
    setIsVerifying(true);
    await triggerHaptic('light');
    
    const isValid = await verifyNotePinForNote(noteId, enteredPin);
    
    if (isValid) {
      await triggerHaptic('heavy');
      toast.success(t('notePin.unlocked', 'Note unlocked'));
      onUnlocked();
      onClose();
    } else {
      await triggerHaptic('heavy');
      setShake(true);
      setAttempts(prev => prev + 1);
      
      setTimeout(() => {
        setShake(false);
        setPin('');
        inputRefs.current[0]?.focus();
      }, 500);
      
      if (attempts >= 2) {
        toast.error(t('notePin.tooManyAttempts', 'Too many failed attempts'));
      } else {
        toast.error(t('notePin.incorrectPin', 'Incorrect PIN'));
      }
    }
    
    setIsVerifying(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {t('notePin.unlockNote', 'Unlock Note')}
          </SheetTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {noteTitle 
              ? t('notePin.enterPinFor', 'Enter PIN to access "{{title}}"', { title: noteTitle })
              : t('notePin.enterPinToAccess', 'Enter PIN to access this note')
            }
          </p>
        </SheetHeader>

        <div className="space-y-6">
          {/* PIN Input */}
          <div 
            className={cn(
              "flex justify-center gap-3 transition-transform",
              shake && "animate-shake"
            )}
          >
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={pin[index] || ''}
                onChange={(e) => handlePinInput(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={cn(
                  "w-14 h-14 text-center text-2xl font-bold rounded-xl border-2",
                  "bg-background focus:outline-none focus:ring-2 focus:ring-primary",
                  "transition-all duration-200",
                  pin[index] ? "border-primary" : "border-muted",
                  shake && "border-destructive"
                )}
                disabled={isVerifying}
              />
            ))}
          </div>

          {/* Attempts indicator */}
          {attempts > 0 && (
            <p className="text-center text-sm text-destructive">
              {t('notePin.attemptsRemaining', '{{count}} attempts remaining', { count: Math.max(0, 5 - attempts) })}
            </p>
          )}

          {/* Actions */}
          <div className="pt-4">
            <Button 
              variant="ghost" 
              onClick={onClose} 
              className="w-full text-muted-foreground"
              disabled={isVerifying}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
