import PreBookingChat from '../models/preBookingChat.model.js';
import User from '../models/user.model.js';
import Listing from '../models/listing.model.js';
import { sendPreBookingMessageNotification } from '../utils/emailService.js';

export const initiateOrGetChat = async (req, res, next) => {
    try {
        const { listingId, ownerId } = req.body;
        const userId = req.user.id; // From verifyToken middleware

        if (!ownerId) {
            return res.status(400).json({ success: false, message: 'Missing ownerId' });
        }

        if (userId === ownerId) {
            return res.status(400).json({ success: false, message: 'You cannot chat with yourself' });
        }

        // Check if chat exists
        // If listingId is provided, look for it. If not, explicitly look for listingId: null
        const query = {
            participants: { $all: [userId, ownerId] }
        };

        if (listingId) {
            query.listingId = listingId;
        } else {
            query.listingId = null;
        }

        let chat = await PreBookingChat.findOne(query)
            .populate('participants', 'username avatar email')
            .populate('listingId', 'name address imageSqft');

        if (!chat) {
            // Create new chat
            chat = new PreBookingChat({
                participants: [userId, ownerId],
                listingId: listingId || null,
                ownerId,
                messages: []
            });
            await chat.save();
            // Populate after save
            chat = await PreBookingChat.findById(chat._id)
                .populate('participants', 'username avatar email')
                .populate('listingId', 'name address imageSqft');
        } else {
            // Filter messages if chat exists and was cleared
            const clearance = chat.clearedBy.find(c => c.userId.toString() === userId);
            if (clearance) {
                chat.messages = chat.messages.filter(m => new Date(m.timestamp) > new Date(clearance.clearedAt));
            }
        }

        res.status(200).json({ success: true, chat });
    } catch (error) {
        next(error);
    }
};

export const sendMessage = async (req, res, next) => {
    try {
        const { chatId, content } = req.body;
        const senderId = req.user.id;

        if (!chatId || !content) {
            return res.status(400).json({ success: false, message: 'Missing chatId or content' });
        }

        const chat = await PreBookingChat.findById(chatId)
            .populate('participants', 'username email')
            .populate('listingId', 'name _id');

        if (!chat) {
            return res.status(404).json({ success: false, message: 'Chat not found' });
        }

        // Verify participant
        if (!chat.participants.some(p => p._id.toString() === senderId)) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const newMessage = {
            sender: senderId,
            content,
            timestamp: new Date(),
            read: false
        };

        chat.messages.push(newMessage);
        chat.lastMessage = {
            content,
            timestamp: newMessage.timestamp,
            sender: senderId,
            read: false
        };

        await chat.save();

        // Socket Emission
        const io = req.app.get('io');
        const recipientId = chat.participants.find(p => p._id.toString() !== senderId)._id.toString();
        const sender = chat.participants.find(p => p._id.toString() === senderId);
        const senderName = sender ? sender.username : 'User';

        // Emit to recipient's room
        io.to(recipientId).emit('pre_booking_message', {
            chatId: chat._id,
            message: newMessage,
            listingId: chat.listingId ? chat.listingId._id : null,
            senderId,
            senderName,
            ownerId: chat.ownerId
        });

        // Also emit to sender (for multi-device sync)
        io.to(senderId).emit('pre_booking_message', {
            chatId: chat._id,
            message: newMessage,
            listingId: chat.listingId ? chat.listingId._id : null,
            senderId,
            senderName,
            ownerId: chat.ownerId
        });

        // Email Notification
        const recipient = chat.participants.find(p => p._id.toString() === recipientId);


        if (recipient && sender) {
            // Check if recipient is online
            // We use the same room ID ('recipientId') that we emitted to above
            const recipientSocketRoom = io.sockets.adapter.rooms.get(recipientId);
            const isRecipientOnline = recipientSocketRoom && recipientSocketRoom.size > 0;

            // Cooldown logic: 30 minutes
            const EMAIL_COOLDOWN = 30 * 60 * 1000;
            const now = new Date();
            const lastEmailSent = chat.lastEmailSentAt ? new Date(chat.lastEmailSentAt) : new Date(0);

            // Only send email if recipient is OFFLINE and cooldown has passed
            if (!isRecipientOnline && (now - lastEmailSent > EMAIL_COOLDOWN)) {

                let propertyLink = process.env.CLIENT_URL || 'https://urbansetu.vercel.app';
                let subjectName = "General Inquiry";

                if (chat.listingId) {
                    propertyLink = `${propertyLink}/listing/${chat.listingId._id}`;
                    subjectName = chat.listingId.name;
                } else {
                    propertyLink = `${propertyLink}/user/messages`; // Direct to inbox
                }

                // Update lastEmailSentAt immediately to lock
                await PreBookingChat.findByIdAndUpdate(chat._id, { lastEmailSentAt: now });

                // We don't await email to avoid delaying response
                sendPreBookingMessageNotification(
                    recipient.email,
                    recipient.username,
                    sender.username,
                    subjectName,
                    propertyLink
                ).catch(err => console.error('Email sending failed:', err));
            }
        }

        res.status(200).json({ success: true, message: newMessage });
    } catch (error) {
        next(error);
    }
};

export const getUserChats = async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Get all chats where user is a participant
        const chats = await PreBookingChat.find({ participants: userId })
            .populate('participants', 'username avatar email')
            .populate('listingId', 'name address imageSqft')
            .sort({ updatedAt: -1 });

        const chatsWithFilteredPreviews = chats.map(chat => {
            const clearance = chat.clearedBy.find(c => c.userId.toString() === userId);
            if (clearance && chat.lastMessage && new Date(chat.lastMessage.timestamp) <= new Date(clearance.clearedAt)) {
                chat.lastMessage = null;
            }
            return chat;
        });

        res.status(200).json({ success: true, chats: chatsWithFilteredPreviews });
    } catch (error) {
        next(error);
    }
};

export const getChatDetails = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;

        const chat = await PreBookingChat.findById(chatId)
            .populate('participants', 'username avatar email')
            .populate('listingId', 'name address imageSqft');

        if (!chat) {
            return res.status(404).json({ success: false, message: 'Chat not found' });
        }

        if (!chat.participants.some(p => p._id.toString() === userId)) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Filter messages based on clearance
        const clearance = chat.clearedBy.find(c => c.userId.toString() === userId);
        if (clearance) {
            chat.messages = chat.messages.filter(m => new Date(m.timestamp) > new Date(clearance.clearedAt));
        }

        // Mark messages as read if receiver is viewing
        let updated = false;
        chat.messages.forEach(msg => {
            if (msg.sender.toString() !== userId && !msg.read) {
                msg.read = true;
                updated = true;
            }
        });

        if (updated) {
            // If we modified messages array directly, we can save. 
            // Mongoose detects subdocument changes.
            if (chat.lastMessage && chat.lastMessage.sender.toString() !== userId) {
                chat.lastMessage.read = true;
            }
            await chat.save();
        }

        res.status(200).json({ success: true, chat });
    } catch (error) {
        next(error);
    }
};

export const clearChat = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;

        const chat = await PreBookingChat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ success: false, message: 'Chat not found' });
        }

        if (!chat.participants.some(p => p._id.toString() === userId)) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Update clearedBy for this user
        const clearIndex = chat.clearedBy.findIndex(c => c.userId.toString() === userId);
        if (clearIndex > -1) {
            chat.clearedBy[clearIndex].clearedAt = new Date();
        } else {
            chat.clearedBy.push({ userId, clearedAt: new Date() });
        }

        await chat.save();

        // Notify via socket - frontend handles "cleared" by clearing local state
        // But now, we might not need to emit 'chat_cleared' to everyone, only to the user who cleared?
        // Or fetch again?
        // If I emit 'chat_cleared', the other user might also see it cleared if they are listening?
        // The previous implementation of `handleMessage` listeners:
        /*
        socket.on('chat_cleared', ({ chatId }) => {
            if (activeChat && activeChat._id === chatId) {
                setMessages([]);
            }
        });
        */
        // This would clear it for everyone listening. Bad.
        // I should emit a custom event like 'my_chat_cleared' or just let the frontend handle the success response.
        // But for multi-device sync, I should emit to this user's rooms.

        const io = req.app.get('io');
        io.to(userId).emit('chat_cleared', { chatId });

        res.status(200).json({ success: true, message: 'Chat cleared' });

    } catch (error) {
        next(error);
    }
}

export const deleteChats = async (req, res, next) => {
    try {
        const { chatIds } = req.body;
        const userId = req.user.id;

        if (!Array.isArray(chatIds) || chatIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No chats selected' });
        }

        // Verify the user is a participant in all chats proposed for deletion
        // or just delete the ones where they are.
        // We will delete chats where user is participant.

        const result = await PreBookingChat.deleteMany({
            _id: { $in: chatIds },
            participants: userId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'No chats found or unauthorized' });
        }

        res.status(200).json({ success: true, message: `${result.deletedCount} chats deleted` });

    } catch (error) {
        next(error);
    }
}
