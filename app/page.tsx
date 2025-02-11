import Hero from '@/components/hero'
import WidgetWeather from '@/components/widget-weather'
import WidgetNews from '@/components/widget-news'
import CryptoWidget from '@/components/widget-crypto'
import WidgetSearch from '@/components/widget-search'
import Image from 'next/image'
import AboutImg from '@/public/images/pumpkin.jpg'

export default function AboutPage() {
  return (
    <>
      <Hero />

      { /* Content */}
      <div className="grow md:flex space-y-8 md:space-y-0 md:space-x-8 pb-16 md:pb-20">
        <div className="grow md:flex space-y-8 md:space-y-0 md:space-x-8 pt-12 md:pt-16 pb-16 md:pb-20">

          { /* Middle area */}
          <div className="grow">
            <div className="">
              <section>
                <Image
                  className=""
                  src={AboutImg}

                  alt="About"
                />
                { /* Page content */}
                <div className="text-slate-500 dark:text-slate-400 space-y-8">
                  <div className="space-y-4">
                    <h2 className="h3 font-aspekta text-slate-800 dark:text-slate-100">
                      Short Bio
                    </h2>
                    <p>A developer who’s been building web apps for the past 10 years.
                      I spent years at S&P Global as a Senior Software Engineer, and now I’m focused on U-Mail and ApplyPro,
                      tools that help people write better and apply smarter.
                    </p>

                    <p>
                      I like simple solutions, privacy-first design, and software that just works. Whether it’s refining user experiences or solving tricky problems, I build with efficiency and usability in mind.

                      Need a developer who gets things done? Let’s talk.

                    </p>

                    <CryptoWidget />
                  </div>

                </div>
              </section>
            </div>
          </div>

          { /* Right sidebar */}
          <aside className="md:w-[240px] lg:w-[300px] shrink-0">
            <div className="space-y-6">
              <WidgetWeather />
              <WidgetSearch />
              <WidgetNews />
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
