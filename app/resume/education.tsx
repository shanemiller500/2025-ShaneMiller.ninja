import Image from 'next/image'
import { Timeline, type TimelineEntry } from '@/components/ui/timeline'
import { SectionHeader } from '@/components/ui/section-header'

import EducationIcon01 from '@/public/images/ihs-markit-seeklogo.png'
import EducationIcon02 from '@/public/images/general-assembly-seeklogo.png'

const entries: TimelineEntry[] = [
  {
    icon: <Image src={EducationIcon01} width={50} height={49} alt="IHS Markit / Dev-U" />,
    startDate: 'October 2014',
    endDate: 'November 2014',
    title: 'Certificate in Mid-Tier Development',
    org: 'IHS Markit / Dev-U — Boulder, CO',
    description:
      'Intensive program focused on building production-ready mid-tier applications directly preceding a decade-long career at S&P Global. Covered the full Microsoft web stack alongside modern frontend fundamentals.',
    tags: ['C#', 'ASP.NET', 'MVC', 'HTML5', 'CSS3', 'JavaScript', 'jQuery', 'Mid-Tier Architecture'],
  },
  {
    icon: <Image src={EducationIcon02} width={50} height={26} alt="General Assembly" />,
    startDate: 'December 2013',
    endDate: 'July 2014',
    title: 'Web Development Immersive',
    org: 'General Assembly — San Francisco, CA',
    description:
      'Full-time, project-based immersive covering the complete web development lifecycle. Built and shipped real applications from scratch the launchpad for a career in financial technology and enterprise software.',
    tags: ['Ruby on Rails', 'Full-Stack Development', 'HTML5', 'CSS3', 'JavaScript', 'jQuery', 'REST APIs', 'Git', 'Agile'],
  },
]

export default function Education() {
  return (
    <div className="space-y-8">
      <SectionHeader title="Education" />
      <Timeline entries={entries} />
    </div>
  )
}
