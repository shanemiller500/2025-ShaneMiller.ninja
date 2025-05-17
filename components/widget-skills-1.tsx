export default function WidgetSkills() {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 odd:-rotate-1 even:rotate-1 hover:rotate-0 transition-transform duration-700 hover:duration-100 ease-in-out p-5">
      <div className="font-aspekta font-[650] mb-3">Programming Skills</div>
      <ul className="space-y-3">
        <li className="flex justify-between items-center">
          <div className="grow inline-flex mr-1 truncate">
            <span className="text-indigo-500 mr-2">—</span>
            <a className="font-aspekta font-[650] text-sm truncate">JavaScript</a>
          </div>
          <div
            className="shrink-0 relative w-20 h-1.5 bg-slate-200 dark:bg-slate-700 before:absolute before:inset-0 before:bg-gradient-to-r from-indigo-500 to-purple-500 before:w-[80%]"
            role="progressbar"
            aria-valuenow={100}
            aria-valuemin={0}
            aria-valuemax={100}
          ></div>
        </li>

        <li className="flex justify-between items-center">
          <div className="grow inline-flex mr-1 truncate">
            <span className="text-indigo-500 mr-2">—</span>
            <a className="font-aspekta font-[650] text-sm truncate">TypeScript</a>
          </div>
          <div
            className="shrink-0 relative w-20 h-1.5 bg-slate-200 dark:bg-slate-700 before:absolute before:inset-0 before:bg-gradient-to-r from-indigo-500 to-purple-500 before:w-[80%]"
            role="progressbar"
            aria-valuenow={100}
            aria-valuemin={0}
            aria-valuemax={100}
          ></div>
        </li>

        <li className="flex justify-between items-center">
          <div className="grow inline-flex mr-1 truncate">
            <span className="text-indigo-500 mr-2">—</span>
            <a className="font-aspekta font-[650] text-sm truncate">C# / .NET</a>
          </div>
          <div
            className="shrink-0 relative w-20 h-1.5 bg-slate-200 dark:bg-slate-700 before:absolute before:inset-0 before:bg-gradient-to-r from-indigo-500 to-purple-500 before:w-[65%]"
            role="progressbar"
            aria-valuenow={100}
            aria-valuemin={0}
            aria-valuemax={100}
          ></div>
        </li>

        <li className="flex justify-between items-center">
          <div className="grow inline-flex mr-1 truncate">
            <span className="text-indigo-500 mr-2">—</span>
            <a className="font-aspekta font-[650] text-sm truncate">Ruby on Rails</a>
          </div>
          <div
            className="shrink-0 relative w-20 h-1.5 bg-slate-200 dark:bg-slate-700 before:absolute before:inset-0 before:bg-gradient-to-r from-indigo-500 to-purple-500 before:w-[40%]"
            role="progressbar"
            aria-valuenow={100}
            aria-valuemin={0}
            aria-valuemax={100}
          ></div>
        </li>

       
      </ul>
    </div>
  );
}
