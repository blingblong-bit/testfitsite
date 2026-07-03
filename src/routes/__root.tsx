import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import faviconIco from "../assets/favicon.ico.asset.json";
import favicon16 from "../assets/favicon-16x16.png.asset.json";
import favicon32 from "../assets/favicon-32x32.png.asset.json";
import appleTouchIcon from "../assets/apple-touch-icon.png.asset.json";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FIT Beyond Plus | Gym, Training & Classes | Tullahoma, TN |" },
      { name: "description", content: "Join FIT Beyond Plus in Tullahoma, TN for 24/7 gym access, group fitness classes, personal training, and athlete performance training. Tour the gym today." },
      { name: "author", content: "FIT Beyond Plus" },
      { property: "og:title", content: "FIT Beyond Plus | Gym, Training & Classes | Tullahoma, TN |" },
      { property: "og:description", content: "Join FIT Beyond Plus in Tullahoma, TN for 24/7 gym access, group fitness classes, personal training, and athlete performance training. Tour the gym today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "FIT Beyond Plus | Gym, Training & Classes | Tullahoma, TN |" },
      { name: "twitter:description", content: "Join FIT Beyond Plus in Tullahoma, TN for 24/7 gym access, group fitness classes, personal training, and athlete performance training. Tour the gym today." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/jqENWZ4ZZDRMrCPTaFQeFYFDY1p1/social-images/social-1783057769508-ChatGPT_Image_Jul_3,_2026,_12_27_42_AM.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/jqENWZ4ZZDRMrCPTaFQeFYFDY1p1/social-images/social-1783057769508-ChatGPT_Image_Jul_3,_2026,_12_27_42_AM.webp" },
      { name: "google-site-verification", content: "LkNAj6QnBq0j7hICS65jW6dsrBr9_VQmafJKu6Vl2RU" },
    ],
    links: [
      { rel: "icon", type: "image/png", sizes: "16x16", href: favicon16.url },
      { rel: "icon", type: "image/png", sizes: "32x32", href: favicon32.url },
      { rel: "icon", type: "image/x-icon", href: faviconIco.url },
      { rel: "apple-touch-icon", sizes: "180x180", href: appleTouchIcon.url },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Oswald:wght@500;600;700&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": "https://fitbeyondplus.com/#organization",
          name: "FIT Beyond Plus",
          url: "https://fitbeyondplus.com",
          logo: "https://storage.googleapis.com/gpt-engineer-file-uploads/jqENWZ4ZZDRMrCPTaFQeFYFDY1p1/social-images/social-1781665667447-logo.webp",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </QueryClientProvider>
  );
}
