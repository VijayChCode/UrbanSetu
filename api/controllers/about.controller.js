import About from "../models/about.model.js";
import { errorHandler } from "../utils/error.js";

// Get About content
export const getAbout = async (req, res, next) => {
  try {
    let about = await About.findOne();
    
    // If no about content exists, create default content
    if (!about) {
      about = await About.create({
        title: "About Real Estate",
        content: "Real Estate is a leading real estate agency that specializes in helping clients buy, sell, and rent properties in the most desirable neighborhoods. Our team of experienced agents is dedicated to providing exceptional service and making the buying and selling process as smooth as possible.",
        paragraphs: [
          "Our mission is to help our clients achieve their real estate goals by providing expert advice, personalized service, and a deep understanding of the local market. Whether you are looking to buy, sell, or rent a property, we are here to help you every step of the way.",
          "Our team of agents has a wealth of experience and knowledge in the real estate industry, and we are committed to providing the highest level of service to our clients. We believe that buying or selling a property should be an exciting and rewarding experience, and we are dedicated to making that a reality for each and every one of our clients."
        ],
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
    const { title, content, paragraphs } = req.body;
    const { username } = req.user; // From verifyToken middleware
    
    let about = await About.findOne();
    
    if (!about) {
      // Create new about content if it doesn't exist
      about = await About.create({
        title,
        content,
        paragraphs,
        updatedBy: username
      });
    } else {
      // Update existing about content
      about = await About.findByIdAndUpdate(
        about._id,
        {
          title,
          content,
          paragraphs,
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