import Image from 'next/image'

import EducationIcon01 from '@/public/images/ihs-markit-seeklogo.png'
import EducationIcon02 from '@/public/images/general-assembly-seeklogo.png'

export default function Education() {
  return (
    <div className="space-y-8">
      <h2 className="h3 font-aspekta text-slate-800 dark:text-slate-100">Education</h2>
      <ul className="space-y-8">

        {/* Item - IHS Markit / Dev-U */}
        <li className="relative group">
          <div className="flex items-start before:absolute before:left-0 before:h-full before:w-px before:bg-slate-200 before:dark:bg-slate-800 before:self-start before:ml-[28px] before:-translate-x-1/2 before:translate-y-8 before:group-last-of-type:hidden">
            <div className="absolute left-0 h-14 w-14 flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white  rounded-full">
              <Image src={EducationIcon01} width={50} height={50} alt="IHS Markit / Dev-U" />
            </div>
            <div className="pl-20 space-y-1">
              <div className="text-xs text-slate-500 uppercase">
                October 2014 <span className="text-slate-400 dark:text-slate-600">·</span> November 2014
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">
                Certificate in Mid-Tier Development
              </div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                IHS Markit / Dev-U — Boulder, CO
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Focused on HTML5, CSS, JavaScript, jQuery, C#, ASP.NET, and MVC frameworks to build robust, scalable mid-tier applications.
              </div>
            </div>
          </div>
        </li>

        {/* Item - General Assembly */}
        <li className="relative group">
          <div className="flex items-start before:absolute before:left-0 before:h-full before:w-px before:bg-slate-200 before:dark:bg-slate-800 before:self-start before:ml-[28px] before:-translate-x-1/2 before:translate-y-8 before:group-last-of-type:hidden">
            <div className="absolute left-0 h-14 w-14 flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white  rounded-full">
              <Image src={EducationIcon02} width={50} height={26} alt="General Assembly" />
            </div>
            <div className="pl-20 space-y-1">
              <div className="text-xs text-slate-500 uppercase">
                December 2013 <span className="text-slate-400 dark:text-slate-600">·</span> July 2014
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">
                Web Dev Immersive Course
              </div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                General Assembly — San Francisco, CA
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Comprehensive training in full-stack Ruby on Rails development, advanced HTML5/CSS3, JavaScript, jQuery, and API integrations.
              </div>
            </div>
          </div>
        </li>

      </ul>
    </div>
  )
}
