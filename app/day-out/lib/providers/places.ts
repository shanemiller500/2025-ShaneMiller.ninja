import type { Activity, Category, Stop } from "../types";

// Editorial place ideas, not event fixtures or assertions that a venue is open.
// Coordinates mark the place / town centre, not a verified entrance or parking bay.
type Photo = { file: string; credit?: string };
type Extra = Partial<Pick<Activity, "environment" | "travel">> & { photo?: Photo };
// Real photos from Wikimedia Commons. The credit links to the file page, which lists author and licence.
const photo = (file: string, credit = "Wikimedia Commons"): Photo => ({ file, credit });
const place = (id: string, title: string, category: Category, suburb: string, region: string, latitude: number, longitude: number, description: string, url: string, extra: Extra = {}): Activity => ({
  id, kind: "place", title, category, suburb, region, latitude, longitude, description, curated: true,
  environment: extra.environment || "outdoor", travel: extra.travel,
  imageUrl: extra.photo && `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(extra.photo.file)}?width=1200`,
  imageSourceUrl: extra.photo && `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(extra.photo.file)}`,
  imageAttribution: extra.photo && `Photo: ${extra.photo.credit}`,
  source: { name: "Visitor information", url, fetchedAt: "2026-09-28T00:00:00.000Z" },
});
const stop = (name: string, latitude: number, longitude: number): Stop => ({ name, latitude, longitude });
const ride = (id: string, title: string, region: string, description: string, stops: Stop[], url: string, image?: Photo): Activity => ({
  ...place(id, title, "Ride", stops[0].name, region, stops[0].latitude, stops[0].longitude, description, url, { photo: image }),
  kind: "ride", stops,
});

export const PLACES: Activity[] = [
  // Bike rides
  ride("cunninghams-ride", "Cunninghams Gap & Queen Mary Falls", "Southern Downs", "Over the range to Killarney and the falls, with a stop at the top of the gap. The map shows stops, not the road route.", [stop("Aratula", -27.98, 152.55), stop("Cunninghams Gap", -28.05, 152.385), stop("Killarney", -28.333, 152.295), stop("Queen Mary Falls", -28.345, 152.371)], "https://www.southerndownsandgranitebelt.com.au/", photo("Cunninghams_Gap_from_Kents_Lagoon.jpg")),
  ride("lions-ride", "Lions Road to Kyogle", "Scenic Rim / Northern NSW", "Over the border range on the Lions Road, past the old spiral rail loop, then lunch in Kyogle. Check whether the road is open first.", [stop("Rathdowney", -28.213, 152.863), stop("Lions Road", -28.332, 152.973), stop("Kyogle", -28.62, 153.003)], "https://www.visitscenicrim.com.au/", photo("Rathdowney.JPG")),
  ride("tamborine-ride", "Tamborine & Canungra", "Scenic Rim", "Up the mountain, then down for a feed at the Canungra pub. A suggested itinerary; the map shows stops, not the road route.", [stop("Nerang", -27.99, 153.336), stop("Tamborine Mountain", -27.927, 153.185), stop("Canungra", -28.017, 153.164)], "https://www.visitscenicrim.com.au/", photo("CanungraHotel.JPG")),
  ride("beechmont-ride", "Beechmont to Binna Burra", "Gold Coast Hinterland", "Tight mountain road with a Beechmont stop and Binna Burra at the top. Check Lamington park notices and road conditions.", [stop("Nerang", -27.99, 153.336), stop("Beechmont", -28.124, 153.193), stop("Binna Burra", -28.195, 153.187)], "https://parks.qld.gov.au/parks/lamington", photo("Beechmont_-_panoramio.jpg")),
  ride("springbrook-ride", "Springbrook & Natural Bridge", "Gold Coast Hinterland", "Springbrook and Natural Bridge by public roads. They're separate park sections; use Directions for the connecting roads.", [stop("Mudgeeraba", -28.079, 153.365), stop("Springbrook", -28.228, 153.272), stop("Natural Bridge", -28.198, 153.241)], "https://parks.qld.gov.au/parks/springbrook", photo("Springbrook_Cave.jpg")),
  ride("valley-ride", "Two quiet valley stops", "Gold Coast", "Tallebudgera Valley and Currumbin Valley as separate stops. Directions chooses the connecting roads.", [stop("Tallebudgera Valley", -28.19, 153.367), stop("Currumbin Valley", -28.208, 153.393)], "https://www.experiencegoldcoast.com/", photo("Tallebudgera_Creek_Dam,_Tallebudgera_Valley,_Queensland.jpg")),
  ride("nebo-ride", "Samford, Nebo & Glorious", "Brisbane", "The D'Aguilar ranges run from Samford. Check the weather up high and current park and road notices.", [stop("Samford", -27.372, 152.887), stop("Mount Nebo", -27.399, 152.787), stop("Mount Glorious", -27.333, 152.763)], "https://parks.qld.gov.au/parks/daguilar", photo("Following_mountains_ridge_Mount_Glorious_Road_through_D'Aguilar_National_Park,_Queensland_02.jpeg")),
  ride("scenic-rim-ride", "Boonah & Rathdowney", "Scenic Rim", "A full day out through Boonah and Rathdowney, country pubs included. Check fuel stops in Directions before leaving.", [stop("Beaudesert", -27.988, 152.996), stop("Boonah", -27.997, 152.683), stop("Rathdowney", -28.213, 152.863)], "https://www.visitscenicrim.com.au/", photo("Rathdowney.JPG")),

  // War & military history
  place("amberley", "RAAF Amberley Aviation Heritage Centre", "War", "Amberley", "Ipswich", -27.64, 152.712, "Old fighter jets and bombers on a working air force base. It's only open on selected days and needs ID, so check before you go.", "https://www.airforce.gov.au/", { environment: "mixed", photo: photo("A41-213_taking_off_from_RAAF_Base_Amberley.jpg") }),
  place("oakey", "Australian Army Flying Museum", "War", "Oakey", "Toowoomba", -27.41, 151.735, "Army helicopters and warplanes out past Toowoomba. Good for an overnighter with the caravan.", "https://www.armyflyingmuseum.com.au/", { environment: "indoor", photo: photo("Army_Aviation_Centre_Oakey.jpg") }),
  place("maryborough-military", "Maryborough Military & Colonial Museum", "War", "Maryborough", "Fraser Coast", -25.54, 152.702, "A big collection of military gear in a heritage town. It's a long way, so take the caravan and make a weekend of it.", "https://www.visitfrasercoast.com/", { environment: "indoor", photo: photo("MaryboroughMilitaryMuseum.JPG") }),
  place("air-museum", "Queensland Air Museum", "War", "Caloundra", "Sunshine Coast", -26.8, 153.105, "Hangars full of military aircraft, from fighter jets to bombers. Check opening hours and entry prices before going.", "https://www.qam.com.au/", { environment: "indoor", photo: photo("Queensland_Air_Museum_-_panoramio.jpg", "Ché Lydia Xyang, CC BY-SA 3.0") }),
  place("fort-lytton", "Fort Lytton", "War", "Lytton", "Brisbane", -27.41, 153.152, "The old fort that guarded the Brisbane River, with tunnels, gun pits and a military museum. Check open days with Queensland Parks.", "https://parks.qld.gov.au/parks/fort-lytton", { environment: "mixed", photo: photo("Inside_Fort_Lytton_1a.jpg") }),
  place("diamantina", "HMAS Diamantina, the WWII warship", "War", "South Brisbane", "Brisbane", -27.481, 153.028, "Go aboard a WWII frigate at the Queensland Maritime Museum. Leave the car: take the train to South Brisbane and walk through South Bank.", "https://maritimemuseum.com.au/", { environment: "mixed", travel: "transit", photo: photo("HMAS_Diamantina_Brisbane.jpg", "Nighthaze3320, CC BY-SA 4.0") }),
  place("anzac-square", "Anzac Square & memorial galleries", "War", "Brisbane City", "Brisbane", -27.467, 153.026, "Queensland's war memorial, with galleries underneath. It's across the road from Central Station, so take the train.", "https://www.brisbane.qld.gov.au/", { environment: "mixed", travel: "transit", photo: photo("ANZAC_Square,_Brisbane_in_February_2020.jpg") }),
  place("bribie-forts", "Bribie Island WWII forts", "War", "Bribie Island", "Moreton Bay", -27.03, 153.18, "Wartime gun emplacements and forts on the ocean side of Bribie. It's 4WD access only and needs vehicle permits; check the park page first.", "https://parks.qld.gov.au/parks/bribie-island", { photo: photo("Southern_gun_emplacement_from_east_(2013).jpg", "Heritage branch staff, CC BY 3.0") }),

  // Live music
  place("tamworth", "Tamworth Country Music Festival", "Music", "Tamworth", "New England NSW", -31.09, 150.93, "The big one, every January. Busking all down Peel Street and caravans everywhere. Book a site early.", "https://www.tcmf.com.au/", { photo: photo("Jetty_Road_concert.jpg") }),
  place("blues-broadbeach", "Blues on Broadbeach", "Music", "Broadbeach", "Gold Coast", -28.028, 153.431, "Free blues festival, usually in May, with bands all over Broadbeach. Take the tram, skip the parking. Check this year's dates.", "https://bluesonbroadbeach.com/", { environment: "mixed", travel: "transit", photo: photo("Broadbeach_Panorama.jpg", "BobTanGo, CC BY 4.0") }),
  place("gympie-muster", "Gympie Music Muster", "Music", "Amamoor", "Gympie", -26.35, 152.63, "Big country music festival in the state forest, usually late August. Bring the caravan and camp on site. Check dates and camping tickets.", "https://www.muster.com.au/", { photo: photo("Gympie_muster_1.jpg") }),

  // Hinterland
  place("queen-mary", "Queen Mary Falls", "Hinterland", "Killarney", "Southern Downs", -28.345, 152.371, "A proper waterfall over the range past Boonah. There's a caravan park right at the falls.", "https://www.southerndownsandgranitebelt.com.au/", { photo: photo("Queen_Mary_Falls.jpg") }),
  place("cunninghams", "Cunninghams Gap lookout", "Hinterland", "Cunninghams Gap", "Scenic Rim", -28.05, 152.385, "Stand at the top of the Great Dividing Range and look back toward the coast.", "https://parks.qld.gov.au/parks/main-range", { photo: photo("Cunninghams_Gap_from_Kents_Lagoon.jpg") }),
  place("tamborine", "Tamborine Mountain", "Hinterland", "Tamborine Mountain", "Scenic Rim", -27.93, 153.19, "Lookouts, a brewery and a good lunch up the hill. Close enough for a half day.", "https://www.visitscenicrim.com.au/", { environment: "mixed", photo: photo("Bavarian_Grill_Haus_&_Red_Baron_Brewery,_Tamborine_Mountain,_Queensland_08.jpg") }),
  place("springbrook", "Springbrook lookouts", "Hinterland", "Springbrook", "Gold Coast Hinterland", -28.228, 153.272, "Rainforest, waterfalls and big views over the coast. Park notices can close individual tracks and roads.", "https://parks.qld.gov.au/parks/springbrook", { photo: photo("IMAG0310.jpg") }),
  place("lamington", "O'Reilly's & Lamington", "Hinterland", "Lamington", "Scenic Rim", -28.23, 153.135, "A long, winding drive up to O'Reilly's in Lamington National Park. Worth a full day.", "https://parks.qld.gov.au/parks/lamington", { photo: photo("Lamington_NP_1_Stevage.jpg") }),

  // Camping & caravans
  place("mt-barney", "Mount Barney camping", "Camping", "Mount Barney", "Scenic Rim", -28.274, 152.662, "Camp by the creek under the mountain, about an hour and a half inland. Check which campgrounds suit a caravan.", "https://parks.qld.gov.au/parks/mount-barney", { photo: photo("MtBarney.jpg") }),
  place("girraween", "Girraween National Park", "Camping", "Wyberba", "Granite Belt", -28.774, 151.912, "Giant granite boulders, cold nights and wineries nearby. Castle Rock campground takes caravans; book ahead.", "https://parks.qld.gov.au/parks/girraween", { photo: photo("1_Girraween_National_Park_4.JPG") }),
  place("straddie", "Straddie (Point Lookout)", "Camping", "Point Lookout", "Redlands", -27.428, 153.54, "Take the car ferry with the van, camp near the beach and watch the whales from the gorge walk.", "https://www.redlandscoast.com.au/", { photo: photo("NorthGorgeLookingEast.jpg") }),
  place("moogerah", "Lake Moogerah", "Camping", "Moogerah", "Scenic Rim", -28.04, 152.55, "A lakeside caravan park under the Scenic Rim peaks. Book a powered site and check towing access before you go.", "https://www.seqwater.com.au/recreation", { photo: photo("Lake_Moogerah_dam_wall.jpg") }),
  place("somerset", "Lake Somerset", "Camping", "Kilcoy", "Somerset", -27.12, 152.55, "Big lake, holiday park and room for the caravan. Good for fishing and a few quiet days.", "https://www.seqwater.com.au/recreation", { photo: photo("SomersetDamWallNew.JPG") }),
  place("wivenhoe", "Lake Wivenhoe camping", "Camping", "Wivenhoe", "Somerset", -27.36, 152.61, "Lakeside campgrounds on Brisbane's biggest lake. Check site bookings and fire rules with Seqwater.", "https://www.seqwater.com.au/recreation", { photo: photo("Lake_Wivenhoe,_Queensland.JPG", "Unaipon, CC BY 3.0") }),
  place("tallebudgera-park", "Tallebudgera Creek Tourist Park", "Camping", "Burleigh Heads", "Gold Coast", -28.1, 153.456, "Close to home, right on the creek. An easy first trip with the campervan and trailer.", "https://www.goldcoasttouristparks.com.au/"),

  // Motorsport
  place("gc500", "Gold Coast 500 Supercars", "Motorsport", "Surfers Paradise", "Gold Coast", -27.97, 153.425, "Supercars flat out through the streets of Surfers, usually in October. The tram stops right beside it. Check dates and tickets.", "https://www.supercars.com/", { environment: "mixed", travel: "transit", photo: photo("Marcos_Ambrose_in_Supercar_at_Surfers_Paradise.jpg") }),
  place("bathurst", "Bathurst 1000 at Mount Panorama", "Motorsport", "Bathurst", "Central West NSW", -33.447, 149.556, "The great Aussie pilgrimage. Tow the van down and camp on the mountain for race week. Book early.", "https://www.supercars.com/bathurst", { photo: photo("Bathurstconrod.jpg", "Mr Bungle, public domain") }),
  place("ipswich-motorsport", "Queensland Raceway & Willowbank", "Motorsport", "Willowbank", "Ipswich", -27.69, 152.655, "Circuit racing at Queensland Raceway, with drag racing at Willowbank next door. Check the event calendars for race days.", "https://www.ipswich.qld.gov.au/", { photo: photo("V8_Supercar_start_2011.jpg", "NJM2010, CC BY-SA 3.0") }),

  // Tram & train days
  place("suncorp", "Footy at Suncorp Stadium", "Transit", "Milton", "Brisbane", -27.465, 153.009, "Origin, Broncos, Titans away games. Take the train to Roma Street and walk. Nobody wants to park at Suncorp.", "https://www.suncorpstadium.com.au/", { environment: "mixed", travel: "transit", photo: photo("Suncorp_Stadium,_April_2024_(Reds_v_Blues).jpg") }),
  place("gabba", "Cricket or footy at the Gabba", "Transit", "Woolloongabba", "Brisbane", -27.486, 153.038, "Train to South Brisbane, then a walk or a game-day bus. Check the fixture first.", "https://www.thegabba.com.au/", { environment: "mixed", travel: "transit", photo: photo("The_Gabba_Panorama.jpg") }),
  place("tram-broadbeach", "Tram to Broadbeach", "Transit", "Broadbeach", "Gold Coast", -28.028, 153.431, "Catch the G:link tram down the coast, have a counter lunch and a beer, and nobody has to drive home.", "https://translink.com.au/", { environment: "mixed", travel: "transit", photo: photo("GCLR_Set_9_at_Cypress_Avenue_2014-09-28.jpg") }),
  place("south-bank", "Train to South Bank", "Transit", "South Brisbane", "Brisbane", -27.479, 153.023, "Take the tram to Helensvale, change to the train and get off at South Brisbane. Check what's on at South Bank first; there are often free gigs and events.", "https://www.visitbrisbane.com.au/south-bank", { environment: "mixed", travel: "transit", photo: photo("Streets_Beach_at_South_Bank_Parklands,_Brisbane_03.jpg") }),
];

// Stay-home ideas mixed into Best today for a laugh (and a rest). Never ranked or mapped.
// `file` is a Commons file name, or a path under /public (starting with "/") for our own photos.
const home = (id: string, title: string, description: string, cta: string, url: string, file: string, environment: Activity["environment"] = "indoor"): Activity => ({
  ...place(id, title, "Home", "At home", "Your place", 0, 0, description, url, { environment, photo: file.startsWith("/") ? undefined : photo(file) }),
  ...(file.startsWith("/") ? { imageUrl: file } : {}),
  kind: "home", latitude: undefined, longitude: undefined, cta,
});
export const HOME: Activity[] = [
  home("netflix", "Sit on your arse and watch Netflix", "No traffic, no fuel, no park notices. Recliner back, feet up, remote in hand. Pick a war doco and call it research.", "Fire up Netflix", "https://www.netflix.com/", "Living_room_with_1960s_objects.jpg"),
  home("call-son", "Call your son!", "Message from Shane: give me a ring, old man. Tell me where you went today, or where you're pretending you went.", "Ring him", "tel:", "/images/2026me.png"),
  home("rest", "Have a rest today", "You've earned it. The hinterland will still be there tomorrow. Hammock, cold one, done.", "Righto, feet up", "https://www.bom.gov.au/qld/forecasts/gold-coast.shtml", "Hammock_nap_on_patio.jpg", "outdoor"),
  home("mow", "Mow the lawns", "That grass won't cut itself. The neighbours are talking. Fuel up the mower instead of the bike.", "Fine, I'll do it", "https://www.bom.gov.au/qld/forecasts/gold-coast.shtml", "Lawn_Mowing_DVIDS119604.jpg", "outdoor"),
  home("wash-bike", "Give the bike a wash", "Polish the chrome so it's shiny for the next ride. Bonus points for a quick chain lube.", "Grab the bucket", "https://www.bom.gov.au/qld/forecasts/gold-coast.shtml", "Washing_a_Motorcycle.jpg", "outdoor"),
  home("bbq", "Fire up the barbie", "Snags, onions, a cold one and the footy on the radio. Invite the kids round.", "Tongs at the ready", "https://www.bom.gov.au/qld/forecasts/gold-coast.shtml", "Barbecued_meats.jpg", "outdoor"),
  home("touch-grass", "Go touch some grass", "Put the phone down, get off the internet and stand on the lawn in your socks. Doctor's orders.", "Shoes off, out ya go", "https://www.bom.gov.au/qld/forecasts/gold-coast.shtml", "The_Lawn_UVa_2007.jpg", "outdoor"),
  home("pub-walk", "Walk to the pub", "Leave the keys at home. Stroll down, have a schooner and a counter meal, stroll back. Exercise and a beer: balanced diet.", "Righto, walking", "https://www.google.com/maps/search/pub+near+me", "StateLibQld_1_118076_Patrons_of_the_Green_Gate_Hotel_on_the_verandah,_Adavale,_1928.jpg", "mixed"),
  home("bowls-lunch", "Take Mum to the bowls club", "Shout her a senior citizens' lunch: roast of the day, a shandy and a raffle ticket. Brownie points for months.", "Book a table", "https://www.google.com/maps/search/bowls+club+near+me", "Hughenden_Bowls_Club,_Hughenden,_QLD,_Australia_01.jpg", "mixed"),
  home("shed", "Potter in the shed", "Sort the nuts and bolts jar. Find the thing you lost in 2019. Tell nobody what you actually did.", "Into the shed", "https://www.bunnings.com.au/", "Schuppen_7235.jpg"),
];
