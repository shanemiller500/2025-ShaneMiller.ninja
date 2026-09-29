"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { FileText, House, LayoutGrid, Send, type LucideIcon } from "lucide-react";
import HeroImage from "@/public/images/wedding.jpg";
import { trackEvent } from "@/utils/mixpanel";

type Section = "home" | "projects" | "resume" | "contact";

const ITEMS: { key: Section; label: string; hint: string; href: string; icon: LucideIcon }[] = [
  { key: "home", label: "Home", hint: "~/", href: "/", icon: House },
  { key: "projects", label: "Projects", hint: "~/projects", href: "/projects", icon: LayoutGrid },
  { key: "resume", label: "Resume", hint: "~/resume", href: "/resume", icon: FileText },
  { key: "contact", label: "Contact", hint: "~/contact", href: "/contact", icon: Send },
];

// Home, resume, contact and about have their own routes; every other page is a project,
// so new projects light up "Projects" without being listed here.
function sectionFor(pathname: string): Section | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/resume")) return "resume";
  if (pathname.startsWith("/contact")) return "contact";
  if (pathname.startsWith("/about")) return null;
  return "projects";
}

export default function SideNavigation() {
  const pathname = usePathname();
  const active = sectionFor(pathname || "/");

  return (
    <div className="sticky top-0 h-screen w-56 shrink-0 overflow-y-auto border-r border-slate-200/70 bg-slate-50/80 backdrop-blur-xl no-scrollbar dark:border-white/[0.06] dark:bg-brand-900/80 sm:w-48 md:w-24 md:overflow-visible">
      <div className="flex h-full flex-col">
        {/* Avatar with an "online" dot */}
        <div className="hidden justify-center pt-5 md:flex">
          <Link href="/" onClick={() => trackEvent("Navigation Clicked", { label: "Home Avatar", route: "/" })} aria-label="Home" className="group relative">
            <span aria-hidden className="absolute -inset-1 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-rose-400 opacity-60 blur-[6px] transition group-hover:opacity-90" />
            <Image className="relative rounded-full ring-2 ring-white dark:ring-brand-900" src={HeroImage} width={44} height={44} priority alt="Shane Miller" />
            <span className="absolute bottom-0 right-0 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-brand-900" />
            </span>
          </Link>
        </div>

        <nav className="flex flex-1 items-center" aria-label="Main">
          <ul className="w-full space-y-1.5 px-3 md:space-y-3">
            {ITEMS.map(({ key, label, hint, href, icon: Icon }) => {
              const isActive = active === key;
              return (
                <li key={key} className="relative">
                  <Link
                    href={href}
                    onClick={() => trackEvent("Navigation Clicked", { label, route: href })}
                    aria-current={isActive ? "page" : undefined}
                    className={`group relative flex h-12 items-center gap-3 rounded-2xl px-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500/60 md:justify-center md:px-0 ${
                      isActive ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    {/* Sliding highlight behind the active item */}
                    {isActive && (
                      <motion.span layoutId="sideNavActive" className="absolute inset-0 rounded-2xl bg-slate-900/[0.04] ring-1 ring-slate-900/10 dark:bg-white/[0.06] dark:ring-white/10"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                    )}
                    <span
                      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                        isActive
                          ? "bg-indigo-500 text-white shadow-[0_0_18px_-2px_rgba(99,102,241,0.6)]"
                          : "bg-white text-slate-400 ring-1 ring-slate-200/80 group-hover:text-indigo-500 group-hover:ring-indigo-300 dark:bg-white/[0.04] dark:text-slate-500 dark:ring-white/10 dark:group-hover:text-indigo-300"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                    </span>

                    {/* Label: inline in the mobile drawer, a tooltip on the desktop rail */}
                    <span className="relative min-w-0 leading-tight md:hidden">
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{hint}</span>
                    </span>
                    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white opacity-0 shadow-lg transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 dark:bg-white dark:text-slate-900 md:block">
                      {label}
                    </span>

                    {/* Edge indicator on the rail */}
                    {isActive && (
                      <motion.span layoutId="sideNavEdge" aria-hidden className="absolute -right-3 top-2 bottom-2 hidden w-0.5 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500 shadow-[0_0_10px_rgba(99,102,241,0.8)] md:block"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden pb-5 text-center font-mono text-[9px] uppercase tracking-widest text-slate-300 dark:text-slate-600 md:block">
          SM · 26
        </div>
      </div>
    </div>
  );
}
