// app/Weather/api.ts

import { Location } from './types';

export const fetchLocationName = async (
  latitude: number,
  longitude: number
): Promise<Location> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
    );
    const data = await res.json();
    const address = data.address || {};
    let name = "";
    if (address.city) {
      name = address.city;
    } else if (address.town) {
      name = address.town;
    } else if (address.village) {
      name = address.village;
    } else if (address.hamlet) {
      name = address.hamlet;
    } else {
      name = data.display_name || "Unknown Location";
    }
    const country = address.country || "";
    return { name, country, latitude, longitude };
  } catch (err) {
    console.error(err);
    return {
      name: "Unknown Location",
      country: "",
      latitude,
      longitude,
    };
  }
};
