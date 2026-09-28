import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'

import resumeContent from '@/app/resume/content.json'

const SOCIALS = [
  { label: 'GitHub', href: 'https://github.com/shanemiller500' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/shane-miller-ninja/' },
]

export default function Hero() {
  return (
    <section className="pt-10 pb-4 md:pt-14">
      <div className="max-w-[720px]">
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Hello World
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Boulder, Colorado
          </span>
        </div>

        <h1 className="font-aspekta text-4xl font-[650] tracking-tight text-slate-900 dark:text-white md:text-5xl">
          I&apos;m Shane Miller.
        </h1>
        <p className="mt-3 font-aspekta text-xl text-slate-500 dark:text-slate-400 md:text-2xl">
          {resumeContent.headline}
        </p>

        <p className="mt-6 max-w-[620px] text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          I turn messy real-world workflows into software that holds up: deterministic tools,
          human-in-the-loop AI, and the data plumbing underneath. I have more than 12 years in
          production systems, from financial data platforms to core banking.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/projects"
            className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-600 dark:bg-white dark:text-slate-900 dark:hover:bg-indigo-300"
          >
            View projects
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/resume"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-white/20"
          >
            Resume
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center px-2 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
          >
            Get in touch
          </Link>

          <span className="mx-1 hidden h-4 w-px bg-slate-200 dark:bg-white/10 sm:block" />

          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
