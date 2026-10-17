import type { AtlasStory, StoryDoc } from "@/components/atlas/story";

/* ------------------------------------------------------------------ */
/*  Ghost Towns stories, told from the records behind them: the        */
/*  National Park Service's landmark documents (Bannack nomination,    */
/*  Bodie update) and Kennecott brochure, the BLM, California State    */
/*  Parks, and the Massachusetts Archives. Every claim below is in     */
/*  the linked source; counts of places come from the map's own data. */
/*                                                                     */
/*  Action kinds:                                                      */
/*    town   open a featured town (value = featured id)                */
/*    then   open Then & now there (value = "lng,lat,zoom,name")       */
/*    fly    3D flyover of a featured town (value = featured id)       */
/*    layer  show the whole country with one layer focused (value = id)*/
/* ------------------------------------------------------------------ */

export type GhostAction = "town" | "then" | "fly" | "layer";

export const BANNACK_DOC: StoryDoc = {
  title: "Bannack Historic District — National Register of Historic Places / National Historic Landmark nomination",
  url: "https://npgallery.nps.gov/NRHP/GetAsset/NHLS/66000426_text",
  source: "National Park Service",
};
export const BODIE_DOC: StoryDoc = {
  title: "Bodie Historic District (Updated Documentation) — National Historic Landmark executive summary",
  url: "https://www.nps.gov/subjects/nationalhistoriclandmarks/upload/Bodie_update_NPSAB_ExecSumm_2025_06-09.pdf",
  source: "National Park Service",
  year: 2025,
};
export const KENNECOTT_DOC: StoryDoc = {
  title: "Kennecott Mines National Historic Landmark — park brochure",
  url: "https://www.nps.gov/wrst/planyourvisit/upload/Kennecott-Unigrid-Brochure-508.pdf",
  source: "National Park Service",
};
const QUABBIN_DOC: StoryDoc = {
  title: "Quabbin Reservoir, Dam and Aqueduct records — Massachusetts Archives",
  url: "https://www.digitalcommonwealth.org/collections/commonwealth:76537133j",
  source: "Massachusetts Archives",
};
const RHYOLITE_DOC: StoryDoc = { title: "Public tours of historic Rhyolite", url: "https://blm.gov/press-release/public-tours-historic-rhyolite-back-popular-demand", source: "Bureau of Land Management" };
const FLOODED_DOC: StoryDoc = { title: "List of flooded towns in the United States", url: "https://en.wikipedia.org/wiki/List_of_flooded_towns_in_the_United_States", source: "Wikipedia (CC BY-SA)" };

const BANNACK: [number, number] = [-112.9958, 45.1608];
const BODIE: [number, number] = [-119.0119, 38.2122];
const KENNECOTT: [number, number] = [-142.8869, 61.4859];
const ENFIELD: [number, number] = [-72.3667, 42.3167];

export const GHOST_STORIES: AtlasStory<GhostAction>[] = [
  {
    id: "boom-and-bust",
    title: "Boom and bust",
    subtitle: "Gold camps that filled overnight — and emptied almost as fast.",
    when: "1859–1942",
    color: "#fbbf24",
    docs: [BANNACK_DOC, BODIE_DOC, RHYOLITE_DOC],
    chapters: [
      {
        title: "Gold on Grasshopper Creek",
        date: "July 28, 1862",
        body: [
          "A party of prospectors bound for Idaho turned back when they heard its diggings were overcrowded. On July 28, 1862, they stopped to pan Grasshopper Creek — and touched off the first big gold strike in what would become Montana.",
          "By the end of 1862, 500 men were working the creek; 500 more arrived early in 1863.",
        ],
        camera: { center: BANNACK, zoom: 13.5, pitch: 0, bearing: 0 },
        actions: [{ label: "See Bannack on the old maps", kind: "then", value: `${BANNACK.join(",")},14.5,Bannack` }],
      },
      {
        title: "Capital, then ghost",
        date: "1864 – 1938",
        body: [
          "Richer gold at Alder Gulch soon emptied the camp; for two or three years Bannack was almost deserted. In January 1864 the vigilantes hanged sheriff Henry Plummer at Hangman's Gulch. Later that year Bannack became the temporary capital of the new Montana Territory — but the first legislature, meeting there that December, voted to hold its next session in Virginia City.",
          "Ditches revived the placers, and in 1895 the first electric gold dredge in North America arrived. When the gold gave out, the town declined; the post office closed in 1938.",
        ],
        camera: { center: BANNACK, zoom: 15, pitch: 50, bearing: 30 },
        actions: [
          { label: "Fly over Bannack", kind: "fly", value: "bannack" },
          { label: "Open Bannack", kind: "town", value: "bannack" },
        ],
      },
      {
        title: "Bodie: the West's ghost town",
        date: "1859 – 1942",
        body: [
          "Gold was found near Bodie in 1859. An 1875 cave-in exposed a rich vein, and the town boomed to roughly 8,000 people before the bust began in 1881.",
          "The National Park Service calls Bodie an exemplar of the boom-and-bust cycles of Western mining. Its last large mills shut down in 1942, when the War Production Board halted non-essential gold mining across the country.",
        ],
        camera: { center: BODIE, zoom: 14.5, pitch: 45, bearing: 20 },
        actions: [{ label: "Fly over Bodie", kind: "fly", value: "bodie" }],
      },
      {
        title: "Arrested decay",
        date: "1962 – today",
        body: [
          "Since Bodie State Historic Park was created in 1962, California State Parks has kept the town in “arrested decay”: buildings are stabilized to stop them collapsing, but not restored, and belongings left behind stay where they were.",
          "Fires in 1892 and 1932 had already left less than a tenth of the town's roughly 2,000 structures standing.",
        ],
        camera: { center: BODIE, zoom: 15.5, pitch: 0, bearing: 0 },
        actions: [{ label: "See Bodie on the old maps", kind: "then", value: `${BODIE.join(",")},15,Bodie` }],
      },
      {
        title: "Ten years of Rhyolite",
        date: "1904 – 1916",
        body: [
          "Quartz found in 1904 brought a gold rush to the Nevada desert. Within three years Rhyolite had water, electricity, telephones, a bank and 50 saloons — and perhaps 5,000 to 8,000 people.",
          "On March 14, 1911, residents began leaving in large numbers. In 1916 the power was turned off.",
        ],
        camera: { center: [-116.8287, 36.9019], zoom: 14.5, pitch: 40, bearing: -20 },
        actions: [{ label: "Open Rhyolite", kind: "town", value: "rhyolite" }],
      },
    ],
  },
  {
    id: "kennecott",
    title: "Copper in the wilderness",
    subtitle: "Kennecott: a company town at the end of a railroad through glaciers.",
    when: "1900–1938",
    color: "#ef4444",
    docs: [KENNECOTT_DOC],
    chapters: [
      {
        title: "A mountain of copper",
        date: "1900",
        body: [
          "The Ahtna people, here since time immemorial, made tools from pure copper nuggets found near the Kennicott Valley and traded them across vast distances.",
          "In 1900 prospectors Jack Smith and Clarence Warner found exceptionally rich ore — up to 77.9% copper — high in the Wrangell Mountains: one of the last rich copper deposits in North America.",
        ],
        camera: { center: KENNECOTT, zoom: 11.5, pitch: 50, bearing: 300 },
      },
      {
        title: "A railroad through glaciers",
        date: "1906 – 1911",
        body: [
          "Mining engineer Stephen Birch helped form the Alaska Syndicate with the Guggenheims and J. P. Morgan in 1906. Without a way to market, the copper was worthless — so they built one.",
          "The Copper River and Northwestern Railway, finished in 1911 after just four years, ran 196 miles over a glacier and across rivers to Cordova, where ships carried the ore to a smelter in Tacoma.",
        ],
        camera: { center: KENNECOTT, zoom: 9, pitch: 40, bearing: 200 },
      },
      {
        title: "The company town",
        date: "1910s – 1920s",
        body: [
          "World War I sent copper demand soaring, and the mill raised recovery of copper from the rock to a remarkable 96%.",
          "At the height of operations more than 600 people from over 20 countries lived and worked in the mill and mine camps. The average worker lasted six to twelve months.",
        ],
        camera: { center: KENNECOTT, zoom: 15, pitch: 55, bearing: 330 },
        actions: [{ label: "Fly over Kennecott", kind: "fly", value: "kennecott" }],
      },
      {
        title: "The end of the line",
        date: "1925 – 1986",
        body: [
          "Production peaked in 1925. As the rich ore bodies ran out, the mines closed in 1938 — after 4.6 million tons of ore and a $100 million profit. With the company gone, the railway and the town were left to the wilderness.",
          "Kennecott Mines became a National Historic Landmark in 1986.",
        ],
        camera: { center: KENNECOTT, zoom: 14.5, pitch: 0, bearing: 0 },
        actions: [
          { label: "See Kennecott on the old maps", kind: "then", value: `${KENNECOTT.join(",")},14,Kennecott` },
          { label: "Open Kennecott", kind: "town", value: "kennecott" },
        ],
      },
    ],
  },
  {
    id: "drowned-valley",
    title: "The drowned valley",
    subtitle: "Four Massachusetts towns erased for Boston's water — and the reservoirs that swallowed more.",
    when: "1887–1938",
    color: "#38bdf8",
    docs: [QUABBIN_DOC, FLOODED_DOC],
    chapters: [
      {
        title: "A valley on the map",
        date: "1887",
        body: [
          "The U.S. Geological Survey mapped the Swift River valley as early as 1887. Its sheets show the roads, streams and villages of Enfield and its neighbours — Dana, Greenwich and Prescott.",
          "Open the old survey and drag the divider: on the other side, water.",
        ],
        camera: { center: ENFIELD, zoom: 12, pitch: 0, bearing: 0 },
        actions: [{ label: "Enfield, then and now", kind: "then", value: `${ENFIELD.join(",")},13.5,Enfield` }],
      },
      {
        title: "Four towns erased",
        date: "April 28, 1938",
        body: [
          "On April 28, 1938, Dana, Enfield, Greenwich and Prescott were disincorporated — dissolved as towns — for the Quabbin Reservoir, Dam and Aqueduct, a water supply for Boston and its metropolitan area.",
        ],
        camera: { center: [-72.3, 42.38], zoom: 10.5, pitch: 0, bearing: 0 },
        actions: [{ label: "Open the lost towns of the Quabbin", kind: "town", value: "quabbin" }],
      },
      {
        title: "Even the dead were moved",
        body: [
          "Under the Acts of 1927, the water commission had to clear the cemeteries in the reservoir's watershed: about 7,500 burials in 34 cemeteries. 945 of them were moved to cemeteries outside the valley.",
        ],
        camera: { center: [-72.3, 42.38], zoom: 11.2, pitch: 40, bearing: 15 },
      },
      {
        title: "Not the only one",
        body: [
          "Wikipedia's list of flooded towns in the United States names 153 of them, in 30 states — from Kennett under California's Lake Shasta to the towns beneath the reservoirs of the Tennessee and Columbia valleys.",
          "Each blue dot on the map is one. A dashed ring means the town's own position isn't published, so it's marked at its reservoir.",
        ],
        camera: { center: [-97, 39], zoom: 3.6, pitch: 0, bearing: 0 },
        actions: [{ label: "Show only drowned towns", kind: "layer", value: "drowned" }],
      },
    ],
  },
];

export const ghostStoryById = (id: string) => GHOST_STORIES.find((s) => s.id === id);
