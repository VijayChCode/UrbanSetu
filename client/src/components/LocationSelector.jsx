import React, { useEffect, useState } from "react";
import data from "../data/countries+states+cities.json";
import Fuse from "fuse.js";

export default function LocationSelector({ value, onChange, mode = "form" }) {
  // Find India in the dataset
  const india = data.find((country) => country.name === "India");
  const states = india ? india.states : [];

  const [cities, setCities] = useState([]);
  const [stateSearch, setStateSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");

  // When state changes, update cities
  useEffect(() => {
    if (value.state) {
      const stateObj = states.find(
        (s) => s.name === value.state || s.state_code === value.state
      );
      setCities(stateObj ? stateObj.cities : []);
    } else {
      setCities([]);
    }
    setCitySearch(""); // Reset city search when state changes
  }, [value.state, states]);

  // Fuzzy search for states
  const fuseStates = new Fuse(states, { keys: ["name"], threshold: 0.4 });
  const filteredStates = stateSearch
    ? fuseStates.search(stateSearch).map((r) => r.item)
    : states;

  // Fuzzy search for cities
  const fuseCities = new Fuse(cities, { keys: ["name"], threshold: 0.4 });
  const filteredCities = citySearch
    ? fuseCities.search(citySearch).map((r) => r.item)
    : cities;



  // Handlers
  const handleStateChange = (e) => {
    onChange({ state: e.target.value, city: "" });
  };
  const handleCityChange = (e) => {
    onChange({ ...value, city: e.target.value });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* State Dropdown with fuzzy search */}
      <div>
        <label className="block mb-1 font-semibold text-gray-700">State</label>
        <input
          type="text"
          placeholder="Search State..."
          value={stateSearch}
          onChange={(e) => setStateSearch(e.target.value)}
          className="w-full mb-2 p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        />
        <select
          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          value={value.state || ""}
          onChange={handleStateChange}
        >
          <option value="">Select State</option>
          {filteredStates.map((s) => (
            <option key={s.state_code} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {/* City Dropdown: single-select for both form and search modes */}
      <div>
        <label className="block mb-1 font-semibold text-gray-700">City</label>
        <input
          type="text"
          placeholder="Search City..."
          value={citySearch}
          onChange={(e) => setCitySearch(e.target.value)}
          className="w-full mb-2 p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          disabled={!value.state}
        />
        <select
          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          value={value.city || ""}
          onChange={handleCityChange}
          disabled={!value.state}
        >
          <option value="">Select City</option>
          {filteredCities.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
} 