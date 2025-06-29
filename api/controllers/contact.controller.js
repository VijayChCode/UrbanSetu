import { errorHandler } from "../utils/error.js";
import Contact from "../models/contact.model.js";

// Send support message (for users)
export const sendSupportMessage = async (req, res, next) => {
    try {
        const { email, subject, message } = req.body;

        // Validate required fields
        if (!email || !subject || !message) {
            return next(errorHandler(400, "All fields are required"));
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return next(errorHandler(400, "Please provide a valid email address"));
        }

        // Save message to database
        const newContact = new Contact({
            email,
            subject,
            message
        });

        await newContact.save();

        res.status(200).json({
            success: true,
            message: "Support message sent successfully"
        });
    } catch (error) {
        next(error);
    }
};

// Get all support messages (for admins)
export const getAllSupportMessages = async (req, res, next) => {
    try {
        const messages = await Contact.find()
            .sort({ createdAt: -1 })
            .select('-__v');

        res.status(200).json(messages);
    } catch (error) {
        next(error);
    }
};

// Mark message as read (for admins)
export const markMessageAsRead = async (req, res, next) => {
    try {
        const { messageId } = req.params;

        const message = await Contact.findById(messageId);
        if (!message) {
            return next(errorHandler(404, "Message not found"));
        }

        message.status = 'read';
        message.readAt = new Date();
        await message.save();

        res.status(200).json({
            success: true,
            message: "Message marked as read"
        });
    } catch (error) {
        next(error);
    }
};

// Mark message as replied (for admins)
export const markMessageAsReplied = async (req, res, next) => {
    try {
        const { messageId } = req.params;

        const message = await Contact.findById(messageId);
        if (!message) {
            return next(errorHandler(404, "Message not found"));
        }

        message.status = 'replied';
        message.repliedAt = new Date();
        await message.save();

        res.status(200).json({
            success: true,
            message: "Message marked as replied"
        });
    } catch (error) {
        next(error);
    }
};

// Get unread message count (for admins)
export const getUnreadMessageCount = async (req, res, next) => {
    try {
        const count = await Contact.countDocuments({ status: 'unread' });
        
        res.status(200).json({
            success: true,
            count
        });
    } catch (error) {
        next(error);
    }
};

// Delete support message (for admins)
export const deleteSupportMessage = async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const message = await Contact.findById(messageId);
        if (!message) {
            return next(errorHandler(404, "Message not found"));
        }
        await Contact.findByIdAndDelete(messageId);
        res.status(200).json({
            success: true,
            message: "Support message deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

// Send admin reply to support message
export const sendAdminReply = async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const { replyMessage } = req.body;
        const adminId = req.user.id;

        // Validate required fields
        if (!replyMessage || !replyMessage.trim()) {
            return next(errorHandler(400, "Reply message is required"));
        }

        const message = await Contact.findById(messageId);
        if (!message) {
            return next(errorHandler(404, "Message not found"));
        }

        // Update message with admin reply
        message.adminReply = replyMessage.trim();
        message.adminReplyAt = new Date();
        message.adminRepliedBy = adminId;
        message.status = 'replied';
        message.repliedAt = new Date();
        
        await message.save();

        // TODO: Send email notification to user
        // For now, we'll just return success
        // In a real implementation, you'd integrate with an email service like Nodemailer

        res.status(200).json({
            success: true,
            message: "Reply sent successfully"
        });
    } catch (error) {
        next(error);
    }
};

// Get user's support messages and replies
export const getUserSupportMessages = async (req, res, next) => {
    try {
        const { email } = req.params;
        
        if (!email) {
            return next(errorHandler(400, "Email is required"));
        }

        const messages = await Contact.find({ email })
            .sort({ createdAt: -1 })
            .select('-__v');

        res.status(200).json(messages);
    } catch (error) {
        next(error);
    }
};

// Delete user's own message
export const deleteUserMessage = async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const { email } = req.query; // Get email from query params for verification
        
        if (!messageId) {
            return next(errorHandler(400, "Message ID is required"));
        }

        // Find the message and verify it belongs to the user
        const message = await Contact.findById(messageId);
        if (!message) {
            return next(errorHandler(404, "Message not found"));
        }

        // Verify the message belongs to the user (email verification)
        if (message.email !== email) {
            return next(errorHandler(403, "You can only delete your own messages"));
        }

        // Allow deletion of any message (unread, read, or replied)
        await Contact.findByIdAndDelete(messageId);
        
        res.status(200).json({
            success: true,
            message: "Message deleted successfully"
        });
    } catch (error) {
        next(error);
    }
}; 