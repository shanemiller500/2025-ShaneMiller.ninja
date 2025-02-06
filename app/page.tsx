import Hero from '@/components/hero'
import WidgetNewsletter from '@/components/widget-newsletter'
import WidgetSponsor from '@/components/widget-sponsor'
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
            <div className="max-w-[700px]">
              <section>
                <Image
                  className="w-full"
                  src={AboutImg}
    
                  alt="About"
                />
                { /* Page content */}
                <div className="text-slate-500 dark:text-slate-400 space-y-8">
                  <div className="space-y-4">
                    <h2 className="h3 font-aspekta text-slate-800 dark:text-slate-100">
                      Short Bio
                    </h2>
                    <p>
                    </p>
                    <p>

                    </p>
                  </div>
                  <div className="space-y-4">
                    <h2 className="h3 font-aspekta text-slate-800 dark:text-slate-100">
                      Career
                    </h2>
                    <p>
                      
                    </p>
                    <p>
                     
                    </p>
                    <p>
                    
                     </p>
                  </div>

                </div>
              </section>
            </div>
          </div>

          { /* Right sidebar */}
          {/* <aside className="md:w-[240px] lg:w-[300px] shrink-0">
            <div className="space-y-6">
              <WidgetNewsletter />
              <WidgetSponsor />
            </div>
          </aside> */}
        </div>
      </div>
    </>
  )
}
