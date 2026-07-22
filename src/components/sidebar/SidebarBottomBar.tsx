import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  locale: Locale;
  getTargetUrl: (target: Locale) => string;
  size?: 'inline' | 'stacked';
}

export const LanguageSwitcher = ({
  locale,
  getTargetUrl,
  size = 'inline',
}: LanguageSwitcherProps) => {
  const navigate = useNavigate();
  const { t: _t } = useTranslation('common');
  if (size === 'stacked') {
    return (
      <button
        onClick={() => navigate(getTargetUrl(locale === 'de' ? 'en' : 'de'))}
        className="icon-button text-xs font-semibold"
        title={locale === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln'}
      >
        {locale.toUpperCase()}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 px-3 border-l shrink-0">
      <button
        onClick={() => navigate(getTargetUrl('de'))}
        className={cn(
          'px-2 py-0.5 rounded text-xs font-medium transition-colors',
          locale === 'de' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
        )}
      >
        DE
      </button>
      <button
        onClick={() => navigate(getTargetUrl('en'))}
        className={cn(
          'px-2 py-0.5 rounded text-xs font-medium transition-colors',
          locale === 'en' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
        )}
      >
        EN
      </button>
    </div>
  );
};

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
        <LanguageSwitcher locale={locale} getTargetUrl={getTargetUrl} size="stacked" />
        <button
          onClick={onToggleSettings}
          className="icon-button"
          title={t('settings.sectionTitle')}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-stretch">
      <button
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
      </button>
      <LanguageSwitcher locale={locale} getTargetUrl={getTargetUrl} />
    </div>
  );
};

export const MobileCloseButton = ({ onClose }: { onClose: () => void }) => (
  <button
    onClick={onClose}
    className="lg:hidden absolute top-4 right-4 p-2 hover:bg-muted rounded-lg z-20"
  >
    <X className="h-5 w-5" />
  </button>
);

export const SidebarLogo = ({ onCollapse }: { onCollapse: () => void }) => {
  const { t } = useTranslation('common');
  return (
    <div className="border-b mb-2 flex-shrink-0 bg-sidebar/90 backdrop-blur-md z-10">
      <div className="flex items-center justify-between gap-0">
        <div className="flex-1 min-w-0 p-6 truncate">
          <h2 className="text-xl font-semibold">
            <Link to="." className="hover:underline">
              Sessionplan
            </Link>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('sidebar.dragAndDrop')}
          </p>
        </div>
        <button
          onClick={onCollapse}
          className="hidden lg:flex p-2 hover:bg-muted py-[2.88rem] px-6 transition-colors shrink-0"
          title={t('settings.collapse')}
        >
          <PanelLeftCloseIcon />
        </button>
      </div>
    </div>
  );
};

const PanelLeftCloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="m16 15-3-3 3-3" />
  </svg>
);
