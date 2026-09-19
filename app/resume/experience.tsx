import resumeContent from './content.json'
import Image from 'next/image'
import { Timeline, type TimelineEntry } from '@/components/ui/timeline'
import { SectionHeader } from '@/components/ui/section-header'

import ApplyPro from '@/public/images/applyprologo.png'
import UMail from '@/public/images/umailLogo.png'
import spgi from '@/public/images/sp-global-seeklogo.png'
import DCI from '@/public/images/DCI.jpg'
import Trilon from '@/public/images/trilon-group-logo-dark.png'

const logos = { dci: DCI, umail: UMail, applypro: ApplyPro, spgi };
const { trilon } = resumeContent;
const entries: TimelineEntry[] = [
  {
    icon: <Image className="h-[46px] w-[46px] object-contain" src={Trilon} alt="Trilon Group logo" width={46} height={46} />,
    startDate: trilon.startDate,
    endDate: trilon.endDate,
    title: trilon.title,
    org: trilon.org,
    description: trilon.description,
    tags: trilon.tags,
  },
  ...resumeContent.previousExperience.map((entry) => ({
    ...entry,
    icon: <Image className="object-contain" src={logos[entry.icon as keyof typeof logos]} alt={entry.org.split(' \u2014 ')[0] + ' logo'} width={46} height={46} />,
  })),
]

export default function Experience() {
  return (
    <div className="space-y-8">
      <SectionHeader title="Experience" />
      <Timeline entries={entries} />
    </div>
  )
}
