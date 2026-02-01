import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ListingItem from "../components/ListingItem";
import GeminiAIWrapper from "../components/GeminiAIWrapper";
import LocationSelector from "../components/LocationSelector";
import data from "../data/countries+states+cities.json";
import duckImg from "../assets/duck-go-final.gif";
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import SearchSuggestions from '../components/SearchSuggestions';
import FormField from "../components/ui/FormField";
import SelectField from "../components/ui/SelectField";
import ListingSkeletonGrid from "../components/skeletons/ListingSkeletonGrid";
import FilterChips from "../components/search/FilterChips";
import { Search as SearchIcon, IndianRupee, Filter, MapPin, Home, DollarSign, GripVertical, ChevronDown, RefreshCw, Sparkles } from "lucide-react";

import { usePageTitle } from '../hooks/usePageTitle';
import { authenticatedFetch } from "../utils/auth";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Search() {
    // Set page title
    usePageTitle("Search Properties - Find Your Dream Home");

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
    const [recommendations, setRecommendations] = useState([]);
    const [smartQuery, setSmartQuery] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false); // Mobile filter toggle
    const [useAI, setUseAI] = useState(false); // AI Search Toggle
    const [aiPrompt, setAiPrompt] = useState(""); // AI Search Input State

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

        // Initialize AI mode from URL
        const isAiMode = urlParams.get("mode") === "ai";
        setUseAI(isAiMode);
        if (isAiMode) {
            setAiPrompt(urlParams.get("searchTerm") || "");
        }

        const fetchListings = async () => {
            setLoading(true);
            setError(null);
            try {
                const fetchParams = new URLSearchParams(urlParams);
                // fetchParams.set('visibility', 'public'); // Let backend decide based on auth

                let endpoint = `${API_BASE_URL}/api/listing/get?${fetchParams.toString()}`;

                // If AI Search is enabled and we have a search term
                if (useAI && fetchParams.get('searchTerm')) {
                    endpoint = `${API_BASE_URL}/api/listing/ai-search?query=${fetchParams.get('searchTerm')}`;
                }

                const res = await authenticatedFetch(endpoint);
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                const responseData = await res.json();

                // Handle different response structures
                const data = useAI ? responseData.data : responseData;

                setListings(Array.isArray(data) ? data : []);
                setShowMoreListing(!useAI && Array.isArray(data) && data.length > 8); // Backend AI search handles limit differently
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

        // Show suggestions when typing in search term
        if (name === 'searchTerm') {
            setShowSuggestions(value.trim().length >= 2);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setFormData(prev => ({
            ...prev,
            searchTerm: suggestion.displayText
        }));
        setShowSuggestions(false);

        // Navigate to the property listing
        navigate(`/listing/${suggestion.id}`);
    };

    const handleSearchInputFocus = () => {
        if (formData.searchTerm.trim().length >= 2) {
            setShowSuggestions(true);
        }
    };

    const handleSearchInputBlur = () => {
        // Delay hiding suggestions to allow clicking on them
        setTimeout(() => setShowSuggestions(false), 200);
    };

    const clearAllFilters = () => {
        const reset = {
            searchTerm: "", type: "all", parking: false, furnished: false, offer: false,
            sort: "createdAt", order: "desc", minPrice: "", maxPrice: "",
            city: "", state: "", bedrooms: "", bathrooms: ""
        };
        setFormData(reset);
        navigate(`?${new URLSearchParams(reset).toString()}`);
    };

    const removeFilter = (key) => {
        const updated = { ...formData };
        if (typeof updated[key] === 'boolean') updated[key] = false; else updated[key] = "";
        setFormData(updated);
        navigate(`?${new URLSearchParams(updated).toString()}`);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSubmit = { ...formData };
        if (useAI) {
            dataToSubmit.searchTerm = aiPrompt;
        }
        const urlParams = new URLSearchParams(dataToSubmit);
        navigate(`?${urlParams.toString()}`);
    };

    const applySmartQuery = (e) => {
        e.preventDefault();
        const natural = (smartQuery || '').trim();
        if (!natural) return;
        const extracted = { ...formData };

        // Normalize number words (e.g., "two bhk" -> "2 bhk")
        const numberWordToDigit = (text) => {
            const map = {
                'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
                'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
            };
            return text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, (m) => map[m.toLowerCase()]);
        };
        const norm = numberWordToDigit(natural);

        // Enhanced NLP processing with context understanding
        const processNaturalLanguage = (query) => {
            const lowerQuery = query.toLowerCase();

            // Intent detection
            const intents = {
                search: /(?:find|search|look for|looking for|need|want|require|dhundh|khoj|chahiye)/i,
                rent: /(?:rent|rental|renting|for rent|to rent|kiran|bhada|rent par)/i,
                buy: /(?:buy|purchase|sale|selling|for sale|to buy|kharid|bechne|sale par)/i,
                budget: /(?:budget|affordable|cheap|low cost|economical|paisa|dam|rate)/i,
                location: /(?:near|close to|around|in|at|from|paas|mein|se)/i,
                size: /(?:room|bedroom|bhk|bed|bath|bathroom|toilet|kamra|washroom)/i,
                amenities: /(?:parking|furnished|unfurnished|garden|balcony|lift|security|gym|pool|ac|air conditioning)/i
            };

            // Extract intent
            const detectedIntent = Object.keys(intents).find(intent => intents[intent].test(query));

            return { detectedIntent, query: lowerQuery };
        };

        const { detectedIntent } = processNaturalLanguage(norm);

        // Enhanced city to state mapping with more cities and landmarks
        const inferStateFromCity = (city) => {
            const cityToState = {
                // Maharashtra
                'mumbai': 'Maharashtra', 'pune': 'Maharashtra', 'nagpur': 'Maharashtra', 'nashik': 'Maharashtra',
                'aurangabad': 'Maharashtra', 'solapur': 'Maharashtra', 'amravati': 'Maharashtra', 'kolhapur': 'Maharashtra',
                'sangli': 'Maharashtra', 'malegaon': 'Maharashtra', 'ulhasnagar': 'Maharashtra', 'jalgaon': 'Maharashtra',
                'akola': 'Maharashtra', 'latur': 'Maharashtra', 'dhule': 'Maharashtra', 'ahmednagar': 'Maharashtra',
                'chandrapur': 'Maharashtra', 'parbhani': 'Maharashtra', 'ichalkaranji': 'Maharashtra', 'jalna': 'Maharashtra',
                'bhusawal': 'Maharashtra', 'ambad': 'Maharashtra', 'yavatmal': 'Maharashtra', 'kamptee': 'Maharashtra',
                'gondia': 'Maharashtra', 'barshi': 'Maharashtra', 'achalpur': 'Maharashtra', 'osmanabad': 'Maharashtra',
                'nandurbar': 'Maharashtra', 'wardha': 'Maharashtra', 'udgir': 'Maharashtra', 'hinganghat': 'Maharashtra',

                // Delhi & NCR
                'delhi': 'Delhi', 'new delhi': 'Delhi', 'gurgaon': 'Haryana',
                'gurugram': 'Haryana', 'faridabad': 'Haryana', 'ghaziabad': 'Uttar Pradesh',
                'sonipat': 'Haryana', 'panipat': 'Haryana', 'rohtak': 'Haryana', 'karnal': 'Haryana',
                'hisar': 'Haryana', 'ambala': 'Haryana', 'yamunanagar': 'Haryana', 'bhiwani': 'Haryana',
                'rewari': 'Haryana', 'palwal': 'Haryana', 'mahendragarh': 'Haryana', 'jind': 'Haryana',
                'kaithal': 'Haryana', 'fatehabad': 'Haryana', 'sirsa': 'Haryana', 'mewat': 'Haryana',

                // Karnataka
                'bengaluru': 'Karnataka', 'bangalore': 'Karnataka', 'mysuru': 'Karnataka', 'mysore': 'Karnataka',
                'mangalore': 'Karnataka', 'hubli': 'Karnataka', 'belgaum': 'Karnataka', 'gulbarga': 'Karnataka',
                'davangere': 'Karnataka', 'bellary': 'Karnataka', 'bijapur': 'Karnataka', 'shimoga': 'Karnataka',
                'tumkur': 'Karnataka', 'raichur': 'Karnataka', 'bidar': 'Karnataka', 'hospet': 'Karnataka',
                'hassan': 'Karnataka', 'gadag': 'Karnataka', 'udupi': 'Karnataka', 'karwar': 'Karnataka',
                'chitradurga': 'Karnataka', 'kolar': 'Karnataka', 'mandya': 'Karnataka', 'chikmagalur': 'Karnataka',
                'gangavati': 'Karnataka', 'bagalkot': 'Karnataka', 'ranebennur': 'Karnataka', 'athani': 'Karnataka',

                // Tamil Nadu
                'chennai': 'Tamil Nadu', 'coimbatore': 'Tamil Nadu', 'madurai': 'Tamil Nadu', 'tiruchirapalli': 'Tamil Nadu',
                'salem': 'Tamil Nadu', 'tirunelveli': 'Tamil Nadu', 'tiruppur': 'Tamil Nadu', 'erode': 'Tamil Nadu',
                'vellore': 'Tamil Nadu', 'thoothukkudi': 'Tamil Nadu', 'dindigul': 'Tamil Nadu', 'thanjavur': 'Tamil Nadu',
                'ranipet': 'Tamil Nadu', 'sivakasi': 'Tamil Nadu', 'karur': 'Tamil Nadu', 'udhagamandalam': 'Tamil Nadu',
                'hosur': 'Tamil Nadu', 'nagercoil': 'Tamil Nadu', 'kanchipuram': 'Tamil Nadu', 'cuddalore': 'Tamil Nadu',
                'kumbakonam': 'Tamil Nadu', 'tiruvannamalai': 'Tamil Nadu', 'pollachi': 'Tamil Nadu', 'rajapalayam': 'Tamil Nadu',
                'gudiyatham': 'Tamil Nadu', 'pudukkottai': 'Tamil Nadu', 'neyveli': 'Tamil Nadu', 'ambattur': 'Tamil Nadu',

                // West Bengal
                'kolkata': 'West Bengal', 'howrah': 'West Bengal', 'durgapur': 'West Bengal', 'asansol': 'West Bengal',
                'siliguri': 'West Bengal', 'malda': 'West Bengal', 'berhampore': 'West Bengal', 'habra': 'West Bengal',
                'kharagpur': 'West Bengal', 'shantipur': 'West Bengal', 'dankuni': 'West Bengal', 'dhulian': 'West Bengal',
                'ranaghat': 'West Bengal', 'haldia': 'West Bengal', 'raiganj': 'West Bengal', 'krishnanagar': 'West Bengal',
                'nabadwip': 'West Bengal', 'medinipur': 'West Bengal', 'jalpaiguri': 'West Bengal', 'balurghat': 'West Bengal',
                'basirhat': 'West Bengal', 'bankura': 'West Bengal', 'chakdaha': 'West Bengal', 'darjeeling': 'West Bengal',

                // Telangana
                'hyderabad': 'Telangana', 'warangal': 'Telangana', 'nizamabad': 'Telangana', 'khammam': 'Telangana',
                'karimnagar': 'Telangana', 'ramagundam': 'Telangana', 'mahbubnagar': 'Telangana', 'nalgonda': 'Telangana',
                'adilabad': 'Telangana', 'suryapet': 'Telangana', 'miryalaguda': 'Telangana', 'tadepalligudem': 'Telangana',
                'mancherial': 'Telangana', 'kothagudem': 'Telangana', 'dharmabad': 'Telangana', 'bhongir': 'Telangana',
                'bodhan': 'Telangana', 'palwancha': 'Telangana', 'mandamarri': 'Telangana', 'koratla': 'Telangana',
                'sircilla': 'Telangana', 'tandur': 'Telangana', 'siddipet': 'Telangana', 'wanaparthy': 'Telangana',

                // Gujarat
                'ahmedabad': 'Gujarat', 'surat': 'Gujarat', 'vadodara': 'Gujarat', 'rajkot': 'Gujarat',
                'bhavnagar': 'Gujarat', 'jamnagar': 'Gujarat', 'nadiad': 'Gujarat', 'porbandar': 'Gujarat',
                'anand': 'Gujarat', 'morbi': 'Gujarat', 'mahesana': 'Gujarat', 'bharuch': 'Gujarat',
                'veraval': 'Gujarat', 'navsari': 'Gujarat', 'gandhidham': 'Gujarat',

                // Rajasthan
                'jaipur': 'Rajasthan', 'jodhpur': 'Rajasthan', 'udaipur': 'Rajasthan', 'kota': 'Rajasthan',
                'bikaner': 'Rajasthan', 'ajmer': 'Rajasthan', 'bharatpur': 'Rajasthan', 'bhiwadi': 'Rajasthan',
                'alwar': 'Rajasthan', 'beawar': 'Rajasthan', 'dungarpur': 'Rajasthan', 'hindaun': 'Rajasthan',
                'gangapur': 'Rajasthan', 'laxmangarh': 'Rajasthan', 'sikar': 'Rajasthan', 'pali': 'Rajasthan',
                'tonk': 'Rajasthan', 'kishangarh': 'Rajasthan', 'banswara': 'Rajasthan', 'hanumangarh': 'Rajasthan',
                'dausa': 'Rajasthan', 'churu': 'Rajasthan', 'bundi': 'Rajasthan', 'sawai madhopur': 'Rajasthan',

                // Uttar Pradesh
                'lucknow': 'Uttar Pradesh', 'kanpur': 'Uttar Pradesh', 'agra': 'Uttar Pradesh', 'varanasi': 'Uttar Pradesh',
                'meerut': 'Uttar Pradesh', 'allahabad': 'Uttar Pradesh', 'bareilly': 'Uttar Pradesh', 'gorakhpur': 'Uttar Pradesh',
                'moradabad': 'Uttar Pradesh', 'aligarh': 'Uttar Pradesh', 'saharanpur': 'Uttar Pradesh', 'noida': 'Uttar Pradesh',
                'firozabad': 'Uttar Pradesh', 'jhansi': 'Uttar Pradesh', 'muzaffarnagar': 'Uttar Pradesh', 'mathura': 'Uttar Pradesh',
                'shahjahanpur': 'Uttar Pradesh', 'rampur': 'Uttar Pradesh', 'modinagar': 'Uttar Pradesh', 'hapur': 'Uttar Pradesh',
                'etawah': 'Uttar Pradesh', 'mirzapur': 'Uttar Pradesh', 'bulandshahr': 'Uttar Pradesh', 'sambhal': 'Uttar Pradesh',
                'amroha': 'Uttar Pradesh', 'hardoi': 'Uttar Pradesh', 'fatehpur': 'Uttar Pradesh', 'raebareli': 'Uttar Pradesh',

                // Madhya Pradesh
                'indore': 'Madhya Pradesh', 'bhopal': 'Madhya Pradesh', 'gwalior': 'Madhya Pradesh', 'jabalpur': 'Madhya Pradesh',
                'ujjain': 'Madhya Pradesh', 'sagar': 'Madhya Pradesh', 'dewas': 'Madhya Pradesh', 'satna': 'Madhya Pradesh',
                'ratlam': 'Madhya Pradesh', 'rewa': 'Madhya Pradesh', 'murwara': 'Madhya Pradesh', 'singrauli': 'Madhya Pradesh',
                'burhanpur': 'Madhya Pradesh', 'khandwa': 'Madhya Pradesh', 'morena': 'Madhya Pradesh', 'bhind': 'Madhya Pradesh',
                'vidisha': 'Madhya Pradesh', 'chhindwara': 'Madhya Pradesh', 'guna': 'Madhya Pradesh', 'shivpuri': 'Madhya Pradesh',
                'mandsaur': 'Madhya Pradesh', 'neemuch': 'Madhya Pradesh', 'pithampur': 'Madhya Pradesh', 'itarsi': 'Madhya Pradesh',

                // Bihar
                'patna': 'Bihar', 'gaya': 'Bihar', 'bhagalpur': 'Bihar', 'muzaffarpur': 'Bihar',
                'purnia': 'Bihar', 'darbhanga': 'Bihar', 'bihar sharif': 'Bihar', 'arrah': 'Bihar',
                'begusarai': 'Bihar', 'katihar': 'Bihar', 'munger': 'Bihar', 'chapra': 'Bihar',
                'sasaram': 'Bihar', 'hajipur': 'Bihar', 'dehri': 'Bihar', 'bettiah': 'Bihar',
                'motihari': 'Bihar', 'siwan': 'Bihar', 'kishanganj': 'Bihar', 'saharsa': 'Bihar',

                // Kerala
                'kochi': 'Kerala', 'thiruvananthapuram': 'Kerala', 'kozhikode': 'Kerala', 'thrissur': 'Kerala',
                'kollam': 'Kerala', 'palakkad': 'Kerala', 'alappuzha': 'Kerala', 'malappuram': 'Kerala',
                'kannur': 'Kerala', 'kasaragod': 'Kerala', 'pathanamthitta': 'Kerala', 'idukki': 'Kerala',
                'wayanad': 'Kerala', 'ernakulam': 'Kerala', 'kottayam': 'Kerala', 'tirur': 'Kerala',
                'koyilandy': 'Kerala',

                // Andhra Pradesh
                'visakhapatnam': 'Andhra Pradesh', 'vijayawada': 'Andhra Pradesh', 'guntur': 'Andhra Pradesh', 'nellore': 'Andhra Pradesh',
                'kurnool': 'Andhra Pradesh', 'rajahmundry': 'Andhra Pradesh', 'tirupati': 'Andhra Pradesh', 'kadapa': 'Andhra Pradesh',
                'anantapur': 'Andhra Pradesh', 'chittoor': 'Andhra Pradesh', 'proddatur': 'Andhra Pradesh', 'nandyal': 'Andhra Pradesh',
                'eluru': 'Andhra Pradesh', 'ongole': 'Andhra Pradesh', 'chilakaluripet': 'Andhra Pradesh', 'kadiri': 'Andhra Pradesh',
                'adoni': 'Andhra Pradesh', 'tenali': 'Andhra Pradesh', 'chirala': 'Andhra Pradesh', 'bapatla': 'Andhra Pradesh',
                'srikakulam': 'Andhra Pradesh', 'vizianagaram': 'Andhra Pradesh', 'parvathipuram': 'Andhra Pradesh', 'bobbili': 'Andhra Pradesh',

                // Union Territories
                'chandigarh': 'Chandigarh', 'panchkula': 'Haryana', 'mohali': 'Punjab',
                'jammu': 'Jammu and Kashmir', 'srinagar': 'Jammu and Kashmir', 'leh': 'Ladakh',
                'kargil': 'Ladakh', 'anantnag': 'Jammu and Kashmir', 'baramulla': 'Jammu and Kashmir',
                'udhampur': 'Jammu and Kashmir', 'kathua': 'Jammu and Kashmir', 'rajouri': 'Jammu and Kashmir',
                'punch': 'Jammu and Kashmir', 'doda': 'Jammu and Kashmir', 'kishtwar': 'Jammu and Kashmir',
                'ramban': 'Jammu and Kashmir', 'reasi': 'Jammu and Kashmir', 'samba': 'Jammu and Kashmir',
                'bandipora': 'Jammu and Kashmir', 'ganderbal': 'Jammu and Kashmir', 'kulgam': 'Jammu and Kashmir',
                'pulwama': 'Jammu and Kashmir', 'shopian': 'Jammu and Kashmir', 'budgam': 'Jammu and Kashmir',
                'kupwara': 'Jammu and Kashmir', 'handwara': 'Jammu and Kashmir', 'karnah': 'Jammu and Kashmir'
            };
            const key = (city || '').toLowerCase().trim();
            return cityToState[key] || '';
        };

        // Enhanced bedroom detection with routine language
        const bedPatterns = [
            /(\d+)\s*(bhk|bed|beds|bedroom|bedrooms|room|rooms)/i,
            // Routine language patterns
            /(\d+)\s*(?:ka|ke)\s*(?:room|kamra|bedroom)/i,
            /(\d+)\s*(?:bhk|bed|room)\s*(?:ka|ke)\s*(?:flat|apartment|ghar)/i,
            /(?:flat|apartment|ghar)\s*(?:with|mein)\s*(\d+)\s*(?:room|bed|bhk)/i,
            /(\d+)\s*(?:room|bed|bhk)\s*(?:wala|wali)\s*(?:flat|apartment|ghar)/i
        ];

        for (const pattern of bedPatterns) {
            const bedsMatch = norm.match(pattern);
            if (bedsMatch) {
                extracted.bedrooms = bedsMatch[1];
                break;
            }
        }

        // Enhanced bathroom detection with routine language
        const bathPatterns = [
            /(\d+)\s*(bath|baths|bathroom|bathrooms|toilet|toilets)/i,
            // Routine language patterns
            /(\d+)\s*(?:ka|ke)\s*(?:bathroom|toilet|washroom)/i,
            /(\d+)\s*(?:bath|toilet)\s*(?:ka|ke)\s*(?:flat|apartment|ghar)/i,
            /(?:flat|apartment|ghar)\s*(?:with|mein)\s*(\d+)\s*(?:bath|toilet)/i,
            /(\d+)\s*(?:bath|toilet)\s*(?:wala|wali)\s*(?:flat|apartment|ghar)/i
        ];

        for (const pattern of bathPatterns) {
            const bathMatch = norm.match(pattern);
            if (bathMatch) {
                extracted.bathrooms = bathMatch[1];
                break;
            }
        }

        // Enhanced price detection with more patterns and intelligent parsing including routine language
        const pricePatterns = [
            /(?:under|below|upto|max|maximum|up to)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores|rs|rupees?)?/i,
            /(?:within|around|about|approximately|approx)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores|rs|rupees?)?/i,
            /(?:budget|budget of|my budget is|looking for)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores|rs|rupees?)?/i,
            /(?:less than|not more than|below|under)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores|rs|rupees?)?/i,
            /(?:price|cost|rent|sale price)\s*(?:is|should be|around|about)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores|rs|rupees?)?/i,
            /(?:affordable|cheap|low cost|economical)\s*(?:under|below|within)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores|rs|rupees?)?/i,
            /(?:₹|rs\.?|rupees?)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores)?/i,
            // Routine language patterns
            /(?:kam\s+se\s+kam|minimum|at\s+least)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores|rs|rupees?)?/i,
            /(?:zyada\s+se\s+zyada|maximum|at\s+most)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores|rs|rupees?)?/i,
            /(?:tak|se\s+zyada|se\s+kam)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores|rs|rupees?)?/i,
            /(?:around|about|lagbhag|takriban)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores|rs|rupees?)?/i,
            /(?:budget|paisa|rupees)\s*(?:hai|mein)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores)?/i,
            /(?:price|dam|rate)\s*(?:hai|mein)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores)?/i
        ];

        for (const pattern of pricePatterns) {
            const priceMatch = norm.match(pattern);
            if (priceMatch) {
                extracted.maxPrice = priceMatch[1].replace(/,/g, '');
                if (priceMatch[2]) {
                    const unit = priceMatch[2].toLowerCase();
                    const val = Number(extracted.maxPrice || 0);
                    if (unit === 'k' || unit === 'thousand') extracted.maxPrice = String(val * 1000);
                    if (unit === 'l' || unit === 'lac' || unit === 'lakh' || unit === 'lakhs') extracted.maxPrice = String(val * 100000);
                    if (unit === 'cr' || unit === 'crore' || unit === 'crores') extracted.maxPrice = String(val * 10000000);
                }
                break;
            }
        }

        // Price range detection: "between X and Y"
        const rangeMatch = norm.match(/between\s+(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore)?\s+(?:and|to|\-)+\s+(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore)?/i);
        if (rangeMatch) {
            const toNumber = (val, unit) => {
                let n = Number((val || '').replace(/,/g, ''));
                if (!unit) return String(n);
                const u = unit.toLowerCase();
                if (u === 'k') n *= 1000;
                if (u === 'l' || u === 'lac' || u === 'lakh') n *= 100000;
                if (u === 'cr' || u === 'crore') n *= 10000000;
                return String(n);
            };
            extracted.minPrice = toNumber(rangeMatch[1], rangeMatch[2]);
            extracted.maxPrice = toNumber(rangeMatch[3], rangeMatch[4]);
        }

        // Enhanced minimum price detection
        const minPricePatterns = [
            /(?:above|more than|minimum|min|from)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores)?/i,
            /(?:starting from|starting at)\s*(\d[\d,]*)\s*(k|l|lac|lakh|cr|crore|thousand|lakhs|crores)?/i
        ];

        for (const pattern of minPricePatterns) {
            const minPriceMatch = norm.match(pattern);
            if (minPriceMatch) {
                extracted.minPrice = minPriceMatch[1].replace(/,/g, '');
                if (minPriceMatch[2]) {
                    const unit = minPriceMatch[2].toLowerCase();
                    const val = Number(extracted.minPrice || 0);
                    if (unit === 'k' || unit === 'thousand') extracted.minPrice = String(val * 1000);
                    if (unit === 'l' || unit === 'lac' || unit === 'lakh' || unit === 'lakhs') extracted.minPrice = String(val * 100000);
                    if (unit === 'cr' || unit === 'crore' || unit === 'crores') extracted.minPrice = String(val * 10000000);
                }
                break;
            }
        }

        // Enhanced location detection with routine language
        const locationPatterns = [
            /(?:near|close to|around)\s+([a-zA-Z\s]+?)(?:\s|$|,|\.)/i,
            /(?:in|at|from)\s+([a-zA-Z\s]+?)(?:\s|$|,|\.)/i,
            /(?:located in|situated in)\s+([a-zA-Z\s]+?)(?:\s|$|,|\.)/i,
            /(?:area|locality|neighborhood)\s+([a-zA-Z\s]+?)(?:\s|$|,|\.)/i,
            // Routine language patterns
            /(?:paas|near|ke\s+paas|ke\s+near)\s+([a-zA-Z\s]+?)(?:\s|$|,|\.)/i,
            /(?:mein|in|at)\s+([a-zA-Z\s]+?)(?:\s|$|,|\.)/i,
            /(?:area|ilaka|mohalla|colony)\s+([a-zA-Z\s]+?)(?:\s|$|,|\.)/i,
            /(?:located|situated|hain)\s+(?:in|mein)\s+([a-zA-Z\s]+?)(?:\s|$|,|\.)/i,
            /(?:from|se)\s+([a-zA-Z\s]+?)(?:\s|$|,|\.)/i
        ];

        for (const pattern of locationPatterns) {
            const locationMatch = norm.match(pattern);
            if (locationMatch) {
                const location = locationMatch[1].trim();
                // Check if it's a city or landmark
                if (location.length > 2 && !/^(the|a|an|and|or|but|in|on|at|to|for|of|with|by)$/i.test(location)) {
                    extracted.city = location;
                    break;
                }
            }
        }

        // Auto-infer state from city
        if (extracted.city && !extracted.state) {
            extracted.state = inferStateFromCity(extracted.city);
        }

        // Enhanced state detection
        const states = ['andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi', 'chandigarh', 'jammu and kashmir', 'ladakh'];
        const lower = norm.toLowerCase();
        const matchedState = states.find(s => new RegExp(`(^|\\b)${s}(\\b|$)`).test(lower));
        if (matchedState) extracted.state = matchedState.replace(/\b\w/g, c => c.toUpperCase());

        // Enhanced property type detection with routine language
        const typePatterns = [
            /\b(rent|rental|renting|for rent|to rent)\b/i,
            /\b(sale|sell|selling|for sale|to sell|buy|buying|purchase|purchasing)\b/i,
            /\b(lease|leasing|leased)\b/i,
            // Routine language patterns
            /(?:rent|kiran|bhada)\s+(?:ke\s+liye|par|mein)/i,
            /(?:sale|bechne|kharidne)\s+(?:ke\s+liye|par|mein)/i,
            /(?:for|ke\s+liye)\s+(?:rent|sale|kiran|bechne)/i,
            /(?:looking\s+for|chahiye|dhundh\s+raha)\s+(?:rent|sale|kiran|bechne)/i,
            /(?:want|chahiye)\s+(?:to\s+)?(?:rent|buy|kiran|kharid)/i,
            /(?:available\s+for|available)\s+(?:rent|sale|kiran|bechne)/i
        ];

        // Enhanced amenities detection with smart context understanding
        const amenitiesPatterns = {
            parking: [
                /(?:parking|car\s+parking|vehicle\s+parking|garage)/i,
                /(?:parking\s+available|parking\s+space|car\s+space)/i,
                /(?:with\s+parking|parking\s+included)/i,
                // Hindi/regional patterns
                /(?:parking|gaadi\s+rakhne\s+ki\s+jagah|vehicle\s+parking)/i
            ],
            furnished: [
                /(?:furnished|fully\s+furnished|semi\s+furnished)/i,
                /(?:with\s+furniture|furniture\s+included)/i,
                /(?:ready\s+to\s+move|move\s+in\s+ready)/i,
                // Hindi/regional patterns
                /(?:furnished|saman\s+ke\s+saath|ready\s+to\s+move)/i
            ],
            unfurnished: [
                /(?:unfurnished|semi\s+furnished|bare)/i,
                /(?:without\s+furniture|no\s+furniture)/i,
                // Hindi/regional patterns
                /(?:unfurnished|bina\s+saman\s+ke|khali)/i
            ],
            garden: [
                /(?:garden|lawn|green\s+space|outdoor\s+space)/i,
                /(?:with\s+garden|garden\s+available)/i,
                // Hindi/regional patterns
                /(?:garden|bagicha|lawn|green\s+area)/i
            ],
            balcony: [
                /(?:balcony|terrace|veranda)/i,
                /(?:with\s+balcony|balcony\s+available)/i,
                // Hindi/regional patterns
                /(?:balcony|terrace|veranda|chhat)/i
            ],
            lift: [
                /(?:lift|elevator|elevator\s+available)/i,
                /(?:with\s+lift|lift\s+facility)/i,
                // Hindi/regional patterns
                /(?:lift|elevator|lift\s+ki\s+facility)/i
            ],
            security: [
                /(?:security|24\s*7\s*security|gated\s+community)/i,
                /(?:security\s+guard|security\s+system)/i,
                // Hindi/regional patterns
                /(?:security|suraksha|guard|24\s*7\s*security)/i
            ],
            gym: [
                /(?:gym|fitness\s+center|workout\s+area)/i,
                /(?:with\s+gym|gym\s+facility)/i,
                // Hindi/regional patterns
                /(?:gym|fitness|vyayam\s+shala)/i
            ],
            pool: [
                /(?:pool|swimming\s+pool)/i,
                /(?:with\s+pool|pool\s+facility)/i,
                // Hindi/regional patterns
                /(?:pool|swimming\s+pool|tairne\s+ki\s+jagah)/i
            ],
            ac: [
                /(?:ac|air\s+conditioning|air\s+conditioned)/i,
                /(?:with\s+ac|ac\s+available)/i,
                // Hindi/regional patterns
                /(?:ac|air\s+conditioning|thandak)/i
            ]
        };

        // Process amenities
        Object.keys(amenitiesPatterns).forEach(amenity => {
            const patterns = amenitiesPatterns[amenity];
            const hasAmenity = patterns.some(pattern => pattern.test(norm));
            if (hasAmenity) {
                if (amenity === 'furnished') extracted.furnished = true;
                if (amenity === 'parking') extracted.parking = true;
                if (amenity === 'offer') extracted.offer = true; // For special offers
            }
        });

        for (const pattern of typePatterns) {
            const typeMatch = norm.match(pattern);
            if (typeMatch) {
                const type = typeMatch[1] || typeMatch[0];
                if (/rent|kiran|bhada|lease/i.test(type)) extracted.type = 'rent';
                else if (/sale|bechne|kharidne|buy|purchase/i.test(type)) extracted.type = 'sale';
                break;
            }
        }

        // Enhanced amenities detection with more comprehensive patterns and routine language
        const amenityPatterns = {
            parking: [
                /(?:with|having|includes?)\s+parking/i,
                /parking\s+(?:available|included|provided|space)/i,
                /(?:car\s+)?parking/i,
                /garage/i,
                /(?:covered|open)\s+parking/i,
                /(?:two|2)\s+wheelers?\s+parking/i,
                /(?:four|4)\s+wheelers?\s+parking/i,
                /vehicle\s+parking/i,
                /parking\s+lot/i,
                /parking\s+space/i,
                // Routine language patterns
                /(?:gaadi|car|bike|scooter)\s+(?:parking|khada|rakhne)/i,
                /(?:parking|khada)\s+(?:hai|available|mila)/i,
                /(?:covered|chhaya)\s+(?:parking|khada)/i,
                /(?:basement|tala)\s+(?:parking|khada)/i,
                /(?:open|khula)\s+(?:parking|khada)/i
            ],
            furnished: [
                /(?:fully\s+)?furnished/i,
                /(?:with|having|includes?)\s+furniture/i,
                /furniture\s+(?:included|provided|available)/i,
                /(?:semi\s+)?furnished/i,
                /(?:partially\s+)?furnished/i,
                /(?:well\s+)?furnished/i,
                /(?:beautifully\s+)?furnished/i,
                /(?:modern\s+)?furniture/i,
                /(?:wooden\s+)?furniture/i,
                /(?:ready\s+to\s+move\s+in|rtmi)/i,
                // Routine language patterns
                /(?:furnished|sajavata|sajaya|sajaya\s+hua)/i,
                /(?:furniture|samagri|saman)\s+(?:hai|available|mila)/i,
                /(?:ready|taiyar)\s+(?:to\s+move|rehne|rahan)/i,
                /(?:fully|puri\s+tarah|bilkul)\s+(?:furnished|sajaya)/i,
                /(?:semi|aadha|thoda)\s+(?:furnished|sajaya)/i,
                /(?:modern|naya|latest)\s+(?:furniture|samagri)/i
            ],
            unfurnished: [
                /unfurnished/i,
                /(?:without|no)\s+furniture/i,
                /bare\s+apartment/i,
                /(?:empty|vacant)\s+apartment/i,
                /(?:not\s+)?furnished/i,
                /(?:without\s+)?furniture/i,
                // Routine language patterns
                /(?:unfurnished|khali|saman\s+nahi)/i,
                /(?:without|bina)\s+(?:furniture|samagri)/i,
                /(?:empty|khali)\s+(?:flat|apartment|ghar)/i,
                /(?:bare|nanga)\s+(?:flat|apartment)/i,
                /(?:no|nahi)\s+(?:furniture|samagri)/i
            ],
            offer: [
                /(?:special\s+)?offer/i,
                /discount/i,
                /deal/i,
                /promotion/i,
                /(?:reduced|lower)\s+price/i,
                /(?:cheap|affordable|budget)/i,
                /(?:best\s+)?deal/i,
                /(?:great\s+)?offer/i,
                /(?:limited\s+time\s+)?offer/i,
                /(?:exclusive\s+)?offer/i,
                /(?:flash\s+)?sale/i,
                /(?:clearance\s+)?sale/i,
                // Routine language patterns
                /(?:offer|sasta|kam\s+dam)/i,
                /(?:discount|chhut|bargain)/i,
                /(?:deal|sasta\s+deal|achha\s+deal)/i,
                /(?:cheap|sasta|kam\s+price)/i,
                /(?:affordable|paisa\s+vasool|value\s+for\s+money)/i,
                /(?:budget|kam\s+budget|sasta)/i,
                /(?:special|khas|limited)\s+(?:offer|deal)/i
            ],
            // New amenity patterns with routine language
            balcony: [
                /(?:with|having)\s+balcony/i,
                /balcony/i,
                /(?:private\s+)?balcony/i,
                /(?:beautiful\s+)?balcony/i,
                // Routine language
                /(?:balcony|baalkoni|chhajja)\s+(?:hai|available)/i,
                /(?:with|ke\s+sath)\s+(?:balcony|baalkoni)/i,
                /(?:private|apna)\s+(?:balcony|baalkoni)/i
            ],
            garden: [
                /(?:with|having)\s+garden/i,
                /garden/i,
                /(?:private\s+)?garden/i,
                /(?:beautiful\s+)?garden/i,
                /(?:rooftop\s+)?garden/i,
                // Routine language
                /(?:garden|bagicha|lawn)\s+(?:hai|available)/i,
                /(?:with|ke\s+sath)\s+(?:garden|bagicha)/i,
                /(?:rooftop|chhat)\s+(?:garden|bagicha)/i
            ],
            security: [
                /(?:with|having)\s+security/i,
                /security/i,
                /(?:24\s*\/\s*7\s+)?security/i,
                /(?:gated\s+)?security/i,
                /(?:cctv\s+)?security/i,
                /(?:round\s+the\s+clock\s+)?security/i,
                // Routine language
                /(?:security|suraksha|guard)\s+(?:hai|available)/i,
                /(?:24\s*\/\s*7|hamesha)\s+(?:security|guard)/i,
                /(?:gated|gate)\s+(?:society|colony)/i,
                /(?:cctv|camera)\s+(?:hai|available)/i
            ],
            lift: [
                /(?:with|having)\s+lift/i,
                /lift/i,
                /elevator/i,
                /(?:modern\s+)?lift/i,
                // Routine language
                /(?:lift|elevator|uddan)\s+(?:hai|available)/i,
                /(?:with|ke\s+sath)\s+(?:lift|elevator)/i,
                /(?:modern|naya)\s+(?:lift|elevator)/i
            ],
            ac: [
                /(?:with|having)\s+ac/i,
                /(?:air\s+conditioning|air\s+conditioner)/i,
                /(?:central\s+)?ac/i,
                /(?:split\s+)?ac/i,
                // Routine language
                /(?:ac|air\s+conditioner|cooler)\s+(?:hai|available)/i,
                /(?:with|ke\s+sath)\s+(?:ac|cooler)/i,
                /(?:central|split)\s+(?:ac|cooler)/i
            ]
        };

        // Check for parking
        if (amenityPatterns.parking.some(pattern => pattern.test(norm))) {
            extracted.parking = true;
        } else if (/no\s+parking|without\s+parking/i.test(norm)) {
            extracted.parking = false;
        }

        // Check for furnished/unfurnished
        if (amenityPatterns.furnished.some(pattern => pattern.test(norm))) {
            extracted.furnished = true;
        } else if (amenityPatterns.unfurnished.some(pattern => pattern.test(norm))) {
            extracted.furnished = false;
        }

        // Check for offers
        if (amenityPatterns.offer.some(pattern => pattern.test(norm))) {
            extracted.offer = true;
        }

        // Property size detection
        const sizePatterns = [
            /(?:small|compact|studio|1\s*bhk)/i,
            /(?:medium|2\s*bhk|3\s*bhk)/i,
            /(?:large|big|4\s*bhk|5\s*bhk)/i,
            /(?:luxury|premium|villa|penthouse)/i
        ];

        if (/small|compact|studio|1\s*bhk/i.test(norm)) {
            extracted.bedrooms = '1';
        } else if (/medium|2\s*bhk|3\s*bhk/i.test(norm)) {
            extracted.bedrooms = '2';
        } else if (/large|big|4\s*bhk|5\s*bhk/i.test(norm)) {
            extracted.bedrooms = '4';
        }

        // Property condition detection
        if (/new|newly\s+built|recently\s+constructed/i.test(norm)) {
            // Could add a condition filter if needed
        } else if (/old|aged|renovated|refurbished/i.test(norm)) {
            // Could add a condition filter if needed
        }

        // Urgency detection
        if (/urgent|immediate|asap|quick|fast/i.test(norm)) {
            extracted.sort = 'createdAt';
            extracted.order = 'desc';
        }

        // Monthly rent intent cues
        if (/(per\s*month|monthly|\/mo|pm)/i.test(norm)) {
            extracted.type = 'rent';
        }

        const urlParams = new URLSearchParams(extracted);
        navigate(`?${urlParams.toString()}`);
    };

    const showMoreListingClick = async () => {
        try {
            const urlParams = new URLSearchParams(location.search);
            urlParams.set("startIndex", listings.length);
            // urlParams.set("visibility", "public");
            const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?${urlParams.toString()}`);
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col font-sans text-slate-800 dark:text-gray-200 transition-colors duration-300">
            {/* Search Header / Hero */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 pb-20 pt-10 px-4 shadow-lg mb-8 relative transition-colors duration-300">
                {/* Abstract shapes for visual interest */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
                    <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] rounded-full bg-white mix-blend-overlay filter blur-3xl animate-float"></div>
                    <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-300 mix-blend-overlay filter blur-3xl animate-float" style={{ animationDelay: "2s" }}></div>
                </div>

                <div className="max-w-7xl mx-auto text-center relative z-20 animate-slideInFromTop">
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tighter drop-shadow-2xl">
                        Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400">Sanctuary</span>
                    </h1>

                    {/* AI Toggle Stick */}
                    <div className="flex justify-center mb-8">
                        <div className="bg-white/10 backdrop-blur-md p-1 rounded-full border border-white/20 inline-flex relative">
                            <button
                                onClick={() => {
                                    setUseAI(false);
                                    const params = new URLSearchParams(location.search);
                                    params.delete("mode");
                                    navigate(`?${params.toString()}`);
                                }}
                                className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${!useAI ? 'bg-white text-blue-600 shadow-lg' : 'text-blue-100 hover:text-white'}`}
                            >
                                Classic
                            </button>
                            <button
                                onClick={() => {
                                    setUseAI(true);
                                    const params = new URLSearchParams(location.search);
                                    params.set("mode", "ai");
                                    navigate(`?${params.toString()}`);
                                }}
                                className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${useAI ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30' : 'text-blue-100 hover:text-white'}`}
                            >
                                <Sparkles size={14} className={useAI ? "animate-pulse" : ""} /> Setu AI
                            </button>
                        </div>
                    </div>

                    <form onSubmit={useAI ? handleSubmit : applySmartQuery} className="max-w-3xl mx-auto relative group">
                        <div className={`relative flex items-center bg-white dark:bg-gray-800 rounded-full p-2 transition-all duration-500 ${useAI ? 'shadow-[0_0_50px_-10px_rgba(168,85,247,0.5)] border-2 border-purple-500/50' : 'shadow-2xl border-4 border-white/20'}`}>

                            <div className="pl-6 text-gray-400">
                                {useAI ? <Sparkles className="text-purple-500 animate-pulse" /> : <SearchIcon />}
                            </div>

                            <input
                                type="text"
                                placeholder={useAI ? "Describe your dream home... (e.g., 'Modern villa near a park with morning sunlight')" : "Enter an address, neighborhood, city, or ZIP code"}
                                className="w-full bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-200 placeholder-gray-400 text-sm sm:text-lg h-12 sm:h-14 font-medium"
                                value={useAI ? aiPrompt : smartQuery}
                                onChange={useAI ? (e) => setAiPrompt(e.target.value) : (e) => setSmartQuery(e.target.value)}
                                name={useAI ? "aiPrompt" : "smartQuery"}
                                autoComplete="off"
                                onFocus={handleSearchInputFocus}
                                onBlur={handleSearchInputBlur}
                            />

                            <button className={`h-12 w-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform transform active:scale-95 ${useAI ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:rotate-12' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                {useAI ? <Sparkles size={20} /> : <SearchIcon size={20} />}
                            </button>

                            <SearchSuggestions
                                searchTerm={useAI ? aiPrompt : smartQuery}
                                onSuggestionClick={(s) => {
                                    if (useAI) {
                                        setAiPrompt(s.displayText);
                                    } else {
                                        setSmartQuery(s.displayText);
                                    }
                                    handleSuggestionClick(s);
                                }}
                                onClose={() => setShowSuggestions(false)}
                                isVisible={showSuggestions}
                            />
                        </div>
                        {useAI && (
                            <div className="absolute -bottom-8 left-0 right-0 text-center">
                                <span className="text-[10px] font-bold text-purple-200 uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                                    Vector Semantic Search Active
                                </span>
                            </div>
                        )}
                    </form>
                </div>

            </div>


            {/* Main Content Area */}
            <main className="flex-grow max-w-7xl mx-auto px-4 w-full -mt-20 relative z-10 pb-20">
                {/* Mobile Filter Toggle Button */}
                <button
                    onClick={() => setIsFiltersOpen(true)}
                    className="md:hidden w-full mb-6 bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                >
                    <Filter className="w-5 h-5" /> Open Filters
                </button>

                {/* Detailed Filters Card */}
                <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6 mb-8 animate-fade-in-up transition-colors duration-300">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                        <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Detailed Filters</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Keyword Search */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-4 relative group">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Property Search</label>
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    name="searchTerm"
                                    value={formData.searchTerm}
                                    onChange={handleChanges}
                                    onFocus={handleSearchInputFocus}
                                    onBlur={handleSearchInputBlur}
                                    placeholder={useAI ? "Describe your dream home... (e.g. cozy vibe with sunset view 🌅)" : "Search by name, location, or features..."}
                                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all outline-none ${useAI
                                        ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 focus:border-indigo-500 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 text-indigo-900 dark:text-indigo-100 placeholder-indigo-300"
                                        : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-100 dark:focus:ring-blue-900/30 dark:text-white"
                                        }`}
                                />
                                <SearchSuggestions
                                    searchTerm={formData.searchTerm}
                                    onSuggestionClick={handleSuggestionClick}
                                    onClose={() => setShowSuggestions(false)}
                                    isVisible={showSuggestions}
                                    className="mt-1"
                                />
                            </div>

                            {/* AI Search Toggle */}
                            <div className="mt-3 flex items-center justify-between">
                                <p className="text-xs text-gray-400">
                                    {useAI ? "💡 AI will analyze the 'vibe' of properties based on your description." : "Standard keyword search."}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setUseAI(!useAI)}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-300 ${useAI
                                        ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg scale-105"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                                        }`}
                                >
                                    <Sparkles className={`w-4 h-4 ${useAI ? "text-yellow-300 animate-pulse" : ""}`} />
                                    {useAI ? "AI Search Active" : "Enable AI Search"}
                                </button>
                            </div>
                        </div>

                        {/* Location */}
                        <div className="lg:col-span-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Location</label>
                            <LocationSelector value={locationFilter} onChange={handleLocationChange} mode="search" className="w-full" />
                        </div>

                        {/* Type */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Property Type</label>
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                                {['all', 'rent', 'sale'].map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, type: t }))}
                                        className={`flex-1 capitalize py-2 rounded-lg text-sm font-medium transition-all ${formData.type === t
                                            ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow-sm font-bold'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sort */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Sort By</label>
                            <div className="relative">
                                <select
                                    onChange={(e) => {
                                        const [sort, order] = e.target.value.split("_");
                                        setFormData((prev) => ({ ...prev, sort, order }));
                                    }}
                                    value={`${formData.sort}_${formData.order}`}
                                    className="w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl appearance-none focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500 focus:outline-none transition-all cursor-pointer"
                                    id="sort_order"
                                >
                                    <option value="regularPrice_desc">Price: High to Low</option>
                                    <option value="regularPrice_asc">Price: Low to High</option>
                                    <option value="createdAt_desc">Newest First</option>
                                    <option value="createdAt_asc">Oldest First</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* Price Range */}
                        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Min Price</label>
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="number"
                                        name="minPrice"
                                        value={formData.minPrice}
                                        onChange={handleChanges}
                                        placeholder="Min"
                                        className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500 focus:outline-none transition-all"
                                        min={0}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Max Price</label>
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="number"
                                        name="maxPrice"
                                        value={formData.maxPrice}
                                        onChange={handleChanges}
                                        placeholder="Max"
                                        className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500 focus:outline-none transition-all"
                                        min={0}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Beds / Baths */}
                        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Bedrooms</label>
                                <input
                                    type="number"
                                    name="bedrooms"
                                    value={formData.bedrooms}
                                    onChange={handleChanges}
                                    placeholder="Beds"
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500 focus:outline-none transition-all"
                                    min={0}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Bathrooms</label>
                                <input
                                    type="number"
                                    name="bathrooms"
                                    value={formData.bathrooms}
                                    onChange={handleChanges}
                                    placeholder="Baths"
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500 focus:outline-none transition-all"
                                    min={0}
                                />
                            </div>
                        </div>

                        {/* Amenities */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-4 flex flex-wrap gap-4 pt-2">
                            {[
                                { name: 'parking', label: 'Parking Space' },
                                { name: 'furnished', label: 'Furnished' },
                                { name: 'offer', label: 'Special Offer' }
                            ].map((amenity) => (
                                <label key={amenity.name} className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-200 ${formData[amenity.name] ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600 group-hover:border-blue-400'
                                        }`}>
                                        {formData[amenity.name] && <svg className="w-4 h-4 text-white font-bold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                    </div>
                                    <span className={`text-sm font-medium transition-colors ${formData[amenity.name] ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200'}`}>{amenity.label}</span>
                                    <input
                                        type="checkbox"
                                        name={amenity.name}
                                        onChange={handleChanges}
                                        checked={formData[amenity.name]}
                                        className="hidden"
                                    />
                                </label>
                            ))}
                        </div>

                        <div className="col-span-1 md:col-span-2 lg:col-span-4 flex justify-end">
                            <button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Update Results
                            </button>
                        </div>
                    </form>
                </div>

                {/* Active Filters Display */}
                <div className="mb-8">
                    <FilterChips formData={formData} onClear={clearAllFilters} onRemove={removeFilter} />
                </div>

                {/* Listing Results */}
                <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            Search Results
                            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700">
                                {listings.length} properties
                            </span>
                        </h2>
                    </div>

                    {error && (
                        <div className="text-center py-10 bg-red-50 rounded-xl border border-red-100 animate-fade-in">
                            <p className="text-red-600 text-lg font-medium">{error}</p>
                            <button onClick={() => window.location.reload()} className="mt-4 text-blue-600 hover:underline">Try refreshing the page</button>
                        </div>
                    )}

                    {!loading && !error && listings.length === 0 && (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-12 text-center animate-fade-in-up transition-colors duration-300">
                            <img src={duckImg} alt="No listings found" className="w-[280px] h-[280px] object-contain mx-auto opacity-90 hover:scale-105 transition-transform duration-500" />
                            <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-2">No properties matched your search</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                                We couldn't find exactly what you're looking for. Try adjusting your filters or use our Smart Search.
                            </p>
                            <button
                                onClick={clearAllFilters}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" /> Clear all filters
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {loading ? (
                            <ListingSkeletonGrid count={8} />
                        ) : (
                            listings.map((listing, index) => (
                                <div
                                    key={listing._id}
                                    className="animate-fade-in-up"
                                    style={{ animationDelay: `${index * 0.05}s` }}
                                >
                                    <ListingItem listing={listing} />
                                </div>
                            ))
                        )}
                    </div>

                    {showMoreListing && (
                        <div className="flex justify-center mt-12">
                            <button
                                type="button"
                                onClick={showMoreListingClick}
                                className="group relative px-8 py-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-white font-bold rounded-full shadow-md hover:shadow-lg hover:text-blue-600 dark:hover:text-blue-400 transition-all border border-gray-200 dark:border-gray-700 border-b-4 hover:border-b active:border-b-0 active:translate-y-1"
                            >
                                <span className="relative z-10 flex items-center gap-2">Show More Properties <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" /></span>
                            </button>
                        </div>
                    )}
                </div>

                {recommendations.length > 0 && (
                    <div className="mt-16 pt-10 border-t border-gray-200 dark:border-gray-800">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Recommended for you</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {recommendations.map((l, index) => (
                                <div key={l._id} className="animate-fade-in-up" style={{ animationDelay: `${index * 0.05}s` }}>
                                    <ListingItem listing={l} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Mobile Filters Drawer */}
            {
                isFiltersOpen && (
                    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setIsFiltersOpen(false)}>
                        <div className="absolute right-0 top-0 h-full w-4/5 max-w-sm bg-white dark:bg-gray-900 shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto animate-slide-in-right transition-colors duration-300" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-4 border-b dark:border-gray-800 pb-4">
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Filter Properties</h2>
                                <button onClick={() => setIsFiltersOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white">Close</button>
                            </div>

                            {/* Mobile Search Term */}
                            <div className="mb-2">
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Search Keyword</label>
                                <div className="relative">
                                    <SearchIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        name="searchTerm"
                                        value={formData.searchTerm}
                                        onChange={handleChanges}
                                        placeholder="Search..."
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Mobile Location Selector */}
                            <div className="mb-2">
                                <LocationSelector value={locationFilter} onChange={handleLocationChange} />
                            </div>

                            {/* Mobile Type Filter */}
                            <div className="mb-2">
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Property Type</label>
                                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                                    {['all', 'rent', 'sale'].map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, type: t }))}
                                            className={`flex-1 capitalize py-2 rounded-lg text-sm font-medium transition-all ${formData.type === t
                                                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                                }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mobile Detailed Filters */}
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl mb-2">
                                <label className="block text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">Price & Size</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="number" name="minPrice" placeholder="Min ₹" value={formData.minPrice} onChange={handleChanges} className="p-2 border dark:border-gray-700 rounded-lg w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                                    <input type="number" name="maxPrice" placeholder="Max ₹" value={formData.maxPrice} onChange={handleChanges} className="p-2 border dark:border-gray-700 rounded-lg w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                                    <input type="number" name="bedrooms" placeholder="Beds" value={formData.bedrooms} onChange={handleChanges} className="p-2 border dark:border-gray-700 rounded-lg w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                                    <input type="number" name="bathrooms" placeholder="Baths" value={formData.bathrooms} onChange={handleChanges} className="p-2 border dark:border-gray-700 rounded-lg w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                                </div>
                            </div>

                            {/* Mobile Checkboxes */}
                            <div className="flex flex-col gap-3 mb-4">
                                {['parking', 'furnished', 'offer'].map(item => (
                                    <label key={item} className="flex items-center gap-2">
                                        <input type="checkbox" name={item} checked={formData[item]} onChange={handleChanges} className="w-5 h-5 accent-blue-600" />
                                        <span className="capitalize text-gray-700 dark:text-gray-300 font-medium">{item}</span>
                                    </label>
                                ))}
                            </div>

                            {/* Mobile Sort */}
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sort By</label>
                            <select
                                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all mb-4"
                                onChange={(e) => {
                                    const [sort, order] = e.target.value.split("_");
                                    setFormData((prev) => ({ ...prev, sort, order }));
                                }}
                                value={`${formData.sort}_${formData.order}`}
                            >
                                <option value="regularPrice_desc">Price: High to Low</option>
                                <option value="regularPrice_asc">Price: Low to High</option>
                                <option value="createdAt_desc">Newest First</option>
                                <option value="createdAt_asc">Oldest First</option>
                            </select>

                            <button
                                onClick={(e) => {
                                    handleSubmit(e);
                                    setIsFiltersOpen(false);
                                }}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mt-2 shadow-md"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                )
            }

            <GeminiAIWrapper />
            <ContactSupportWrapper />
        </div >
    );
}
