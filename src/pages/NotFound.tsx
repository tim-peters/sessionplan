import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { TemplateHeader } from '@/components/layout/TemplateHeader';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <DocumentMeta
        title="Seite nicht gefunden (404)"
        description="Die angeforderte Seite konnte nicht gefunden werden."
        canonicalPath="/404"
        noindex={true}
        robots="noindex,nofollow"
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <TemplateHeader
            title="404"
            breadcrumbs={[{ label: '404' }]}
          />
          <div className="text-center">
            <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
            <a href="/" className="text-primary underline hover:text-primary/90">
              Return to Home
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotFound;
