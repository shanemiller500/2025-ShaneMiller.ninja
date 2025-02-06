import Education from '@/components/education'
import Experience from '@/components/experience'
import Recommendations from '@/components/recommendations'
import WidgetSkills2 from '@/components/widget-skills-1'
import WidgetSkills1 from '@/components/widget-skills-2'
import WidgetSkills3 from '@/components/widget-skills-3'
import WidgetSkills4 from '@/components/widget-skills-4'
import WidgetSkills5 from '@/components/widget-skills-5'
import WidgetSkills6 from '@/components/widget-skills-6'
import WidgetSkills7 from '@/components/widget-skills-7'
import WidgetSkills8 from '@/components/widget-skills-8'
import WidgetSkills9 from '@/components/widget-skills-9'


export const metadata = {
  title: 'Resume - Shane-Miller',
  description: 'Page description',
}

export default function Resume() {
  return (
    <div className="grow md:flex space-y-8 md:space-y-0 md:space-x-8 pt-12 md:pt-16 pb-16 md:pb-20">

      { /* Middle area */}
      <div className="grow">
        <div className="max-w-[700px]">

          <section>
            {/* Page title */}
            <h1 className="h1 font-aspekta mb-12">My resume</h1>
            {/* Page content */}
            <div className="text-slate-500 dark:text-slate-400 space-y-12">

              <Education />
              <Experience />
              {/* <Recommendations />   */}

            </div>
          </section>

        </div>
      </div>

      { /* Right sidebar */}
      <aside className="md:w-[240px] lg:w-[300px] shrink-0">
        <div className="space-y-6">

       

          <WidgetSkills2 />  { /* Programming Skills */}
          <WidgetSkills1 />  { /* Frontend Skills */}
          <WidgetSkills7 />   { /* Backend Technologies & API Development */}  
          <WidgetSkills3 />   { /* CI/CD (Continuous Integration & Continuous Deployment) */}
          <WidgetSkills9 />   { /* AI & Machine Learning */}
          <WidgetSkills4 />   { /* Hosting & Cloud Services */}
          <WidgetSkills5 />   { /* Monitoring & Logging */}
          <WidgetSkills6 />   { /*Containerization & Analytics */}
          <WidgetSkills8/>    { /* Databases & Data Management */}

        

        </div>
      </aside>

    </div>
  )
}
