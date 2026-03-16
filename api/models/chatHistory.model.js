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
    recommendations: {
      type: Array, // Array of property objects
      default: undefined
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  totalMessages: {
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
chatHistorySchema.methods.addMessage = function (role, content, isRestricted = false, recommendations = undefined) {
  this.messages.push({
    role,
    content,
    isRestricted,
    recommendations,
    timestamp: new Date()
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
    .select('sessionId totalMessages lastActivity createdAt name')
    .sort({ lastActivity: -1 })
    .limit(20); // Limit to last 20 sessions

  return sessions.map(session => ({
    sessionId: session.sessionId,
    name: session.name,
    messageCount: session.totalMessages,
    lastMessageAt: session.lastActivity,
    createdAt: session.createdAt
  }));
};

const ChatHistory = mongoose.model("ChatHistory", chatHistorySchema);

export default ChatHistory;