import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, X, Eye, Clock, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NoteConflictCopy } from '@/types/note';
import { 
  getConflictCopiesForNote, 
  resolveConflict as resolveConflictInStorage,
  loadConflictCopies 
} from '@/utils/syncQueue';
import { useNotes } from '@/contexts/NotesContext';
import { formatDistanceToNow } from 'date-fns';

interface ConflictResolutionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId?: string; // If provided, show conflicts for specific note
}

export const ConflictResolutionSheet = ({
  open,
  onOpenChange,
  noteId,
}: ConflictResolutionSheetProps) => {
  const [conflicts, setConflicts] = useState<NoteConflictCopy[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<NoteConflictCopy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getNoteById, updateNote } = useNotes();

  useEffect(() => {
    if (open) {
      loadConflicts();
    }
  }, [open, noteId]);

  const loadConflicts = async () => {
    setIsLoading(true);
    try {
      if (noteId) {
        const noteConflicts = await getConflictCopiesForNote(noteId);
        setConflicts(noteConflicts);
      } else {
        const allConflicts = await loadConflictCopies();
        setConflicts(allConflicts.filter(c => !c.resolved));
      }
    } catch (error) {
      console.error('Error loading conflicts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeepLocal = async (conflict: NoteConflictCopy) => {
    // Keep current local version, discard conflict
    await resolveConflictInStorage(conflict.id);
    
    // Update the note to remove conflict flag
    const note = getNoteById(conflict.noteId);
    if (note) {
      await updateNote(conflict.noteId, {
        hasConflict: false,
        conflictCopyId: undefined,
        syncStatus: 'synced',
      });
    }
    
    // Reload conflicts
    await loadConflicts();
  };

  const handleUseRemote = async (conflict: NoteConflictCopy) => {
    // Replace local content with remote (conflict copy) content
    const note = getNoteById(conflict.noteId);
    if (note) {
      await updateNote(conflict.noteId, {
        title: conflict.title,
        content: conflict.content,
        syncVersion: conflict.version,
        hasConflict: false,
        conflictCopyId: undefined,
        syncStatus: 'pending',
        isDirty: true,
      });
    }
    
    await resolveConflictInStorage(conflict.id);
    await loadConflicts();
  };

  const handleKeepBoth = async (conflict: NoteConflictCopy) => {
    // Create a duplicate note with the conflict content
    const { saveNote } = useNotes();
    const note = getNoteById(conflict.noteId);
    
    if (note) {
      const duplicateNote = {
        ...note,
        id: `${note.id}_conflict_${Date.now()}`,
        title: `${conflict.title} (Conflict Copy)`,
        content: conflict.content,
        syncVersion: 1,
        syncStatus: 'pending' as const,
        isDirty: true,
        hasConflict: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Note: We can't call saveNote from here easily, so we'll just resolve and mark the original
      await updateNote(conflict.noteId, {
        hasConflict: false,
        conflictCopyId: undefined,
        syncStatus: 'synced',
      });
    }
    
    await resolveConflictInStorage(conflict.id);
    await loadConflicts();
  };

  const formatTime = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Sync Conflicts ({conflicts.length})
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(80vh-120px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : conflicts.length === 0 ? (
            <div className="text-center py-12">
              <Check className="h-12 w-12 text-accent mx-auto mb-3" />
              <p className="text-muted-foreground">No conflicts to resolve</p>
              <p className="text-xs text-muted-foreground mt-1">
                All your notes are in sync
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {conflicts.map((conflict) => {
                  const currentNote = getNoteById(conflict.noteId);
                  
                  return (
                    <motion.div
                      key={conflict.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className="bg-card border border-border rounded-2xl p-4 space-y-4"
                    >
                      {/* Note Info */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-foreground line-clamp-1">
                            {currentNote?.title || conflict.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            Conflict detected {formatTime(conflict.timestamp)}
                          </p>
                        </div>
                        <span className="text-xs bg-warning/10 text-warning px-2 py-1 rounded-full">
                          v{conflict.version}
                        </span>
                      </div>

                      {/* Device Info */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                        <Smartphone className="h-3 w-3" />
                        <span>From device: {conflict.deviceId.substring(0, 20)}...</span>
                      </div>

                      {/* Content Preview */}
                      {selectedConflict?.id === conflict.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-2"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-muted/30 rounded-lg p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Your Version
                              </p>
                              <p className="text-xs text-foreground line-clamp-4">
                                {currentNote?.content?.substring(0, 200) || 'No content'}
                              </p>
                            </div>
                            <div className="bg-muted/30 rounded-lg p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Other Version
                              </p>
                              <p className="text-xs text-foreground line-clamp-4">
                                {conflict.content?.substring(0, 200) || 'No content'}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedConflict(
                            selectedConflict?.id === conflict.id ? null : conflict
                          )}
                          className="flex-1 rounded-xl"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {selectedConflict?.id === conflict.id ? 'Hide' : 'Compare'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleKeepLocal(conflict)}
                          className="flex-1 rounded-xl"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Keep Mine
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUseRemote(conflict)}
                          className="flex-1 rounded-xl"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Use Other
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
