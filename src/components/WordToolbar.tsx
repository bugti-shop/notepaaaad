import { useCallback, useRef, useState, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Subscript,
  Superscript,
  RemoveFormatting,
  Code,
  Minus,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  List,
  ListOrdered,
  Highlighter,
  Undo,
  Redo,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Table,
  Paperclip,
  Heading1,
  Link2,
  ZoomIn,
  ZoomOut,
  PilcrowLeft,
  PilcrowRight,
  Plus,
  Mic,
  CheckSquare,
  ChevronDown,
  Indent,
  Outdent,
} from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface WordToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onStrikethrough?: () => void;
  onSubscript?: () => void;
  onSuperscript?: () => void;
  onClearFormatting?: () => void;
  onCodeBlock?: () => void;
  onHorizontalRule?: () => void;
  onBlockquote?: () => void;
  onTextColor: (color: string) => void;
  onHighlight: (color: string) => void;
  onBulletList: () => void;
  onNumberedList: () => void;
  onImageUpload: () => void;
  onTableInsert: (rows: number, cols: number, style?: string) => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onAlignJustify: () => void;
  onTextCase: (caseType: 'upper' | 'lower' | 'capitalize') => void;
  onFontFamily?: (font: string) => void;
  onFontSize?: (size: string) => void;
  onGlobalFontSizeChange?: (size: string) => void;
  onHeading: (level: 1 | 2 | 3 | 'p') => void;
  currentFontFamily?: string;
  currentFontSize?: string;
  onInsertLink?: () => void;
  onInsertNoteLink?: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  isStickyNote?: boolean;
  allowImages?: boolean;
  showTable?: boolean;
  onComment?: () => void;
  onTextDirection?: (dir: 'ltr' | 'rtl') => void;
  textDirection?: 'ltr' | 'rtl';
  onAttachment?: () => void;
  onVoiceRecord?: () => void;
  onEmojiInsert?: (emoji: string) => void;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  isSubscript?: boolean;
  isSuperscript?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  isBulletList?: boolean;
  isNumberedList?: boolean;
  onIndent?: () => void;
  onOutdent?: () => void;
  onChecklist?: () => void;
  isChecklist?: boolean;
}

// Toolbar order types
type ToolbarItemId = 
  | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'subscript' | 'superscript' 
  | 'clearFormatting' | 'codeBlock' | 'horizontalRule' | 'blockquote' | 'emoji'
  | 'bulletList' | 'numberedList' | 'image' | 'table' | 'highlight' | 'textColor'
  | 'undo' | 'redo' | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
  | 'fontFamily' | 'fontSize' | 'headings' | 'textCase' | 'ltr' | 'rtl'
  | 'comment' | 'link' | 'noteLink' | 'attachment' | 'zoom';

const DEFAULT_TOOLBAR_ORDER: ToolbarItemId[] = [
  'bold', 'italic', 'underline', 'fontFamily', 'fontSize', 'strikethrough', 'subscript', 'superscript',
  'clearFormatting', 'codeBlock', 'horizontalRule', 'blockquote', 'emoji',
  'bulletList', 'numberedList', 'image', 'table', 'highlight', 'textColor',
  'undo', 'redo', 'alignLeft', 'alignCenter', 'alignRight', 'alignJustify',
  'headings', 'textCase', 'ltr', 'rtl',
  'comment', 'link', 'noteLink', 'attachment', 'zoom'
];

let cachedToolbarOrder: ToolbarItemId[] = [...DEFAULT_TOOLBAR_ORDER];

export const setCachedToolbarOrder = (order: ToolbarItemId[]) => {
  cachedToolbarOrder = order;
};

// Compact color palette
const TEXT_COLORS = [
  '#000000', '#374151', '#6B7280', '#9CA3AF',
  '#DC2626', '#EA580C', '#CA8A04', '#16A34A',
  '#0EA5E9', '#3B82F6', '#8B5CF6', '#EC4899',
];

const HIGHLIGHT_COLORS = [
  'transparent',
  '#FEF08A', '#FED7AA', '#FECACA', '#FBCFE8',
  '#E9D5FF', '#BFDBFE', '#BBF7D0', '#CFFAFE',
];

const FONT_FAMILIES = [
  { name: 'Default', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Times', value: '"Times New Roman", serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Courier', value: '"Courier New", monospace' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
];

const FONT_SIZES = ['10', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48'];

export const WordToolbar = ({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onBold,
  onItalic,
  onUnderline,
  onStrikethrough,
  onSubscript,
  onSuperscript,
  onClearFormatting,
  onCodeBlock,
  onHorizontalRule,
  onBlockquote,
  onTextColor,
  onHighlight,
  onBulletList,
  onNumberedList,
  onImageUpload,
  onTableInsert,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onAlignJustify,
  onTextCase,
  onFontFamily,
  onFontSize,
  onHeading,
  currentFontFamily,
  currentFontSize = '16',
  onInsertLink,
  onInsertNoteLink,
  zoom,
  onZoomChange,
  isStickyNote = false,
  allowImages = true,
  showTable = true,
  onComment,
  onTextDirection,
  textDirection = 'ltr',
  onAttachment,
  onVoiceRecord,
  onEmojiInsert,
  isBold = false,
  isItalic = false,
  isUnderline = false,
  isStrikethrough = false,
  isSubscript = false,
  isSuperscript = false,
  alignment = 'left',
  isBulletList = false,
  isNumberedList = false,
  onIndent,
  onOutdent,
  onChecklist,
  isChecklist = false,
}: WordToolbarProps) => {
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const [fontFamilyOpen, setFontFamilyOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableOpen, setTableOpen] = useState(false);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [selectedTextColor, setSelectedTextColor] = useState('#000000');
  const [selectedHighlight, setSelectedHighlight] = useState('transparent');

  // Minimal icon button - Zoho style
  const IconBtn = ({ 
    onClick, 
    disabled, 
    title, 
    active = false,
    children,
  }: { 
    onClick?: () => void; 
    disabled?: boolean; 
    title: string; 
    active?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-11 w-11 flex items-center justify-center rounded transition-colors flex-shrink-0",
        "hover:bg-muted/80 active:bg-muted",
        active && "bg-primary/10 text-primary",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      {children}
    </button>
  );

  // Thin separator
  const Sep = () => <div className="w-px h-7 bg-border/50 mx-0.5 flex-shrink-0" />;

  return (
    <div className={cn(
      "border-t border-border/40",
      isStickyNote ? "bg-background" : "bg-muted/20"
    )}>
      <div className="flex items-center gap-0 px-1 overflow-x-auto scrollbar-hide h-12">
        
        {/* Undo / Redo */}
        <IconBtn onClick={onUndo} disabled={!canUndo} title="Undo">
          <Undo className="h-5 w-5" strokeWidth={2} />
        </IconBtn>
        <IconBtn onClick={onRedo} disabled={!canRedo} title="Redo">
          <Redo className="h-5 w-5" strokeWidth={2} />
        </IconBtn>

        <Sep />

        {/* Font Size - Clean indicator like "16px" */}
        {onFontSize && (
          <Popover open={fontSizeOpen} onOpenChange={setFontSizeOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Font Size"
                className="h-11 px-2.5 flex items-center gap-0.5 rounded hover:bg-muted/80 transition-colors flex-shrink-0 text-sm font-semibold"
              >
                {currentFontSize}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" strokeWidth={2} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-20 p-1" align="start">
              <div className="max-h-48 overflow-y-auto">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => { onFontSize(size); setFontSizeOpen(false); }}
                    className={cn(
                      "w-full px-2 py-1.5 text-sm text-left rounded hover:bg-muted transition-colors",
                      currentFontSize === size && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Font Family */}
        {onFontFamily && (
          <Popover open={fontFamilyOpen} onOpenChange={setFontFamilyOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Font"
                className="h-11 w-11 flex items-center justify-center rounded hover:bg-muted/80 transition-colors flex-shrink-0"
              >
                <Type className="h-5 w-5" strokeWidth={2} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="start">
              {FONT_FAMILIES.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  onClick={() => { onFontFamily(font.value); setFontFamilyOpen(false); }}
                  style={{ fontFamily: font.value }}
                  className={cn(
                    "w-full px-2 py-1.5 text-sm text-left rounded hover:bg-muted transition-colors",
                    currentFontFamily === font.value && "bg-primary/10 text-primary"
                  )}
                >
                  {font.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}

        <Sep />

        {/* Text Formatting: B I U S */}
        <IconBtn onClick={onBold} title="Bold" active={isBold}>
          <Bold className="h-5 w-5" strokeWidth={isBold ? 2.5 : 2} />
        </IconBtn>
        <IconBtn onClick={onItalic} title="Italic" active={isItalic}>
          <Italic className="h-5 w-5" strokeWidth={isItalic ? 2.5 : 2} />
        </IconBtn>
        <IconBtn onClick={onUnderline} title="Underline" active={isUnderline}>
          <UnderlineIcon className="h-5 w-5" strokeWidth={isUnderline ? 2.5 : 2} />
        </IconBtn>
        {onStrikethrough && (
          <IconBtn onClick={onStrikethrough} title="Strikethrough" active={isStrikethrough}>
            <Strikethrough className="h-5 w-5" strokeWidth={isStrikethrough ? 2.5 : 2} />
          </IconBtn>
        )}

        <Sep />

        {/* Text Color */}
        <Popover open={textColorOpen} onOpenChange={setTextColorOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Text Color"
              className="h-11 w-11 flex flex-col items-center justify-center gap-0.5 rounded hover:bg-muted/80 transition-colors flex-shrink-0"
            >
              <span className="text-base font-semibold leading-none">A</span>
              <div className="h-1.5 w-5 rounded-full" style={{ backgroundColor: selectedTextColor }} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-6 gap-1">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => { onTextColor(color); setSelectedTextColor(color); setTextColorOpen(false); }}
                  className={cn(
                    "h-6 w-6 rounded border border-border/50 hover:scale-110 transition-transform",
                    selectedTextColor === color && "ring-2 ring-primary ring-offset-1"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight */}
        <Popover open={highlightOpen} onOpenChange={setHighlightOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Highlight"
              className="h-11 w-11 flex items-center justify-center rounded hover:bg-muted/80 transition-colors flex-shrink-0"
            >
              <Highlighter className="h-5 w-5" strokeWidth={2} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-5 gap-1">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => { onHighlight(color); setSelectedHighlight(color); setHighlightOpen(false); }}
                  className={cn(
                    "h-6 w-6 rounded border border-border/50 hover:scale-110 transition-transform",
                    color === 'transparent' && "bg-[repeating-linear-gradient(45deg,#ccc,#ccc_2px,#fff_2px,#fff_4px)]",
                    selectedHighlight === color && "ring-2 ring-primary ring-offset-1"
                  )}
                  style={{ backgroundColor: color === 'transparent' ? undefined : color }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Sep />

        {/* Lists */}
        <IconBtn onClick={onBulletList} title="Bullet List" active={isBulletList}>
          <List className="h-5 w-5" strokeWidth={2} />
        </IconBtn>
        <IconBtn onClick={onNumberedList} title="Numbered List" active={isNumberedList}>
          <ListOrdered className="h-5 w-5" strokeWidth={2} />
        </IconBtn>
        {onChecklist && (
          <IconBtn onClick={onChecklist} title="Checklist" active={isChecklist}>
            <CheckSquare className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        )}

        <Sep />

        {/* Alignment - Compact dropdown */}
        <Popover open={alignOpen} onOpenChange={setAlignOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Alignment"
              className="h-11 w-11 flex items-center justify-center rounded hover:bg-muted/80 transition-colors flex-shrink-0"
            >
              {alignment === 'left' && <AlignLeft className="h-5 w-5" strokeWidth={2} />}
              {alignment === 'center' && <AlignCenter className="h-5 w-5" strokeWidth={2} />}
              {alignment === 'right' && <AlignRight className="h-5 w-5" strokeWidth={2} />}
              {alignment === 'justify' && <AlignJustify className="h-5 w-5" strokeWidth={2} />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1" align="start">
            <div className="flex gap-0.5">
              <IconBtn onClick={() => { onAlignLeft(); setAlignOpen(false); }} title="Left" active={alignment === 'left'}>
                <AlignLeft className="h-5 w-5" strokeWidth={2} />
              </IconBtn>
              <IconBtn onClick={() => { onAlignCenter(); setAlignOpen(false); }} title="Center" active={alignment === 'center'}>
                <AlignCenter className="h-5 w-5" strokeWidth={2} />
              </IconBtn>
              <IconBtn onClick={() => { onAlignRight(); setAlignOpen(false); }} title="Right" active={alignment === 'right'}>
                <AlignRight className="h-5 w-5" strokeWidth={2} />
              </IconBtn>
              <IconBtn onClick={() => { onAlignJustify(); setAlignOpen(false); }} title="Justify" active={alignment === 'justify'}>
                <AlignJustify className="h-5 w-5" strokeWidth={2} />
              </IconBtn>
            </div>
          </PopoverContent>
        </Popover>

        {/* Indent / Outdent */}
        {onOutdent && (
          <IconBtn onClick={onOutdent} title="Decrease Indent">
            <Outdent className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        )}
        {onIndent && (
          <IconBtn onClick={onIndent} title="Increase Indent">
            <Indent className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        )}

        <Sep />

        {/* Table */}
        {showTable && (
          <Popover open={tableOpen} onOpenChange={setTableOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Insert Table"
                className="h-11 w-11 flex items-center justify-center rounded hover:bg-muted/80 transition-colors flex-shrink-0"
              >
                <Table className="h-5 w-5" strokeWidth={2} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3" align="start">
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Insert Table</p>
                <div className="flex items-center justify-between text-sm">
                  <span>Rows</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTableRows(Math.max(1, tableRows - 1))}
                      className="h-6 w-6 flex items-center justify-center rounded border hover:bg-muted"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center font-semibold">{tableRows}</span>
                    <button
                      type="button"
                      onClick={() => setTableRows(Math.min(10, tableRows + 1))}
                      className="h-6 w-6 flex items-center justify-center rounded border hover:bg-muted"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Cols</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTableCols(Math.max(1, tableCols - 1))}
                      className="h-6 w-6 flex items-center justify-center rounded border hover:bg-muted"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center font-semibold">{tableCols}</span>
                    <button
                      type="button"
                      onClick={() => setTableCols(Math.min(8, tableCols + 1))}
                      className="h-6 w-6 flex items-center justify-center rounded border hover:bg-muted"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { onTableInsert(tableRows, tableCols); setTableOpen(false); }}
                  className="w-full h-8 text-sm font-semibold bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  Insert
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Image */}
        {allowImages && (
          <IconBtn onClick={onImageUpload} title="Insert Image">
            <ImageIcon className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        )}

        {/* Horizontal Rule */}
        {onHorizontalRule && (
          <IconBtn onClick={onHorizontalRule} title="Horizontal Line">
            <Minus className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        )}

        <Sep />

        {/* Headings */}
        <Popover open={headingOpen} onOpenChange={setHeadingOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Headings"
              className="h-11 w-11 flex items-center justify-center rounded hover:bg-muted/80 transition-colors flex-shrink-0"
            >
              <Heading1 className="h-5 w-5" strokeWidth={2} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-1" align="start">
            <button
              type="button"
              onClick={() => { onHeading(1); setHeadingOpen(false); }}
              className="w-full px-2 py-1.5 text-left text-lg font-bold rounded hover:bg-muted"
            >
              Heading 1
            </button>
            <button
              type="button"
              onClick={() => { onHeading(2); setHeadingOpen(false); }}
              className="w-full px-2 py-1.5 text-left text-base font-bold rounded hover:bg-muted"
            >
              Heading 2
            </button>
            <button
              type="button"
              onClick={() => { onHeading(3); setHeadingOpen(false); }}
              className="w-full px-2 py-1.5 text-left text-sm font-semibold rounded hover:bg-muted"
            >
              Heading 3
            </button>
            <button
              type="button"
              onClick={() => { onHeading('p'); setHeadingOpen(false); }}
              className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-muted"
            >
              Normal
            </button>
          </PopoverContent>
        </Popover>

        {/* Subscript / Superscript */}
        {onSubscript && (
          <IconBtn onClick={onSubscript} title="Subscript" active={isSubscript}>
            <Subscript className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        )}
        {onSuperscript && (
          <IconBtn onClick={onSuperscript} title="Superscript" active={isSuperscript}>
            <Superscript className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        )}

        {/* Clear Formatting */}
        {onClearFormatting && (
          <IconBtn onClick={onClearFormatting} title="Clear Formatting">
            <RemoveFormatting className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        )}

        <Sep />

        {/* Link */}
        {onInsertLink && (
          <IconBtn onClick={onInsertLink} title="Insert Link">
            <LinkIcon className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        )}

        {/* Note Link */}
        {onInsertNoteLink && (
          <IconBtn onClick={onInsertNoteLink} title="Link to Note">
            <Link2 className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        )}

        {/* Attachment */}
        {onAttachment && (
          <IconBtn onClick={onAttachment} title="Attach File">
            <Paperclip className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        )}

        {/* Emoji */}
        {onEmojiInsert && (
          <EmojiPicker onEmojiSelect={onEmojiInsert} />
        )}

        {/* Voice Record */}
        {onVoiceRecord && (
          <IconBtn onClick={onVoiceRecord} title="Voice Recording">
            <Mic className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        )}

        <Sep />

        {/* Text Direction */}
        {onTextDirection && (
          <>
            <IconBtn onClick={() => onTextDirection('ltr')} title="Left to Right" active={textDirection === 'ltr'}>
              <PilcrowLeft className="h-5 w-5" strokeWidth={2} />
            </IconBtn>
            <IconBtn onClick={() => onTextDirection('rtl')} title="Right to Left" active={textDirection === 'rtl'}>
              <PilcrowRight className="h-5 w-5" strokeWidth={2} />
            </IconBtn>
          </>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-0 flex-shrink-0 ml-auto">
          <IconBtn 
            onClick={() => onZoomChange(Math.max(50, zoom - 10))} 
            disabled={zoom <= 50}
            title="Zoom Out"
          >
            <ZoomOut className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
          <span className="text-sm font-semibold w-12 text-center tabular-nums">{zoom}%</span>
          <IconBtn 
            onClick={() => onZoomChange(Math.min(200, zoom + 10))} 
            disabled={zoom >= 200}
            title="Zoom In"
          >
            <ZoomIn className="h-5 w-5" strokeWidth={2} />
          </IconBtn>
        </div>
      </div>
    </div>
  );
};
