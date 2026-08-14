import { Copy, Library, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/primitives/dropdown-menu';

interface ItemActionsMenuProps {
  onEditDetails: () => void;
  onDuplicate: () => void;
  onSaveToLibrary: () => void;
  onDelete: () => void;
}

/**
 * Three-dot dropdown menu with standard item actions.
 * Used in BlockCard, GroupCard, and BreakoutCard.
 */
export const ItemActionsMenu = ({
  onEditDetails,
  onDuplicate,
  onSaveToLibrary,
  onDelete,
}: ItemActionsMenuProps) => {
  const { t } = useTranslation('common');

  const stop = (cb: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    cb();
  };

  return (
  <div className="print:hidden">
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 print:hidden">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        <DropdownMenuItem onClick={stop(onEditDetails)}>
          <Pencil className="h-4 w-4 mr-2" />
          {t('actions.editDetails')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={stop(onDuplicate)}>
          <Copy className="h-4 w-4 mr-2" />
          {t('actions.duplicate')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={stop(onSaveToLibrary)}>
          <Library className="h-4 w-4 mr-2" />
          {t('actions.saveToLibrary')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={stop(onDelete)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {t('actions.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
  );
};
