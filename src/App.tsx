import { Toaster as Sonner } from "@/components/primitives/sonner";
import { MessageSquare } from 'lucide-react';
import { TooltipProvider } from "@/components/primitives/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, useLocation, Outlet, useNavigation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Suspense, useEffect, useRef, useState } from "react";
import { resetPrerenderReady, signalPrerenderReady, isPrerendering } from "./lib/prerender";
import { LibraryProvider } from "./contexts/LibraryContext";
import { LocaleProvider } from "./contexts/LocaleContext";
import { LoadingScreen } from "./components/states/LoadingScreen";
import { ErrorBoundary } from "./components/states/ErrorBoundary";
import { WorkshopPageContext } from "./contexts/WorkshopPageContext";
import {
  blogArticleLoader,
  blogIndexLoader,
  homePageLoader,
  templateArticleLoader,
  templatesIndexLoader,
  landingPageLoader,
  landingPagesLoader,
} from "./lib/routeLoaders";

const FEEDBACK_MAILTO = 'mailto:feedback@sessionplan.de';

// Layout component with page view tracking
function RootLayout() {
  const location = useLocation();
  const navigation = useNavigation();
  const workshopPageRef = useRef(false);
  workshopPageRef.current = false;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  useEffect(() => {
    resetPrerenderReady();
  }, [location.pathname]);

  useEffect(() => {
    if (!isPrerendering()) {
      return;
    }

    if (location.pathname === "/landing-pages" || location.pathname === "/en/landing-pages") {
      return;
    }

    if (navigation.state !== "idle") {
      return;
    }

    let secondFrame: number | undefined;

    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        signalPrerenderReady();
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [location.pathname, navigation.state]);
  
  return (
    <>
      <WorkshopPageContext.Provider value={workshopPageRef}>
        <LocaleProvider>
          <Outlet />
        </LocaleProvider>
      </WorkshopPageContext.Provider>
      <a
        href={FEEDBACK_MAILTO}
        className="fixed hidden lg:flex bottom-4 right-4 md:-ml-16 z-30 items-center gap-2 px-3 py-2 rounded-sm bg-card shadow-md hover:bg-muted transition-colors text-sm font-medium"
      >
        <MessageSquare className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Feedback</span>
      </a>
    </>
  );
}

// Router configuration with data loaders
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <LocaleProvider><ErrorBoundary /></LocaleProvider>,
    children: [
      // ── DE routes (no prefix) ─────────────────────────────────────────────
      {
        path: "/",
        lazy: async () => ({ Component: (await import("./pages/Index")).default }),
        loader: homePageLoader,
      },
      {
        path: "/blog",
        lazy: async () => ({ Component: (await import("./pages/Blog")).default }),
        loader: blogIndexLoader,
      },
      {
        path: "/blog/:slug",
        lazy: async () => ({ Component: (await import("./pages/BlogArticle")).default }),
        loader: blogArticleLoader,
      },
      {
        path: "/templates",
        lazy: async () => ({ Component: (await import("./pages/Templates")).default }),
        loader: templatesIndexLoader,
      },
      {
        path: "/templates/:slug",
        lazy: async () => ({ Component: (await import("./pages/LandingPage")).default }),
        loader: templateArticleLoader,
      },
      {
        path: "/landing-pages",
        lazy: async () => ({ Component: (await import("./pages/LandingPages")).default }),
        loader: landingPagesLoader,
      },
      {
        path: "/404",
        lazy: async () => ({ Component: (await import("./pages/NotFound")).default }),
      },
      {
        path: "/:slug",
        lazy: async () => ({ Component: (await import("./pages/LandingPage")).default }),
        loader: landingPageLoader,
      },

      // ── EN routes (/en prefix) ────────────────────────────────────────────
      {
        path: "/en",
        lazy: async () => ({ Component: (await import("./pages/Index")).default }),
        loader: homePageLoader,
      },
      {
        path: "/en/blog",
        lazy: async () => ({ Component: (await import("./pages/Blog")).default }),
        loader: blogIndexLoader,
      },
      {
        path: "/en/blog/:slug",
        lazy: async () => ({ Component: (await import("./pages/BlogArticle")).default }),
        loader: blogArticleLoader,
      },
      {
        path: "/en/templates",
        lazy: async () => ({ Component: (await import("./pages/Templates")).default }),
        loader: templatesIndexLoader,
      },
      {
        path: "/en/templates/:slug",
        lazy: async () => ({ Component: (await import("./pages/LandingPage")).default }),
        loader: templateArticleLoader,
      },
      {
        path: "/en/landing-pages",
        lazy: async () => ({ Component: (await import("./pages/LandingPages")).default }),
        loader: landingPagesLoader,
      },
      {
        path: "/en/:slug",
        lazy: async () => ({ Component: (await import("./pages/LandingPage")).default }),
        loader: landingPageLoader,
      },

      // ── Fallback ──────────────────────────────────────────────────────────
      {
        path: "*",
        lazy: async () => ({ Component: (await import("./pages/NotFound")).default }),
      },
    ],
  },
]);

const App = () => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <LibraryProvider>
          <TooltipProvider>
            <Sonner />
            <Suspense fallback={<LoadingScreen />}>
              <RouterProvider router={router} />
            </Suspense>
          </TooltipProvider>
        </LibraryProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
};

export default App;
