import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ListingItem from "../components/ListingItem";
import LocationSelector from "../components/LocationSelector";

export default function PublicSearch() {
    const location = useLocation();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        searchTerm: "",
        type: "all",
        parking: false,
        furnished: false,
        offer: false,
        sort: "createdAt",
        order: "desc",
        minPrice: "",
        maxPrice: "",
        city: "",
        state: "",
        bedrooms: "",
        bathrooms: "",
    });
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showMoreListing, setShowMoreListing] = useState(false);
    const [error, setError] = useState(null);
    const [locationFilter, setLocationFilter] = useState({ state: "", district: "", city: "" });

    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        setFormData({
            searchTerm: urlParams.get("searchTerm") || "",
            type: urlParams.get("type") || "all",
            parking: urlParams.get("parking") === "true",
            furnished: urlParams.get("furnished") === "true",
            offer: urlParams.get("offer") === "true",
            sort: urlParams.get("sort") || "createdAt",
            order: urlParams.get("order") || "desc",
            minPrice: urlParams.get("minPrice") || "",
            maxPrice: urlParams.get("maxPrice") || "",
            city: urlParams.get("city") || "",
            state: urlParams.get("state") || "",
            bedrooms: urlParams.get("bedrooms") || "",
            bathrooms: urlParams.get("bathrooms") || "",
        });
        setLocationFilter({
            state: urlParams.get("state") || "",
            district: urlParams.get("district") || "",
            city: urlParams.get("city") || "",
        });

        const fetchListings = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/listing/get?${urlParams.toString()}`);
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                const data = await res.json();
                setListings(Array.isArray(data) ? data : []);
                setShowMoreListing(Array.isArray(data) && data.length > 8);
            } catch (error) {
                console.error("Error fetching listings:", error);
                setError("Failed to load listings. Please try again.");
                setListings([]);
                setShowMoreListing(false);
            }
            setLoading(false);
        };
        fetchListings();
    }, [location.search]);

    const handleChanges = (e) => {
        const { name, value, checked, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const urlParams = new URLSearchParams(formData);
        navigate(`?${urlParams.toString()}`);
    };

    const showMoreListingClick = async () => {
        try {
            const urlParams = new URLSearchParams(location.search);
            urlParams.set("startIndex", listings.length);
            const res = await fetch(`/api/listing/get?${urlParams.toString()}`);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                setListings((prev) => [...prev, ...data]);
                setShowMoreListing(data.length >= 8);
            }
        } catch (error) {
            console.error("Error fetching more listings:", error);
        }
    };

    const handleLocationChange = (loc) => {
        setLocationFilter(loc);
        setFormData((prev) => ({ ...prev, state: loc.state, district: loc.district, city: loc.city }));
    };

    return (
        <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
            <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
                <h3 className="text-3xl font-extrabold text-blue-700 mb-6 text-center drop-shadow">
                    Explore Properties
                </h3>
                <form
                    onSubmit={handleSubmit}
                    className="grid md:grid-cols-2 gap-4 bg-gray-100 p-4 rounded-lg mb-6"
                >
                    <input
                        type="text"
                        name="searchTerm"
                        placeholder="Search..."
                        value={formData.searchTerm}
                        onChange={handleChanges}
                        className="p-2 border rounded-md w-full"
                    />

                    <select
                        name="sort_order"
                        onChange={(e) => {
                            const [sort, order] = e.target.value.split("_");
                            setFormData((prev) => ({
                                ...prev,
                                sort,
                                order,
                            }));
                        }}
                        value={`${formData.sort}_${formData.order}`}
                        className="p-2 border rounded-md w-full"
                    >
                        <option value="regularPrice_desc">Price high to low</option>
                        <option value="regularPrice_asc">Price low to high</option>
                        <option value="createdAt_desc">Latest</option>
                        <option value="createdAt_asc">Oldest</option>
                    </select>

                    {/* LocationSelector for search */}
                    <div className="md:col-span-2">
                        <LocationSelector value={locationFilter} onChange={handleLocationChange} mode="search" />
                    </div>

                    {/* Radio Buttons for Type Selection */}
                    <div className="flex gap-4">
                        <label>
                            <input
                                type="radio"
                                name="type"
                                value="all"
                                checked={formData.type === "all"}
                                onChange={handleChanges}
                            />{" "}
                            All
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="type"
                                value="rent"
                                checked={formData.type === "rent"}
                                onChange={handleChanges}
                            />{" "}
                            Rent
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="type"
                                value="sale"
                                checked={formData.type === "sale"}
                                onChange={handleChanges}
                            />{" "}
                            Sale
                        </label>
                    </div>

                    {/* Checkboxes for Filters */}
                    <div className="flex gap-4">
                        <label>
                            <input
                                type="checkbox"
                                name="parking"
                                onChange={handleChanges}
                                checked={formData.parking}
                            />{" "}
                            Parking
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                name="furnished"
                                onChange={handleChanges}
                                checked={formData.furnished}
                            />{" "}
                            Furnished
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                name="offer"
                                onChange={handleChanges}
                                checked={formData.offer}
                            />{" "}
                            Offer
                        </label>
                    </div>

                    {/* Advanced Filters */}
                    <div className="flex gap-2">
                      <input
                        type="number"
                        name="minPrice"
                        placeholder="Min Price"
                        value={formData.minPrice}
                        onChange={handleChanges}
                        className="p-2 border rounded-md w-full"
                        min={0}
                      />
                      <input
                        type="number"
                        name="maxPrice"
                        placeholder="Max Price"
                        value={formData.maxPrice}
                        onChange={handleChanges}
                        className="p-2 border rounded-md w-full"
                        min={0}
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        name="bedrooms"
                        placeholder="Bedrooms"
                        value={formData.bedrooms}
                        onChange={handleChanges}
                        className="p-2 border rounded-md w-full"
                        min={1}
                      />
                      <input
                        type="number"
                        name="bathrooms"
                        placeholder="Bathrooms"
                        value={formData.bathrooms}
                        onChange={handleChanges}
                        className="p-2 border rounded-md w-full"
                        min={1}
                      />
                    </div>

                    <button type="submit" className="bg-blue-600 text-white p-2 rounded-md w-full">
                        Search
                    </button>
                </form>

                {/* Listings Display */}
                <div className="mt-4">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Listings</h2>
                    {loading && <p className="text-center text-lg font-semibold text-blue-600 animate-pulse">Loading...</p>}
                    {error && <p className="text-center text-red-600 text-lg mb-4">{error}</p>}
                    {!loading && !error && listings.length === 0 && <p className="text-center text-gray-500 text-lg">No Listings found</p>}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {listings && listings.map((listing) => (
                            <ListingItem key={listing._id} listing={listing} />
                        ))}
                    </div>
                    {showMoreListing && (
                        <div className="flex justify-center mt-4">
                        <button
                            type="button"
                            onClick={showMoreListingClick}
                            className="mt-4 bg-gray-600 text-white p-2 rounded-md w-500"
                        >
                            Show More
                        </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 