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
        vision: "To become India's most trusted digital real estate network driven by AI and community insights, where every property transaction is transparent, efficient, and customer-centric.",
        features: [
          "AI-powered property recommendations",
          "Verified & secure listings with fraud detection",
          "Real-time chat system (Socket.io)",
          "Advanced search with filters & map view",
          "Wishlist vs Watchlist management",
          "Appointment booking system",
          "Admin insights dashboard",
          "Responsive design with dark/light mode",
          "Mobile-ready Progressive Web App (PWA)",
          "Review system and user dashboards"
        ],
        whoWeServe: [
          "Home buyers and renters looking for verified properties",
          "Property owners and agents seeking visibility and tools",
          "Admins needing oversight and smart analytics"
        ],
        coreValues: [
          {
            title: "Transparency",
            description: "We believe in complete transparency in all our dealings and maintain the highest standards of trust."
          },
          {
            title: "User Trust & Data Privacy",
            description: "Your data security and privacy are our top priorities. We implement industry-leading security measures."
          },
          {
            title: "Innovation",
            description: "We continuously innovate using AI, automation, and analytics to provide the best technology solutions."
          },
          {
            title: "Fair Marketplace",
            description: "We ensure a fair and equal platform for all users, promoting ethical practices in real estate."
          },
          {
            title: "Verified Listings & Secure Transactions",
            description: "Every listing is verified, and all transactions are secure and protected."
          }
        ],
        howItWorks: {
          buyers: {
            title: "For Buyers & Renters",
            steps: [
              "Browse verified properties with AI-powered recommendations",
              "Use advanced filters and map view to find your perfect home",
              "Add properties to wishlist or watchlist for easy tracking",
              "Book appointments and chat with property owners in real-time",
              "Make informed decisions with detailed property insights"
            ]
          },
          sellers: {
            title: "For Sellers & Property Owners",
            steps: [
              "List your property with detailed information and media",
              "Track performance with comprehensive analytics dashboard",
              "Chat with potential buyers and manage inquiries",
              "Schedule and manage property visits efficiently",
              "Monitor reviews and maintain your property's reputation"
            ]
          },
          admins: {
            title: "For Administrators",
            steps: [
              "Approve and manage property listings",
              "Monitor platform activity and user interactions",
              "Analyze data insights and platform performance",
              "Manage user accounts and resolve disputes",
              "Ensure platform security and compliance"
            ]
          }
        },
        journey: {
          title: "Our Journey",
          story: "The idea of UrbanSetu was born from the need for a smarter, transparent real estate experience. Our team combined technology, data, and user feedback to build a platform that goes beyond listings — one that learns and adapts to user needs.",
          milestones: [
            {
              year: "2020",
              title: "Company Founded",
              description: "Started with a vision to revolutionize real estate in India"
            },
            {
              year: "2021",
              title: "1000+ Properties",
              description: "Reached our first milestone of 1000 verified listings"
            },
            {
              year: "2022",
              title: "AI Integration",
              description: "Launched AI-powered property recommendations and fraud detection"
            },
            {
              year: "2023",
              title: "10K+ Customers",
              description: "Served over 10,000 satisfied customers nationwide"
            },
            {
              year: "2024",
              title: "Mobile App Launch",
              description: "Launched our comprehensive mobile application and PWA"
            }
          ]
        },
        team: "UrbanSetu is built by a passionate team of real estate and technology enthusiasts, dedicated to making property transactions simple, secure, and enjoyable for everyone.",
        teamMembers: [
          {
            name: "Rajesh Kumar",
            role: "CEO & Founder",
            description: "Visionary leader with 15+ years in real estate technology",
            image: null
          },
          {
            name: "Priya Sharma",
            role: "CTO",
            description: "Tech expert specializing in AI and machine learning",
            image: null
          },
          {
            name: "Amit Patel",
            role: "Head of Operations",
            description: "Operations specialist ensuring smooth customer experience",
            image: null
          },
          {
            name: "Sneha Gupta",
            role: "Head of Marketing",
            description: "Marketing strategist connecting properties with people",
            image: null
          }
        ],
        faqs: [
          {
            question: "What is UrbanSetu?",
            answer: "UrbanSetu is a comprehensive real estate platform that uses AI and smart technology to connect buyers, sellers, and renters. We provide verified listings, real-time chat, appointment booking, and advanced analytics to make property transactions seamless and secure."
          },
          {
            question: "Is UrbanSetu free to use?",
            answer: "Yes! UrbanSetu is completely free for buyers and renters. Property owners can list their properties for free with basic features, and we offer premium plans for advanced analytics and marketing tools."
          },
          {
            question: "How are properties verified?",
            answer: "Every property goes through our comprehensive verification process, including document verification, location verification, and fraud detection. We also use AI to analyze listing quality and authenticity."
          },
          {
            question: "How do I book a property visit?",
            answer: "Simply browse properties, click on the property you're interested in, and use our appointment booking system to schedule a visit. You can also chat with the property owner directly through our real-time messaging system."
          },
          {
            question: "Is my data secure on UrbanSetu?",
            answer: "Absolutely! We implement industry-leading security measures including data encryption, secure authentication, and regular security audits. Your personal information is protected and never shared without your consent."
          },
          {
            question: "How can I contact support?",
            answer: "You can reach our support team through email at info.urbansetu@gmail.com, use our in-app chat support, or call our helpline. We also have a comprehensive help center with detailed guides and FAQs."
          }
        ],
        trust: "Every listing goes through a verification process, and reviews help ensure transparency. Our platform is designed with user security and data privacy at its core.",
        contact: "Have questions or feedback?\n📧 Email us at: info.urbansetu@gmail.com\n🧑‍💻 Or visit our Help Center",
        socialLinks: {
          email: "info.urbansetu@gmail.com",
          instagram: "https://instagram.com/urbansetu",
          x: "https://x.com/urbansetu",
          facebook: "https://facebook.com/urbansetu",
          youtube: "https://youtube.com/@urbansetu"
        },
        updatedBy: "System"
      });
    }
    
    res.status(200).json(about);
  } catch (error) {
    next(error);
  }
};

// Update About content with new fields (for migration)
export const migrateAbout = async (req, res, next) => {
  try {
    let about = await About.findOne();
    
    if (!about) {
      return res.status(404).json({ message: 'About document not found' });
    }
    
    // Update with new fields if they don't exist
    const updateData = {};
    
    if (!about.vision) {
      updateData.vision = "To become India's most trusted digital real estate network driven by AI and community insights, where every property transaction is transparent, efficient, and customer-centric.";
    }
    
    if (!about.coreValues || about.coreValues.length === 0) {
      updateData.coreValues = [
        {
          title: "Transparency",
          description: "We believe in complete transparency in all our dealings and maintain the highest standards of trust."
        },
        {
          title: "User Trust & Data Privacy",
          description: "Your data security and privacy are our top priorities. We implement industry-leading security measures."
        },
        {
          title: "Innovation",
          description: "We continuously innovate using AI, automation, and analytics to provide the best technology solutions."
        },
        {
          title: "Fair Marketplace",
          description: "We ensure a fair and equal platform for all users, promoting ethical practices in real estate."
        },
        {
          title: "Verified Listings & Secure Transactions",
          description: "Every listing is verified, and all transactions are secure and protected."
        }
      ];
    }
    
    if (!about.howItWorks || !about.howItWorks.buyers || about.howItWorks.buyers.steps.length === 0) {
      updateData.howItWorks = {
        buyers: {
          title: "For Buyers & Renters",
          steps: [
            "Browse verified properties with AI-powered recommendations",
            "Use advanced filters and map view to find your perfect home",
            "Add properties to wishlist or watchlist for easy tracking",
            "Book appointments and chat with property owners in real-time",
            "Make informed decisions with detailed property insights"
          ]
        },
        sellers: {
          title: "For Sellers & Property Owners",
          steps: [
            "List your property with detailed information and media",
            "Track performance with comprehensive analytics dashboard",
            "Chat with potential buyers and manage inquiries",
            "Schedule and manage property visits efficiently",
            "Monitor reviews and maintain your property's reputation"
          ]
        },
        admins: {
          title: "For Administrators",
          steps: [
            "Approve and manage property listings",
            "Monitor platform activity and user interactions",
            "Analyze data insights and platform performance",
            "Manage user accounts and resolve disputes",
            "Ensure platform security and compliance"
          ]
        }
      };
    }
    
    if (!about.journey || !about.journey.milestones || about.journey.milestones.length === 0) {
      updateData.journey = {
        title: "Our Journey",
        story: "The idea of UrbanSetu was born from the need for a smarter, transparent real estate experience. Our team combined technology, data, and user feedback to build a platform that goes beyond listings — one that learns and adapts to user needs.",
        milestones: [
          {
            year: "2020",
            title: "Company Founded",
            description: "Started with a vision to revolutionize real estate in India"
          },
          {
            year: "2021",
            title: "1000+ Properties",
            description: "Reached our first milestone of 1000 verified listings"
          },
          {
            year: "2022",
            title: "AI Integration",
            description: "Launched AI-powered property recommendations and fraud detection"
          },
          {
            year: "2023",
            title: "10K+ Customers",
            description: "Served over 10,000 satisfied customers nationwide"
          },
          {
            year: "2024",
            title: "Mobile App Launch",
            description: "Launched our comprehensive mobile application and PWA"
          }
        ]
      };
    }
    
    if (!about.teamMembers || about.teamMembers.length === 0) {
      updateData.teamMembers = [
        {
          name: "Bahvith Tungena",
          role: "CEO & Founder",
          description: "Visionary leader with 15+ years in real estate technology",
          image: null
        },
        {
          name: "Akhil Reddy",
          role: "CTO",
          description: "Tech expert specializing in AI and machine learning",
          image: null
        },
        {
          name: "Harsha Vardhan",
          role: "Head of Operations",
          description: "Operations specialist ensuring smooth customer experience",
          image: null
        },
        {
          name: "Vijay",
          role: "Head of Marketing",
          description: "Marketing strategist connecting properties with people",
          image: null
        }
      ];
    }
    
    if (!about.faqs || about.faqs.length === 0) {
      updateData.faqs = [
        {
          question: "What is UrbanSetu?",
          answer: "UrbanSetu is a comprehensive real estate platform that uses AI and smart technology to connect buyers, sellers, and renters. We provide verified listings, real-time chat, appointment booking, and advanced analytics to make property transactions seamless and secure."
        },
        {
          question: "Is UrbanSetu free to use?",
          answer: "Yes! UrbanSetu is completely free for buyers and renters. Property owners can list their properties for free with basic features, and we offer premium plans for advanced analytics and marketing tools."
        },
        {
          question: "How are properties verified?",
          answer: "Every property goes through our comprehensive verification process, including document verification, location verification, and fraud detection. We also use AI to analyze listing quality and authenticity."
        },
        {
          question: "How do I book a property visit?",
          answer: "Simply browse properties, click on the property you're interested in, and use our appointment booking system to schedule a visit. You can also chat with the property owner directly through our real-time messaging system."
        },
        {
          question: "Is my data secure on UrbanSetu?",
          answer: "Absolutely! We implement industry-leading security measures including data encryption, secure authentication, and regular security audits. Your personal information is protected and never shared without your consent."
        },
        {
          question: "How can I contact support?",
          answer: "You can reach our support team through email at info.urbansetu@gmail.com, use our in-app chat support, or call our helpline. We also have a comprehensive help center with detailed guides and FAQs."
        }
      ];
    }
    
    if (!about.socialLinks) {
      updateData.socialLinks = {
        email: "info.urbansetu@gmail.com",
        instagram: "https://instagram.com/urbansetu",
        x: "https://x.com/urbansetu",
        facebook: "https://facebook.com/urbansetu",
        youtube: "https://youtube.com/@urbansetu"
      };
    }
    
    if (Object.keys(updateData).length > 0) {
      about = await About.findByIdAndUpdate(
        about._id,
        { ...updateData, lastUpdated: Date.now() },
        { new: true }
      );
      res.status(200).json({ 
        message: 'About document updated successfully', 
        updatedFields: Object.keys(updateData),
        about 
      });
    } else {
      res.status(200).json({ 
        message: 'About document already has all new fields', 
        about 
      });
    }
    
  } catch (error) {
    next(error);
  }
};

// Update About content (Admin only)
export const updateAbout = async (req, res, next) => {
  try {
    const { 
      heroTitle, heroText, mission, vision, features, whoWeServe, coreValues, 
      howItWorks, journey, team, teamMembers, faqs, trust, contact, 
      socialLinks, customFields 
    } = req.body;
    const { username } = req.user; // From verifyToken middleware
    
    let about = await About.findOne();
    
    if (!about) {
      // Create new about content if it doesn't exist
      about = await About.create({
        heroTitle,
        heroText,
        mission,
        vision,
        features,
        whoWeServe,
        coreValues,
        howItWorks,
        journey,
        team,
        teamMembers,
        faqs,
        trust,
        contact,
        socialLinks,
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
          vision,
          features,
          whoWeServe,
          coreValues,
          howItWorks,
          journey,
          team,
          teamMembers,
          faqs,
          trust,
          contact,
          socialLinks,
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