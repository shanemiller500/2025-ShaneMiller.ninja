import Image from 'next/image'
import ApplyPro from '@/public/images/applyprologo.png'
import UMail from '@/public/images/umailLogo.png'
import spgi from '@/public/images/sp-global-seeklogo.png'
import DCI from '@/public/images/DCI.jpg'

export default function Experience() {
  return (
    <div className="space-y-8">
      <h2 className="h3 font-aspekta text-slate-800 dark:text-slate-100">Experience</h2>
      <ul className="space-y-8">


        {/* Item - Data Center Inc. */}
          <li className="relative group">
            <div className="flex items-start before:absolute before:left-0 before:h-full before:w-px before:bg-white before:dark:bg-slate-800 before:self-start before:ml-[28px] before:-translate-x-1/2 before:translate-y-8 before:group-last-of-type:hidden">
              <div className="absolute left-0 h-14 w-14 flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white rounded-full">
                <Image
                  className="object-contain"
                  src={DCI}
                  alt="Data Center Inc. Logo"
                  width={46}
                  height={46}
                />
              </div>
              <div className="pl-20 space-y-1">
                <div className="text-xs text-slate-500 uppercase">
                  April 2025 <span className="text-slate-400 dark:text-slate-600">·</span> Present
                </div>
                <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">
                  Senior Engineer Level II
                </div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  Data Center Inc. (Remote) — Hutchinson, KS
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                As Senior II Software Engineer on DCI's core product for community financial institutions, working in an Agile methodology with C# to design, implement, and optimize scalable features that power daily banking operations.
                </div>
              </div>
            </div>
          </li>

        {/* Item - ApplyPro.ai */}
        <li className="relative group">
          <div className="flex items-start before:absolute before:left-0 before:h-full before:w-px before:bg-white before:dark:bg-slate-800 before:self-start before:ml-[28px] before:-translate-x-1/2 before:translate-y-8 before:group-last-of-type:hidden">
            <div className="absolute left-0 h-14 w-14 flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white rounded-full">
              <Image 
                className="object-contain" 
                src={ApplyPro} 
                alt="ApplyPro Logo" 
                width={46} 
                height={46} 
              />
            </div>
            <div className="pl-20 space-y-1">
              <div className="text-xs text-slate-500 uppercase">
                September 2024 <span className="text-slate-400 dark:text-slate-600">·</span> Present
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">Founder</div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">ApplyPro.ai — Boulder, CO</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Launched a Next.js-based resume builder with SSR, real-time validations, and Tailwind integration. Deployed on Vercel with Mixpanel & Stripe, scaling to 100+ active users.
              </div>
            </div>
          </div>
        </li>

        {/* Item - U-Mail.ai */}
        <li className="relative group">
          <div className="flex items-start before:absolute before:left-0 before:h-full before:w-px before:bg-white before:dark:bg-slate-800 before:self-start before:ml-[28px] before:-translate-x-1/2 before:translate-y-8 before:group-last-of-type:hidden">
            <div className="absolute left-0 h-14 w-14 flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white rounded-full">
            <Image 
                className="object-contain" 
                src={UMail} 
                alt="UMail Logo" 
                width={46} 
                height={46} 
              />
            </div>
            <div className="pl-20 space-y-1">
              <div className="text-xs text-slate-500 uppercase">
                April 2024 <span className="text-slate-400 dark:text-slate-600">·</span> Present
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">Founder</div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">U-Mail.ai — Boulder, CO</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Built an AI-powered email platform integrating Gmail & Firebase for real-time messaging. Created & implemented advanced voice-to-text, Google Meet & Zoom integrations, and secure OAuth with Node/Express APIs. Expanded into B2Bwith custom soulitions for specific industries. & businesses.
              </div>
            </div>
          </div>
        </li>

        {/* Item - S&P Global (Senior Software Engineer) */}
        <li className="relative group">
          <div className="flex items-start before:absolute before:left-0 before:h-full before:w-px before:bg-white before:dark:bg-slate-800 before:self-start before:ml-[28px] before:-translate-x-1/2 before:translate-y-8 before:group-last-of-type:hidden">
            <div className="absolute left-0 h-14 w-14 flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white rounded-full">
            <Image 
                className="object-contain" 
                src={spgi} 
                alt="S&P Global Logo" 
                width={47} 
                height={47} 
              />
            </div>
            <div className="pl-20 space-y-1">
              <div className="text-xs text-slate-500 uppercase">
                February 2018 <span className="text-slate-400 dark:text-slate-600">·</span> February 2024
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">Senior Software Engineer</div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">S&P Global — Boulder, CO</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Diagnosed and resolved complex full-stack issues, boosting system resilience and performance. Leveraged SAML, SSO, and OAuth to maintain robust security across hundreds of codebases.
              </div>
            </div>
          </div>
        </li>

        {/* Item - S&P Global (Web Developer, Client-Facing Team) */}
        <li className="relative group">
          <div className="flex items-start before:absolute before:left-0 before:h-full before:w-px before:bg-white before:dark:bg-slate-800 before:self-start before:ml-[28px] before:-translate-x-1/2 before:translate-y-8 before:group-last-of-type:hidden">
            <div className="absolute left-0 h-14 w-14 flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white rounded-full">
            <Image 
                className="object-contain" 
                src={spgi} 
                alt="ApplyPro Logo" 
                width={47} 
                height={47} 
              />
            </div>
            <div className="pl-20 space-y-1">
              <div className="text-xs text-slate-500 uppercase">
                August 2016 <span className="text-slate-400 dark:text-slate-600">·</span> February 2018
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">Web Developer, Client-Facing Team</div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">S&P Global — Boulder, CO</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Developed and maintained high-traffic, live-streaming financial apps. Collaborated with multinational clients, delivering tailored solutions for both new and legacy systems.
              </div>
            </div>
          </div>
        </li>

        {/* Item - S&P Global (Jr. Web Developer) */}
        <li className="relative group">
          <div className="flex items-start before:absolute before:left-0 before:h-full before:w-px before:bg-white before:dark:bg-slate-800 before:self-start before:ml-[28px] before:-translate-x-1/2 before:translate-y-8">
            <div className="absolute left-0 h-14 w-14 flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white rounded-full">
            <Image 
                className="object-contain" 
                src={spgi} 
                alt="ApplyPro Logo" 
                width={47} 
                height={47} 
              />
            </div>
            <div className="pl-20 space-y-1">
              <div className="text-xs text-slate-500 uppercase">
                November 2014 <span className="text-slate-400 dark:text-slate-600">·</span> August 2016
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">Jr. Web Developer</div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">S&P Global — Boulder, CO</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Managed multiple client projects, improving user experiences across 100+ platforms. Collaborated in a small team to enhance code quality and performance for diverse applications.
              </div>
            </div>
          </div>
        </li>

      </ul>
    </div>
  )
}
