import Image from 'next/image'
import { Timeline, type TimelineEntry } from '@/components/ui/timeline'
import { SectionHeader } from '@/components/ui/section-header'

import ApplyPro from '@/public/images/applyprologo.png'
import UMail from '@/public/images/umailLogo.png'
import spgi from '@/public/images/sp-global-seeklogo.png'
import DCI from '@/public/images/DCI.jpg'

const entries: TimelineEntry[] = [
  {
    icon: <Image className="object-contain" src={DCI} alt="Data Center Inc. Logo" width={46} height={46} />,
    startDate: 'April 2025',
    endDate: 'Present',
    title: 'Senior Engineer Level II',
    org: 'Data Center Inc. — Remote',
    description:
    'Full-stack engineer on a .NET core banking platform, working across the entire GoBanking ecosystem. Investigates and resolves defects, performance issues, and feature gaps spanning ACH processing, batch workflows, reconciliation systems, reporting, and user-facing modules. Regularly steps into unfamiliar areas of the codebase to diagnose production issues, improve reliability, and deliver hardened releases in a regulated, compliance-driven environment.',
    tags: [
      'C#', '.NET Framework', '.NET Core', 'SQL Server', 'ASP.NET MVC', 'ASP.NET WebForms',
      'Stored Procedures', 'ACH Processing', 'Batch Systems', 'Reconciliation Pipelines',
      'Transaction Flows', 'Reporting Layers', 'REST APIs', 'Telerik', 'Windows Server',
      'SCA / Code Analysis', 'Agile',
    ],
  },
  {
    icon: <Image className="object-contain" src={ApplyPro} alt="ApplyPro Logo" width={46} height={46} />,
    startDate: 'September 2024',
    endDate: 'Present',
    title: 'Founder & Lead Engineer',
    org: 'ApplyPro.ai — Boulder, CO',
    description: (
      <>
        Solo-built an AI-powered resume platform — owning every layer from SSR Next.js frontend to
        API routes, payments, and CI/CD. Integrated Stripe subscriptions and Mixpanel analytics.
        Scaled to{' '}
        <span className="font-semibold text-slate-600 dark:text-slate-300">400+ active users</span>{' '}
        through rapid, data-driven iteration.
      </>
    ),
    tags: [
      'Next.js', 'App Router', 'SSR', 'React', 'TypeScript', 'Node.js', 'PostgreSQL',
      'REST APIs', 'AI Integration', 'Document Processing', 'Stripe', 'Subscription Billing',
      'Mixpanel', 'Tailwind CSS', 'Component Architecture', 'Vercel', 'CI/CD',
    ],
  },
  {
    icon: <Image className="object-contain" src={UMail} alt="UMail Logo" width={46} height={46} />,
    startDate: 'April 2024',
    endDate: 'Present',
    title: 'Founder & Lead Engineer',
    org: 'U-Mail.ai — Boulder, CO',
    description:
      'Built an AI-enhanced email platform with Node/Express APIs, Gmail integration, Firebase Auth, and secure OAuth 2.0. Shipped voice-to-text, AI text enhancement, and Google Meet/Zoom integrations. Architected a modular, multi-tenant API to power industry-specific B2B deployments.',
    tags: [
      'Node.js', 'Express', 'React', 'Firebase Auth', 'Realtime DB', 'OAuth 2.0',
      'Gmail API', 'OpenAI API', 'Voice-to-Text', 'AI Text Enhancement', 'Google Meet API',
      'Zoom API', 'Multi-Tenant Architecture', 'REST APIs', 'GCP', 'Vercel', 'Mixpanel', 'B2B SaaS',
    ],
  },
  {
    icon: <Image className="object-contain" src={spgi} alt="S&P Global Logo" width={47} height={47} />,
    startDate: 'February 2018',
    endDate: 'February 2024',
    title: 'Senior Software Engineer',
    org: (
      <>
        S&P Global — Boulder, CO{' '}
      </>
    ),
    description:
      'Trusted with mission-critical systems powering real-time market data and global trading infrastructure. Diagnosed and resolved high-severity production incidents across Vue, React, C#/.NET, and Node/Express. Owned SAML, SSO, and OAuth across distributed financial products. Optimized large-scale exchange data pipelines and held the line on SLA compliance.',
    tags: [
      'React', 'Vue.js', 'JavaScript', 'C#', '.NET', 'ASP.NET', 'Razor', 'Node.js', 'Express',
      'SAML', 'SSO', 'OAuth 2.0', 'SQL Server', 'REST APIs', 'Data Ingestion Pipelines',
      'Exchange Vendor Feeds', 'Real-Time Financial Data', 'Distributed Systems',
      'Enterprise Architecture', 'Performance Optimization', 'SLA Compliance',
    ],
  },
  {
    icon: <Image className="object-contain" src={spgi} alt="S&P Global Logo" width={47} height={47} />,
    startDate: 'August 2014',
    endDate: 'February 2018',
    title: 'Web Developer — Client-Facing Team',
    org: 'S&P Global — Boulder, CO',
    description:
      'Built and maintained high-traffic financial web apps for multinational institutional clients. Delivered live-streaming market data systems, client-specific enhancements, and production fixes — often collaborating directly with global clients under tight deadlines.',
    tags: [
      'JavaScript', 'HTML/CSS', 'Real-Time Data', 'Live Streaming', 'Financial Web Apps',
      'Enterprise Systems', 'Legacy Codebases', 'Client Integration', 'Global Markets', 'Production Support',
    ],
  },
  {
    icon: <Image className="object-contain" src={spgi} alt="S&P Global Logo" width={47} height={47} />,
    startDate: 'November 2014',
    endDate: 'August 2016',
    title: 'Jr. Web Developer',
    org: 'S&P Global — Boulder, CO',
    description:
      'Began a decade at S&P Global building financial web applications across 100+ client platforms. Worked in agile teams shipping performance improvements and enterprise features — the foundation of deep expertise in global financial systems.',
    tags: [
      'JavaScript', 'HTML/CSS', 'Financial Web Apps', 'Enterprise Platforms',
      'Legacy Systems', 'Agile', 'Performance Optimization', 'Client Projects', 'Cross-Team Collaboration',
    ],
  },
]

export default function Experience() {
  return (
    <div className="space-y-8">
      <SectionHeader title="Experience" />
      <Timeline entries={entries} />
    </div>
  )
}
