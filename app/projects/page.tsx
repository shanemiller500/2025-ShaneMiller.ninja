import ProjectCard from '../project-card'
import WidgetNewsletter from '@/components/widget-newsletter'
import WidgetSponsor from '@/components/widget-sponsor'

import Icon01 from '@/public/images/project-icon-01.svg'
import Icon03 from '@/public/images/project-icon-03.svg'
import Icon04 from '@/public/images/project-icon-04.svg'
import Icon05 from '@/public/images/project-icon-05.svg'
import Icon06 from '@/public/images/project-icon-06.svg'
import Icon07 from '@/public/images/project-icon-07.svg'
import Icon08 from '@/public/images/project-icon-08.svg'

export const metadata = {
  title: 'Projects - DevSpace',
  description: 'Page description',
}

export default function Projects() {

  const items01 = [
    {
      id: 0,
      icon: Icon01,
      slug: 'https://holdmybeer.info',
      title: 'HoldMyBeer.info',
      excerpt: 'Hold My Beer CO is a company focused on data privacy and enhanced security.',

    },
  ]

  const items02 = [
    {
      id: 0,
      icon: Icon03,
      slug: '/stocks',
      title: 'Stock Market Data',
      excerpt: 'Live streaming Heatmaps, Charts, stock quotes, earnings & IPOs.',
      openSource: false,
    },
    {
      id: 1,
      icon: Icon04,
      slug: '/Country',
      title: 'Country Search',
      excerpt: 'Search for any Countries infomation',
      openSource: false,
    },
    {
      id: 2,
      icon: Icon05,
      slug: '/Marvel',
      title: 'Marvel API',
      excerpt: 'Lookup Comics, Characters, Creators, Events, Series, and Stories.',
      openSource: false,
    },
    {
      id: 3,
      icon: Icon06,
      slug: '/Bored',
      title: 'Bored?',
      excerpt: 'Fun things to do when you are bored using free APIs.',
      openSource: false,
    },
    {
      id: 4,
      icon: Icon07,
      slug: '/Crypto',
      title: 'Crypto Market Data',
      excerpt: 'Crypto Market Data, Charts, and more.',
      openSource: false,
    },
    {
      id: 5,
      icon: Icon08,
      slug: '/ISS',
      title: 'Track The ISS',
      excerpt: 'Track the ISS as it moves around the planet',
      openSource: false,
    },
    {
      id: 6,
      icon: Icon08,
      slug: '/NASA',
      title: 'NASA API',
      excerpt: 'NASA photo of the day & Mars Rover photos.',
      openSource: false,
    },
    {
      id: 7,
      icon: Icon08,
      slug: '/Art',
      title: 'Art  Institute of Chicago',
      excerpt: 'Art  Institute of Chicago\'s open source API.',
      openSource: false,
    },
  ]

  return (
    <div className="grow md:flex space-y-8 md:space-y-0 md:space-x-8 pt-12 md:pt-16 pb-16 md:pb-20">
      { /* Middle area */ }
      <div className="grow">
        <div className="max-w-[700px]">
          <section>
            {/* Page title */}
            <h1 className="h1 font-aspekta mb-12">Things I've built</h1>
            {/* Page content */}
            <div className="space-y-10">
              {/* Side Hustles cards */}
              <section>
                <h2 className="font-aspekta text-xl font-[650] mb-6">Company Founded</h2>
                {/* Cards */}
                <div className="grid sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-5">
                  {items01.map(item => (
                    <ProjectCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
              {/* Client Projects cards */}
              <section>
                <h2 className="font-aspekta text-xl font-[650] mb-6">Fun Dev Portfolio Stuff</h2>
                {/* Cards */}
                <div className="grid sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-5">
                  {items02.map(item => (
                    <ProjectCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>

      { /* Right sidebar */ }
      <aside className="md:w-[240px] lg:w-[300px] shrink-0">
        <div className="space-y-6">
          <WidgetNewsletter />
          <WidgetSponsor />
        </div>
      </aside>
    </div>
  )
}
