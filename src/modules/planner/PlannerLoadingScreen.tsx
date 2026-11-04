import { useTranslation } from 'react-i18next';

/** Shown while a Dynamic Link is loading from the server. */
export const PlannerLoadingScreen = () => {
  const { t } = useTranslation('common');

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <svg className="h-6 w-6 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">{t('planner.permanentLinkCreating')}</span>
      </div>
    </div>
  );
};
