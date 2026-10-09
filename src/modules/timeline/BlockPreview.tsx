import { useEffect, useRef, useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { parseFormatting } from '@/lib/textFormatting';
import { FormattedTextField } from '@/components/atoms/FormattedTextField';
import { EditableFieldPencil } from '@/components/atoms/EditableFieldPencil';
import { useIsMobile } from '@/hooks/use-mobile';
import { useClickToEdit } from '@/hooks/useClickToEdit';

interface BlockPreviewProps {
  notes?: string;
  material?: string;
  showFullText?: boolean;
  stackFields?: boolean;
  showEmptyPlaceholders?: boolean;
  onUpdate?: (updates: { notes?: string; material?: string }) => void;
}

const InlineEditableField = ({
  value,
  onChange,
  showFullText,
  multiline = false,
  startFocused = false,
  onEmptyBlur,
  align = 'left',
}: {
  value: string;
  onChange: (v: string) => void;
  showFullText: boolean;
  multiline?: boolean;
  startFocused?: boolean;
  onEmptyBlur?: () => void;
  align?: 'left' | 'right';
}) => {
  const {
    previewRef,
    editing,
    startEditing,
    stopEditing,
    caretPoint,
    initialSelection,
  } = useClickToEdit<HTMLParagraphElement>({ value, initiallyEditing: startFocused });

  if (!editing) {
    return (
      <p
        ref={previewRef}
        className={cn(
          'editable-field cursor-text px-1 -mx-1',
          showFullText ? 'whitespace-pre-wrap break-words' : 'line-clamp-2',
          align === 'right' && 'text-right',
        )}
        onClick={(e) => {
          e.stopPropagation();
          startEditing(e);
        }}
      >
        {/* Pencil cue: before the text when right-aligned, after it when
            left-aligned, so its reserved space always lands in whitespace and
            the text itself never shifts. */}
        {align === 'right' && <EditableFieldPencil className="mr-1" />}
        {parseFormatting(value)}
        {align !== 'right' && <EditableFieldPencil className="ml-1" />}
      </p>
    );
  }

  return (
    <FormattedTextField
      value={value}
      onChange={onChange}
      onBlur={(v) => {
        stopEditing();
        if (!v) onEmptyBlur?.();
      }}
      multiline={multiline}
      autoGrow
      autoFocus
      toolbarSize="xs"
      align={align}
      initialCaretPoint={caretPoint}
      initialSelection={initialSelection}
      className="w-full"
    />
  );
};

// Small hover-intent delay before an empty-fields placeholder reveals itself, so quickly passing
// the mouse over it (on the way to somewhere else) doesn't flash it open.
const HOVER_REVEAL_DELAY_MS = 200;

// Marks where a not-yet-revealed placeholder will appear - a small strip in that spot's corner,
// not a highlight over the whole hoverable area. Shows on any card-level hover; once this specific
// spot has actually been hovered long enough to reveal the real "+ label", the strip is dropped in
// favor of that (the caller only renders this while its own `visible`/`revealed` state is false).
const HoverIndicator = ({ align }: { align: 'left' | 'right' }) => (
  <span
    aria-hidden
    className={cn(
      'absolute top-2 w-6 h-1 rounded-full bg-muted-foreground/20 opacity-0 transition-opacity delay-0 group-hover:opacity-100 group-hover:delay-300',
      align === 'right' ? 'right-1' : 'left-1',
    )}
  />
);

const FieldPlaceholder = ({
  variant,
  align = 'left',
  label,
  onActivate,
}: {
  variant: 'row' | 'compact';
  align?: 'left' | 'right';
  label: string;
  onActivate: () => void;
}) => {
  if (variant === 'compact') {
    return (
      <button
        type="button"
        title={label}
        onClick={(e) => { e.stopPropagation(); onActivate(); }}
        className="w-8 h-5 shrink-0 flex items-center justify-center text-muted-foreground rounded"
      >
        <Plus className="h-3.5 w-3.5 opacity-0 transition-opacity delay-0 group-hover:opacity-100 group-hover:delay-300" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onActivate(); }}
      className={cn(
        'relative h-7 flex-1 flex items-center gap-1',
        align === 'right' ? 'justify-end' : 'justify-start',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1 text-xs text-muted-foreground transition-opacity',
          align === 'right' && 'text-right',
          'opacity-0 delay-0 group-hover:opacity-100 group-hover:delay-300',
        )}
      >
        <Plus className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    </button>
  );
};

// Only used while BOTH fields are empty: unlike FieldPlaceholder above, the reserved row here only
// exists once hovered (height 0 at rest, so an empty block isn't taller than a filled one). This is
// safe from the earlier flicker bug because only the wrapper's HEIGHT grows (extending its bottom
// edge), never its top-margin/position - the absolutely positioned buttons inside stay anchored to
// that unmoving top edge the whole time, so hovering one can never shift it out from under the cursor.
const EmptyFieldsPlaceholders = ({
  notesLabel,
  materialLabel,
  onActivateNotes,
  onActivateMaterial,
}: {
  notesLabel: string;
  materialLabel: string;
  onActivateNotes: () => void;
  onActivateMaterial: () => void;
}) => {
  const [notesRevealed, setNotesRevealed] = useState(false);
  const [materialRevealed, setMaterialRevealed] = useState(false);
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const materialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
    if (materialTimeoutRef.current) clearTimeout(materialTimeoutRef.current);
  }, []);

  const revealAfterDelay = (
    setRevealed: (v: boolean) => void,
    timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  ) => () => {
    timeoutRef.current = setTimeout(() => setRevealed(true), HOVER_REVEAL_DELAY_MS);
  };

  const hideNow = (
    setRevealed: (v: boolean) => void,
    timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  ) => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setRevealed(false);
  };

  // Hovering the block anywhere only reveals a small marker showing where to hover next. Only
  // hovering that marked spot grows the wrapper and reserves real space for the add action.
  const wrapperHeight = notesRevealed || materialRevealed ? 'h-4' : 'h-0';

  return (
    <div className={cn('relative transition-[height] duration-150', wrapperHeight)}>
      <button
        type="button"
        onMouseEnter={revealAfterDelay(setNotesRevealed, notesTimeoutRef)}
        onMouseLeave={hideNow(setNotesRevealed, notesTimeoutRef)}
        onClick={(e) => { e.stopPropagation(); onActivateNotes(); }}
        className="absolute -top-1 left-0 h-7 w-1/2 flex items-center justify-start gap-1"
      >
        {!notesRevealed && <HoverIndicator align="left" />}
        <span className={cn('flex items-center gap-1 text-xs text-muted-foreground transition-opacity', notesRevealed ? 'opacity-100' : 'opacity-0')}>
          <Plus className="h-3 w-3 shrink-0" />
          <span className="truncate">{notesLabel}</span>
        </span>
      </button>
      <button
        type="button"
        onMouseEnter={revealAfterDelay(setMaterialRevealed, materialTimeoutRef)}
        onMouseLeave={hideNow(setMaterialRevealed, materialTimeoutRef)}
        onClick={(e) => { e.stopPropagation(); onActivateMaterial(); }}
        className="absolute -top-1 right-0 h-7 w-1/2 flex items-center justify-end"
      >
        {!materialRevealed && <HoverIndicator align="right" />}
        <span className={cn('flex items-center gap-1 text-xs text-muted-foreground text-right transition-opacity', materialRevealed ? 'opacity-100' : 'opacity-0')}>
          <Plus className="h-3 w-3 shrink-0" />
          <span className="truncate">{materialLabel}</span>
        </span>
      </button>
    </div>
  );
};

export const BlockPreview = ({
  notes,
  material,
  showFullText = false,
  stackFields = false,
  showEmptyPlaceholders = true,
  onUpdate,
}: BlockPreviewProps) => {
  const isMobile = useIsMobile();
  const canEdit = !!onUpdate && !isMobile;
  const { t } = useTranslation('common');
  const [forceEditNotes, setForceEditNotes] = useState(false);
  const [forceEditMaterial, setForceEditMaterial] = useState(false);

  if (!notes && !material && !canEdit) return null;

  const notesActive = !!notes || forceEditNotes;
  const materialActive = !!material || forceEditMaterial;
  const bothActive = notesActive && materialActive;
  const neitherActive = !notesActive && !materialActive;

  if (neitherActive && !showEmptyPlaceholders) return null;

  const notesField = (
    canEdit ? (
      <InlineEditableField
        value={notes || ''}
        onChange={(v) => onUpdate!({ notes: v })}
        showFullText={showFullText}
        multiline
        startFocused={forceEditNotes}
        onEmptyBlur={() => setForceEditNotes(false)}
      />
    ) : (
      <p className={showFullText ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}>{parseFormatting(notes || '')}</p>
    )
  );

  const materialField = (align: 'left' | 'right') => (
    <div className={cn('flex items-start gap-1.5', align === 'right' && 'sm:text-right sm:justify-end')}>
      {!!material && <Package className="h-3.5 w-3.5 mt-1 shrink-0" />}
      {canEdit ? (
        <InlineEditableField
          value={material || ''}
          onChange={(v) => onUpdate!({ material: v })}
          showFullText={showFullText}
          multiline
          startFocused={forceEditMaterial}
          onEmptyBlur={() => setForceEditMaterial(false)}
          align={align}
        />
      ) : (
        <p className={showFullText ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}>{parseFormatting(material || '')}</p>
      )}
    </div>
  );

  return (
    <div className="mr-4 mt-2">
      {bothActive ? (
        <div className={cn('grid grid-cols-1', !stackFields ? 'sm:grid-cols-2 gap-4' : 'gap-1')}>
          <div className="text-sm text-muted-foreground">
            <div className="flex items-start gap-1.5">{notesField}</div>
          </div>
          <div className="text-sm text-muted-foreground">
            {materialField(!stackFields ? 'right' : 'left')}
          </div>
        </div>
      ) : neitherActive ? (
        showEmptyPlaceholders && (
          <EmptyFieldsPlaceholders
            notesLabel={t('dialog.notes')}
            materialLabel={t('dialog.material')}
            onActivateNotes={() => setForceEditNotes(true)}
            onActivateMaterial={() => setForceEditMaterial(true)}
          />
        )
      ) : stackFields ? (
        <div className="flex flex-col gap-1">
          {notesActive ? (
            <div className="text-sm text-muted-foreground">{notesField}</div>
          ) : (
            canEdit && showEmptyPlaceholders && <FieldPlaceholder variant="row" align="left" label={t('dialog.addNotes')} onActivate={() => setForceEditNotes(true)} />
          )}
          {materialActive ? (
            <div className="text-sm text-muted-foreground">{materialField('left')}</div>
          ) : (
            canEdit && showEmptyPlaceholders && <FieldPlaceholder variant="row" align="left" label={t('dialog.addMaterial')} onActivate={() => setForceEditMaterial(true)} />
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {notesActive ? (
            <>
              <div className="flex-1 min-w-0 text-sm text-muted-foreground">{notesField}</div>
              {canEdit && showEmptyPlaceholders && (
                <FieldPlaceholder variant="compact" label={t('dialog.addMaterial')} onActivate={() => setForceEditMaterial(true)} />
              )}
            </>
          ) : (
            <>
              {canEdit && showEmptyPlaceholders && (
                <FieldPlaceholder variant="compact" label={t('dialog.addNotes')} onActivate={() => setForceEditNotes(true)} />
              )}
              <div className="flex-1 min-w-0 text-sm text-muted-foreground">{materialField('right')}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
