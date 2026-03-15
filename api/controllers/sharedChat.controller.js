import SharedChat from '../models/sharedChat.model.js';
import ChatHistory from '../models/chatHistory.model.js';
import User from '../models/user.model.js';
import { sendSharedChatLinkEmail, sendSharedChatRevokedEmail } from '../utils/emailService.js';
import crypto from 'crypto';

// ... (createSharedChat, getSharedChat, getShareInfo, updateSharedChat remain unchanged) ...

// Import a shared chat into user's history
export const importSharedChat = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { shareToken } = req.params;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required to import chats' });
        }

        // Find the shared chat
        const sharedChat = await SharedChat.findOne({ shareToken });
        if (!sharedChat) {
            return res.status(404).json({ success: false, message: 'Shared chat not found' });
        }

        // Check if active or expired? (Optional: Allow importing expired chats if valuable?)
        // Let's enforce active only for now as per "View" logic
        if (!sharedChat.isActive) {
            return res.status(410).json({ success: false, message: 'Cannot import inactive shared chat' });
        }
        if (sharedChat.expiresAt && new Date() > new Date(sharedChat.expiresAt)) {
            return res.status(410).json({ success: false, message: 'Cannot import expired shared chat' });
        }

        // Generate ID
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create new ChatHistory entry
        // Filter out restricted/violation messages
        const validMessages = sharedChat.messages.filter(m => !m.isRestricted);

        if (validMessages.length === 0) {
            return res.status(400).json({ success: false, message: 'This chat contains only restricted content and cannot be imported.' });
        }

        const newChatHistory = new ChatHistory({
            userId,
            sessionId: newSessionId,
            name: `Imported: ${sharedChat.title}`, // Add prefix to distinguish
            messages: validMessages.map(m => ({
                role: m.role,
                content: m.content,
                isRestricted: false, // Ensure we don't import restricted flags as we filtered them
                timestamp: m.timestamp || new Date()
            })),
            totalMessages: validMessages.length
        });

        await newChatHistory.save();

        res.status(200).json({
            success: true,
            message: 'Chat imported successfully',
            sessionId: newSessionId
        });

    } catch (error) {
        console.error('Error importing shared chat:', error);
        res.status(500).json({ success: false, message: 'Failed to import chat' });
    }
};

// Delete/Revoke completely
export const deleteSharedChat = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { shareToken } = req.params;

        if (!userId) return res.status(401).json({ success: false, message: 'Auth required' });

        // Find first to get title for email
        const sharedChat = await SharedChat.findOne({ shareToken, userId });

        if (!sharedChat) {
            return res.status(404).json({ success: false, message: 'Shared chat not found' });
        }

        const title = sharedChat.title;

        // Verify and delete
        await SharedChat.findOneAndDelete({ shareToken, userId });

        // Send email notification (async, non-blocking)
        (async () => {
            try {
                const user = await User.findById(userId).select('email');
                if (user && user.email) {
                    await sendSharedChatRevokedEmail(
                        user.email,
                        title,
                        new Date()
                    );
                    console.log(`✅ Revocation email sent to: ${user.email}`);
                }
            } catch (emailError) {
                console.error('Failed to send revocation email:', emailError);
            }
        })();

        res.status(200).json({ success: true, message: 'Link revoked and deleted permanently' });

    } catch (error) {
        console.error('Error deleting shared chat:', error);
        res.status(500).json({ success: false, message: 'Failed to delete shared chat' });
    }
};

// Create a new shared chat link
export const createSharedChat = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { sessionId, title, expiresType } = req.body; // expiresType: '7days', '30days', 'never'

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        // Find the original chat
        const originalChat = await ChatHistory.findOne({ userId, sessionId, isActive: true });
        if (!originalChat) {
            return res.status(404).json({ success: false, message: 'Chat not found' });
        }

        if (!originalChat.messages || originalChat.messages.length === 0) {
            return res.status(400).json({ success: false, message: 'Cannot share an empty chat' });
        }

        // Check if an active share already exists for this session? 
        // User might want multiple links or just update the existing one.
        // Let's look for an existing one to update or return.
        let sharedChat = await SharedChat.findOne({ userId, originalSessionId: sessionId });

        // Calculate expiry
        let expiresAt = null;
        const now = new Date();
        if (expiresType === '7days') {
            expiresAt = new Date(now.setDate(now.getDate() + 7));
        } else if (expiresType === '30days') {
            expiresAt = new Date(now.setDate(now.getDate() + 30));
        }
        // 'never' stays null

        const shareToken = crypto.randomBytes(8).toString('hex'); // 16 chars

        if (sharedChat) {
            // Update existing if active or reactivate?
            // If the user is requesting a "Create", and one exists, we can perhaps just update the content validation
            // But if they clicked "Create Link" again, maybe they want a fresh snapshot.
            // Let's update the snapshot and reactivate.
            sharedChat.messages = originalChat.messages
                .filter(m => !m.isRestricted) // Filter out restricted content from share
                .map(m => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                    isRestricted: false // Should be false since we filtered them, but keeping schema consistent
                }));
            sharedChat.title = title || originalChat.name || 'Shared Conversation';
            sharedChat.isActive = true;
            if (expiresType) sharedChat.expiresAt = expiresAt;
            // Only update token if we want to invalidate old ones, but often better to keep unless revoked.
            // Let's keep the token stable so links don't break unless explicitly revoked.

            await sharedChat.save();
        } else {
            // Create new
            // Filter first
            const validMessages = originalChat.messages.filter(m => !m.isRestricted);

            if (validMessages.length === 0) {
                return res.status(400).json({ success: false, message: 'Cannot share a chat with only restricted content' });
            }

            sharedChat = new SharedChat({
                userId,
                originalChatId: originalChat._id,
                originalSessionId: sessionId,
                shareToken: shareToken,
                title: title || originalChat.name || 'Shared Conversation',
                messages: validMessages.map(m => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                    isRestricted: false
                })),
                expiresAt: expiresAt
            });
            await sharedChat.save();
        }

        // Send email notification (async, non-blocking)
        (async () => {
            try {
                const user = await User.findById(userId).select('email');
                if (user && user.email) {
                    const clientBaseUrl = 'https://urbansetu.vercel.app'; // Or process.env.CLIENT_URL
                    const sharedLink = `${clientBaseUrl}/ai/share/${sharedChat.shareToken}`;

                    await sendSharedChatLinkEmail(
                        user.email,
                        sharedLink,
                        sharedChat.title,
                        sharedChat.expiresAt,
                        sharedChat.messages.length,
                        sharedChat.shareToken
                    );
                    console.log(`✅ Shared chat email sent to: ${user.email}`);
                }
            } catch (emailError) {
                console.error('Failed to send shared chat email:', emailError);
            }
        })();

        // Return the full object
        res.status(200).json({
            success: true,
            sharedChat: {
                shareToken: sharedChat.shareToken,
                title: sharedChat.title,
                expiresAt: sharedChat.expiresAt,
                isActive: sharedChat.isActive,
                createdAt: sharedChat.createdAt,
                url: `/ai/share/${sharedChat.shareToken}`
            }
        });

    } catch (error) {
        console.error('Error creating shared chat:', error);
        res.status(500).json({ success: false, message: 'Failed to create shared link' });
    }
};

// Get shared chat info (public view)
export const getSharedChat = async (req, res) => {
    try {
        const { shareToken } = req.params;
        const sharedChat = await SharedChat.findOne({ shareToken });

        if (!sharedChat) {
            return res.status(404).json({ success: false, message: 'Shared chat not found' });
        }

        // Check if active
        if (!sharedChat.isActive) {
            return res.status(410).json({ success: false, message: 'This shared link has been deactivated globally by the owner.' });
        }

        // Check expiry
        if (sharedChat.expiresAt && new Date() > new Date(sharedChat.expiresAt)) {
            return res.status(410).json({ success: false, message: 'This shared link has expired.' });
        }

        // Increment views unless suppressed
        if (req.query.inc !== '0') {
            sharedChat.views += 1;
        }
        await sharedChat.save();

        res.status(200).json({
            success: true,
            sharedChat: {
                title: sharedChat.title,
                messages: sharedChat.messages,
                date: sharedChat.createdAt,
                expiresAt: sharedChat.expiresAt,
                ownerId: sharedChat.userId
            }
        });

    } catch (error) {
        console.error('Error fetching shared chat:', error);
        res.status(500).json({ success: false, message: 'Failed to load chat' });
    }
};

// Get management info (for the modal) - requires auth
export const getShareInfo = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { sessionId } = req.params;

        if (!userId) return res.status(401).json({ success: false, message: 'Auth required' });

        const sharedChat = await SharedChat.findOne({ userId, originalSessionId: sessionId });

        if (!sharedChat) {
            return res.status(200).json({ success: true, sharedChat: null });
        }

        res.status(200).json({
            success: true,
            sharedChat: {
                shareToken: sharedChat.shareToken,
                title: sharedChat.title,
                isActive: sharedChat.isActive,
                expiresAt: sharedChat.expiresAt,
                views: sharedChat.views,
                createdAt: sharedChat.createdAt,
                url: `/ai/share/${sharedChat.shareToken}`
            }
        });

    } catch (error) {
        console.error('Error fetching share info:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch share info' });
    }
};

// Update shared chat settings
export const updateSharedChat = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { shareToken } = req.params;
        const { isActive, expiresType, title } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: 'Auth required' });

        const sharedChat = await SharedChat.findOne({ shareToken, userId });
        if (!sharedChat) {
            return res.status(404).json({ success: false, message: 'Shared chat not found' });
        }

        // Check for changes before updating
        const originalChat = await ChatHistory.findById(sharedChat.originalChatId);

        // Check standard fields first
        if (typeof isActive === 'boolean') {
            sharedChat.isActive = isActive;
        }

        if (title !== undefined) {
            sharedChat.title = title.trim() || 'Shared Conversation';
        }

        // Check messages diff
        let messagesChanged = false;
        if (originalChat && originalChat.messages) {
            // Apply filter to original messages
            const validOriginalMessages = originalChat.messages.filter(m => !m.isRestricted).map(m => ({
                role: m.role,
                content: m.content,
                timestamp: m.timestamp,
                isRestricted: false // key point
            }));

            // Compare with current shared messages (simplistic comparison)
            // JSON.stringify might fail if fields order differs or _id. 
            // Ideally we should sanitize sharedChat.messages to plain objects for comparison or just overwrite if lengths differ significantly or just overwrite always if logic dictates sync.
            // For now, let's just overwrite with filtered content to ensure consistency.
            // But we need to check if it CHANGED to avoid unnecessary db writes/notifications? 
            // The original logic was: if (JSON.stringify... !== ...)
            // Let's mimic that but with validMessages.

            // Note: sharedChat.messages are Mongoose docs, need toJSON or similar for fair comparison against mapped objects. 
            // Simpler: Just overwrite. The check `messagesChanged` tracks if we need to return "Link updated" vs "Up to date".

            // Let's just compare lengths or last message content to decide? 
            // Or just stringify the mapped arrays.

            const currentSharedJSON = JSON.stringify(sharedChat.messages.map(m => ({
                role: m.role, content: m.content, timestamp: m.timestamp
            })));
            const newSharedJSON = JSON.stringify(validOriginalMessages.map(m => ({
                role: m.role, content: m.content, timestamp: m.timestamp
            })));

            if (currentSharedJSON !== newSharedJSON) {
                sharedChat.messages = validOriginalMessages;
                messagesChanged = true;
            }
        }

        // Check expiry diff
        let expiryChanged = false;
        if (expiresType) {
            const now = new Date();
            let newExpiresAt = null;

            if (expiresType === '7days') {
                newExpiresAt = new Date(now.setDate(now.getDate() + 7));
            } else if (expiresType === '30days') {
                newExpiresAt = new Date(now.setDate(now.getDate() + 30));
            } else if (expiresType === 'never') {
                newExpiresAt = null;
            }

            // Only update if significantly different (> 1 hour) to avoid "always updated" on re-click
            let shouldUpdateExpiry = false;

            if (sharedChat.expiresAt === null && newExpiresAt !== null) shouldUpdateExpiry = true;
            else if (sharedChat.expiresAt !== null && newExpiresAt === null) shouldUpdateExpiry = true;
            else if (sharedChat.expiresAt && newExpiresAt) {
                const diff = Math.abs(new Date(sharedChat.expiresAt).getTime() - newExpiresAt.getTime());
                if (diff > 3600000) shouldUpdateExpiry = true; // > 1 hour
            }

            if (shouldUpdateExpiry) {
                sharedChat.expiresAt = newExpiresAt;
                expiryChanged = true;
            }
        }

        if (!sharedChat.isModified('title') && !sharedChat.isModified('isActive') && !messagesChanged && !expiryChanged) {
            return res.status(200).json({
                success: true,
                message: 'Link is up to date',
                sharedChat: {
                    isActive: sharedChat.isActive,
                    expiresAt: sharedChat.expiresAt,
                    title: sharedChat.title
                }
            });
        }



        await sharedChat.save();

        res.status(200).json({
            success: true,
            message: 'Link updated successfully',
            sharedChat: {
                isActive: sharedChat.isActive,
                expiresAt: sharedChat.expiresAt,
                title: sharedChat.title
            }
        });

    } catch (error) {
        console.error('Error updating shared chat:', error);
        res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
};


