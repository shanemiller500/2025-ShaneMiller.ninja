'use client';

import { useEffect } from 'react';
import ProjectCard from './project-card';
import Icon01 from '@/public/images/hmbco.png';
import Icon03 from '@/public/images/the-new-york-stock-exchange-seeklogo.png';
import Icon04 from '@/public/images/project-icon-04.svg';
import Icon05 from '@/public/images/s-h-i-e-l-d-seeklogo.png';
import Icon06 from '@/public/images/project-icon-06.svg';
import Icon07 from '@/public/images/bitcoin-seeklogo.png';
import Icon08 from '@/public/images/nasa-seeklogo.png';
import Icon09 from '@/public/images/aic.png';
import { trackEvent } from '@/utils/mixpanel';

interface ProjectItem {
  id: number;
  icon: typeof Icon01;
  slug: string;
  title: string;
  excerpt: string;
  openSource?: boolean;
}

export default function Projects() {
  // Fire a page view event when the Projects page is mounted.
  useEffect(() => {
    trackEvent('Projects Page Viewed', { page: 'Projects' });
  }, []);

  const items01: ProjectItem[] = [
    {
      id: 0,
      icon: Icon01,
      slug: 'https://holdmybeer.info',
      title: 'HoldMyBeer.info',
      excerpt:
        'Hold My Beer CO is a company focused on data privacy and enhanced security. Here you will find applications like ApplyPro & UMail that have daily active users & test users on specific custom tools.',
    },
  ];

  const items02: ProjectItem[] = [
    {
      id: 4,
      icon: Icon07,
      slug: '/Crypto',
      title: 'Crypto Market Data',
      excerpt: 'Crypto Market Data, Charts, and more.',
      openSource: false,
    },
    {
      id: 0, // Note: Ensure unique IDs in production.
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
      icon: Icon09,
      slug: '/Art',
      title: 'Art  Institute of Chicago',
      excerpt: "Art  Institute of Chicago's open source API.",
      openSource: false,
    },
    {
      id: 8,
      icon: Icon04,
      slug: '/cymatics',
      title: 'Cymatics (Caution: Contains flashing lights!)',
      excerpt: "  A fun side project using sound frequencies to make sand dance into cymatic patterns, still a work in progress! ",
      openSource: false,
    },
  ];

  // Handler to track a project click event.
  const handleProjectClick = (item: ProjectItem, category: string) => {
    trackEvent('Project Clicked', {
      title: item.title,
      slug: item.slug,
      category,
    });
  };

  return (
    <div className="grow md:flex space-y-8 md:space-y-0 md:space-x-8 pt-12 md:pt-16 pb-16 md:pb-20">
      {/* Middle area */}
      <div className="grow">
        <section>
          {/* Page title */}
          <h1 className="h1 font-aspekta mb-12">Things I've built</h1>
          {/* Page content */}
          <div className="space-y-10">
            {/* Company Founded cards */}
            <section>
              <h2 className="font-aspekta text-xl font-[650] mb-6">Company Founded</h2>
              <div className="grid sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-5">
                {items01.map(item => (
                  <ProjectCard
                    key={item.id}
                    item={item}
                    onClick={() => handleProjectClick(item, 'Company Founded')}
                  />
                ))}
              </div>
            </section>
            {/* Fun Dev Portfolio Stuff cards */}
            <section>
              <h2 className="font-aspekta text-xl font-[650] mb-6">Fun Dev Portfolio Stuff</h2>
              <div className="grid sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-5">
                {items02.map(item => (
                  <ProjectCard
                    key={item.id}
                    item={item}
                    onClick={() => handleProjectClick(item, 'Fun Dev Portfolio Stuff')}
                  />
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
