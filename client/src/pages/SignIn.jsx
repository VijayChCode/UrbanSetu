import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signInFailure, signInStart, signInSuccess } from "../redux/user/userSlice.js";
import Oauth from "../components/Oauth.jsx";
import ContactSupportWrapper from "../components/ContactSupportWrapper.jsx";

export default function SignIn() {
    const [formData, setFormData] = useState({
        email: "",
        password: ""
    });
    const [urlError, setUrlError] = useState("");

    const { loading, error, currentUser } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const location = useLocation();

    // Check for error parameters in URL on component mount
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const errorParam = searchParams.get('error');
        
        if (errorParam === 'password_change_unsuccessful') {
            setUrlError("Password change unsuccessful! Please try again.");
            // Clear the error parameter from URL
            navigate('/sign-in', { replace: true });
        }
    }, [location.search, navigate]);

    // Block access if already signed in
    useEffect(() => {
        if (currentUser) {
            if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
                // Special handling for root admin
                if (currentUser.isDefaultAdmin) {
                    navigate('/admin', { replace: true });
                } else {
                    navigate('/admin', { replace: true });
                }
            } else {
                navigate('/user', { replace: true });
            }
        }
    }, [currentUser, navigate]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.id]: e.target.value
        });
        // Clear URL error when user starts typing
        if (urlError) {
            setUrlError("");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        dispatch(signInStart());
        try {
            const apiUrl = "/api/auth/signin";
            const options = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            };
            const res = await fetch(apiUrl, options);
            const data = await res.json();

            if (data.success === false) {
                dispatch(signInFailure(data.message));
                return;
            }
            
            // Dispatch success and wait for state update
            dispatch(signInSuccess(data));
            
            // Use a small delay to ensure state is updated
            await new Promise(resolve => setTimeout(resolve, 50));
            
            if (data.role === "admin" || data.role === "rootadmin") {
                // Special handling for root admin
                if (data.isDefaultAdmin) {
                    navigate("/admin");
                } else {
                    navigate("/admin");
                }
            } else {
                navigate("/user");
            }

        } catch (error) {
            dispatch(signInFailure(error.message));
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Image and Quote */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-700 relative overflow-hidden">
                <div className="absolute inset-0 bg-black opacity-20"></div>
                <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
                    <div className="text-center max-w-md">
                        <h1 className="text-4xl font-bold mb-6 animate-fade-in">
                            Welcome Back
                        </h1>
                        <p className="text-xl mb-8 leading-relaxed animate-fade-in-delay">
                            "Home is not a place, it's a feeling. Find your perfect sanctuary with us."
                        </p>
                        <div className="space-y-4 text-lg animate-fade-in-delay-2">
                            <div className="flex items-center justify-center space-x-3">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                <span>Discover Your Dream Home</span>
                            </div>
                            <div className="flex items-center justify-center space-x-3">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
                                <span>Connect with Trusted Agents</span>
                            </div>
                            <div className="flex items-center justify-center space-x-3">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
                                <span>Secure & Reliable Platform</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Floating Elements */}
                <div className="absolute top-20 left-20 w-16 h-16 bg-white bg-opacity-10 rounded-full animate-float"></div>
                <div className="absolute bottom-32 right-16 w-12 h-12 bg-white bg-opacity-10 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
                <div className="absolute top-1/2 right-24 w-8 h-8 bg-white bg-opacity-10 rounded-full animate-float" style={{animationDelay: '1s'}}></div>
                
                {/* House Silhouette */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black bg-opacity-20">
                    <svg className="w-full h-full" viewBox="0 0 100 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 2L2 8V18H18V8L10 2Z" fill="white" fillOpacity="0.1"/>
                        <path d="M8 12H12V18H8V12Z" fill="white" fillOpacity="0.2"/>
                        <circle cx="10" cy="5" r="1" fill="white" fillOpacity="0.3"/>
                    </svg>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-gray-800 mb-2">Sign In</h2>
                        <p className="text-gray-600">Welcome back! Please sign in to your account.</p>
                    </div>
                    
                    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    Email Address
                                </label>
                                <input 
                                    type="email" 
                                    placeholder="Enter your email" 
                                    id="email" 
                                    onChange={handleChange} 
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                    Password
                                </label>
                                <input 
                                    type="password" 
                                    placeholder="Enter your password" 
                                    id="password" 
                                    onChange={handleChange} 
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    required
                                />
                            </div>
                            
                            {/* Forgot Password Link */}
                            <div className="text-right">
                                <Link 
                                    to="/forgot-password" 
                                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"
                                >
                                    Forgot Password?
                                </Link>
                            </div>
                            
                            <button 
                                disabled={loading} 
                                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                        Signing In...
                                    </div>
                                ) : (
                                    "Sign In"
                                )}
                            </button>
                            
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-gray-500">Or continue with</span>
                                </div>
                            </div>
                            
                            <Oauth pageType="signIn" />
                            
                            {(error || urlError) && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <p className="text-red-600 text-sm">{urlError || error}</p>
                                </div>
                            )}
                        </form>
                        
                        <div className="mt-6 text-center">
                            <p className="text-gray-600">
                                Don't have an account?{" "}
                                <Link to="/sign-up" className="text-blue-600 hover:text-blue-800 font-semibold hover:underline transition-colors duration-200">
                                    Sign Up
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <ContactSupportWrapper />
        </div>
    );
}

