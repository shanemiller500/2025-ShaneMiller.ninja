import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'

import resumeContent from '@/app/resume/content.json'

const SOCIALS = [
  { label: 'GitHub', href: 'https://github.com/shanemiller500' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/shane-miller-ninja/' },
]

export default function Hero() {
  return (
    <section className="relative isolate pt-10 pb-4 md:pt-14">
      {/* Backdrop: fine grid squares + soft aurora, same as the dashboards */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-[460px] text-slate-300/70 dark:text-white/[0.07] [mask-image:radial-gradient(ellipse_at_top_left,black_30%,transparent_70%)]"
        style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '36px 36px' }}
      />
      <div aria-hidden className="pointer-events-none absolute -top-20 left-0 -z-10 h-72 w-[40rem] max-w-full rounded-full bg-gradient-to-r from-emerald-300/20 via-indigo-300/25 to-rose-300/20 blur-3xl dark:from-emerald-500/10 dark:via-indigo-500/15 dark:to-rose-500/10" />
      <div className="max-w-[720px]">
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs">
          <span className="text-indigo-500 dark:text-indigo-300">~/</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Hello world
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <MapPin className="h-3 w-3" />
            Boulder, Colorado
          </span>
        </div>

        <h1 className="font-aspekta text-4xl font-[650] tracking-tight text-slate-900 dark:text-white md:text-5xl">
          I&apos;m <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-rose-400 bg-clip-text text-transparent">Shane Miller.</span>
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
            className="group inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_-4px_rgba(99,102,241,0.7)] transition hover:bg-indigo-600"
          >
            View projects
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/resume"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white/80 px-5 py-2.5 text-sm font-semibold text-slate-700 backdrop-blur transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-indigo-400/40 dark:hover:text-indigo-300"
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
              className="font-mono text-xs text-slate-400 transition-colors hover:text-indigo-600 dark:hover:text-indigo-300"
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
