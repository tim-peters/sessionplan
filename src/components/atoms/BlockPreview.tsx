import { useEffect, useRef, useState } from 'react';
import { Package } from 'lucide-react';
import { parseFormatting } from '@/lib/textFormatting';
import { useIsMobile } from '@/hooks/use-mobile';

interface BlockPreviewProps {
  notes?: string;
  material?: string;
  showFullText?: boolean;
  onUpdate?: (updates: { notes?: string; material?: string }) => void;
}

const EditableField = ({
  value,
  onChange,
  showFullText,
  multiline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  showFullText: boolean;
  multiline?: boolean;
}) => {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focused && multiline && ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [focused, multiline, value]);

  if (!focused) {
    return (
      <p
        className={`cursor-text ${showFullText ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}`}
        onClick={(e) => { e.stopPropagation(); setFocused(true); }}
      >
        {parseFormatting(value)}
      </p>
    );
  }

  if (multiline) {
    return (
      <textarea
        ref={ref}
        autoFocus
        value={value}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setFocused(false)}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-transparent border-none outline-none focus:ring-2 focus:ring-primary/20 rounded px-1 resize-none overflow-hidden leading-snug"
      />
    );
  }

  return (
    <input
      autoFocus
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setFocused(false)}
      onClick={(e) => e.stopPropagation()}
      className="w-full bg-transparent border-none outline-none focus:ring-2 focus:ring-primary/20 rounded px-1 truncate"
    />
  );
};

export const BlockPreview = ({ notes, material, showFullText = false, onUpdate }: BlockPreviewProps) => {
  const isMobile = useIsMobile();
  const canEdit = !!onUpdate && !isMobile;

  if (!notes && !material) return null;

  return (
    <div className={`mt-2 grid gap-4 mr-4 grid-cols-1 ${notes && material ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
      {notes && (
        <div className="text-sm text-muted-foreground">
          <div className="flex items-start gap-1.5">
            {canEdit ? (
              <EditableField value={notes} onChange={(v) => onUpdate!({ notes: v })} showFullText={showFullText} multiline />
            ) : (
              <p className={showFullText ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}>{parseFormatting(notes)}</p>
            )}
          </div>
        </div>
      )}
      {material && (
        <div className="text-sm text-muted-foreground">
          <div className="flex items-start gap-1.5 sm:text-right sm:justify-end">
            <Package className="h-3.5 w-3.5 mt-1 shrink-0" />
            {canEdit ? (
              <EditableField value={material} onChange={(v) => onUpdate!({ material: v })} showFullText={showFullText} />
            ) : (
              <p className={showFullText ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}>{parseFormatting(material)}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
