import { useTranslation } from 'react-i18next';
import { WorkshopItem } from '@/types/workshop';
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
        'w-full font-medium bg-transparent border-none outline-none focus:ring-2 focus:ring-primary/20 rounded px-1 mt-[2px] -mx-1 truncate',
        className,
      )}
      placeholder={t(placeholderKey)}
      {...(testIdAttr && {
        'data-block-title-input': true,
        'data-block-id': item.id,
      })}
    />
  );
};
