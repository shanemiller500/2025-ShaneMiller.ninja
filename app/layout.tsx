'use client';

import './css/style.css';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import Theme from './theme-provider';
import SideNavigation from '@/components/ui/side-navigation';
import Header from '@/components/ui/header';
import Footer from '@/components/ui/footer';
import { Analytics } from "@vercel/analytics/react";
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/utils/mixpanel';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID; 

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
});

const aspekta = localFont({
  src: [
    {
      path: '../public/fonts/Aspekta-500.woff2',
      weight: '500',
    },
    {
      path: '../public/fonts/Aspekta-650.woff2',
      weight: '650',
    },
  ],
  variable: '--font-aspekta',
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Track page views with Mixpanel on route change.
  useEffect(() => { 
    trackEvent('Page Viewed', { path: pathname }); 
  }, [pathname]);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag('config', GA_TRACKING_ID, {
        page_path: pathname,
      });
    }
  }, [pathname]);
  
  

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Analytics Setup */}
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
      <body className={`${inter.variable} ${aspekta.variable} font-inter antialiased bg-indigo-50 text-brand-700 dark:bg-brand-900 dark:text-slate-200 tracking-tight`}>
        <Theme>
          <div className="max-w-7xl mx-auto">
            <div className="min-h-screen flex">
              <SideNavigation />
              {/* Main content */}
              <main className="grow overflow-hidden px-6">
                <div className="w-full h-full max-w-[1072px] mx-auto flex flex-col">
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
