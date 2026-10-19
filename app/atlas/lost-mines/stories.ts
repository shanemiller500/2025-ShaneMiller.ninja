import type { AtlasStory, StoryDoc } from "@/components/atlas/story";

/* ------------------------------------------------------------------ */
/*  Lost Mines stories, told from official records: state historic     */
/*  sites and parks, the National Park Service, South Dakota's mining  */
/*  agency, Sanford Lab, and USGS. Every claim is in a linked source;  */
/*  the mine counts on the map come from the map's own data.           */
/*                                                                     */
/*  Action kinds:                                                      */
/*    site      open a featured site (value = site id)                 */
/*    fly       3D flyover of a featured site (value = site id)        */
/*    then      Then & now (value = "lng,lat,zoom,name")               */
/*    timeline  "When it was mined" at a decade (value = year)         */
/*    mine      open one record (value = "mrds.<id>@<tile>")           */
/*    map       back to the map                                        */
/* ------------------------------------------------------------------ */

export type MineAction = "site" | "fly" | "then" | "timeline" | "mine" | "map";

export const NPS_AML_1990_DOC: StoryDoc = {
  title: "Abandoned Mineral Lands in the National Park System — A Pictorial Summary",
  url: "https://www.npshistory.com/publications/mines/aml-1990.pdf",
  source: "National Park Service",
  year: 1990,
};
const REED_DOC: StoryDoc = { title: "Reed Gold Mine — History", url: "https://historicsites.nc.gov/all-sites/reed-gold-mine/history", source: "NC Historic Sites" };
const DAHLONEGA_DOC: StoryDoc = { title: "Dahlonega Gold Museum State Historic Site", url: "https://gastateparks.org/DahlonegaGoldMuseum", source: "Georgia State Parks" };
const MARSHALL_DOC: StoryDoc = { title: "Marshall Gold Discovery State Historic Park", url: "https://www.parks.ca.gov/?page_id=484", source: "California State Parks" };
const KLONDIKE_DOC: StoryDoc = { title: "Ton of Goods", url: "https://www.nps.gov/klgo/learn/historyculture/tonofgoods.htm", source: "National Park Service" };
const KLONDIKE_HRS_DOC: StoryDoc = { title: "Proposed Klondike Gold Rush National Historical Park — Historic Resource Study (Bearss)", url: "https://www.npshistory.com/publications/klgo/hrs.pdf", source: "National Park Service", year: 1970 };
const HOMESTAKE_STATE_DOC: StoryDoc = { title: "South Dakota mining history — Homestake", url: "https://danr.sd.gov/Environment/MineralsMining/MiningHistory.aspx", source: "S.D. Dept. of Agriculture & Natural Resources" };
const SANFORD_DOC: StoryDoc = { title: "Our Story", url: "https://sanfordlab.org/our-story", source: "Sanford Underground Research Facility" };
const MRDS_HOMESTAKE_DOC: StoryDoc = { title: "Homestake Mine — MRDS record #10106953", url: "https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=10106953", source: "U.S. Geological Survey" };
const NPS_HAZARDS_DOC: StoryDoc = { title: "Abandoned Mineral Lands — Hazards and Safety", url: "https://www.nps.gov/subjects/abandonedminerallands/hazards-and-safety.htm", source: "National Park Service" };
const NPS_CLOSURES_DOC: StoryDoc = { title: "Physical Hazards Abatement: “Look but Don't Touch & Stay Out, Stay Alive”", url: "https://www.nps.gov/articles/aps-v4-i2-c12.htm", source: "National Park Service" };
const NPS_AML_DOC: StoryDoc = { title: "Abandoned Mineral Lands", url: "https://www.nps.gov/subjects/abandonedminerallands/index.htm", source: "National Park Service" };
const USMIN_DOC: StoryDoc = { title: "Prospect- and mine-related features from USGS topographic maps — metadata", url: "https://mrdata.usgs.gov/usmin/metadata/usmin-topo.html", source: "U.S. Geological Survey" };
const USGS_AML_FS_DOC: StoryDoc = { title: "The Abandoned Mine Inventory of the United States — A Brief Summary (Fact Sheet 2025–3003)", url: "https://pubs.usgs.gov/publication/fs20253003", source: "U.S. Geological Survey", year: 2025 };
const KEANE_DOC: StoryDoc = { title: "Keane Wonder Mine", url: "https://www.nps.gov/deva/learn/historyculture/keane-wonder-mine.htm", source: "National Park Service" };

const REED: [number, number] = [-80.46996, 35.28542];
const DAHLONEGA: [number, number] = [-83.98488, 34.53267];
const COLOMA: [number, number] = [-120.89236, 38.80347];
const SKAGWAY: [number, number] = [-135.26367, 59.57537];
const LEAD: [number, number] = [-103.76501, 44.35607];
const BODIE: [number, number] = [-119.0119, 38.2122];
const KEANE: [number, number] = [-116.90944, 36.66917];

export const MINE_STORIES: AtlasStory<MineAction>[] = [
  {
    id: "gold-fever",
    title: "Gold fever",
    subtitle: "From a doorstop in North Carolina to a ton of goods on the Chilkoot.",
    when: "1799–1898",
    color: "#facc15",
    docs: [REED_DOC, DAHLONEGA_DOC, MARSHALL_DOC, KLONDIKE_DOC, KLONDIKE_HRS_DOC],
    chapters: [
      {
        title: "A 17-pound doorstop",
        date: "1799",
        body: [
          "One Sunday in 1799, Conrad Reed found a large yellow rock in Little Meadow Creek on his family's North Carolina farm. It reportedly weighed 17 pounds, and for three years it held the door open.",
          "In 1802 a Fayetteville jeweler bought it for $3.50 — one-tenth of one percent of its value. It was the first documented gold find in the United States, and North Carolina led the nation in gold until 1848.",
        ],
        camera: { center: REED, zoom: 14, pitch: 40 },
        actions: [
          { label: "Open Reed Gold Mine", kind: "site", value: "reed" },
          { label: "The map in the 1790s", kind: "timeline", value: 1790 },
        ],
      },
      {
        title: "Into the Cherokee Nation",
        date: "c. 1829",
        body: [
          "Twenty years before California, thousands of prospectors flocked into the Cherokee Nation in north Georgia — what the state calls America's first major gold rush.",
          "A U.S. Branch Mint opened at Dahlonega in 1838 and coined more than $6 million in gold before it closed in 1861.",
        ],
        camera: { center: DAHLONEGA, zoom: 13, pitch: 40 },
        actions: [{ label: "Open Dahlonega", kind: "site", value: "dahlonega" }],
      },
      {
        title: "Gold in the tailrace",
        date: "1848",
        body: [
          "In 1848 James Marshall found gold in the tailrace of the sawmill he was building with John Sutter on the American River. It set off the greatest mass movement of people in the Western Hemisphere.",
          "Step the timeline into the 1850s and watch the Sierra light up with mines.",
        ],
        camera: { center: COLOMA, zoom: 14, pitch: 45 },
        actions: [
          { label: "The 1850s on the timeline", kind: "timeline", value: 1850 },
          { label: "Then & now at Coloma", kind: "then", value: `${COLOMA[0]},${COLOMA[1]},14.5,Sutter's Mill` },
        ],
      },
      {
        title: "A ton of goods",
        date: "1897–98",
        body: [
          "The Klondike's gold was in Canada, but the way in ran through Skagway and Dyea. Canada required every stampeder to bring a year's supply — food alone weighed at least 1,095 pounds, a “ton of goods” with gear.",
          "Relaying it over the passes, some walked nearly 1,000 miles to move their supplies the 33 miles from Dyea to Lake Bennett.",
        ],
        camera: { center: SKAGWAY, zoom: 10.5, pitch: 50, bearing: -20 },
        actions: [
          { label: "Open Skagway & the trails", kind: "site", value: "klondike" },
          { label: "Fly over in 3D", kind: "fly", value: "klondike" },
        ],
      },
    ],
  },
  {
    id: "homestake",
    title: "Homestake",
    subtitle: "125 years of gold in the Black Hills — and what the records say now.",
    when: "1876–2001",
    color: "#eab308",
    docs: [HOMESTAKE_STATE_DOC, SANFORD_DOC, MRDS_HOMESTAKE_DOC],
    chapters: [
      {
        title: "A strike in the Black Hills",
        date: "1876",
        body: [
          "Homestake was operating by 1876 at Lead, in South Dakota's Black Hills. It would run for 125 years.",
          "Over its life its mill processed 167.63 million tons of ore and produced 39.62 million ounces of gold and 9 million ounces of silver.",
        ],
        camera: { center: LEAD, zoom: 13, pitch: 45 },
        actions: [{ label: "Then & now: the 1894 map", kind: "then", value: `${LEAD[0]},${LEAD[1]},14.5,Homestake Mine` }],
      },
      {
        title: "Largest and deepest",
        body: ["Until it closed, Homestake was the largest and deepest gold mine in North America."],
        camera: { center: LEAD, zoom: 14.5, pitch: 60, bearing: 30 },
        actions: [{ label: "Fly over in 3D", kind: "fly", value: "homestake" }],
      },
      {
        title: "The last ton",
        date: "December 14, 2001",
        body: [
          "Homestake mined its last ton of gold ore on December 14, 2001. On February 13, 2002, the mill shut down for good.",
          "In 2006 the old mine became an underground research facility — science where the miners worked.",
        ],
        camera: { center: LEAD, zoom: 13.5, pitch: 40 },
      },
      {
        title: "Two registers, two answers",
        body: [
          "USGS's Mineral Resources Data System stopped updating in 2011, and it still lists Homestake as a producer. MSHA's register — kept current — lists it as abandoned since 2007.",
          "Old records drift from the ground. This map shows both, with their dates, so you can tell.",
        ],
        camera: { center: LEAD, zoom: 13, pitch: 0 },
        actions: [{ label: "Open the USGS record", kind: "mine", value: "mrds.10106953@-52_22" }],
      },
    ],
  },
  {
    id: "stay-out",
    title: "Why old mines kill",
    subtitle: "Hundreds of thousands of old workings — and why the new maps leave them off.",
    when: "Today",
    color: "#f87171",
    docs: [USMIN_DOC, NPS_HAZARDS_DOC, NPS_CLOSURES_DOC, USGS_AML_FS_DOC, NPS_AML_1990_DOC, KEANE_DOC],
    chapters: [
      {
        title: "Gone from the map",
        body: [
          "USGS digitized 725,690 mine symbols — shafts, adits, prospect pits, dumps — from about 106,350 of its old topographic maps, dated 1886 to 2006. The newer US Topo maps don't show mine symbols at all.",
          "Around Bodie, California, the old maps mark hundreds of them. Zoom in anywhere in the West and they appear.",
        ],
        camera: { center: BODIE, zoom: 14, pitch: 0 },
        actions: [{ label: "Then & now at Bodie", kind: "then", value: `${BODIE[0]},${BODIE[1]},14.5,Bodie` }],
      },
      {
        title: "Left open",
        body: [
          "Mines were built to be safe only while they were working. When miners moved on, they often left shafts uncovered and took the ventilation and pumps with them; timbers and ore pillars were removed or left to rot.",
          "At Keane Wonder in Death Valley, the park closed the area from 2008 to 2017 for stabilization and mine safety work — and still warns that not all shafts are closed.",
        ],
        camera: { center: KEANE, zoom: 15, pitch: 55, bearing: 30 },
        actions: [
          { label: "Open Keane Wonder", kind: "site", value: "keane-wonder" },
          { label: "Fly over in 3D", kind: "fly", value: "keane-wonder" },
        ],
      },
      {
        title: "The air, the water, the dynamite",
        body: [
          "Carbon monoxide, carbon dioxide, methane and hydrogen sulfide collect underground, and pockets of still air can hold almost no oxygen. By the time you feel ill, you can't react.",
          "Nationally, the most common cause of death at abandoned mines is drowning in water-filled quarries and pits — the water is deep, cold and walled in. Old explosives become so unstable a footstep can set them off.",
        ],
        camera: { center: KEANE, zoom: 13, pitch: 40 },
      },
      {
        title: "Closing them — and keeping the bats",
        body: [
          "The Park Service closes openings with foam plugs, by collapsing them, or with slotted gates that let bats in but keep people out. Its 1990 survey counted 9,934 abandoned mine hazards and openings in 120 park units; today it counts about 38,000 abandoned mineral land features.",
          "Nationwide there are hundreds of thousands, and as of 2025 no complete inventory. USGS is building one — and will not publish exact locations, so the workings can't be used as a guide to explore them. Look, don't climb. Stay out, stay alive.",
        ],
        camera: { center: [-112, 40], zoom: 4.2 },
        actions: [{ label: "Back to the map", kind: "map" }],
      },
    ],
  },
];

export const mineStoryById = (id: string) => MINE_STORIES.find((s) => s.id === id);
