"use client";

import React, { useEffect, useState } from "react";

// A simple spinner using Tailwind's animate-spin utility
const Spinner = () => (
  <div className="flex justify-center items-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500 dark:border-indigo-300"></div>
  </div>
);

const CountrySearch = () => {
  const [countries, setCountries] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [mapUrl, setMapUrl] = useState("");

  // Fetch all countries on mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch("https://restcountries.com/v3.1/all");
        const data = await response.json();
        setCountries(data);
      } catch (error) {
        console.error("Error fetching countries:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchCountries();
  }, []);

  // Handler for the search button
  const handleSearch = () => {
    setSearchLoading(true);
    // Filter countries based on search text (case-insensitive)
    const filtered = countries.filter((country) =>
      country.name.common.toLowerCase().includes(searchText.toLowerCase())
    );
    // Simulate a 2-second delay before showing the results
    setTimeout(() => {
      setFilteredCountries(filtered);
      setSearchLoading(false);
      // If at least one country is found and has coordinates, update the map URL
      if (filtered.length > 0 && filtered[0].latlng) {
        const [lat, lng] = filtered[0].latlng;
        setMapUrl(`https://maps.google.com/maps?q=${lat},${lng}&z=4&output=embed`);
      } else {
        setMapUrl("");
      }
    }, 2000);
  };

  return (
    <div className="p-4 dark:text-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-center">Country Search</h1>

      {initialLoading ? (
        <div id="loader" className="my-8">
          <Spinner />
        </div>
      ) : (
        <>
          {/* Search Input and Button */}
          <div className="mb-6 flex flex-col sm:flex-row items-center gap-2">
            <input
              id="searchInputCountry"
              type="text"
              placeholder="Search for a country..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              list="countrySuggestions"
              className="p-2 border border-gray-300 rounded w-full sm:w-auto dark:bg-brand-900 dark:border-gray-600 focus:outline-none"
            />
            <datalist id="countrySuggestions">
              {countries.map((country) => (
                <option key={country.cca3} value={country.name.common} />
              ))}
            </datalist>
            <button
              id="countrySearchInput"
              onClick={handleSearch}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded hover:bg-gradient-to-r from-indigo-600 to-purple-600 focus:outline-none"
            >
              Search
            </button>
          </div>

          {/* Loading Spinner for Search */}
          {searchLoading && (
            <div id="loader" className="my-8">
              <Spinner />
            </div>
          )}

          {/* Display Filtered Country Results and Google Map */}
          {filteredCountries.length > 0 ? (
            // When a map URL is available, show the country list and map side by side on md screens and above
            mapUrl ? (
              <div className="grid grid-cols-1 md:grid-cols-2 ">
                {/* Country list */}
                <div
                  id="countryList"
                  className="grid grid-cols-1 sm:grid-cols-2"
                >
                  {filteredCountries.map((country) => (
                    <div
                      key={country.cca3}
                      className="border border-gray-300 rounded p-4 dark:border-gray-700"
                    >
                      <h3 className="text-xl font-semibold mb-2">
                        {country.name.common}
                      </h3>
                      {country.flags && country.flags.png && (
                        <img
                          src={country.flags.png}
                          alt={`${country.name.common} Flag`}
                          className="w-full mb-2 object-cover rounded"
                        />
                      )}
                      {country.flags && country.flags.alt && (
                        <p className="text-sm">
                          <strong>Flag details:</strong> {country.flags.alt}
                        </p>
                      )}
                      {country.capital && (
                        <p className="text-sm">
                          <strong>Capital:</strong> {country.capital.join(", ")}
                        </p>
                      )}
                      <p className="text-sm">
                        <strong>Population:</strong> {country.population}
                      </p>
                      {country.continents && country.continents[0] && (
                        <p className="text-sm">
                          <strong>Continent:</strong> {country.continents[0]}
                        </p>
                      )}
                      {country.languages && (
                        <p className="text-sm">
                          <strong>Languages:</strong>{" "}
                          {Object.values(country.languages).join(", ")}
                        </p>
                      )}
                      <p className="text-sm">
                        <strong>UN Member:</strong>{" "}
                        {country.unMember ? "Yes" : "No"}
                      </p>
                      {country.coatOfArms && country.coatOfArms.png && (
                        <img
                          src={country.coatOfArms.png}
                          alt={`${country.name.common} Coat of Arms`}
                          className="w-full mt-2 object-cover rounded"
                        />
                      )}
                    </div>
                  ))}
                </div>
                {/* Google Map */}
                <div className="mt-4 md:mt-0">
                  <iframe
                    id="countrySearchMap"
                    title="Country Map"
                    src={mapUrl}
                    width="100%"
                    height="400"
                    className="border-0"
                    allowFullScreen
                    loading="lazy"
                  ></iframe>
                </div>
              </div>
            ) : (
              // If no map is available, just show the country cards in a responsive grid.
              <div
                id="countryList"
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
              >
                {filteredCountries.map((country) => (
                  <div
                    key={country.cca3}
                    className="border border-gray-300 rounded p-4 dark:border-gray-700"
                  >
                    <h3 className="text-xl font-semibold mb-2">
                      {country.name.common}
                    </h3>
                    {country.flags && country.flags.png && (
                      <img
                        src={country.flags.png}
                        alt={`${country.name.common} Flag`}
                        className="w-full mb-2 object-cover rounded"
                      />
                    )}
                    {country.flags && country.flags.alt && (
                      <p className="text-sm">
                        <strong>Flag details:</strong> {country.flags.alt}
                      </p>
                    )}
                    {country.capital && (
                      <p className="text-sm">
                        <strong>Capital:</strong> {country.capital.join(", ")}
                      </p>
                    )}
                    <p className="text-sm">
                      <strong>Population:</strong> {country.population}
                    </p>
                    {country.continents && country.continents[0] && (
                      <p className="text-sm">
                        <strong>Continent:</strong> {country.continents[0]}
                      </p>
                    )}
                    {country.languages && (
                      <p className="text-sm">
                        <strong>Languages:</strong>{" "}
                        {Object.values(country.languages).join(", ")}
                      </p>
                    )}
                    <p className="text-sm">
                      <strong>UN Member:</strong>{" "}
                      {country.unMember ? "Yes" : "No"}
                    </p>
                    {country.coatOfArms && country.coatOfArms.png && (
                      <img
                        src={country.coatOfArms.png}
                        alt={`${country.name.common} Coat of Arms`}
                        className="w-full mt-2 object-cover rounded"
                      />
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            !searchLoading && <p className="text-center mt-4">No countries found.</p>
          )}
        </>
      )}
    </div>
  );
};

export default CountrySearch;
