import { cn } from '@/lib/utils';
import { Person } from '@/types/workshop';

interface PersonAvatarListProps {
  personIds: string[];
  persons: Person[];
  className?: string;
}

/**
 * Renders a row of person avatar circles with initials and color.
 * Used in BlockCard, GroupCard, and BreakoutCard.
 */
export const PersonAvatarList = ({ personIds, persons, className }: PersonAvatarListProps) => {
  if (!personIds || personIds.length === 0) return null;

  return (
    <div className={cn('flex gap-1', className)}>
      {personIds.map(personId => {
        const person = persons.find(p => p.id === personId);
        if (!person) return null;
        return (
          <div
            key={personId}
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0"
            style={{ backgroundColor: person.color }}
            title={person.name}
          >
            {person.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
        );
      })}
    </div>
  );
};
