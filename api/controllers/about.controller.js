import About from "../models/about.model.js";
import { errorHandler } from "../utils/error.js";

// Get About content
export const getAbout = async (req, res, next) => {
  try {
    let about = await About.findOne();
    
    // If no about content exists, create default content
    if (!about) {
      about = await About.create({
        heroTitle: "Welcome to UrbanSetu",
        heroText: "Your trusted platform for seamless real estate experiences. Whether you're buying, renting, or managing properties, UrbanSetu bridges the gap between people and properties through smart technology and user-first design.",
        mission: "Our mission is to simplify real estate transactions by providing a transparent, intuitive, and powerful platform that connects buyers, sellers, renters, and agents effectively.",
        features: [
          "Advanced property search with filters & map view",
          "Virtual tours, property videos, and floor plans",
          "In-app messaging between users and agents",
          "Review system and user dashboards",
          "Admin analytics, listing management & appointments",
          "Mobile-ready Progressive Web App (PWA)"
        ],
        whoWeServe: [
          "Home buyers and renters looking for verified properties",
          "Property owners and agents seeking visibility and tools",
          "Admins needing oversight and smart analytics"
        ],
        trust: "Every listing goes through a verification process, and reviews help ensure transparency. Our platform is designed with user security and data privacy at its core.",
        team: "UrbanSetu is built by a passionate team of real estate and technology enthusiasts, dedicated to making property transactions simple, secure, and enjoyable for everyone.",
        contact: "Have questions or feedback?\n📧 Email us at: support@urbansetu.com\n🧑‍💻 Or visit our Help Center",
        updatedBy: "System"
      });
    }
    
    res.status(200).json(about);
  } catch (error) {
    next(error);
  }
};

// Update About content (Admin only)
export const updateAbout = async (req, res, next) => {
  try {
    const { heroTitle, heroText, mission, features, whoWeServe, trust, team, contact, customFields } = req.body;
    const { username } = req.user; // From verifyToken middleware
    
    let about = await About.findOne();
    
    if (!about) {
      // Create new about content if it doesn't exist
      about = await About.create({
        heroTitle,
        heroText,
        mission,
        features,
        whoWeServe,
        trust,
        team,
        contact,
        customFields: customFields || [],
        updatedBy: username
      });
    } else {
      // Update existing about content
      about = await About.findByIdAndUpdate(
        about._id,
        {
          heroTitle,
          heroText,
          mission,
          features,
          whoWeServe,
          trust,
          team,
          contact,
          customFields: customFields || [],
          lastUpdated: Date.now(),
          updatedBy: username
        },
        { new: true }
      );
    }
    
    res.status(200).json(about);
  } catch (error) {
    next(error);
  }
}; 