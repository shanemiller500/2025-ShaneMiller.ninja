import Image from 'next/image'
import ApplyPro from '@/public/images/applyprologo.png'
import UMail from '@/public/images/umailLogo.png'
import spgi from '@/public/images/sp-global-seeklogo.png'
import DCI from '@/public/images/DCI.jpg'

const Tag = ({ label }: { label: string }) => (
  <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
    {label}
  </span>
)

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
            <div className="pl-20 space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">
                April 2025 <span className="text-slate-400 dark:text-slate-600">·</span> Present
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">
                Senior Engineer Level II
              </div>
              <div className="text-sm font-medium text-indigo-500 dark:text-indigo-400">
                Data Center Inc. — Remote
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Full-stack engineer on a .NET core banking platform under strict SLAs. Ships features across ACH processing, batch systems, reconciliation pipelines, and reporting. Resolves live production incidents, drives performance via SCA scans, and delivers hardened releases in a compliance-driven environment.
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['C#', '.NET Framework', '.NET Core', 'SQL Server', 'ASP.NET MVC', 'ASP.NET WebForms', 'Stored Procedures', 'ACH Processing', 'Batch Systems', 'Reconciliation Pipelines', 'Transaction Flows', 'Reporting Layers', 'REST APIs', 'Telerik', 'Windows Server', 'SCA / Code Analysis', 'Agile'].map(t => <Tag key={t} label={t} />)}
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
            <div className="pl-20 space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">
                September 2024 <span className="text-slate-400 dark:text-slate-600">·</span> Present
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">
                Founder &amp; Lead Engineer
              </div>
              <div className="text-sm font-medium text-indigo-500 dark:text-indigo-400">
                ApplyPro.ai — Boulder, CO
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Solo-built an AI-powered resume platform — owning every layer from SSR Next.js frontend to API routes, payments, and CI/CD. Integrated Stripe subscriptions and Mixpanel analytics. Scaled to <span className="font-semibold text-slate-600 dark:text-slate-300">400+ active users</span> through rapid, data-driven iteration.
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Next.js', 'App Router', 'SSR', 'React', 'TypeScript', 'Node.js', 'PostgreSQL', 'REST APIs', 'AI Integration', 'Document Processing', 'Stripe', 'Subscription Billing', 'Mixpanel', 'Tailwind CSS', 'Component Architecture', 'Vercel', 'CI/CD'].map(t => <Tag key={t} label={t} />)}
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
            <div className="pl-20 space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">
                April 2024 <span className="text-slate-400 dark:text-slate-600">·</span> Present
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">
                Founder &amp; Lead Engineer
              </div>
              <div className="text-sm font-medium text-indigo-500 dark:text-indigo-400">
                U-Mail.ai — Boulder, CO
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Built an AI-enhanced email platform with Node/Express APIs, Gmail integration, Firebase Auth, and secure OAuth 2.0. Shipped voice-to-text, AI text enhancement, and Google Meet/Zoom integrations. Architected a modular, multi-tenant API to power industry-specific B2B deployments.
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Node.js', 'Express', 'React', 'Firebase Auth', 'Realtime DB', 'OAuth 2.0', 'Gmail API', 'OpenAI API', 'Voice-to-Text', 'AI Text Enhancement', 'Google Meet API', 'Zoom API', 'Multi-Tenant Architecture', 'REST APIs', 'GCP', 'Vercel', 'Mixpanel', 'B2B SaaS'].map(t => <Tag key={t} label={t} />)}
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
            <div className="pl-20 space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">
                February 2018 <span className="text-slate-400 dark:text-slate-600">·</span> February 2024
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">
                Senior Software Engineer
              </div>
              <div className="text-sm font-medium text-indigo-500 dark:text-indigo-400">
                S&amp;P Global — Boulder, CO
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Trusted with mission-critical systems powering real-time market data and global trading infrastructure. Diagnosed and resolved high-severity production incidents across Vue, React, C#/.NET, and Node/Express. Owned SAML, SSO, and OAuth across distributed financial products. Optimized large-scale exchange data pipelines and held the line on SLA compliance.
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['React', 'Vue.js', 'JavaScript', 'C#', '.NET', 'ASP.NET', 'Razor', 'Node.js', 'Express', 'SAML', 'SSO', 'OAuth 2.0', 'SQL Server', 'REST APIs', 'Data Ingestion Pipelines', 'Exchange Vendor Feeds', 'Real-Time Financial Data', 'Distributed Systems', 'Enterprise Architecture', 'Performance Optimization', 'SLA Compliance'].map(t => <Tag key={t} label={t} />)}
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
                alt="S&P Global Logo"
                width={47}
                height={47}
              />
            </div>
            <div className="pl-20 space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">
                August 2014 <span className="text-slate-400 dark:text-slate-600">·</span> February 2018
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">
                Web Developer — Client-Facing Team
              </div>
              <div className="text-sm font-medium text-indigo-500 dark:text-indigo-400">
                S&amp;P Global — Boulder, CO
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Built and maintained high-traffic financial web apps for multinational institutional clients. Delivered live-streaming market data systems, client-specific enhancements, and production fixes — often collaborating directly with global clients under tight deadlines.
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['JavaScript', 'HTML/CSS', 'Real-Time Data', 'Live Streaming', 'Financial Web Apps', 'Enterprise Systems', 'Legacy Codebases', 'Client Integration', 'Global Markets', 'Production Support'].map(t => <Tag key={t} label={t} />)}
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
                alt="S&P Global Logo"
                width={47}
                height={47}
              />
            </div>
            <div className="pl-20 space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">
                November 2014 <span className="text-slate-400 dark:text-slate-600">·</span> August 2016
              </div>
              <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">
                Jr. Web Developer
              </div>
              <div className="text-sm font-medium text-indigo-500 dark:text-indigo-400">
                S&amp;P Global — Boulder, CO
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Began a decade at S&amp;P Global building financial web applications across 100+ client platforms. Worked in agile teams shipping performance improvements and enterprise features — the foundation of deep expertise in global financial systems.
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['JavaScript', 'HTML/CSS', 'Financial Web Apps', 'Enterprise Platforms', 'Legacy Systems', 'Agile', 'Performance Optimization', 'Client Projects', 'Cross-Team Collaboration'].map(t => <Tag key={t} label={t} />)}
              </div>
            </div>
          </div>
        </li>

      </ul>
    </div>
  )
}
