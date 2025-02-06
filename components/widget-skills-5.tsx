export default function WidgetSkills() {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800  odd:-rotate-1 even:rotate-1 hover:rotate-0 transition-transform duration-700 hover:duration-100 ease-in-out p-5">
      <div className="font-aspekta font-[650] mb-3">Monitoring & Logging</div>
      <ul className="space-y-3">
       

        <li className="flex justify-between items-center">
          <div className="grow inline-flex mr-1 truncate">
            <span className="text-indigo-500 mr-2">—</span> <a className="font-aspekta font-[650] text-sm truncate">Elasticsearch</a>
          </div>
          <div className="shrink-0 relative w-20 h-1.5 bg-slate-200 dark:bg-slate-700 before:absolute before:inset-0 before:bg-indigo-500 before:w-[63%]" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}></div>
        </li>

        <li className="flex justify-between items-center">
          <div className="grow inline-flex mr-1 truncate">
            <span className="text-indigo-500 mr-2">—</span> <a className="font-aspekta font-[650] text-sm truncate">Kibana</a>
          </div>
          <div className="shrink-0 relative w-20 h-1.5 bg-slate-200 dark:bg-slate-700 before:absolute before:inset-0 before:bg-indigo-500 before:w-[70%]" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}></div>
        </li>

        <li className="flex justify-between items-center">
          <div className="grow inline-flex mr-1 truncate">
            <span className="text-indigo-500 mr-2">—</span> <a className="font-aspekta font-[650] text-sm truncate">Dotcom</a>
          </div>
          <div className="shrink-0 relative w-20 h-1.5 bg-slate-200 dark:bg-slate-700 before:absolute before:inset-0 before:bg-indigo-500 before:w-[90%]" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}></div>
        </li>

        <li className="flex justify-between items-center">
          <div className="grow inline-flex mr-1 truncate">
            <span className="text-indigo-500 mr-2">—</span> <a className="font-aspekta font-[650] text-sm truncate">Grafana</a>
          </div>
          <div className="shrink-0 relative w-20 h-1.5 bg-slate-200 dark:bg-slate-700 before:absolute before:inset-0 before:bg-indigo-500 before:w-[70%]" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}></div>
        </li>

      </ul>
    </div>
  )
}