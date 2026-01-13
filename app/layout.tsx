"use client";

import "./css/style.css";
import Script from "next/script";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import Theme from "./theme-provider";
import SideNavigation from "@/components/ui/side-navigation";
import Header from "@/components/ui/header";
import Footer from "@/components/ui/footer";
import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState, Fragment } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/utils/mixpanel";
import ConsoleGreeting from "@/components/ConsoleGreeting";

import { Dialog, Transition } from "@headlessui/react";
import { Menu, X } from "lucide-react";

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const aspekta = localFont({
  src: [
    { path: "../public/fonts/Aspekta-500.woff2", weight: "500" },
    { path: "../public/fonts/Aspekta-650.woff2", weight: "650" },
  ],
  variable: "--font-aspekta",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // close drawer on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Mixpanel page view
  useEffect(() => {
    trackEvent("Page Viewed", { path: pathname });
  }, [pathname]);

  // GA page view
  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("config", GA_TRACKING_ID, { page_path: pathname });
    }
  }, [pathname]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <title>Shane Miller&apos;s Portfolio</title>
        <meta
          name="description"
          content="Welcome to shanemiller.ninja Portfolio."
        />
        <meta name="keywords" content="shanemiller, ninja, Portfolio," />
        <meta name="author" content="Shane Miller" />

        <meta property="og:title" content="shanemiller.ninja Website" />
        <meta
          property="og:description"
          content="Discover shanemiller.ninja Website."
        />
        <meta property="og:url" content="https://shanemiller.ninja" />
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="shanemiller.ninja Website" />
        <meta
          name="twitter:description"
          content="Discover shanemiller.ninja Website."
        />

        {GA_TRACKING_ID && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_TRACKING_ID}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
      </head>

      <body
        className={`${inter.variable} ${aspekta.variable} font-inter antialiased bg-indigo-50 text-brand-700 dark:bg-brand-900 dark:text-slate-200 tracking-tight`}
      >
        <Theme>
          <ConsoleGreeting />

          <div className="max-w-7xl mx-auto">
            <div className="min-h-screen flex">
              {/* Desktop sidebar */}
              <div className="hidden lg:block">
                <SideNavigation />
              </div>

              {/* Mobile sidebar drawer */}
              <Transition.Root show={mobileNavOpen} as={Fragment}>
                <Dialog
                  as="div"
                  className="relative z-50 lg:hidden"
                  onClose={setMobileNavOpen}
                >
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                  </Transition.Child>

                  <div className="fixed inset-0 flex">
                    <Transition.Child
                      as={Fragment}
                      enter="ease-out duration-250"
                      enterFrom="-translate-x-full"
                      enterTo="translate-x-0"
                      leave="ease-in duration-200"
                      leaveFrom="translate-x-0"
                      leaveTo="-translate-x-full"
                    >
                      <Dialog.Panel className="relative flex w-[86%] max-w-sm flex-col bg-white shadow-xl dark:bg-brand-900">
                        <div className="flex items-center justify-between px-4 py-4 border-b border-black/5 dark:border-white/10">
                          <div className="text-sm font-extrabold text-brand-900 dark:text-white">
                            Menu
                          </div>
                          <button
                            type="button"
                            onClick={() => setMobileNavOpen(false)}
                            className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white/70 p-2 text-brand-900 shadow-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white"
                            aria-label="Close menu"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>

                        {/* Your existing sidebar component */}
                        <div className="flex-1 overflow-y-auto overscroll-contain">
                          <SideNavigation />
                        </div>

                        <div className="px-4 py-3 border-t border-black/5 text-[11px] text-brand-600 dark:border-white/10 dark:text-brand-300">
                          Tap anywhere outside to close.
                        </div>
                      </Dialog.Panel>
                    </Transition.Child>
                  </div>
                </Dialog>
              </Transition.Root>

              {/* Main content */}
              <main className="grow overflow-hidden px-4 sm:px-6">
                <div className="w-full h-full max-w-[1072px] mx-auto flex flex-col">
                  {/* Mobile top bar (hamburger) */}
                  <div className="lg:hidden pt-4">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setMobileNavOpen(true)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-extrabold text-brand-900 shadow-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white"
                        aria-label="Open menu"
                      >
                        <Menu className="h-4 w-4" />
                        Menu
                      </button>

                      {/* optional: small brand / page label */}
                      <div className="text-[11px] font-semibold text-brand-600 dark:text-brand-300">
                        shanemiller.ninja
                      </div>
                    </div>
                  </div>

                  <Header />
                  {children}
                </div>
              </main>
            </div>
          </div>

          <Footer />
        </Theme>

        <Analytics />
      </body>
    </html>
  );
}
