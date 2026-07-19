import mongoose from "mongoose";

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: {
    type: String,
    default: null,
    trim: true,
    maxlength: 80
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  messages: [{
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    isRestricted: {
      type: Boolean,
      default: false
    },
    isError: {
      type: Boolean,
      default: false
    },
    recommendations: {
      type: Array, // Array of property objects
      default: undefined
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    tokenUsage: {
      promptTokens: Number,
      completionTokens: Number,
      totalTokens: Number
    },
    variants: [{
      content: String,
      role: String,
      recommendations: Array,
      isError: Boolean,
      isRestricted: Boolean,
      timestamp: { type: Date, default: Date.now },
      images: [String],
      imageUrl: String,
      audioUrl: String,
      videoUrl: String,
      documentUrl: String,
      documentName: String,
      imageAudits: Object,
      ocrText: String,
      visionAnalysis: String,
      faceTags: [{
        name: { type: String, trim: true },
        details: { type: String, trim: true },
        descriptor: [Number]
      }],
      tokenUsage: {
        promptTokens: Number,
        completionTokens: Number,
        totalTokens: Number
      },
      tail: { type: Array, default: [] }
    }],
    activeVersionIndex: {
      type: Number,
      default: 0
    },
    // Media Attachments
    imageAudits: {
      type: Object,
      default: undefined
    },
    images: {
      type: [String],
      default: undefined
    },
    imageUrl: {
      type: String,
      default: undefined
    },
    audioUrl: {
      type: String,
      default: undefined
    },
    videoUrl: {
      type: String,
      default: undefined
    },
    documentUrl: {
      type: String,
      default: undefined
    },
    documentName: {
      type: String,
      default: undefined
    },
    ocrText: {
      type: String,
      default: undefined
    },
    visionAnalysis: {
      type: String,
      default: undefined
    },
    faceTags: [{
      name: { type: String, trim: true },
      details: { type: String, trim: true },
      descriptor: [Number]
    }]
  }],
  totalMessages: {
    type: Number,
    default: 0
  },
  totalTokens: {
    type: Number,
    default: 0
  },
  nonMessageTokens: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  settings: {
    messageLimit: { type: String },
    dataRetention: { type: String },
    tone: { type: String },
    responseLength: { type: String },
    creativity: { type: String },
    temperature: { type: String },
    topP: { type: String },
    contextWindow: { type: String },
    enableStreaming: { type: String }
  }
}, {
  timestamps: true,
  // Add indexes for better performance
  indexes: [
    { userId: 1, sessionId: 1 },
    { userId: 1, lastActivity: -1 },
    { sessionId: 1 }
  ]
});

// Update lastActivity and totalMessages before saving
chatHistorySchema.pre('save', function (next) {
  this.lastActivity = new Date();
  this.totalMessages = this.messages.length;

  // Calculate total tokens across all messages + out-of-band tokens (like suggestions)
  this.totalTokens = (this.nonMessageTokens || 0) + this.messages.reduce((total, msg) => {
    return total + (msg.tokenUsage?.totalTokens || 0);
  }, 0);

  next();
});

// Static method to find or create a chat session
chatHistorySchema.statics.findOrCreateSession = async function (userId, sessionId) {
  let chatHistory = await this.findOne({ userId, sessionId, isActive: true });

  if (!chatHistory) {
    chatHistory = new this({
      userId,
      sessionId,
      messages: []
    });
    await chatHistory.save();
  }

  return chatHistory;
};

// Instance method to add a message
chatHistorySchema.methods.addMessage = function (role, content, isRestricted = false, recommendations = undefined, isError = false, media = {}) {
  this.messages.push({
    role,
    content,
    isRestricted,
    isError,
    recommendations,
    timestamp: new Date(),
    ...media
  });
  return this.save();
};

// Instance method to clear messages
chatHistorySchema.methods.clearMessages = function () {
  this.messages = [];
  this.totalMessages = 0;
  return this.save();
};

// Instance method to deactivate session
chatHistorySchema.methods.deactivate = function () {
  this.isActive = false;
  return this.save();
};

// Static method to get user's chat sessions
chatHistorySchema.statics.getUserSessions = async function (userId) {
  const sessions = await this.find({
    userId,
    isActive: true
  })
    .select('sessionId totalMessages totalTokens lastActivity createdAt name settings isPinned')
    .sort({ isPinned: -1, lastActivity: -1 })
    .limit(20); // Limit to last 20 sessions

  return sessions.map(session => ({
    sessionId: session.sessionId,
    name: session.name,
    messageCount: session.totalMessages,
    totalTokens: session.totalTokens || 0,
    lastMessageAt: session.lastActivity,
    createdAt: session.createdAt,
    settings: session.settings || {},
    isPinned: session.isPinned || false
  }));
};

const ChatHistory = mongoose.model("ChatHistory", chatHistorySchema);

export default ChatHistory;