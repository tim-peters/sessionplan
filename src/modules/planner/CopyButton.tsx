import { Button } from '@/components/primitives/button';
import { Check, ClipboardCopy } from 'lucide-react';
import { ComponentProps } from 'react';

interface CopyButtonProps {
  copied: boolean;
  label: string;
  copiedLabel: string;
  onClick: () => void;
  variant?: ComponentProps<typeof Button>['variant'];
}

/**
 * Button that toggles between a "copy" and "copied" state.
 */
export const CopyButton = ({
  copied,
  label,
  copiedLabel,
  onClick,
  variant = 'secondary',
}: CopyButtonProps) => (
  <Button
    variant={copied ? 'default' : variant}
    size="sm"
    className="w-full gap-2"
    onClick={onClick}
  >
    {copied ? (
      <>
        <Check className="h-3.5 w-3.5" />
        {copiedLabel}
      </>
    ) : (
      <>
        <ClipboardCopy className="h-3.5 w-3.5" />
        {label}
      </>
    )}
  </Button>
);
