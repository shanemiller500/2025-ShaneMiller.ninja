import type { AtlasStory } from "@/components/atlas/story";

/* ------------------------------------------------------------------ */
/*  Earth Alive's guided stories. Facts come from the USGS papers      */
/*  listed in each story's `docs` (all seeded into the atlas library   */
/*  by scripts/atlas/manifests/earth-alive.json) and the Smithsonian   */
/*  GVP volcano profiles.                                              */
/*                                                                     */
/*  Action kinds:                                                      */
/*    sequence  replay a famous quake's aftershocks (value = USGS id)  */
/*    depth     open the 3D view on a region (value = region key)      */
/*    faults    switch the U.S. fault layer on                         */
/*    volcano   open a volcano's profile (value = GVP number)          */
/*    terrain   switch terrain (value = "relief" | "3d")               */
/* ------------------------------------------------------------------ */

export type EarthStoryAction = "sequence" | "depth" | "faults" | "volcano" | "terrain";

const PDF = {
  alaska: { title: "The 1964 Great Alaska Earthquake and Tsunamis — A Modern Perspective and Enduring Legacies", url: "https://pubs.usgs.gov/fs/2014/3018/pdf/fs2014-3018.pdf", source: "USGS Fact Sheet 2014–3018", year: 2014 },
  stHelens: { title: "Mount St. Helens — From the 1980 Eruption to 2000", url: "https://pubs.usgs.gov/fs/2000/fs036-00/fs036-00.pdf", source: "USGS Fact Sheet 036-00", year: 2000 },
  orphan: { title: "The Orphan Tsunami of 1700 — Japanese Clues to a Parent Earthquake in North America", url: "https://pubs.usgs.gov/pp/pp1707/pp1707.pdf", source: "USGS Professional Paper 1707 (2nd ed.)", year: 2015 },
  sanAndreas: { title: "The San Andreas Fault System, California", url: "https://pubs.usgs.gov/pp/1990/1515/pp1515.pdf", source: "USGS Professional Paper 1515", year: 1990 },
  hayward: { title: "The Hayward Fault — Is It Due for a Repeat of the Powerful 1868 Earthquake?", url: "https://pubs.usgs.gov/fs/2008/3019/fs2008-3019.pdf", source: "USGS Fact Sheet 2008–3019", year: 2008 },
  newMadrid: { title: "Earthquake Hazard in the New Madrid Seismic Zone Remains a Concern", url: "https://pubs.usgs.gov/fs/2009/3071/pdf/FS09-3071.pdf", source: "USGS Fact Sheet 2009–3071", year: 2009 },
  yellowstone: { title: "Steam Explosions, Earthquakes, and Volcanic Eruptions — What's in Yellowstone's Future?", url: "https://pubs.usgs.gov/fs/2005/3024/fs2005-3024.pdf", source: "USGS Fact Sheet 2005–3024", year: 2005 },
  pager: { title: "PAGER — Rapid Assessment of an Earthquake's Impact", url: "https://pubs.usgs.gov/fs/2010/3036/pdf/FS10-3036.pdf", source: "USGS Fact Sheet 2010–3036", year: 2010 },
};

export const EARTH_STORIES: AtlasStory<EarthStoryAction>[] = [
  {
    id: "alaska-1964",
    title: "The Great Alaska Earthquake",
    subtitle: "Four and a half minutes of shaking that rewrote how we understand subduction zones.",
    when: "1964",
    color: "#38bdf8",
    docs: [PDF.alaska],
    chapters: [
      {
        date: "March 27, 1964 · 5:36 p.m.",
        title: "Good Friday",
        body: [
          "The ground across south-central Alaska shook for as much as four and a half minutes. At magnitude 9.2, it is still the largest earthquake recorded in U.S. history — and the second largest ever measured with modern instruments.",
        ],
        camera: { center: [-147.3, 60.9], zoom: 5.4, pitch: 35, bearing: -15 },
      },
      {
        title: "A 580-mile rupture",
        body: [
          "Here the Pacific plate slides beneath Alaska along the Aleutian megathrust. In 1964 a 580-mile section of that fault slipped at once.",
          "Seaward, the land rose — Middleton Island came up about 10 feet. Inland, around Cook Inlet and Kodiak Island, it dropped, and coastal forests drowned in salt water.",
        ],
        camera: { center: [-149.5, 58.8], zoom: 4.4, pitch: 20, bearing: 0 },
        actions: [{ label: "See the slab in 3D", kind: "depth", value: "alaska" }],
      },
      {
        title: "Waves within minutes",
        body: [
          "Underwater landslides set off local tsunamis that hit before anyone could react. Chenega, a village in Prince William Sound, lost 23 people — a third of its population — to a 65-foot wave about four minutes after the shaking began.",
          "The main tsunami crossed the Pacific; sixteen people died along the coasts of Oregon and California.",
        ],
        camera: { center: [-148.0, 60.2], zoom: 7, pitch: 45, bearing: 20 },
      },
      {
        title: "Aftershocks",
        body: ["Thousands of aftershocks followed. Replay what the catalog recorded — 1960s seismometers only caught the larger ones, so the real sequence was far busier."],
        camera: { center: [-149.5, 59.3], zoom: 4.8, pitch: 0, bearing: 0 },
        actions: [{ label: "Replay the aftershocks", kind: "sequence", value: "official19640328033616_30" }],
      },
      {
        title: "Legacy",
        body: [
          "The pattern of uplift and subsidence measured after 1964 became the template for how subduction zones rupture in great earthquakes, and buried marsh layers along the coast now hold a 5,600-year record of earlier ones.",
          "Today tsunami warning centers can send alerts within minutes of an earthquake that could generate one.",
        ],
        camera: { center: [-152, 57.5], zoom: 3.6, pitch: 0, bearing: 0 },
      },
    ],
  },
  {
    id: "st-helens-1980",
    title: "Mount St. Helens",
    subtitle: "The bulge, the landslide, the blast — and a volcano that kept going.",
    when: "1980",
    color: "#f97316",
    docs: [PDF.stHelens],
    chapters: [
      {
        date: "March 16 – May 17, 1980",
        title: "The volcano awakens",
        body: [
          "The first sign was a swarm of small earthquakes on March 16. On March 27 steam explosions blasted a crater through the summit ice cap.",
          "By May 17 more than 10,000 earthquakes had shaken the volcano, and its north flank had bulged outward at least 450 feet.",
        ],
        camera: { center: [-122.18, 46.2], zoom: 10.6, pitch: 60, bearing: 160 },
        actions: [
          { label: "Show 3D terrain", kind: "terrain", value: "3d" },
          { label: "Volcano profile", kind: "volcano", value: 321050 },
        ],
      },
      {
        date: "May 18, 1980 · 8:32 a.m.",
        title: "The largest landslide on record",
        body: [
          "Within 15 to 20 seconds of a magnitude 5.1 earthquake, the bulge and summit slid away — the largest landslide on Earth in recorded history. It depressurized the magma inside, and powerful explosions ripped through the sliding debris.",
          "The blast cloud reached as far as 17 miles north; the landslide ran about 14 miles west down the North Fork Toutle River. Fifty-seven people died.",
        ],
        camera: { center: [-122.2, 46.27], zoom: 10.2, pitch: 55, bearing: 200 },
      },
      {
        title: "Mudflows",
        body: [
          "The largest and most destructive lahar formed from water seeping out of the landslide deposit through most of the day, scouring the deposit and the river channel as it flowed downstream.",
        ],
        camera: { center: [-122.42, 46.3], zoom: 9.6, pitch: 50, bearing: 250 },
      },
      {
        title: "Still alive",
        body: [
          "The eruption removed the upper ~400 m of the summit and left a horseshoe-shaped crater open to the north. Lava domes grew in it through 1986, and again from 2004 to 2008.",
        ],
        camera: { center: [-122.19, 46.2], zoom: 11.6, pitch: 62, bearing: 180 },
      },
    ],
  },
  {
    id: "cascadia-1700",
    title: "The Orphan Tsunami",
    subtitle: "A tsunami hit Japan with no earthquake. Its parent was in North America.",
    when: "1700",
    color: "#a78bfa",
    docs: [PDF.orphan],
    chapters: [
      {
        date: "January 1700",
        title: "Waves without warning",
        body: [
          "A tsunami flooded villages and fields along Japan's Pacific coast. No one in Japan had felt an earthquake — so the waves were an orphan, written down in village and government records but unexplained.",
        ],
        camera: { center: [141.4, 38.8], zoom: 5, pitch: 25, bearing: 0 },
      },
      {
        date: "January 26, 1700 · evening",
        title: "Across the ocean",
        body: [
          "Three centuries later, scientists matched the Japanese records to their parent: a magnitude-9 earthquake on the Cascadia subduction zone, which runs offshore from northern California to British Columbia.",
        ],
        camera: { center: [-165, 43], zoom: 2.4, pitch: 0, bearing: 0 },
      },
      {
        title: "Ghost forests",
        body: [
          "Along the Washington coast the land dropped during the earthquake and salt water killed the forests. Tree rings in those standing dead trees show they died after the 1699 growing season — matching the date from Japan.",
        ],
        camera: { center: [-123.95, 46.55], zoom: 8.2, pitch: 45, bearing: 0 },
      },
      {
        title: "Locked and waiting",
        body: [
          "Cascadia is strangely quiet today: few deep earthquakes, because the plates are stuck together and storing strain. Look beneath it in 3D, then compare with a busy subduction zone like Japan or Tonga.",
        ],
        camera: { center: [-125, 45.5], zoom: 5, pitch: 30, bearing: 0 },
        actions: [{ label: "Look beneath Cascadia", kind: "depth", value: "cascadia" }],
      },
    ],
  },
  {
    id: "bay-area",
    title: "San Andreas & the Bay Area",
    subtitle: "Two plates sliding past each other, right through California.",
    when: "1868–1989",
    color: "#f43f5e",
    docs: [PDF.sanAndreas, PDF.hayward],
    chapters: [
      {
        title: "A plate boundary on land",
        body: [
          "The San Andreas fault system is where the Pacific plate grinds northwest past North America — a transform boundary running most of the length of California, with branches like the Hayward and Calaveras faults.",
        ],
        camera: { center: [-120.6, 36.4], zoom: 5.6, pitch: 30, bearing: -30 },
        actions: [{ label: "Show active faults", kind: "faults" }],
      },
      {
        date: "October 21, 1868",
        title: "The Hayward fault",
        body: [
          "A magnitude 6.8 earthquake on the Hayward fault killed about 30 people in a sparsely settled region — one of the most destructive in California's history.",
          "Its large quakes have come every 95 to 160 years (138 on average), and 1868 was more than 150 years ago.",
        ],
        camera: { center: [-122.12, 37.72], zoom: 9.4, pitch: 50, bearing: -35 },
        actions: [{ label: "Show active faults", kind: "faults" }],
      },
      {
        date: "April 18, 1906 · 5:12 a.m.",
        title: "San Francisco",
        body: [
          "The northern San Andreas ruptured for nearly 300 miles in a magnitude 7.9 earthquake. The shaking and the fires that followed destroyed much of San Francisco.",
        ],
        camera: { center: [-122.6, 37.9], zoom: 7.3, pitch: 40, bearing: -20 },
        actions: [{ label: "Replay what the catalog recorded", kind: "sequence", value: "official19060418131226300_12" }],
      },
      {
        date: "October 17, 1989",
        title: "Loma Prieta",
        body: ["A magnitude 6.9 earthquake in the Santa Cruz Mountains collapsed a section of the Bay Bridge and the Cypress freeway — a reminder that the whole system is loaded."],
        camera: { center: [-121.88, 37.04], zoom: 8.3, pitch: 40, bearing: 0 },
        actions: [{ label: "Replay the aftershocks", kind: "sequence", value: "nc216859" }],
      },
    ],
  },
  {
    id: "new-madrid",
    title: "New Madrid",
    subtitle: "Major earthquakes in the middle of a continent, far from any plate boundary.",
    when: "1811–12",
    color: "#eab308",
    docs: [PDF.newMadrid],
    chapters: [
      {
        date: "Winter 1811–12",
        title: "The heartland shakes",
        body: [
          "A sequence of major earthquakes struck the central Mississippi Valley — not at a plate boundary, but deep inside the North American plate.",
        ],
        camera: { center: [-89.6, 36.4], zoom: 6.4, pitch: 30, bearing: 0 },
      },
      {
        title: "Written in the sand",
        body: [
          "Strong shaking liquefied buried sand and blew it to the surface as sand blows. Older sand blows show the zone has repeatedly produced sequences of major earthquakes, including several of magnitude 7 to 8, before 1811.",
        ],
        camera: { center: [-89.75, 36.25], zoom: 8.5, pitch: 45, bearing: 20 },
      },
      {
        title: "Still active",
        body: [
          "Small earthquakes still pepper the zone, and their rate isn't falling the way aftershocks would. Scientists expect large earthquakes like 1811–12 to recur, on average about every 500 years.",
        ],
        camera: { center: [-89.6, 36.3], zoom: 7, pitch: 0, bearing: 0 },
      },
    ],
  },
  {
    id: "yellowstone",
    title: "Yellowstone",
    subtitle: "A supervolcano whose likeliest hazards are the small ones.",
    when: "2.1 Ma → now",
    color: "#22d3ee",
    docs: [PDF.yellowstone],
    chapters: [
      {
        title: "A giant, restless system",
        body: ["Yellowstone sits on one of the world's largest active volcanic systems — geysers, hot springs and a ground that rises and falls."],
        camera: { center: [-110.55, 44.55], zoom: 8.2, pitch: 50, bearing: 0 },
        actions: [{ label: "Shaded relief", kind: "terrain", value: "relief" }],
      },
      {
        title: "Three caldera eruptions",
        body: [
          "Three cataclysmic eruptions — 2.1 million, 1.3 million and 640,000 years ago — left huge collapsed calderas. The first erupted nearly 6,000 times the volume of Mount St. Helens in 1980; the youngest formed today's Yellowstone Caldera.",
        ],
        camera: { center: [-110.6, 44.5], zoom: 7.4, pitch: 35, bearing: -20 },
      },
      {
        date: "August 17, 1959",
        title: "What's likelier",
        body: [
          "Caldera-forming eruptions are extremely rare — only three in the past several million years. Earthquakes and hydrothermal (steam) explosions are far more likely. The 1959 Hebgen Lake earthquake, just west of the park, killed 28 people, most of them in a landslide it triggered.",
        ],
        camera: { center: [-111.25, 44.83], zoom: 9.2, pitch: 50, bearing: 30 },
      },
    ],
  },
  {
    id: "tohoku-2011",
    title: "Tōhoku",
    subtitle: "Japan's magnitude 9.1 — and how USGS gauges a disaster in minutes.",
    when: "2011",
    color: "#ef4444",
    docs: [PDF.pager],
    chapters: [
      {
        date: "March 11, 2011 · 2:46 p.m. JST",
        title: "The Japan Trench breaks",
        body: [
          "A magnitude 9.1 earthquake ruptured the Japan Trench, where the Pacific plate dives beneath northern Japan. The tsunami that followed devastated the coast and led to the Fukushima Daiichi nuclear accident.",
        ],
        camera: { center: [142.6, 38.3], zoom: 5.6, pitch: 35, bearing: -20 },
      },
      {
        title: "Two slabs below",
        body: ["Beneath Japan, quakes outline the Pacific plate sinking from the east — and the Philippine Sea plate from the south."],
        camera: { center: [141, 37.5], zoom: 5, pitch: 0, bearing: 0 },
        actions: [{ label: "Look beneath Japan", kind: "depth", value: "japan" }],
      },
      {
        title: "The aftershocks",
        body: ["Hundreds of magnitude-5+ aftershocks followed within a year. Watch the zone light up."],
        camera: { center: [142, 38], zoom: 5, pitch: 0, bearing: 0 },
        actions: [{ label: "Replay the aftershocks", kind: "sequence", value: "official20110311054624120_30" }],
      },
      {
        title: "Measuring impact",
        body: [
          "Within minutes of a big earthquake, USGS's PAGER system estimates likely fatalities and economic losses from the shaking and who lives there — the green-to-red alert on each quake card in Earth Alive.",
        ],
        camera: { center: [140, 37], zoom: 4.2, pitch: 0, bearing: 0 },
      },
    ],
  },
];
