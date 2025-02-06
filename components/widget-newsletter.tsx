import Image from 'next/image'


export default function WidgetNewsletter() {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-gradient-to-t dark:from-slate-800 dark:to-slate-800/30 odd:-rotate-1 even:rotate-1 hover:rotate-0 transition-transform duration-700 hover:duration-100 ease-in-out p-5">
      <div className="text-center mb-1">
        <div className="inline-flex -space-x-3 -ml-0.5">
       
        </div>
      </div>
      <div className="text-center mb-8">
        <div className="font-aspekta font-[650] mb-1">Never miss an update!</div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Subscribe and join 100K+ developers.</p>
      </div>
      <form>
        <div className="mb-2">
          <label className="sr-only" htmlFor="newsletter">
            Your email…
          </label>
          <input id="newsletter" type="email" className="form-input py-1 w-full" placeholder="Your email…" />
        </div>
        <button className="btn-sm w-full  text-slate-100 bg-sky-500 hover:bg-sky-600" type="submit">
          Subscribe
        </button>
      </form>
    </div>
  )
}