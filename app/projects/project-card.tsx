'use client';

import Link from 'next/link';
import Image, { StaticImageData } from 'next/image';

interface Item {
  id: number;
  icon: StaticImageData;
  slug: string;
  title: string;
  excerpt: string;
  openSource?: boolean;
}

interface ItemProps {
  item: Item;
  onClick?: () => void;
}

export default function ProjectCard({ item, onClick }: ItemProps) {
  const isExternal = item.slug.startsWith("https://");

  return (
    <Link
     href={item.slug}
  target={isExternal ? "_blank" : undefined}
  rel={isExternal ? "noopener noreferrer" : undefined}
  onClick={onClick}
      className="rounded-lg dark:hover:border-indigo-700 transition-color ease-in-out p-5 group dark:bg-brand-900 bg-white shadow-lg hover:shadow-lg dark:hover:shadow-indigo-800"
    >
      <div className="flex flex-col h-full">
        <div className="grow">
          <div className="flex items-center justify-between space-x-2">
            <div className="h-10 w-10 flex items-center justify-center border border-indigo-300 dark:border-indigo-700 rounded-full mb-2">
              <Image src={item.icon} width={30} alt={item.title} />
            </div>
            {item.openSource && (
              <div className="text-xs inline-flex items-center font-medium bg-green-100 text-green-600 rounded-full text-center px-2 h-5">
                Open-Source
              </div>
            )}
          </div>
          <div className="text-lg font-aspekta font-[650] mb-1">{item.title}</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{item.excerpt}</p>
        </div>
        <div className="text-indigo-500 flex justify-end">
          <svg
            className="fill-current -rotate-45 group-hover:rotate-0 transition-transform ease-out"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="12"
          >
            <path d="M9.586 5 6.293 1.707 7.707.293 13.414 6l-5.707 5.707-1.414-1.414L9.586 7H0V5h9.586Z" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
