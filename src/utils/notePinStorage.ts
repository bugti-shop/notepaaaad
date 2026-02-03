// PIN lock storage for individual notes
// Uses SHA-256 hashing similar to app lock

import { getSetting, setSetting, removeSetting } from './settingsStorage';

// Storage keys
const getNotePinKey = (noteId: string) => `npd_note_pin_${noteId}`;

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

// Set PIN for a note
export const setNotePin = async (noteId: string, pin: string): Promise<void> => {
  const pinHash = await hashNotePin(pin);
  await setSetting(getNotePinKey(noteId), pinHash);
};

// Remove PIN from a note
export const removeNotePin = async (noteId: string): Promise<void> => {
  await removeSetting(getNotePinKey(noteId));
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
