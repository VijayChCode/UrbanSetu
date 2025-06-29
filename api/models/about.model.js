import mongoose from "mongoose";

const aboutSchema = new mongoose.Schema({
  heroTitle: {
    type: String,
    required: true,
    default: "Welcome to UrbanSetu"
  },
  heroText: {
    type: String,
    required: true,
    default: "Your trusted platform for seamless real estate experiences. Whether you're buying, renting, or managing properties, UrbanSetu bridges the gap between people and properties through smart technology and user-first design."
  },
  mission: {
    type: String,
    required: true,
    default: "Our mission is to simplify real estate transactions by providing a transparent, intuitive, and powerful platform that connects buyers, sellers, renters, and agents effectively."
  },
  features: [{
    type: String,
    required: true
  }],
  whoWeServe: [{
    type: String,
    required: true
  }],
  trust: {
    type: String,
    required: true,
    default: "Every listing goes through a verification process, and reviews help ensure transparency. Our platform is designed with user security and data privacy at its core."
  },
  team: {
    type: String,
    required: true,
    default: "UrbanSetu is built by a passionate team of real estate and technology enthusiasts, dedicated to making property transactions simple, secure, and enjoyable for everyone."
  },
  contact: {
    type: String,
    required: true,
    default: "Have questions or feedback?\n📧 Email us at: support@urbansetu.com\n🧑‍💻 Or visit our Help Center"
  },
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