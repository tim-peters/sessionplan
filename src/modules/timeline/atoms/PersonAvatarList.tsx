import { cn } from '@/lib/utils';
import { Person } from '@/types/workshop';
import { PersonAvatar } from '@/components/atoms/PersonAvatar';

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
        return <PersonAvatar key={personId} name={person.name} color={person.color} size="sm" />;
      })}
    </div>
  );
};
