'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import HeroImage from '@/public/images/wedding.jpg';
import { trackEvent } from '@/utils/mixpanel';

export default function SideNavigation() {
  const pathname = usePathname();

  // Helper function to track a click event
  const handleNavClick = (label: string, route: string) => {
    trackEvent('Navigation Clicked', { label, route });
  };

  return (
    <div className="sticky top-0 w-16 md:w-24 shrink-0 h-screen overflow-y-auto no-scrollbar border-r border-slate-200 dark:border-slate-800">
      <div className="h-full flex flex-col justify-between after:flex-1 after:mt-auto">
        <div className="flex-1">
          {pathname !== '/' && (
            <div className="flex justify-center my-4">
              <Link href="/" onClick={() => handleNavClick('Home Avatar', '/')}>
                <Image
                  className="rounded-full"
                  src={HeroImage}
                  width={32}
                  height={32}
                  priority
                  alt="Me"
                />
              </Link>
            </div>
          )}
        </div>
        <div className="flex-1 grow flex items-center">
          <nav className="w-full">
            <ul className="space-y-4">
              <li className="py-2">
                <Link
                  href="/"
                  onClick={() => handleNavClick('Home', '/')}
                  className={`w-full h-6 flex items-center justify-center relative after:absolute after:w-0.5 after:right-0 after:top-0 after:bottom-0 ${
                    pathname !== '/about' &&
                    pathname !== '/contact' &&
                    pathname !== '/projects' &&
                    pathname !== '/resume' &&
                    pathname !== '/Bored' &&
                    pathname !== '/Marvel' &&
                    pathname !== '/stocks' &&
                    pathname !== '/Country' &&
                    pathname !== '/Crypto' &&
                    pathname !== '/ISS' &&
                    pathname !== '/Art' &&
                    pathname !== '/Vibroacoustics' &&
                    pathname !== '/Spacex' &&
                    pathname !== '/news' &&
                    pathname !== '/search' &&
                    pathname !== '/results' &&
                    pathname !== '/Weather' &&
                    pathname !== '/NASA'  &&
                    pathname !== '/PrettyPrint'
                      ? 'text-indigo-500 after:bg-gradient-to-r from-indigo-500 to-purple-500'
                      : 'text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400'
                  }`}
                >
                  <span className="sr-only">Home</span>
                  <svg className="fill-current" xmlns="http://www.w3.org/2000/svg" width="21" height="19">
                    <path fillOpacity=".16" d="M4 7v11h13V7l-6.5-5z" />
                    <path d="m10.433 3.242-8.837 6.56L.404 8.198l10.02-7.44L20.59 8.194l-1.18 1.614-8.977-6.565ZM16 17V9h2v10H3V9h2v8h11Z" />
                  </svg>
                </Link>
              </li>

              <li className="py-2">
                <Link
                  href="/projects"
                  onClick={() => handleNavClick('Projects', '/projects')}
                  className={`w-full h-6 flex items-center justify-center relative after:absolute after:w-0.5 after:right-0 after:top-0 after:bottom-0 ${
                    pathname === '/projects' ||
                    pathname === '/Marvel' ||
                    pathname === '/stocks' ||
                    pathname === '/Country' ||
                    pathname === '/Crypto' ||
                    pathname === '/Bored' ||
                    pathname === '/ISS' ||
                    pathname === '/Art' ||
                    pathname === '/Vibroacoustics' ||
                    pathname === '/Spacex' ||
                    pathname === '/news' ||
                    pathname === '/search' ||
                    pathname === '/results' ||
                    pathname === '/Weather' ||
                    pathname === '/NASA' ||
                    pathname === '/PrettyPrint'
                      ? 'text-indigo-500 after:bg-gradient-to-r from-indigo-500 to-purple-500'
                      : 'text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400'
                  }`}
                >
                  <span className="sr-only">Projects</span>
                  <svg className="fill-current" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                    <path fillOpacity=".16" d="M1 4h18v10H1z" />
                    <path d="M8 3h4V2H8v1ZM6 3V0h8v3h6v12H0V3h6ZM2 5v8h16V5H2Zm14 13v-2h2v4H2v-4h2v2h12Z" />
                  </svg>
                </Link>
              </li>

              <li className="py-2">
                <Link
                  href="/resume"
                  onClick={() => handleNavClick('Resume', '/resume')}
                  className={`w-full h-6 flex items-center justify-center relative after:absolute after:w-0.5 after:right-0 after:top-0 after:bottom-0 ${
                    pathname === '/resume'
                      ? 'text-indigo-500 after:bg-gradient-to-r from-indigo-500 to-purple-500'
                      : 'text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400'
                  }`}
                >
                  <span className="sr-only">Resume</span>
                  <svg className="fill-current" xmlns="http://www.w3.org/2000/svg" width="18" height="20">
                    <path fillOpacity=".16" fillRule="nonzero" d="M1 5h16v14H1z" />
                    <path fillRule="nonzero" d="M2 6v12h14V6H2Zm16-2v16H0V4h18ZM2 2V0h14v2H2Z" />
                  </svg>
                </Link>
              </li>

              <li className="py-2">
                <Link
                  href="/contact"
                  onClick={() => handleNavClick('Contact', '/contact')}
                  className={`w-full h-6 flex items-center justify-center relative after:absolute after:w-0.5 after:right-0 after:top-0 after:bottom-0 ${
                    pathname === '/contact'
                      ? 'text-indigo-500 after:bg-gradient-to-r from-indigo-500 to-purple-500'
                      : 'text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400'
                  }`}
                >
                  <span className="sr-only">Contact</span>
                  <svg className="fill-current" xmlns="http://www.w3.org/2000/svg" width="21" height="21">
                    <path fillOpacity=".16" d="m13.4 18-3-7.4-7.4-3L19 2z" />
                    <path d="M13.331 15.169 17.37 3.63 5.831 7.669l5.337 2.163 2.163 5.337Zm-3.699-3.801L.17 7.53 20.63.37l-7.161 20.461-3.837-9.463Z" />
                  </svg>
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
