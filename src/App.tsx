import { Toaster as Sonner } from "@/components/primitives/sonner";
import { TooltipProvider } from "@/components/primitives/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, useLocation, Outlet, useNavigation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Suspense, useEffect, useRef, useState } from "react";
import { lazyPage } from "./lib/lazyRoute";
import { resetPrerenderReady, signalPrerenderReady, isPrerendering } from "./lib/prerender";
import { LibraryProvider } from "./contexts/LibraryContext";
import { LocaleProvider } from "./contexts/LocaleContext";
import { LoadingScreen } from "./components/states/LoadingScreen";
import { ErrorBoundary } from "./components/states/ErrorBoundary";
import { LanguageHint } from "./components/atoms/LanguageHint";
import { WorkshopPageContext } from "./contexts/WorkshopPageContext";
import {
  blogArticleLoader,
  blogIndexLoader,
  blogCategoryLoader,
  homePageLoader,
  templateArticleLoader,
  templateCategoryLoader,
  templatesIndexLoader,
  landingPageLoader,
  landingPagesLoader,
  landingPageHubLoader,
} from "./lib/routeLoaders";

import { siteRoutes, SiteFeedback } from '@/integrations/site';

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
    let fired = false;

    const handleScroll = () => {
      if (!fired && window.scrollY > window.innerHeight) {
        fired = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
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
          {/* Voluntary language suggestion — rendered once here so it behaves
              uniformly on every page as a floating bubble (bottom-right). */}
          <LanguageHint />
        </LocaleProvider>
      </WorkshopPageContext.Provider>
      <SiteFeedback />
    </>
  );
}

// Router configuration with data loaders
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <LocaleProvider><ErrorBoundary /></LocaleProvider>,
    children: [
      ...siteRoutes,
      // ── DE routes (no prefix) ─────────────────────────────────────────────
      {
        path: "/",
        lazy: lazyPage(() => import("./pages/Index")),
        loader: homePageLoader,
      },
      {
        path: "/blog",
        lazy: lazyPage(() => import("./pages/Blog")),
        loader: blogIndexLoader,
      },
      {
        path: "/blog/workshop-methoden",
        lazy: lazyPage(() => import("./pages/BlogCategory")),
        loader: (args) => blogCategoryLoader(args, 'workshop-methoden'),
      },
      {
        path: "/blog/sessionplan-neuigkeiten",
        lazy: lazyPage(() => import("./pages/BlogCategory")),
        loader: (args) => blogCategoryLoader(args, 'sessionplan-neuigkeiten'),
      },
      {
        path: "/blog/tool-tipps",
        lazy: lazyPage(() => import("./pages/BlogCategory")),
        loader: (args) => blogCategoryLoader(args, 'tool-tipps'),
      },
      {
        path: "/blog/ki-im-workshop",
        lazy: lazyPage(() => import("./pages/BlogCategory")),
        loader: (args) => blogCategoryLoader(args, 'ki-im-workshop'),
      },
      {
        path: "/blog/:slug",
        lazy: lazyPage(() => import("./pages/BlogArticle")),
        loader: blogArticleLoader,
      },
      {
        path: "/templates",
        lazy: lazyPage(() => import("./pages/Templates")),
        loader: templatesIndexLoader,
      },
      {
        path: "/templates/retrospektive",
        lazy: lazyPage(() => import("./pages/TemplateCategory")),
        loader: (args) => templateCategoryLoader(args, 'retrospektive'),
      },
      {
        path: "/templates/liberating-structures",
        lazy: lazyPage(() => import("./pages/TemplateCategory")),
        loader: (args) => templateCategoryLoader(args, 'liberating-structures'),
      },
      {
        path: "/templates/workshop",
        lazy: lazyPage(() => import("./pages/TemplateCategory")),
        loader: (args) => templateCategoryLoader(args, 'workshop'),
      },
      {
        path: "/templates/entscheidung",
        lazy: lazyPage(() => import("./pages/TemplateCategory")),
        loader: (args) => templateCategoryLoader(args, 'entscheidung'),
      },
      {
        path: "/templates/:slug",
        lazy: lazyPage(() => import("./pages/LandingPage")),
        loader: templateArticleLoader,
      },
      {
        path: "/landing-pages",
        lazy: lazyPage(() => import("./pages/LandingPages")),
        loader: landingPagesLoader,
      },
      {
        path: "/landing-pages/workshops",
        lazy: lazyPage(() => import("./pages/LandingPageHub")),
        loader: (args) => landingPageHubLoader(args, 'workshops'),
      },
      {
        path: "/landing-pages/events",
        lazy: lazyPage(() => import("./pages/LandingPageHub")),
        loader: (args) => landingPageHubLoader(args, 'events'),
      },
      {
        path: "/landing-pages/feiern-feste",
        lazy: lazyPage(() => import("./pages/LandingPageHub")),
        loader: (args) => landingPageHubLoader(args, 'feiern-feste'),
      },
      {
        path: "/landing-pages/bildung-unterricht",
        lazy: lazyPage(() => import("./pages/LandingPageHub")),
        loader: (args) => landingPageHubLoader(args, 'bildung-unterricht'),
      },
      {
        path: "/404",
        lazy: lazyPage(() => import("./pages/NotFound")),
      },
      {
        path: "/:slug",
        lazy: lazyPage(() => import("./pages/LandingPage")),
        loader: landingPageLoader,
      },

      // ── EN routes (/en prefix) ────────────────────────────────────────────
      {
        path: "/en",
        lazy: lazyPage(() => import("./pages/Index")),
        loader: homePageLoader,
      },
      {
        path: "/en/blog",
        lazy: lazyPage(() => import("./pages/Blog")),
        loader: blogIndexLoader,
      },
      {
        path: "/en/blog/workshop-methods",
        lazy: lazyPage(() => import("./pages/BlogCategory")),
        loader: (args) => blogCategoryLoader(args, 'workshop-methods'),
      },
      {
        path: "/en/blog/sessionplan-news",
        lazy: lazyPage(() => import("./pages/BlogCategory")),
        loader: (args) => blogCategoryLoader(args, 'sessionplan-news'),
      },
      {
        path: "/en/blog/tool-tips",
        lazy: lazyPage(() => import("./pages/BlogCategory")),
        loader: (args) => blogCategoryLoader(args, 'tool-tips'),
      },
      {
        path: "/en/blog/ai-in-workshops",
        lazy: lazyPage(() => import("./pages/BlogCategory")),
        loader: (args) => blogCategoryLoader(args, 'ai-in-workshops'),
      },
      {
        path: "/en/blog/:slug",
        lazy: lazyPage(() => import("./pages/BlogArticle")),
        loader: blogArticleLoader,
      },
      {
        path: "/en/templates",
        lazy: lazyPage(() => import("./pages/Templates")),
        loader: templatesIndexLoader,
      },
      {
        path: "/en/templates/retrospective",
        lazy: lazyPage(() => import("./pages/TemplateCategory")),
        loader: (args) => templateCategoryLoader(args, 'retrospective'),
      },
      {
        path: "/en/templates/liberating-structures",
        lazy: lazyPage(() => import("./pages/TemplateCategory")),
        loader: (args) => templateCategoryLoader(args, 'liberating-structures'),
      },
      {
        path: "/en/templates/workshop",
        lazy: lazyPage(() => import("./pages/TemplateCategory")),
        loader: (args) => templateCategoryLoader(args, 'workshop'),
      },
      {
        path: "/en/templates/decision",
        lazy: lazyPage(() => import("./pages/TemplateCategory")),
        loader: (args) => templateCategoryLoader(args, 'decision'),
      },
      {
        path: "/en/templates/:slug",
        lazy: lazyPage(() => import("./pages/LandingPage")),
        loader: templateArticleLoader,
      },
      {
        path: "/en/landing-pages",
        lazy: lazyPage(() => import("./pages/LandingPages")),
        loader: landingPagesLoader,
      },
      {
        path: "/en/landing-pages/workshops",
        lazy: lazyPage(() => import("./pages/LandingPageHub")),
        loader: (args) => landingPageHubLoader(args, 'workshops'),
      },
      {
        path: "/en/landing-pages/events",
        lazy: lazyPage(() => import("./pages/LandingPageHub")),
        loader: (args) => landingPageHubLoader(args, 'events'),
      },
      {
        path: "/en/landing-pages/creative-production",
        lazy: lazyPage(() => import("./pages/LandingPageHub")),
        loader: (args) => landingPageHubLoader(args, 'creative-production'),
      },
      {
        path: "/en/:slug",
        lazy: lazyPage(() => import("./pages/LandingPage")),
        loader: landingPageLoader,
      },

      // ── Fallback ──────────────────────────────────────────────────────────
      {
        path: "*",
        lazy: lazyPage(() => import("./pages/NotFound")),
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
