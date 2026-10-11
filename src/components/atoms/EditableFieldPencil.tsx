import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableFieldPencilProps {
  className?: string;
}

/**
 * Small decorative pencil cue for inline-editable text fields. Rendered inside
 * an element carrying the `.editable-field` class; it stays invisible at rest
 * and fades in while the field is hovered (see `.editable-field-pencil` in
 * index.css — hover-only devices, hidden in print).
 *
 * Must stay `inline`: Tailwind preflight makes svgs `display: block`, which
 * would stack the icon on its own line instead of flowing with the text.
 *
 * For left-aligned text place it AFTER the text, for right-aligned text BEFORE
 * it, so its reserved inline space always falls into whitespace and the text
 * position never shifts.
 *
 * Title inputs can't contain elements — there the pencil lives in an invisible
 * `.editable-field-sizer` span that mirrors the input's text (see
 * BlockTitleInput / WorkshopHeader). Inside an `invisible` parent it needs the
 * `visible` class to restore visibility.
 */
export const EditableFieldPencil = ({ className }: EditableFieldPencilProps) => (
  <Pencil
    aria-hidden
    className={cn('editable-field-pencil inline h-3 w-3 shrink-0 text-muted-foreground/70', className)}
  />
);
