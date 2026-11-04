import { Button } from '@/components/primitives/button';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarSectionHeaderProps {
  icon: React.ElementType;
  label: React.ReactNode;
  isOpen: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}

export const SidebarSectionHeader = ({
  icon: Icon,
  label,
  isOpen,
  onClick,
  badge,
}: SidebarSectionHeaderProps) => (
  <Button variant="plain" size="none"
    onClick={onClick}
    aria-expanded={isOpen}
    className="-mx-3 flex min-h-10 w-[calc(100%+1.5rem)] items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:text-primary-text"
  >
    <span className="flex items-center gap-2">
      <Icon className="h-4 w-4" />
      {label}
      {badge}
    </span>
    {isOpen ? (
      <ChevronDown className="h-4 w-4" />
    ) : (
      <ChevronRight className="h-4 w-4" />
    )}
  </Button>
);
