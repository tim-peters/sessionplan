import { Palette, Plus, FolderPlus, SquareSplitHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BlockType } from '@/types/workshop';
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
    <div className="p-4">
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
                initialName={type.name}
                initialColor={type.color}
                namePlaceholder={t('sidebar.addType')}
                onSave={(name, color) => onUpdateBlockType(type.id, name, color)}
                onCancel={() => onStartEditBlockType(type.id)}
                onDelete={() => onRequestDeleteBlockType(type.id, type.name)}
              />
            ) : (
              <DraggableBlockType
                key={type.id}
                type={type}
                onModify={() => onStartEditBlockType(type.id)}
                onAdd={() => onAddBlock(type.id)}
                shortcutKey={index < 9 ? String(index + 1) : undefined}
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
            <button
              onClick={onShowNewTypeForm}
              className="sidebar-item text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              <span>{t('sidebar.addType')}</span>
            </button>
          )}

          <DraggableSpecialType
            dragType="new-group"
            icon={FolderPlus}
            label={t('sidebar.group')}
            onAdd={onAddGroup}
            shortcut="g"
          />

          <DraggableSpecialType
            dragType="new-breakout"
            icon={SquareSplitHorizontal}
            label={t('sidebar.breakout')}
            onAdd={onAddBreakout}
            shortcut="b"
          />
        </div>
      )}
    </div>
  );
};
