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
  <button
    onClick={onClick}
    className="flex items-center justify-between w-full text-sm font-medium hover:text-primary"
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
  </button>
);
