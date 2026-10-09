import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { PageFooter } from '@/components/layout/PageFooter';
import { signalPrerenderReady } from '@/lib/prerender';
/**
 * Error Boundary für React Router
 * Fängt Fehler in Loadern und Components ab
 */
export function ErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    // Signal prerender ready even on error pages so Puppeteer doesn't timeout
    signalPrerenderReady();
  }, []);
  
  // 404 Error
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundError />;
  }
  
  // Andere Fehler
  return <GenericError error={error} />;
}

function NotFoundError() {
  const { t } = useTranslation('common');

  useEffect(() => {
  }, []);
  return (
    <>
      <DocumentMeta
        title={t('errors.notFound')}
        description={t('errors.notFoundDesc')}
        noindex={true}
      />
      <div className="min-h-screen flex flex-col" data-error-page="true">
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              404
            </h1>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              {t('errors.notFound')}
            </h2>
            <p className="text-muted-foreground mb-8">
              {t('errors.notFoundDesc')}
            </p>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {t('errors.backHome')}
            </Link>
          </div>
        </main>
        <div className="mx-6 md:mx-0">
          <PageFooter />
        </div>
      </div>
    </>
  );
}

function GenericError({ error }: { error: unknown }) {
  const { t } = useTranslation('common');
  const errorMessage = error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.';

  useEffect(() => {
  }, [errorMessage]);

  return (
    <>
      <DocumentMeta
        title={t('errors.oops')}
        description=""
        noindex={true}
      />
      <div className="min-h-screen flex flex-col" data-error-page="true">
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {t('errors.oops')}
            </h1>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              {t('errors.somethingWrong')}
            </h2>
            <p className="text-muted-foreground mb-2">
              {errorMessage}
            </p>
            {import.meta.env.DEV && error instanceof Error && error.stack && (
              <details className="mt-4 text-left text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto max-h-60">
                <summary className="cursor-pointer font-semibold mb-2">
                  {t('errors.stackTrace')}
                </summary>
                <pre className="text-red-600 dark:text-red-400 whitespace-pre-wrap">
                  {error.stack}
                </pre>
              </details>
            )}
            <div className="mt-8 flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {t('errors.reload')}
              </button>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {t('errors.toHome')}
              </Link>
            </div>
          </div>
        </main>
        <div className="mx-6 md:mx-0">
          <PageFooter />
        </div>
      </div>
    </>
  );
}
