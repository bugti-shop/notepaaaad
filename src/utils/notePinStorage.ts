// PIN lock storage for individual notes
// Uses SHA-256 hashing similar to app lock
// Supports biometric authentication per note
// Supports master PIN for all locked notes

import { getSetting, setSetting, removeSetting } from './settingsStorage';

// Storage keys
const getNotePinKey = (noteId: string) => `npd_note_pin_${noteId}`;
const getNoteBiometricKey = (noteId: string) => `npd_note_biometric_${noteId}`;
const MASTER_PIN_KEY = 'npd_master_note_pin';
const MASTER_PIN_BIOMETRIC_KEY = 'npd_master_note_biometric';
const MASTER_PIN_ENABLED_KEY = 'npd_master_note_pin_enabled';

// Interface for note PIN settings
export interface NotePinSettings {
  pinHash: string | null;
  biometricEnabled: boolean;
}

// Interface for master PIN settings
export interface MasterPinSettings {
  enabled: boolean;
  pinHash: string | null;
  biometricEnabled: boolean;
}

// Hash PIN using SHA-256
export const hashNotePin = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'npd-note-pin-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Verify PIN against stored hash
export const verifyNotePin = async (pin: string, storedHash: string): Promise<boolean> => {
  const inputHash = await hashNotePin(pin);
  return inputHash === storedHash;
};

// Check if a note has PIN protection
export const hasNotePin = async (noteId: string): Promise<boolean> => {
  const pinHash = await getSetting<string | null>(getNotePinKey(noteId), null);
  return !!pinHash;
};

// Get the stored PIN hash for a note
export const getNotePinHash = async (noteId: string): Promise<string | null> => {
  return getSetting<string | null>(getNotePinKey(noteId), null);
};

// Get full note PIN settings including biometric
export const getNotePinSettings = async (noteId: string): Promise<NotePinSettings> => {
  const [pinHash, biometricEnabled] = await Promise.all([
    getSetting<string | null>(getNotePinKey(noteId), null),
    getSetting<boolean>(getNoteBiometricKey(noteId), false),
  ]);
  return { pinHash, biometricEnabled };
};

// Set PIN for a note
export const setNotePin = async (noteId: string, pin: string): Promise<void> => {
  const pinHash = await hashNotePin(pin);
  await setSetting(getNotePinKey(noteId), pinHash);
};

// Enable/disable biometric for a note
export const setNoteBiometric = async (noteId: string, enabled: boolean): Promise<void> => {
  await setSetting(getNoteBiometricKey(noteId), enabled);
};

// Remove PIN from a note (also removes biometric)
export const removeNotePin = async (noteId: string): Promise<void> => {
  await Promise.all([
    removeSetting(getNotePinKey(noteId)),
    removeSetting(getNoteBiometricKey(noteId)),
  ]);
};

// Verify PIN for a specific note
export const verifyNotePinForNote = async (noteId: string, pin: string): Promise<boolean> => {
  const storedHash = await getNotePinHash(noteId);
  if (!storedHash) return false;
  return verifyNotePin(pin, storedHash);
};

// Change PIN for a note (requires old PIN verification)
export const changeNotePin = async (
  noteId: string, 
  oldPin: string, 
  newPin: string
): Promise<boolean> => {
  const isValid = await verifyNotePinForNote(noteId, oldPin);
  if (!isValid) return false;
  
  await setNotePin(noteId, newPin);
  return true;
};

// Get all note IDs that have the same PIN hash
export const getNotesWithSamePin = async (
  noteIds: string[], 
  pinHash: string
): Promise<string[]> => {
  const matches: string[] = [];
  for (const noteId of noteIds) {
    const storedHash = await getNotePinHash(noteId);
    if (storedHash === pinHash) {
      matches.push(noteId);
    }
  }
  return matches;
};

// ==================== MASTER PIN FUNCTIONS ====================

// Get master PIN settings
export const getMasterPinSettings = async (): Promise<MasterPinSettings> => {
  const [enabled, pinHash, biometricEnabled] = await Promise.all([
    getSetting<boolean>(MASTER_PIN_ENABLED_KEY, false),
    getSetting<string | null>(MASTER_PIN_KEY, null),
    getSetting<boolean>(MASTER_PIN_BIOMETRIC_KEY, false),
  ]);
  return { enabled, pinHash, biometricEnabled };
};

// Check if master PIN is enabled
export const isMasterPinEnabled = async (): Promise<boolean> => {
  return getSetting<boolean>(MASTER_PIN_ENABLED_KEY, false);
};

// Get master PIN hash
export const getMasterPinHash = async (): Promise<string | null> => {
  return getSetting<string | null>(MASTER_PIN_KEY, null);
};

// Set master PIN
export const setMasterPin = async (pin: string): Promise<void> => {
  const pinHash = await hashNotePin(pin);
  await Promise.all([
    setSetting(MASTER_PIN_KEY, pinHash),
    setSetting(MASTER_PIN_ENABLED_KEY, true),
  ]);
};

// Enable/disable master PIN biometric
export const setMasterPinBiometric = async (enabled: boolean): Promise<void> => {
  await setSetting(MASTER_PIN_BIOMETRIC_KEY, enabled);
};

// Remove master PIN
export const removeMasterPin = async (): Promise<void> => {
  await Promise.all([
    removeSetting(MASTER_PIN_KEY),
    removeSetting(MASTER_PIN_BIOMETRIC_KEY),
    setSetting(MASTER_PIN_ENABLED_KEY, false),
  ]);
};

// Verify master PIN
export const verifyMasterPin = async (pin: string): Promise<boolean> => {
  const storedHash = await getMasterPinHash();
  if (!storedHash) return false;
  return verifyNotePin(pin, storedHash);
};

// Check if a PIN can unlock a note (either note's own PIN or master PIN)
export const canUnlockNote = async (noteId: string, pin: string): Promise<boolean> => {
  // First check if it's the note's own PIN
  const noteValid = await verifyNotePinForNote(noteId, pin);
  if (noteValid) return true;
  
  // Then check if master PIN is enabled and matches
  const masterEnabled = await isMasterPinEnabled();
  if (masterEnabled) {
    return verifyMasterPin(pin);
  }
  
  return false;
};
