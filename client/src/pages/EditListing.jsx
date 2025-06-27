import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import LocationSelector from "../components/LocationSelector";

export default function EditListing() {
  const [formData, setFormData] = useState({
    imageUrls: [],
    name: "",
    description: "",
    propertyNumber: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    address: "",
    type: "sale",
    bedrooms: 1,
    bathrooms: 1,
    regularPrice: 0,
    discountPrice: 0,
    offer: false,
    parking: false,
    furnished: false,
    locationLink: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const params = useParams();
  const [consent, setConsent] = useState(false);
  const [location, setLocation] = useState({ state: "", district: "", city: "", cities: [] });

  useEffect(() => {
    const fetchListing = async () => {
      const listingId = params.listingId;
      const apiUrl = `/api/listing/get/${listingId}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.success === false) {
        setError(data.message);
        return;
      }
      setFormData({
        ...formData,
        ...data,
      });
      setLocation({
        state: data.state || "",
        district: data.district || "",
        city: data.city || "",
        cities: [],
      });
    };
    fetchListing();
    // eslint-disable-next-line
  }, [params.listingId]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      state: location.state,
      city: location.city || "",
    }));
  }, [location]);

  const validateImageUrl = (url) => {
    if (!url) return true;
    try { new URL(url); } catch { return false; }
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const hasImageExtension = imageExtensions.some(ext => url.toLowerCase().includes(ext));
    return hasImageExtension || url.includes('images') || url.includes('img');
  };

  const handleImageChange = (index, url) => {
    const newImageUrls = [...formData.imageUrls];
    newImageUrls[index] = url;
    setFormData({ ...formData, imageUrls: newImageUrls });
    const newImageErrors = { ...imageErrors };
    if (url && !validateImageUrl(url)) {
      newImageErrors[index] = "Please enter a valid image URL";
    } else {
      delete newImageErrors[index];
    }
    setImageErrors(newImageErrors);
  };

  const onHandleRemoveImage = (index) => {
    setFormData({
      ...formData,
      imageUrls: formData.imageUrls.filter((_, i) => i !== index),
    });
    const newImageErrors = { ...imageErrors };
    delete newImageErrors[index];
    setImageErrors(newImageErrors);
  };

  const onHandleChanges = (e) => {
    const { id, value, checked, type, name } = e.target;
    let newValue = type === "checkbox" ? checked : value;
    if (["regularPrice", "discountPrice", "bedrooms", "bathrooms"].includes(id)) {
      newValue = Number(value);
    }
    setFormData({
      ...formData,
      [name || id]: newValue,
    });
  };

  const onSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.type) return setError("Please select a listing type (Sale or Rent)");
    if (formData.imageUrls.length < 1) return setError("At least one image must be uploaded");
    if (formData.regularPrice < formData.discountPrice)
      return setError("Discount price should be less than regular price");
    if (!formData.propertyNumber) return setError("Property number is required");
    if (!formData.city) return setError("City is required");
    if (!formData.state) return setError("State is required");
    if (!formData.pincode) return setError("Pincode is required");
    if (Object.keys(imageErrors).length > 0) {
      return setError("Please fix the image URL errors before submitting");
    }
    if ((currentUser.role !== 'admin' && currentUser.role !== 'rootadmin') && !consent) {
      return setError('You must confirm that the data provided is genuine.');
    }
    setLoading(true);
    setError("");
    try {
      const apiUrl = `/api/listing/update/${params.listingId}`;
      const options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, userRef: currentUser._id }),
      };
      const res = await fetch(apiUrl, options);
      const data = await res.json();
      if (data.success === false) {
        setLoading(false);
        setError(data.message);
        return;
      }
      setLoading(false);
      navigate(`/user/my-listings`);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
        <h3 className="text-3xl font-extrabold text-blue-700 mb-6 text-center drop-shadow">
          Edit Listing
        </h3>
        <form onSubmit={onSubmitForm} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-3">Basic Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                id="name"
                placeholder="Property Name"
                required
                onChange={onHandleChanges}
                value={formData.name}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <textarea
              id="description"
              placeholder="Property Description"
              required
              onChange={onHandleChanges}
              value={formData.description}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mt-4 resize-y"
              rows={4}
            />
          </div>

          {/* Address Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-3">Address Information</h4>
            <div className="mb-4">
              <LocationSelector value={location} onChange={setLocation} mode="form" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                id="propertyNumber"
                placeholder="Property Number/Flat Number"
                required
                onChange={onHandleChanges}
                value={formData.propertyNumber}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                id="landmark"
                placeholder="Landmark (optional)"
                onChange={onHandleChanges}
                value={formData.landmark}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                id="pincode"
                placeholder="Pincode"
                required
                onChange={onHandleChanges}
                value={formData.pincode}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                id="locationLink"
                placeholder="Google Maps Location Link (Optional)"
                onChange={onHandleChanges}
                value={formData.locationLink}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Property Type */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-3">Property Type</h4>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 p-3 bg-white rounded-lg shadow-sm">
                <input 
                  type="radio" 
                  name="type" 
                  value="sale" 
                  onChange={onHandleChanges} 
                  checked={formData.type === "sale"}
                  className="text-blue-600"
                />
                <span className="font-medium">For Sale</span>
              </label>
              <label className="flex items-center gap-2 p-3 bg-white rounded-lg shadow-sm">
                <input 
                  type="radio" 
                  name="type" 
                  value="rent" 
                  onChange={onHandleChanges} 
                  checked={formData.type === "rent"}
                  className="text-blue-600"
                />
                <span className="font-medium">For Rent</span>
              </label>
            </div>
          </div>

          {/* Property Details */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-3">Property Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col">
                <span className="text-gray-700 font-medium mb-1">Bedrooms</span>
                <input
                  type="number"
                  id="bedrooms"
                  onChange={onHandleChanges}
                  value={formData.bedrooms}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-gray-700 font-medium mb-1">Bathrooms</span>
                <input
                  type="number"
                  id="bathrooms"
                  onChange={onHandleChanges}
                  value={formData.bathrooms}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-gray-700 font-medium mb-1">Regular Price (₹)</span>
                <input
                  type="number"
                  id="regularPrice"
                  onChange={onHandleChanges}
                  value={formData.regularPrice}
                  placeholder="Enter price"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-gray-700 font-medium mb-1">Discount Price (₹)</span>
                <input
                  type="number"
                  id="discountPrice"
                  onChange={onHandleChanges}
                  value={formData.discountPrice}
                  placeholder="Enter discount"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Property Features */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-3">Property Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["parking", "furnished", "offer"].map((item) => (
                <label key={item} className="flex items-center space-x-2 p-3 bg-white rounded-lg shadow-sm">
                  <input 
                    type="checkbox" 
                    id={item} 
                    onChange={onHandleChanges} 
                    checked={formData[item]}
                    className="text-blue-600"
                  />
                  <span className="text-gray-700 font-medium capitalize">{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Property Images */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-3">Property Images</h4>
            <p className="text-gray-600 text-sm mb-3">
              Add as many image URLs as you want. Use direct links to images (ending in .jpg, .png, .gif, etc.)
            </p>
            <p className="text-gray-500 text-xs mb-3">
              💡 Tip: You can upload images to services like Imgur, Google Drive (with sharing enabled), or use any public image URL
            </p>
            <div className="space-y-3">
              {formData.imageUrls.map((url, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder={`Image URL ${index + 1} (e.g., https://example.com/image.jpg)`}
                    value={url || ""}
                    onChange={(e) => handleImageChange(index, e.target.value)}
                    className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      imageErrors[index] ? 'border-red-500' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => onHandleRemoveImage(index)}
                    className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition"
                    title="Remove this photo"
                  >
                    ×
                  </button>
                  {imageErrors[index] && (
                    <p className="text-red-500 text-sm mt-1">{imageErrors[index]}</p>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, imageUrls: [...formData.imageUrls, ""] })}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition mt-2"
              >
                Add Photo
              </button>
            </div>

            {/* Image Preview */}
            {formData.imageUrls.some(url => url) && (
              <div className="mt-4">
                <h5 className="font-medium text-gray-700 mb-2">Image Preview:</h5>
                <div className="grid grid-cols-3 gap-4">
                  {formData.imageUrls.map((url, index) => (
                    url && (
                      <div key={url} className="relative">
                        <img 
                          src={url} 
                          alt="listing" 
                          className="w-full h-24 object-cover rounded-lg"
                          onError={(e) => {
                            e.target.src = "https://via.placeholder.com/400x300?text=Image+Not+Found";
                            e.target.className = "w-full h-24 object-cover rounded-lg opacity-50";
                          }}
                        />
                        <button
                          onClick={() => onHandleRemoveImage(index)}
                          type="button"
                          className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded-full hover:bg-red-600 transition"
                        >
                          ×
                        </button>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Consent Checkbox for Users */}
          {currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="consent"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="accent-blue-600 w-4 h-4"
                required
              />
              <label htmlFor="consent" className="text-sm text-gray-700 select-none">
                I confirm that <span className="font-semibold text-blue-700">all the information provided in this listing is true and genuine to the best of my knowledge</span>. Providing false information may result in account suspension or legal action.
              </label>
            </div>
          )}

          {/* Submit Button */}
          <button
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white p-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Updating..." : "Update Listing"}
          </button>
          {error && <p className="text-red-500 text-center">{error}</p>}
        </form>
      </div>
    </div>
  );
}
