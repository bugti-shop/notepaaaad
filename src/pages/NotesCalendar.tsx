import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NotesCalendarView } from '@/components/NotesCalendarView';
import { Plus, StickyNote, FileText, FileEdit, Pen, Filter, FileCode, Sun, Moon, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NoteEditor } from '@/components/NoteEditor';
import { Note, Folder, NoteType } from '@/types/note';
import { BottomNavigation } from '@/components/BottomNavigation';
import { format, isSameDay } from 'date-fns';
import { NoteCard } from '@/components/NoteCard';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import appLogo from '@/assets/app-logo.png';
import { useDarkMode } from '@/hooks/useDarkMode';
import { saveNoteToDBSingle, deleteNoteFromDB } from '@/utils/noteStorage';
import { useNotes } from '@/contexts/NotesContext';

const NotesCalendar = () => {
  const { t } = useTranslation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  // Use global notes context
  const { notes, setNotes } = useNotes();
  
  const [selectedDateNotes, setSelectedDateNotes] = useState<Note[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [defaultType, setDefaultType] = useState<NoteType>('regular');
  const [selectedNoteTypes, setSelectedNoteTypes] = useState<NoteType[]>([
    'sticky', 'lined', 'regular', 'sketch', 'code', 'voice'
  ]);
  const [folders, setFolders] = useState<Folder[]>([]);
  
  useEffect(() => {
    const loadFolders = async () => {
      const { getSetting } = await import('@/utils/settingsStorage');
      const saved = await getSetting<Folder[]>('folders', []);
      setFolders(saved);
    };
    loadFolders();
  }, []);

  // Filter notes for selected date
  useEffect(() => {
    if (date) {
      const notesForDate = notes.filter(note =>
        isSameDay(new Date(note.createdAt), date) &&
        selectedNoteTypes.includes(note.type)
      );
      setSelectedDateNotes(notesForDate);
    } else {
      setSelectedDateNotes([]);
    }
  }, [date, notes, selectedNoteTypes]);

  const handleSaveNote = async (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingNote) {
      const updatedNote: Note = {
        ...editingNote,
        ...noteData,
        createdAt: editingNote.createdAt,
        updatedAt: new Date(),
      };
      const updatedNotes = notes.map(n => n.id === editingNote.id ? updatedNote : n);
      setNotes(updatedNotes);
      await saveNoteToDBSingle(updatedNote);
    } else {
      const newNote: Note = {
        ...noteData,
        id: Date.now().toString(),
        title: noteData.title || `Note - ${format(date || new Date(), 'MMM dd, yyyy')}`,
        createdAt: date || new Date(),
        updatedAt: date || new Date(),
      };
      const updatedNotes = [...notes, newNote];
      setNotes(updatedNotes);
      await saveNoteToDBSingle(newNote);
    }
    setIsEditorOpen(false);
    setEditingNote(null);
    window.dispatchEvent(new Event('notesUpdated'));
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const handleCreateNote = (type: NoteType) => {
    setDefaultType(type);
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const toggleNoteType = (type: NoteType) => {
    setSelectedNoteTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const NOTE_TYPE_LABELS: Record<NoteType, { label: string; icon: any }> = {
    sticky: { label: t('notesMenu.sticky'), icon: StickyNote },
    lined: { label: t('notesMenu.lined'), icon: FileText },
    regular: { label: t('notesMenu.regular'), icon: FileEdit },
    sketch: { label: t('notesMenu.sketch'), icon: Pen },
    code: { label: t('notesMenu.code'), icon: FileCode },
    voice: { label: t('notes.noteTypes.voice', 'Voice Note'), icon: Mic },
  };

  const handleDeleteNote = async (noteId: string) => {
    const updatedNotes = notes.filter(n => n.id !== noteId);
    setNotes(updatedNotes);
    await deleteNoteFromDB(noteId);
    window.dispatchEvent(new Event('notesUpdated'));
  };

  return (
    <div className="min-h-screen min-h-screen-dynamic bg-background pb-16 sm:pb-20">
      {/* Minimal Header */}
      <header className="sticky top-0 bg-background z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <img src={appLogo} alt="Npd" className="h-7 w-7 flex-shrink-0" />
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleDarkMode}
              className="h-8 w-8"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Filter className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 z-50 bg-card">
                <DropdownMenuLabel>{t('notesMenu.filterByType')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(NOTE_TYPE_LABELS) as NoteType[]).map((type) => {
                  const { label, icon: Icon } = NOTE_TYPE_LABELS[type];
                  return (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={selectedNoteTypes.includes(type)}
                      onCheckedChange={() => toggleNoteType(type)}
                      className="gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Full-Page Calendar */}
      <main className="pb-32">
        <NotesCalendarView
          selectedDate={date}
          onDateSelect={setDate}
        />

        {/* Notes for Selected Date */}
        {selectedDateNotes.length > 0 && (
          <div className="px-4 space-y-3 animate-fade-in mt-4">
            <h2 className="text-lg font-semibold text-foreground">
              {t('notesMenu.notesForDate', { date: format(date || new Date(), 'MMMM dd, yyyy') })}
            </h2>
            {selectedDateNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={handleEditNote}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        )}
      </main>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="fixed left-4 right-4 z-30 h-12 text-base font-semibold"
            style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
            size="lg"
            disabled={!date}
          >
            <Plus className="h-5 w-5" />
            {t('notesMenu.addNote')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="mb-2 w-48 z-50 bg-card">
          <DropdownMenuItem onClick={() => handleCreateNote('sticky')} className="gap-2">
            <StickyNote className="h-4 w-4" />
            {t('notesMenu.stickyNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('lined')} className="gap-2">
            <FileText className="h-4 w-4" />
            {t('notesMenu.linedNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('regular')} className="gap-2">
            <FileEdit className="h-4 w-4" />
            {t('notesMenu.regularNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('sketch')} className="gap-2">
            <Pen className="h-4 w-4" />
            {t('notesMenu.sketchNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('code')} className="gap-2">
            <FileCode className="h-4 w-4" />
            {t('notesMenu.codeNotes')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NoteEditor
        note={editingNote}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveNote}
        defaultType={defaultType}
        returnTo="/calendar"
      />

      <BottomNavigation />
    </div>
  );
};

export default NotesCalendar;
