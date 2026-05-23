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
  vision: {
    type: String,
    required: true,
    default: "To become India's most trusted digital real estate network driven by AI and community insights, where every property transaction is transparent, efficient, and customer-centric."
  },
  features: [{
    type: String,
    required: true
  }],
  whoWeServe: [{
    type: String,
    required: true
  }],
  coreValues: [{
    title: { type: String, required: true },
    description: { type: String, required: true }
  }],
  howItWorks: {
    buyers: {
      title: { type: String, required: true },
      steps: [{ type: String, required: true }]
    },
    sellers: {
      title: { type: String, required: true },
      steps: [{ type: String, required: true }]
    },
    admins: {
      title: { type: String, required: true },
      steps: [{ type: String, required: true }]
    }
  },
  journey: {
    title: { type: String, required: true },
    story: { type: String, required: true },
    milestones: [{
      year: { type: String, required: true },
      title: { type: String, required: true },
      description: { type: String, required: true }
    }]
  },
  team: {
    type: String,
    required: true,
    default: "UrbanSetu is built by a passionate team of real estate and technology enthusiasts, dedicated to making property transactions simple, secure, and enjoyable for everyone."
  },
  teamMembers: [{
    name: { type: String, required: true },
    role: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, default: null }
  }],
  faqs: [{
    question: { type: String, required: true },
    answer: { type: String, required: true }
  }],
  trust: {
    type: String,
    required: true,
    default: "Every listing goes through a verification process, and reviews help ensure transparency. Our platform is designed with user security and data privacy at its core."
  },
  contact: {
    type: String,
    required: true,
    default: "Have questions or feedback?\n📧 Email us at: info.urbansetu@gmail.com\n🧑‍💻 Or visit our Help Center"
  },
  socialLinks: {
    email: { type: String, default: "info.urbansetu@gmail.com" },
    instagram: { type: String, default: "https://instagram.com/urbansetu" },
    x: { type: String, default: "https://x.com/urbansetu" },
    facebook: { type: String, default: "https://facebook.com/urbansetu" },
    youtube: { type: String, default: "https://youtube.com/@urbansetu" }
  },
  customFields: [
    {
      key: { type: String, required: true },
      value: { type: String, required: true }
    }
  ],
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