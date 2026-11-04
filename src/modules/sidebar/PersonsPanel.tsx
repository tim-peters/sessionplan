import { Button } from '@/components/primitives/button';
import { Pencil, Plus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Person } from '@/types/workshop';
import { SidebarSectionHeader } from './SidebarSectionHeader';
import { InlineEntityForm } from './InlineEntityForm';
import { PersonAvatar } from '@/components/atoms/PersonAvatar';
import { cn } from '@/lib/utils';
import { DEFAULT_PERSON_COLOR } from '@/lib/workshopDefaults';

interface PersonsPanelProps {
  persons: Person[];
  isOpen: boolean;
  onToggle: () => void;
  onAddPerson: (name: string, color: string) => void;
  editingPersonId: string | null;
  onStartEditPerson: (id: string) => void;
  onUpdatePerson: (id: string, name: string, color: string) => void;
  onRequestDeletePerson: (id: string, name: string) => void;
  showNewPersonForm: boolean;
  newPersonColor: string;
  onShowNewPersonForm: () => void;
  onHideNewPersonForm: () => void;
}

export const PersonsPanel = ({
  persons,
  isOpen,
  onToggle,
  onAddPerson,
  editingPersonId,
  onStartEditPerson,
  onUpdatePerson,
  onRequestDeletePerson,
  showNewPersonForm,
  newPersonColor,
  onShowNewPersonForm,
  onHideNewPersonForm,
}: PersonsPanelProps) => {
  const { t } = useTranslation('common');

  return (
    <div className="sidebar-panel">
      <SidebarSectionHeader
        icon={Users}
        label={
          <>
            {t('sidebar.persons')}
            {persons.length > 0 && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {persons.length}
              </span>
            )}
          </>
        }
        isOpen={isOpen}
        onClick={onToggle}
      />

      {isOpen && (
        <div className="sidebar-section">
          {persons.map((person) =>
            editingPersonId === person.id ? (
              <InlineEntityForm
                key={person.id}
                initialName={person.name}
                initialColor={person.color}
                namePlaceholder={t('sidebar.addPerson')}
                onSave={(name, color) => onUpdatePerson(person.id, name, color)}
                onCancel={() => onStartEditPerson(person.id)}
                onDelete={() => onRequestDeletePerson(person.id, person.name)}
              />
            ) : (
              <div key={person.id} className="sidebar-item group">
                <PersonAvatar name={person.name} color={person.color} size="sm" />
                <span className="flex-1 truncate">{person.name}</span>
                <Button variant="plain" size="none"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEditPerson(person.id);
                  }}
                  className={cn(
                    'sidebar-action p-1 hover:bg-muted-foreground/10 rounded transition-opacity',
                  )}
                  title={t('sidebar.modify')}
                  aria-label={t('sidebar.modify')}
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ),
          )}

          {showNewPersonForm ? (
            <InlineEntityForm
              initialName=""
              initialColor={newPersonColor || DEFAULT_PERSON_COLOR}
              namePlaceholder={t('sidebar.addPerson')}
              onSave={(name, color) => onAddPerson(name, color)}
              onCancel={onHideNewPersonForm}
            />
          ) : (
            <Button variant="plain" size="none"
              onClick={onShowNewPersonForm}
              className="sidebar-item text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              <span>{t('sidebar.addPerson')}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
