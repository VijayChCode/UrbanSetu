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