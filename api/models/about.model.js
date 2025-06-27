import mongoose from "mongoose";

const aboutSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    default: "About Real Estate"
  },
  content: {
    type: String,
    required: true,
    default: "Real Estate is a leading real estate agency that specializes in helping clients buy, sell, and rent properties in the most desirable neighborhoods. Our team of experienced agents is dedicated to providing exceptional service and making the buying and selling process as smooth as possible."
  },
  paragraphs: [{
    type: String,
    required: true
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String,
    required: true
  }
}, { timestamps: true });

const About = mongoose.model("About", aboutSchema);

export default About; 