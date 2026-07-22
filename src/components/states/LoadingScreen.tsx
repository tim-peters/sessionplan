/**
 * Zentralisierte Loading-Screen Komponente
 * Wird verwendet als Suspense fallback während Daten geladen werden
 */
export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100 mb-4"></div>
        <p className="text-muted-foreground">Lädt...</p>
      </div>
    </div>
  );
}
