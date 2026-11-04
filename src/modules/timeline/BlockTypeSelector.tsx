import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/primitives/dropdown-menu';
import { getBlockTypeName } from '@/lib/workshopUtils';
import type { BlockType, WorkshopItem } from '@/types/workshop';

interface BlockTypeSelectorProps {
  blockTypes: BlockType[];
  selectedId: string | null;
  onUpdate: (updates: Partial<WorkshopItem>) => void;
}

export const BlockTypeSelector = ({ blockTypes, selectedId, onUpdate }: BlockTypeSelectorProps) => {
  const { t } = useTranslation('common');
  const selected = blockTypes.find((type) => type.id === selectedId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="plain"
          size="none"
          className="flex items-center justify-between rounded-md px-3 py-2 w-auto h-7 text-xs gap-2 border-none bg-muted/50 hover:bg-accent active:bg-accent-active data-[state=open]:bg-accent print:hidden"
        >
          <span>{selected ? getBlockTypeName(selected, t) : t('block.typePlaceholder')}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-96 overflow-y-auto bg-popover">
        {blockTypes.map((type) => (
          <DropdownMenuCheckboxItem
            key={type.id}
            checked={selectedId === type.id}
            indicatorPosition="right"
            onCheckedChange={(checked) => onUpdate({ blockTypeId: checked ? type.id : null })}
          >
            {getBlockTypeName(type, t)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
