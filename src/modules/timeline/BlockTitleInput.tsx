import { useTranslation } from 'react-i18next';
import { WorkshopItem } from '@/types/workshop';
import { EditableFieldPencil } from '@/components/atoms/EditableFieldPencil';
import { cn } from '@/lib/utils';

interface BlockTitleInputProps {
  item: WorkshopItem;
  onUpdate: (updates: Partial<WorkshopItem>) => void;
  onCreateBelow?: (item: WorkshopItem) => void;
  onDeleteAndFocusPrev?: (item: WorkshopItem) => void;
  placeholderKey?: 'block.titlePlaceholder' | 'block.groupTitlePlaceholder' | 'block.breakoutTitlePlaceholder';
  className?: string;
  testIdAttr?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export const BlockTitleInput = ({
  item,
  onUpdate,
  onCreateBelow,
  onDeleteAndFocusPrev,
  placeholderKey = 'block.titlePlaceholder',
  className,
  testIdAttr = true,
  onClick,
}: BlockTitleInputProps) => {
  const { t } = useTranslation('common');

  const canDeleteOnBackspace =
    item.title === '' &&
    !item.notes &&
    !item.material &&
    (item.type === 'block' || !item.children || item.children.length === 0);

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={item.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onCreateBelow?.(item);
          } else if (e.key === 'Backspace' && !e.repeat && canDeleteOnBackspace) {
            e.preventDefault();
            onDeleteAndFocusPrev?.(item);
          }
        }}
        className={cn(
          'w-full font-medium bg-transparent border-none outline-none rounded px-1 mt-[2px] -mx-1 truncate editable-field',
          className,
        )}
        placeholder={t(placeholderKey)}
        {...(testIdAttr && {
          'data-block-title-input': true,
          'data-block-id': item.id,
        })}
      />
      {/* Invisible sizer mirroring the input's text (same font, padding and
          truncation), carrying the hover pencil so it sits right after the
          text end. Absolute + pointer-events-none: layout, hit target and
          focus behaviour of the input are unchanged. Must stay AFTER the
          input for the `.editable-field:hover ~` CSS hook. */}
      <span
        aria-hidden
        className="editable-field-sizer invisible pointer-events-none absolute top-0 left-0 -mx-1 mt-[2px] px-1 font-medium truncate"
      >
        {item.title || t(placeholderKey)}
        <EditableFieldPencil className="ml-1 visible" />
      </span>
    </div>
  );
};
