import { Button } from '@/components/primitives/button';
import { Palette, Plus, FolderPlus, SquareSplitHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BlockType } from '@/types/workshop';
import { getBlockTypeName } from '@/lib/workshopUtils';
import { SidebarSectionHeader } from './SidebarSectionHeader';
import { DraggableBlockType } from './DraggableBlockType';
import { DraggableSpecialType } from './DraggableSpecialType';
import { InlineEntityForm } from './InlineEntityForm';

interface BlockTypesPanelProps {
  blockTypes: BlockType[];
  isOpen: boolean;
  onToggle: () => void;
  onAddBlock: (blockTypeId: string) => void;
  onAddGroup: () => void;
  onAddBreakout: () => void;
  onAddBlockType: (name: string, color: string) => void;
  editingBlockTypeId: string | null;
  onStartEditBlockType: (id: string) => void;
  onUpdateBlockType: (id: string, name: string, color: string) => void;
  onRequestDeleteBlockType: (id: string, name: string) => void;
  showNewTypeForm: boolean;
  newTypeColor: string;
  onShowNewTypeForm: () => void;
  onHideNewTypeForm: () => void;
}

export const BlockTypesPanel = ({
  blockTypes,
  isOpen,
  onToggle,
  onAddBlock,
  onAddGroup,
  onAddBreakout,
  onAddBlockType,
  editingBlockTypeId,
  onStartEditBlockType,
  onUpdateBlockType,
  onRequestDeleteBlockType,
  showNewTypeForm,
  newTypeColor,
  onShowNewTypeForm,
  onHideNewTypeForm,
}: BlockTypesPanelProps) => {
  const { t } = useTranslation('common');

  return (
    <div className="sidebar-panel">
      <SidebarSectionHeader
        icon={Palette}
        label={t('sidebar.blockTypes')}
        isOpen={isOpen}
        onClick={onToggle}
      />

      {isOpen && (
        <div className="sidebar-section">
          {blockTypes.map((type, index) =>
            editingBlockTypeId === type.id ? (
              <InlineEntityForm
                key={type.id}
                initialName={getBlockTypeName(type, t)}
                initialColor={type.color}
                namePlaceholder={t('sidebar.addType')}
                // An unchanged name keeps the stored one, so translations never get persisted.
                onSave={(name, color) =>
                  onUpdateBlockType(type.id, name === getBlockTypeName(type, t) ? type.name : name, color)
                }
                onCancel={() => onStartEditBlockType(type.id)}
                onDelete={() => onRequestDeleteBlockType(type.id, type.name)}
              />
            ) : (
              <DraggableBlockType
                key={type.id}
                type={type}
                onModify={() => onStartEditBlockType(type.id)}
                onAdd={() => onAddBlock(type.id)}
                shortcutDigit={index < 9 ? index + 1 : undefined}
              />
            )
          )}

          {showNewTypeForm ? (
            <InlineEntityForm
              initialName=""
              initialColor={newTypeColor}
              namePlaceholder={t('sidebar.addType')}
              onSave={(name, color) => onAddBlockType(name, color)}
              onCancel={onHideNewTypeForm}
            />
          ) : (
            <Button variant="plain" size="none"
              onClick={onShowNewTypeForm}
              className="sidebar-item text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              <span>{t('sidebar.addType')}</span>
            </Button>
          )}

          <DraggableSpecialType
            dragType="new-group"
            icon={FolderPlus}
            label={t('sidebar.group')}
            onAdd={onAddGroup}
            shortcutId="addGroup"
          />

          <DraggableSpecialType
            dragType="new-breakout"
            icon={SquareSplitHorizontal}
            label={t('sidebar.breakout')}
            onAdd={onAddBreakout}
            shortcutId="addBreakout"
          />
        </div>
      )}
    </div>
  );
};
