import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { I18nProvider } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NutrIA – AI Nutrition Assistant" },
      { name: "description", content: "Science-based nutrition answers powered by PubMed research and AI." },
      { name: "author", content: "NutrIA" },
      { property: "og:title", content: "NutrIA – AI Nutrition Assistant" },
      { property: "og:description", content: "Science-based nutrition answers powered by PubMed research and AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "NutrIA – AI Nutrition Assistant" },
      { name: "twitter:description", content: "Science-based nutrition answers powered by PubMed research and AI." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/97660e7f-ce67-44be-acab-cd5dc473dcce/id-preview-b5558d72--97d4ca31-f972-49fe-8d63-d80142c24875.lovable.app-1778733117199.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/97660e7f-ce67-44be-acab-cd5dc473dcce/id-preview-b5558d72--97d4ca31-f972-49fe-8d63-d80142c24875.lovable.app-1778733117199.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
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
  return (
    <I18nProvider>
      <LanguageSwitcher />
      <Outlet />
    </I18nProvider>
  );
}
