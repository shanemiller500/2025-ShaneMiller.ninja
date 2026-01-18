"use client";

import Link from "next/link";
import Image, { StaticImageData } from "next/image";

interface Item {
  id: number;
  icon: StaticImageData;
  slug: string;
  title: string;
  excerpt: string;
  openSource?: boolean;
  badge?: string;
}

interface ItemProps {
  item: Item;
  onClick?: () => void;
}

export default function ProjectCard({ item, onClick }: ItemProps) {
  const isExternal = /^https?:\/\//i.test(item.slug);

  return (
    <Link
      href={item.slug}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      onClick={onClick}
      className={[
        "group relative block h-full rounded-3xl",
        "border border-black/10 bg-white shadow-sm",
        "transition-all duration-200",
        "hover:-translate-y-[1px] hover:shadow-md hover:border-black/20",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
        "dark:border-white/10 dark:bg-brand-900/50 dark:hover:border-white/20 dark:focus-visible:ring-offset-brand-900",
      ].join(" ")}
    >
      <div className="relative flex h-full flex-col p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-black/10 dark:ring-white/10 bg-slate-100">
              <Image
                src={item.icon}
                width={28}
                height={28}
                alt={item.title}
                className="h-7 w-7 object-contain"
              />
            </div>

            <div className="min-w-0">
              <div className="truncate text-base font-extrabold text-gray-900 dark:text-white">
                {item.title}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2">
                {item.openSource && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-200">
                    Open Source
                  </span>
                )}

                {item.badge && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-extrabold text-gray-700 ring-1 ring-black/10 dark:text-white/70 dark:ring-white/10">
                    {item.badge}
                  </span>
                )}

                {isExternal && (
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-extrabold text-gray-700 ring-1 ring-black/10 dark:bg-white/10 dark:text-white/70 dark:ring-white/10">
                    External
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* arrow */}
          <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl bg-black/[0.03] ring-1 ring-black/10 transition group-hover:bg-black/[0.06] dark:bg-white/[0.06] dark:ring-white/10 dark:group-hover:bg-white/[0.10]">
            <svg
              className="h-4 w-4 -rotate-45 fill-current text-gray-700 transition-transform duration-200 group-hover:rotate-0 dark:text-white/80"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 14 12"
            >
              <path d="M9.586 5 6.293 1.707 7.707.293 13.414 6l-5.707 5.707-1.414-1.414L9.586 7H0V5h9.586Z" />
            </svg>
          </div>
        </div>

        {/* Body */}
        <p className="mt-4 line-clamp-3 text-sm text-gray-600 dark:text-white/60">
          {item.excerpt}
        </p>

      </div>
    </Link>
  );
}
