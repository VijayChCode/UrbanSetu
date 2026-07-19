import ChatHistory from '../models/chatHistory.model.js';
import { verifyToken } from '../utils/verify.js';

// Save a chat message
export const saveChatMessage = async (req, res) => {
    try {
        const { sessionId, role, content } = req.body;
        const userId = req.user.id;

        if (!sessionId || !role || !content) {
            return res.status(400).json({
                success: false,
                message: 'Session ID, role, and content are required'
            });
        }

        if (!['user', 'assistant'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Role must be either "user" or "assistant"'
            });
        }

        // Find or create chat session
        const chatHistory = await ChatHistory.findOrCreateSession(userId, sessionId);

        // Add message to the session
        const { 
            recommendations = undefined, 
            isError = false, 
            isRestricted = false,
            images,
            imageUrl,
            audioUrl,
            videoUrl,
            documentUrl,
            documentName,
            ocrText,
            visionAnalysis
        } = req.body;

        const media = {
            images,
            imageUrl,
            audioUrl,
            videoUrl,
            documentUrl,
            documentName,
            ocrText,
            visionAnalysis
        };

        await chatHistory.addMessage(role, content, isRestricted, recommendations, isError, media);

        res.status(200).json({
            success: true,
            message: 'Message saved successfully',
            data: {
                sessionId: chatHistory.sessionId,
                totalMessages: chatHistory.totalMessages
            }
        });

    } catch (error) {
        console.error('Error saving chat message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save chat message'
        });
    }
};

// Get chat history for a session (Paginated)
export const getChatHistory = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const userId = req.user.id;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required'
            });
        }

        const chatHistory = await ChatHistory.findOne({
            userId,
            sessionId,
            isActive: true
        }).populate('userId', 'username email role');

        if (!chatHistory) {
            return res.status(200).json({
                success: true,
                data: {
                    sessionId: sessionId,
                    messages: [],
                    totalMessages: 0,
                    hasMore: false
                }
            });
        }

        const totalMessages = chatHistory.messages.length;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        // Calculate slice range to get messages from end (recent) to start (old)
        // Example: Total 100, page 1, limit 20 -> indices 80-99
        // page 2, limit 20 -> indices 60-79
        const end = totalMessages - (pageNum - 1) * limitNum;
        const start = Math.max(0, end - limitNum);
        
        const paginatedMessages = chatHistory.messages.slice(start, end);
        const hasMore = start > 0;

        res.status(200).json({
            success: true,
            data: {
                sessionId: chatHistory.sessionId,
                name: chatHistory.name,
                messages: paginatedMessages,
                totalMessages: totalMessages,
                hasMore: hasMore,
                currentPage: pageNum,
                lastActivity: chatHistory.lastActivity,
                createdAt: chatHistory.createdAt,
                settings: chatHistory.settings || {}
            }
        });

    } catch (error) {
        console.error('Error getting chat history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get chat history'
        });
    }
};

// Get all chat sessions for a user
export const getUserChatSessions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;

        const skip = (page - 1) * limit;

        const chatSessions = await ChatHistory.find({
            userId,
            isActive: true
        })
            .sort({ lastActivity: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('sessionId totalMessages lastActivity createdAt')
            .populate('userId', 'username email role');

        const totalSessions = await ChatHistory.countDocuments({
            userId,
            isActive: true
        });

        res.status(200).json({
            success: true,
            data: {
                sessions: chatSessions,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalSessions / limit),
                    totalSessions,
                    hasNext: page * limit < totalSessions,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Error getting user chat sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get chat sessions'
        });
    }
};

// Clear chat history for a specific session
export const clearChatHistory = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.id;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required'
            });
        }

        const chatHistory = await ChatHistory.findOne({
            userId,
            sessionId,
            isActive: true
        });

        if (!chatHistory) {
            return res.status(404).json({
                success: false,
                message: 'Chat session not found'
            });
        }

        await chatHistory.clearMessages();

        res.status(200).json({
            success: true,
            message: 'Chat history cleared successfully',
            data: {
                sessionId: chatHistory.sessionId,
                totalMessages: 0
            }
        });

    } catch (error) {
        console.error('Error clearing chat history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear chat history'
        });
    }
};

// Clear all chat sessions for a user
export const clearAllChatHistory = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await ChatHistory.updateMany(
            { userId, isActive: true },
            {
                $set: {
                    messages: [],
                    totalMessages: 0,
                    lastActivity: new Date()
                }
            }
        );

        res.status(200).json({
            success: true,
            message: 'All chat history cleared successfully',
            data: {
                modifiedCount: result.modifiedCount
            }
        });

    } catch (error) {
        console.error('Error clearing all chat history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear all chat history'
        });
    }
};

// Update an existing chat session
export const updateChatSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { messages, totalMessages, name, settings, isPinned } = req.body;
        const userId = req.user.id;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required'
            });
        }

        // At least one of messages, name, settings, or isPinned should be provided
        const hasMessages = Array.isArray(messages);
        const hasName = typeof name === 'string';
        const hasSettings = settings && typeof settings === 'object';
        const hasPinned = typeof isPinned === 'boolean';
        if (!hasMessages && !hasName && !hasSettings && !hasPinned) {
            return res.status(400).json({
                success: false,
                message: 'Nothing to update. Provide messages, name, settings, or isPinned.'
            });
        }

        // Use a retry mechanism to handle VersionErrors (optimistic concurrency)
        let retryCount = 0;
        const maxRetries = 3;
        let success = false;
        let lastError;

        while (retryCount < maxRetries && !success) {
            try {
                const chatHistory = await ChatHistory.findOne({
                    userId,
                    sessionId,
                    isActive: true
                });

                if (!chatHistory) {
                    return res.status(404).json({
                        success: false,
                        message: 'Chat session not found'
                    });
                }

                // Update the session with new messages and optional name
                if (hasMessages) {
                    // Check if this is a partial update (e.g., from a frontend with only recent messages loaded)
                    // If the first message in incoming 'messages' matches one in the DB, we replace from that point onwards.
                    // This prevents clobbering older history that wasn't loaded on the frontend.
                    let mergedMessages = messages;
                    
                    if (chatHistory.messages && chatHistory.messages.length > messages.length) {
                        const firstIncoming = messages[0];
                        // Use a simple heuristic to find if the first incoming message exists in current history
                        const indexInDb = chatHistory.messages.findIndex(m => 
                            m.role === firstIncoming.role && 
                            m.content === firstIncoming.content && 
                            (!firstIncoming.timestamp || new Date(m.timestamp).toISOString() === new Date(firstIncoming.timestamp).toISOString())
                        );

                        if (indexInDb !== -1) {
                            console.log(`Partial update detected. Index in DB: ${indexInDb}. Merging messages (Attempt ${retryCount + 1}).`);
                            mergedMessages = [
                                ...chatHistory.messages.slice(0, indexInDb),
                                ...messages
                            ];
                        } else {
                            // SAFETY: No overlap found but incoming is fewer than DB.
                            // This likely means a paginated frontend sent a partial view.
                            // Do NOT replace — keep existing DB messages to prevent data loss.
                            console.warn(`[updateChatSession] WARNING: No overlap found. Incoming: ${messages.length}, DB: ${chatHistory.messages.length}. Keeping DB messages to prevent data loss.`);
                            mergedMessages = chatHistory.messages;
                        }
                    }

                    // Merge media/analysis fields that exist in the database but might be missing/undefined in frontend payload
                    const incomingMessagesWithMergedDbFields = mergedMessages.map(incomingMsg => {
                        const existingMsg = chatHistory.messages.find(m => 
                            m.role === incomingMsg.role && 
                            m.content === incomingMsg.content &&
                            (!incomingMsg.timestamp || new Date(m.timestamp).toISOString() === new Date(incomingMsg.timestamp).toISOString())
                        );

                        if (existingMsg) {
                            let mergedVariants = incomingMsg.variants;
                            if (Array.isArray(incomingMsg.variants) && Array.isArray(existingMsg.variants)) {
                                mergedVariants = incomingMsg.variants.map((v, vIdx) => {
                                    const existingVariant = existingMsg.variants[vIdx];
                                    if (existingVariant && existingVariant.role === v.role && existingVariant.content === v.content) {
                                        return {
                                            ...v,
                                            ocrText: v.ocrText || existingVariant.ocrText,
                                            visionAnalysis: v.visionAnalysis || existingVariant.visionAnalysis,
                                            faceTags: v.faceTags || existingVariant.faceTags
                                        };
                                    }
                                    return v;
                                });
                            }

                            return {
                                ...incomingMsg,
                                ocrText: incomingMsg.ocrText || existingMsg.ocrText,
                                visionAnalysis: incomingMsg.visionAnalysis || existingMsg.visionAnalysis,
                                imageAudits: incomingMsg.imageAudits || existingMsg.imageAudits,
                                images: incomingMsg.images || existingMsg.images,
                                imageUrl: incomingMsg.imageUrl || existingMsg.imageUrl,
                                audioUrl: incomingMsg.audioUrl || existingMsg.audioUrl,
                                videoUrl: incomingMsg.videoUrl || existingMsg.videoUrl,
                                documentUrl: incomingMsg.documentUrl || existingMsg.documentUrl,
                                documentName: incomingMsg.documentName || existingMsg.documentName,
                                tokenUsage: incomingMsg.tokenUsage || existingMsg.tokenUsage,
                                variants: mergedVariants,
                                faceTags: incomingMsg.faceTags || existingMsg.faceTags
                            };
                        }
                        return incomingMsg;
                    });

                    chatHistory.messages = incomingMessagesWithMergedDbFields;
                    chatHistory.totalMessages = incomingMessagesWithMergedDbFields.length;
                }
                
                if (hasName) {
                    const newName = name.trim().slice(0, 80) || null;
                    // logic to prevent overwriting custom titles with generic "Chat [Date]" placeholder
                    const isNewNameGeneric = /^Chat \d/.test(newName);
                    const isOldNameGeneric = !chatHistory.name || /^Chat \d/.test(chatHistory.name);

                    // only update if new name is custom OR if both are generic (or old is null)
                    if (!isNewNameGeneric || isOldNameGeneric) {
                        chatHistory.name = newName;
                    }
                }
                
                if (hasPinned) {
                    chatHistory.isPinned = isPinned;
                }
                
                chatHistory.lastActivity = new Date();

                // Update per-chat settings if provided
                if (hasSettings) {
                    if (!chatHistory.settings) chatHistory.settings = {};
                    const allowedKeys = ['messageLimit', 'dataRetention', 'tone', 'responseLength', 'creativity', 'temperature', 'topP', 'contextWindow', 'enableStreaming'];
                    for (const key of allowedKeys) {
                        if (settings[key] !== undefined) {
                            chatHistory.settings[key] = settings[key];
                        }
                    }
                }

                await chatHistory.save();
                success = true;
            } catch (error) {
                if (error.name === 'VersionError') {
                    retryCount++;
                    lastError = error;
                    console.log(`VersionError in updateChatSession, retrying... (${retryCount}/${maxRetries})`);
                    // Small delay before retry
                    await new Promise(resolve => setTimeout(resolve, 50 * retryCount));
                } else {
                    throw error; // Re-throw if it's not a version error
                }
            }
        }

        if (!success) {
            throw lastError || new Error('Failed to update chat session after multiple retries');
        }

        res.status(200).json({
            success: true,
            message: 'Chat session updated successfully',
            data: {
                sessionId: sessionId,
                totalMessages: totalMessages // Note: this might be slightly off if merged, but frontend usually re-fetches or uses its own count
            }
        });

    } catch (error) {
        console.error('Error updating chat session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update chat session'
        });
    }
};

// Delete a specific chat session
export const deleteChatSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.id;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required'
            });
        }

        const chatHistory = await ChatHistory.findOne({
            userId,
            sessionId,
            isActive: true
        });

        if (!chatHistory) {
            return res.status(404).json({
                success: false,
                message: 'Chat session not found'
            });
        }

        await chatHistory.deactivate();

        res.status(200).json({
            success: true,
            message: 'Chat session deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting chat session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete chat session'
        });
    }
};

export const getImageFaceTags = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { imageUrl } = req.query;
        const userId = req.user.id;

        if (!sessionId || !imageUrl) {
            return res.status(400).json({
                success: false,
                message: 'Session ID and Image URL are required'
            });
        }

        const chatHistory = await ChatHistory.findOne({
            userId,
            sessionId,
            isActive: true
        });

        if (!chatHistory) {
            return res.status(404).json({
                success: false,
                message: 'Chat session not found'
            });
        }

        // Search for message containing the image URL
        const matchedMsg = chatHistory.messages.find(m => 
            (m.images && m.images.includes(imageUrl)) || 
            (m.imageUrl === imageUrl) || 
            (m.ocrText && m.ocrText.includes(imageUrl))
        );

        if (matchedMsg && matchedMsg.faceTags && matchedMsg.faceTags.length > 0) {
            return res.status(200).json({
                success: true,
                faceTags: matchedMsg.faceTags
            });
        }

        // If not found in main messages, search variants
        for (const m of chatHistory.messages) {
            if (m.variants && m.variants.length > 0) {
                for (const v of m.variants) {
                    if ((v.images && v.images.includes(imageUrl)) || (v.imageUrl === imageUrl) || (v.ocrText && v.ocrText.includes(imageUrl))) {
                        if (v.faceTags && v.faceTags.length > 0) {
                            return res.status(200).json({
                                success: true,
                                faceTags: v.faceTags
                            });
                        }
                    }
                }
            }
        }

        return res.status(200).json({
            success: true,
            faceTags: []
        });

    } catch (error) {
        console.error('Error fetching image face tags:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};