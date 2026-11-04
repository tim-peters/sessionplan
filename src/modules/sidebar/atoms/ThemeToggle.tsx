import { Button } from '@/components/primitives/button';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMounted } from '@/hooks/useMounted';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle = ({ className }: ThemeToggleProps) => {
  const { t } = useTranslation('common');
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark');
  const nextTheme: 'dark' | 'light' = isDark ? 'light' : 'dark';

  const label = isDark ? t('settings.themeDark') : t('settings.themeLight');

  return (
    <div className="px-3 py-2 flex items-center justify-between gap-3">
      <label htmlFor="theme-toggle-button" className="text-sm cursor-pointer">
        {label}
      </label>
      <Button variant="plain" size="none"
        type="button" 
        id="theme-toggle-button"
        onClick={() => setTheme(nextTheme)}
        title={t('settings.themeToggle')}
        aria-label={t('settings.themeToggle')}
        aria-pressed={mounted ? isDark : undefined}
        className={cn(
          'px-3 py-1 text-sm text-primary-text rounded-md bg-muted transition-colors',
          className
        )}
      >
        {mounted && isDark ? (
          <Moon className="h-4 w-4 mx-auto" />
        ) : (
          <Sun className="h-4 w-4 mx-auto" />
        )}
      </Button>
    </div>
  );
};

interface ThemeToggleIconProps {
  className?: string;
}

export const ThemeToggleIcon = ({ className }: ThemeToggleIconProps) => {
  const { t } = useTranslation('common');
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark');
  const nextTheme: 'dark' | 'light' = isDark ? 'light' : 'dark';

  return (
    <Button variant="plain" size="none"
      type="button"
      onClick={() => setTheme(nextTheme)}
      title={t('settings.themeToggle')}
      aria-label={t('settings.themeToggle')}
      aria-pressed={mounted ? isDark : undefined}
      className={cn('icon-button', className)}
    >
      {mounted && isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
};
