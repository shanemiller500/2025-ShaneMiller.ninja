"use client";

import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface LinkCardProps {
  link: {
    url: string;
    title: string;
    snippet?: string;
    thumbnail?: string | null;
  };
  index?: number;
}

/* ------------------------------------------------------------------ */
/*  LinkCard Component                                                 */
/* ------------------------------------------------------------------ */
export default function LinkCard({ link, index }: LinkCardProps) {
  const domain = new URL(link.url).hostname.replace("www.", "");

  return (
    <article className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors group">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent("Link Click", { url: link.url })}
        className="block"
      >
        {/* Thumbnail */}
        {link.thumbnail && (
          <div className="relative h-32 overflow-hidden bg-neutral-200 dark:bg-neutral-800">
            <img
              src={link.thumbnail}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {/* Number + Domain */}
          <div className="flex items-center gap-3 mb-2">
            {index && (
              <span className="text-2xl font-black text-red-600 dark:text-red-400" style={{ fontFamily: '"Playfair Display", serif' }}>
                {index}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 dark:text-neutral-400 truncate">
                {domain}
              </p>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-sm font-bold leading-snug mb-2 line-clamp-2 text-neutral-900 dark:text-neutral-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
            {link.title}
          </h3>

          {/* Snippet */}
          {link.snippet && (
            <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400 line-clamp-3" style={{ fontFamily: '"Merriweather", serif' }}>
              {link.snippet}
            </p>
          )}
        </div>
      </a>
    </article>
  );
}