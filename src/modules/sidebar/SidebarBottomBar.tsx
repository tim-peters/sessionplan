import { Button } from '@/components/primitives/button';
import { useTranslation } from 'react-i18next';
import { Settings, ChevronDown, ChevronUp, X, PanelLeftClose } from 'lucide-react';
import { Locale } from '@/lib/i18n';
import { useLanguageSwitcher } from '@/hooks/useLanguageSwitcher';
import { LanguageSwitcher } from '@/components/atoms/LanguageSwitcher';

interface SidebarBottomBarProps {
  isCollapsed: boolean;
  locale: Locale;
  isSettingsOpen: boolean;
  getTargetUrl: (target: Locale) => string;
  onToggleSettings: () => void;
}

export const SidebarBottomBar = ({
  isCollapsed,
  locale,
  isSettingsOpen,
  getTargetUrl,
  onToggleSettings,
}: SidebarBottomBarProps) => {
  const { t } = useTranslation('common');
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-2 gap-1">
        <LanguageSwitcher locale={locale} getTargetUrl={getTargetUrl} variant="collapsed" />
        <Button variant="plain" size="none"
          onClick={onToggleSettings}
          className="icon-button"
          title={t('settings.sectionTitle')}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-stretch">
      <Button variant="plain" size="none"
        onClick={onToggleSettings}
        className="flex-1 flex items-center gap-2 px-3 py-3 text-sm font-medium hover:bg-muted transition-colors"
      >
        <Settings className="h-4 w-4" />
        <span>{t('settings.sectionTitle')}</span>
        <span className="ml-auto">
          {isSettingsOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </span>
      </Button>
      <LanguageSwitcher locale={locale} getTargetUrl={getTargetUrl} variant="sidebar" />
    </div>
  );
};

export const MobileCloseButton = ({ onClose }: { onClose: () => void }) => (
  <Button variant="plain" size="none"
    onClick={onClose}
    className="lg:hidden absolute top-4 right-4 p-2 hover:bg-muted rounded-lg z-20"
  >
    <X className="h-5 w-5" />
  </Button>
);

export const SidebarLogo = ({ onCollapse }: { onCollapse: () => void }) => {
  const { t } = useTranslation('common');
  const { locale } = useLanguageSwitcher();
  return (
    <div className="border-b flex-shrink-0 bg-sidebar/40 z-10">
      <div className="flex items-center justify-between gap-0">
        <div className="flex-1 min-w-0 p-5 sm:p-6 truncate">
          <h2 className="text-xl font-semibold">
            <a href={locale === 'en' ? '/en' : '/'} className="inline-flex items-center gap-2 hover:underline">
              <img src="/pwa/favicon.svg" alt="" className="h-7 w-7 shrink-0 translate-y-3 -translate-x-1" aria-hidden="true" />
              <span>Sessionplan</span>
            </a>
          </h2>
          <p className="text-sm text-muted-foreground -mt-1 pl-9">
            {t('sidebar.dragAndDrop')}
          </p>
        </div>
        <Button variant="ghost" size="icon"
          onClick={onCollapse}
          className="mr-4 hidden shrink-0 lg:inline-flex"
          title={t('settings.collapse')}
          aria-label={t('settings.collapse')}
        >
          <PanelLeftClose className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
