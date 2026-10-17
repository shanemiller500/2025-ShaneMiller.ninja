import type { AtlasStory, StoryDoc } from "@/components/atlas/story";
import type { EraKey } from "@/utils/geo/sinkings";

/* ------------------------------------------------------------------ */
/*  Shipwrecks stories, told from the federal reports behind them:     */
/*  BOEM/NOAA's catalog of WWII wrecks off North Carolina (its history */
/*  chapter covers both wars) and NOAA's Monitor management plan.      */
/*  Every claim below is in the linked report.                         */
/*                                                                     */
/*  A chapter can put the sinkings replay at a date (`at`) so the map  */
/*  shows the war up to that day. Action kinds:                        */
/*    replay  play the sinkings from a date (value = "YYYY-MM-DD")     */
/*    wreck   open a featured wreck (value = featured id)               */
/*    dive    dive to a featured wreck (value = featured id)           */
/* ------------------------------------------------------------------ */

export type WreckAction = "replay" | "wreck" | "dive";

export interface ChapterTime {
  era: EraKey;
  /** show sinkings up to this day */
  at: string;
}

export type WreckStory = AtlasStory<WreckAction> & { time: (ChapterTime | null)[] };

export const BOTA: StoryDoc = {
  title: "Battle of the Atlantic: A Catalog of Shipwrecks off North Carolina's Coast from the Second World War (OCS Study BOEM 2021-076)",
  url: "https://espis.boem.gov/final%20reports/BOEM_2021-076.pdf",
  source: "BOEM & NOAA Office of National Marine Sanctuaries",
  year: 2021,
};
export const MONITOR_PLAN: StoryDoc = {
  title: "Monitor National Marine Sanctuary Final Management Plan and Environmental Assessment",
  url: "https://monitor.noaa.gov/management/final_mp.pdf",
  source: "NOAA Office of National Marine Sanctuaries",
  year: 2013,
};

const HATTERAS = { center: [-75.3, 35.0] as [number, number], zoom: 6.6, pitch: 0, bearing: 0 };

export const WRECK_STORIES: WreckStory[] = [
  {
    id: "hatteras-1942",
    title: "The war off Cape Hatteras",
    subtitle: "1942: U-boats sink ships within sight of the U.S. coast.",
    when: "1942",
    color: "#f43f5e",
    docs: [BOTA],
    time: [{ era: "ww2", at: "1941-12-31" }, { era: "ww2", at: "1942-04-30" }, { era: "ww2", at: "1942-07-15" }, { era: "ww2", at: "1942-08-31" }],
    chapters: [
      {
        title: "Operation Drumbeat",
        date: "January 1942",
        body: [
          "After America entered the war, Germany sent its first wave of U-boats to the U.S. east coast — just six boats, sailing between 16 and 25 December 1941 and arriving in mid-January 1942. Germany code-named the offensive Operation Paukenschlag, “Drumbeat.”",
          "At no point in the first part of 1942 were more than 12 U-boats operating along the east coast at once.",
        ],
        camera: { center: [-72, 37], zoom: 4.6, pitch: 0, bearing: 0 },
        actions: [{ label: "Replay 1942 on the map", kind: "replay", value: "1942-01-01" }],
      },
      {
        title: "The hunting ground",
        date: "January – April 1942",
        body: [
          "Off Cape Hatteras the Gulf Stream and Labrador currents meet and the continental shelf runs close to shore, so shipping crowded into a bottleneck while U-boats could hide in deep water nearby. Dönitz wrote that the area “proved particularly fruitful.”",
          "Nearly 200 merchant ships were sunk off the east coast between January and April 1942 — a stretch later called the “American turkey shoot.”",
          "The dots are every loss Wikipedia's lists give a position for; many sinkings far offshore have only rough positions.",
        ],
        camera: HATTERAS,
      },
      {
        title: "The tide turns",
        date: "April – July 1942",
        body: [
          "On 14 April 1942 the destroyer USS Roper sank U-85 — the first U-boat lost to American forces. The Coast Guard cutter Icarus sank U-352 on 9 May, and aircraft sank U-701 on 7 July.",
          "On 15 July, convoy KS-520 — 19 merchant ships and five escorts — rounded Cape Hatteras. U-576 torpedoed ships in the convoy and was then sunk by gunfire from the freighter Unicoi's Navy armed guard and depth charges from two Navy Kingfisher aircraft.",
        ],
        camera: { center: [-75.5, 35.2], zoom: 7.4, pitch: 0, bearing: 0 },
      },
      {
        title: "The cost",
        date: "January – August 1942",
        body: [
          "BOEM and NOAA estimate that off North Carolina alone about 80 ships were sunk by U-boats, 7 more were lost indirectly, and 4 U-boats were sunk — 91 vessels, and about 1,657 lives: 1,210 merchant mariners, 302 Allied military personnel and 145 German submariners.",
          "With convoys and air patrols in place, Dönitz withdrew his boats from the coast that summer. The wrecks remain on the seafloor; the U-boats are war graves.",
        ],
        camera: HATTERAS,
      },
    ],
  },
  {
    id: "uboat-ww1",
    title: "The first U-boat war",
    subtitle: "1915–1918: unrestricted submarine warfare, and the convoys that answered it.",
    when: "1915–18",
    color: "#f59e0b",
    docs: [BOTA],
    time: [{ era: "ww1", at: "1915-05-07" }, { era: "ww1", at: "1917-04-30" }, { era: "ww1", at: "1917-11-30" }, { era: "ww1", at: "1918-11-11" }],
    chapters: [
      {
        title: "A war zone around Britain",
        date: "February – May 1915",
        body: [
          "On 4 February 1915 Germany declared the waters around Great Britain and Ireland a war zone in which every enemy merchant ship would be destroyed — its first unrestricted U-boat campaign, begun with fewer than 30 U-boats in service.",
          "On 7 May 1915, U-20 torpedoed the liner Lusitania off Ireland. 1,198 people died, 128 of them Americans.",
        ],
        camera: { center: [-6, 52], zoom: 4.6, pitch: 0, bearing: 0 },
        actions: [{ label: "Replay the war from 1914", kind: "replay", value: "1914-07-28" }],
      },
      {
        title: "“We are losing the war”",
        date: "April 1917",
        body: [
          "In April 1917 U-boats sank 444 Allied vessels — nearly a million tons. Admiral William Sims, commanding the newly arrived American warships in Europe, cabled Washington: “I consider that at the present moment we are losing the war!”",
          "The map looks almost empty that month: Wikipedia's April 1917 list names over 500 losses but gives a position for only a handful. Absence of dots isn't absence of sinkings.",
        ],
        camera: { center: [-8, 49], zoom: 4.2, pitch: 0, bearing: 0 },
      },
      {
        title: "Convoys",
        date: "Summer – autumn 1917",
        body: [
          "With American escorts available, the Allies began sailing merchant ships in convoy. By the end of August only 2 ships in 100 were being sunk in convoy, against 1 in 10 sailing alone.",
          "By the end of November 1917 shipping losses had been cut to 259,521 tons.",
        ],
        camera: { center: [-10, 50], zoom: 4, pitch: 0, bearing: 0 },
      },
      {
        title: "U-boats off America",
        date: "1918",
        body: [
          "In May 1918 U-boats were sent to the U.S. east coast for the first time; U-151 was the first enemy warship in U.S. territorial waters since the War of 1812.",
          "Germany sent 7 U-boats to American waters in all, and they sank 10 ships off North Carolina alone. One of them, U-155, was the cargo submarine Deutschland that had been welcomed in Baltimore in 1916.",
        ],
        camera: { center: [-73, 38], zoom: 4.8, pitch: 0, bearing: 0 },
      },
    ],
  },
  {
    id: "monitor",
    title: "USS Monitor",
    subtitle: "From the first battle of ironclads to the first national marine sanctuary.",
    when: "1862–1975",
    color: "#94a3b8",
    docs: [MONITOR_PLAN],
    time: [null, null, null, null],
    chapters: [
      {
        title: "Ironclad against ironclad",
        date: "March 9, 1862",
        body: [
          "Designed by the Swedish-American engineer John Ericsson and built at Greenpoint, N.Y., the Monitor carried a revolving gun turret — the prototype of a new class of warship.",
          "At Hampton Roads, Virginia, she fought the Confederate ironclad CSS Virginia (the former Merrimac): the first confrontation between ironclad warships, and one that changed the course of naval warfare.",
        ],
        camera: { center: [-76.33, 36.98], zoom: 10.5, pitch: 0, bearing: 0 },
      },
      {
        title: "Lost in a gale",
        date: "December 31, 1862",
        body: [
          "Ordered to Beaufort, N.C., under tow, the Monitor met a severe gale off Cape Hatteras and began taking on water. She sank on December 31, 1862 — less than a year after her commissioning — with the loss of sixteen men.",
        ],
        camera: { center: [-75.41, 35.0], zoom: 8.5, pitch: 0, bearing: 0 },
        actions: [{ label: "Open the wreck", kind: "wreck", value: "monitor" }],
      },
      {
        title: "Found, and protected",
        date: "1973 – 1975",
        body: [
          "In August 1973 scientists aboard Duke University's research vessel Eastward found the wreck with side-scan sonar, in 230 feet of water about 16 miles off Cape Hatteras.",
          "On January 30, 1975, NOAA designated the wreck and a column of water a mile across around it as the nation's first national marine sanctuary.",
        ],
        camera: { center: [-75.41, 35.0], zoom: 11, pitch: 0, bearing: 0 },
        actions: [{ label: "Dive to the Monitor", kind: "dive", value: "monitor" }],
      },
      {
        title: "Raising the turret",
        date: "1998 – 2002",
        body: [
          "Between 1998 and 2002 NOAA and the U.S. Navy recovered almost 400 tons of material, including the propeller, engine, guns and the revolving turret, which broke the surface on August 5, 2002 for the first time in nearly 140 years.",
          "In 2002 they also recovered the remains of two sailors lost the night she sank. The ironclad's pieces are being conserved at The Mariners' Museum in Newport News, Virginia.",
        ],
        camera: { center: [-75.41, 35.0], zoom: 9, pitch: 0, bearing: 0 },
      },
    ],
  },
];

export const storyById = (id: string) => WRECK_STORIES.find((s) => s.id === id);
