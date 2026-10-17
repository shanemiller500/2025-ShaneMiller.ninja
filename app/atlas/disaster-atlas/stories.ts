import type { AtlasStory, StoryDoc } from "@/components/atlas/story";
import type { HistoryHazard } from "./history";

/* ------------------------------------------------------------------ */
/*  Disaster Atlas stories — landmark disasters, told from the federal */
/*  reports written after them (NWS service assessment, NHC tropical   */
/*  cyclone reports, NIST). Every claim below is in the linked report; */
/*  path length/width come from the SPC database the map draws.        */
/*                                                                     */
/*  Each chapter can set the history map up (hazard + year) as it      */
/*  opens. Action kinds:                                               */
/*    tornado    open a notable tornado's path + impact (value = label) */
/*    hurricane  open a storm (value = HURDAT2 id)                     */
/*    fire       open a past fire perimeter (value = "year:NAME")      */
/* ------------------------------------------------------------------ */

export type DisasterAction = "tornado" | "hurricane" | "fire";

export interface ChapterSetup {
  hazard: HistoryHazard;
  year: number;
}

export type DisasterStory = AtlasStory<DisasterAction> & { setup: ChapterSetup[] };

const JOPLIN: StoryDoc = { title: "Joplin, Missouri, Tornado — May 22, 2011 (NWS Central Region Service Assessment)", url: "https://www.weather.gov/media/publications/assessments/Joplin_tornado.pdf", source: "NOAA National Weather Service", year: 2011 };
const KATRINA: StoryDoc = { title: "Tropical Cyclone Report: Hurricane Katrina (updated)", url: "https://www.nhc.noaa.gov/data/tcr/AL122005_Katrina.pdf", source: "NOAA National Hurricane Center", year: 2005 };
const HARVEY: StoryDoc = { title: "Tropical Cyclone Report: Hurricane Harvey", url: "https://www.nhc.noaa.gov/data/tcr/AL092017_Harvey.pdf", source: "NOAA National Hurricane Center", year: 2018 };
const CAMP: StoryDoc = { title: "A Case Study of the Camp Fire — Notification, Evacuation, Traffic, and Temporary Refuge Areas (NIST TN 2252)", url: "https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.2252.pdf", source: "NIST", year: 2023 };

export const DISASTER_STORIES: DisasterStory[] = [
  {
    id: "joplin-2011",
    title: "Joplin, May 22, 2011",
    subtitle: "One of the deadliest tornadoes in U.S. history.",
    when: "2011",
    color: "#e11d48",
    docs: [JOPLIN],
    setup: [
      { hazard: "tornadoes", year: 2011 },
      { hazard: "tornadoes", year: 2011 },
      { hazard: "tornadoes", year: 2011 },
    ],
    chapters: [
      {
        title: "An EF-5 in a city of 50,000",
        date: "May 22, 2011",
        body: [
          "On May 22, 2011, a tornado struck Joplin, Missouri, directly killing 158 people and injuring over 1,000 — one of the deadliest tornadoes in U.S. history.",
          "Rated EF-5 with maximum winds over 200 mph, it hit a significant part of a city of more than 50,000 people.",
        ],
        camera: { center: [-94.5, 37.06], zoom: 10.6, pitch: 0, bearing: 0 },
      },
      {
        title: "The warnings",
        body: [
          "A tornado watch for southwest Missouri went out at 1:30 p.m. CDT. At 5:09 p.m. the Springfield NWS office issued a tornado warning for western Jasper County, including northeastern Joplin, and the first three-minute siren sounded at 5:11.",
          "The service assessment found that most people first waited for, sought and filtered more information before taking cover — and that frequent siren activations had left many residents desensitized to them.",
        ],
        camera: { center: [-94.51, 37.08], zoom: 11.5, pitch: 30, bearing: 0 },
      },
      {
        title: "The path",
        body: [
          "NOAA's Storm Prediction Center records the track as 21.6 miles long and up to 1,600 yards wide.",
          "Open it to count the buildings and people standing in that corridor today.",
        ],
        camera: { center: [-94.42, 37.03], zoom: 10.2, pitch: 0, bearing: 0 },
        actions: [{ label: "Count what's in the path", kind: "tornado", value: "Joplin 2011" }],
      },
    ],
  },
  {
    id: "katrina-2005",
    title: "Katrina, 2005",
    subtitle: "The costliest hurricane in U.S. history.",
    when: "2005",
    color: "#d946ef",
    docs: [KATRINA],
    setup: [
      { hazard: "hurricanes", year: 2005 },
      { hazard: "hurricanes", year: 2005 },
      { hazard: "hurricanes", year: 2005 },
    ],
    chapters: [
      {
        title: "Category 5 in the Gulf",
        date: "August 2005",
        body: [
          "Katrina reached Category 5 over the central Gulf of Mexico, then weakened to Category 3 before reaching the northern Gulf coast.",
          "It made landfall near Buras, Louisiana, at 1110 UTC on August 29 at the upper end of Category 3 (110 kt), and made its final landfall near the mouth of the Pearl River at the Louisiana–Mississippi border.",
        ],
        camera: { center: [-88.8, 27.5], zoom: 5.2, pitch: 0, bearing: 0 },
        actions: [{ label: "Open Katrina's track", kind: "hurricane", value: "AL122005" }],
      },
      {
        title: "The levees",
        body: [
          "The storm surge severely strained the New Orleans levee system; several levees and floodwalls were overtopped or breached.",
          "About 80% of the city flooded, to depths of up to about 20 feet, within a day or so of landfall.",
        ],
        camera: { center: [-90.07, 29.98], zoom: 10.2, pitch: 0, bearing: 0 },
      },
      {
        title: "The toll",
        body: [
          "Katrina was the costliest hurricane and one of the five deadliest to strike the United States.",
          "Early estimates put the deaths at over 1,800. The updated NHC report, drawing on medical logs studied since, puts the total at nearly 1,400 direct and indirect deaths — 520 of them direct.",
        ],
        camera: { center: [-89.6, 30.2], zoom: 7.4, pitch: 0, bearing: 0 },
      },
    ],
  },
  {
    id: "harvey-2017",
    title: "Harvey, 2017",
    subtitle: "The wettest tropical cyclone on U.S. record.",
    when: "2017",
    color: "#38bdf8",
    docs: [HARVEY],
    setup: [
      { hazard: "hurricanes", year: 2017 },
      { hazard: "hurricanes", year: 2017 },
      { hazard: "hurricanes", year: 2017 },
    ],
    chapters: [
      {
        title: "Landfall at Rockport",
        date: "August 26, 2017",
        body: [
          "Harvey made landfall as a Category 4 hurricane on San Jose Island, about 5 nautical miles east of Rockport, Texas, at 0300 UTC on August 26 — with 115-kt winds and a 937-mb central pressure.",
        ],
        camera: { center: [-97.05, 28.0], zoom: 8.2, pitch: 0, bearing: 0 },
        actions: [{ label: "Open Harvey's track", kind: "hurricane", value: "AL092017" }],
      },
      {
        title: "Sixty inches of rain",
        body: [
          "Harvey was the most significant tropical cyclone rainfall event in U.S. history since reliable records began around the 1880s.",
          "The highest storm total was 60.58 inches near Nederland, Texas — beating the previous U.S. tropical cyclone record of 52.00 inches.",
        ],
        camera: { center: [-94.6, 29.9], zoom: 8, pitch: 0, bearing: 0 },
      },
      {
        title: "The cost",
        body: [
          "At least 68 people died from the storm's direct effects in Texas, the most from a tropical cyclone in that state since 1919.",
          "Harvey is the second-most costly hurricane in U.S. history after inflation, behind only Katrina.",
        ],
        camera: { center: [-95.37, 29.76], zoom: 8.6, pitch: 0, bearing: 0 },
      },
    ],
  },
  {
    id: "camp-fire-2018",
    title: "The Camp Fire, 2018",
    subtitle: "California's deadliest and most destructive fire.",
    when: "2018",
    color: "#f97316",
    docs: [CAMP],
    setup: [
      { hazard: "fires", year: 2018 },
      { hazard: "fires", year: 2018 },
    ],
    chapters: [
      {
        title: "Concow, Paradise, Magalia",
        date: "November 2018",
        body: [
          "The Camp Fire in Butte County quickly reached the communities of Concow, Paradise and Magalia, triggering the evacuation of 40,000 people.",
          "It burned for 18 days before being declared 100% contained on November 25, 2018.",
        ],
        camera: { center: [-121.55, 39.8], zoom: 9.6, pitch: 0, bearing: 0 },
      },
      {
        title: "What it destroyed",
        body: [
          "The fire covered 153,336 acres and destroyed 18,804 structures, including 13,696 single-family homes. It killed 85 civilians.",
          "Open the burn scar to count the buildings standing inside it today.",
        ],
        camera: { center: [-121.6, 39.77], zoom: 10.4, pitch: 0, bearing: 0 },
        actions: [{ label: "Count what stands there now", kind: "fire", value: "2018:CAMP" }],
      },
    ],
  },
];
