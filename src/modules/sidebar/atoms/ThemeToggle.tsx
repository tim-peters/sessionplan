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

  const label = isDark ? t('settings.themeLight') : t('settings.themeDark');

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      title={t('settings.themeToggle')}
      aria-label={t('settings.themeToggle')}
      aria-pressed={mounted ? isDark : undefined}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors',
        className
      )}
    >
      {mounted && isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span>{label}</span>
    </button>
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
    <button
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
    </button>
  );
};
