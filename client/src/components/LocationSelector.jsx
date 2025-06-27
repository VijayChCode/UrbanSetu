import React, { useEffect, useState, useRef } from "react";
import data from "../data/countries+states+cities.json";
import Fuse from "fuse.js";

export default function LocationSelector({ value, onChange, mode = "form" }) {
  // Find India in the dataset
  const india = data.find((country) => country.name === "India");
  const states = india ? india.states : [];

  const [cities, setCities] = useState([]);
  const [stateSearch, setStateSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [cityHighlight, setCityHighlight] = useState(0);
  const cityInputRef = useRef();
  const cityDropdownRef = useRef();

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
    setCityDropdownOpen(false);
    setCityHighlight(0);
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

  // Multi-select for cities (search mode only)
  const selectedCities = value.cities || [];
  const handleCitySelect = (cityName) => {
    if (selectedCities.includes(cityName)) {
      onChange({ ...value, cities: selectedCities.filter((c) => c !== cityName) });
    } else {
      onChange({ ...value, cities: [...selectedCities, cityName] });
    }
  };
  const handleRemoveCity = (cityName) => {
    onChange({ ...value, cities: selectedCities.filter((c) => c !== cityName) });
  };

  // Keyboard navigation for city dropdown (search mode only)
  useEffect(() => {
    if (!cityDropdownOpen || mode !== "search") return;
    const handleKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        setCityHighlight((h) => Math.min(h + 1, filteredCities.length - 1));
      } else if (e.key === "ArrowUp") {
        setCityHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        if (filteredCities[cityHighlight]) {
          handleCitySelect(filteredCities[cityHighlight].name);
        }
      } else if (e.key === "Escape") {
        setCityDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cityDropdownOpen, filteredCities, cityHighlight, selectedCities, mode]);

  // Handlers
  const handleStateChange = (e) => {
    if (mode === "search") {
      onChange({ state: e.target.value, city: "", cities: [] });
    } else {
      onChange({ state: e.target.value, city: "" });
    }
  };
  const handleCityInputFocus = () => {
    setCityDropdownOpen(true);
  };
  const handleCityInputBlur = (e) => {
    setTimeout(() => setCityDropdownOpen(false), 100);
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
      {/* City Dropdown: single-select for form, multi-select for search */}
      {mode === "search" ? (
        <div className="relative">
          <label className="block mb-1 font-semibold text-gray-700">Cities</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedCities.map((city) => (
              <span
                key={city}
                className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1 text-sm"
              >
                {city}
                <button
                  type="button"
                  className="ml-1 text-blue-700 hover:text-red-500"
                  onClick={() => handleRemoveCity(city)}
                  aria-label={`Remove ${city}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search City..."
            value={citySearch}
            onChange={(e) => {
              setCitySearch(e.target.value);
              setCityDropdownOpen(true);
              setCityHighlight(0);
            }}
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            disabled={!value.state}
            onFocus={handleCityInputFocus}
            onBlur={handleCityInputBlur}
            ref={cityInputRef}
          />
          {/* Dropdown */}
          {cityDropdownOpen && filteredCities.length > 0 && (
            <ul
              className="absolute z-10 w-full bg-white border border-gray-200 rounded-md mt-1 max-h-48 overflow-auto shadow-lg"
              ref={cityDropdownRef}
            >
              {filteredCities.map((c, idx) => (
                <li
                  key={c.id}
                  className={`px-4 py-2 cursor-pointer hover:bg-blue-100 ${
                    cityHighlight === idx ? "bg-blue-100" : ""
                  } ${selectedCities.includes(c.name) ? "font-bold text-blue-700" : ""}`}
                  onMouseDown={() => handleCitySelect(c.name)}
                  onMouseEnter={() => setCityHighlight(idx)}
                  tabIndex={-1}
                >
                  {c.name}
                  {selectedCities.includes(c.name) && (
                    <span className="ml-2 text-xs">✔</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
} 