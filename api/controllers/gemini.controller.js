import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "AIzaSyCDGG9Dsk90Yyim1AXft6jM_mZ7YeR9BhQ"
});

export const chatWithGemini = async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Message is required' 
            });
        }

        // Prepare conversation history for Gemini
        const systemPrompt = `You are a helpful AI assistant specializing in real estate. You help users with:
        - Property search and recommendations
        - Real estate market information
        - Home buying and selling advice
        - Property valuation insights
        - Real estate investment guidance
        - Legal and regulatory information about real estate
        - Tips for first-time homebuyers
        - Property management advice
        
        Always provide accurate, helpful, and professional responses. If you're not sure about something, recommend consulting with a real estate professional.`;

        // Prepare the full conversation context
        const conversationContext = history.map(msg => `${msg.role}: ${msg.content}`).join('\n');
        const fullPrompt = `${systemPrompt}\n\nPrevious conversation:\n${conversationContext}\n\nCurrent user message: ${message}`;

        console.log('Calling Gemini API with model: gemini-2.0-flash-exp');
        
        // Add timeout to ensure we get complete responses
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout - response taking too long')), 60000); // 60 second timeout
        });
        
        const apiCallPromise = ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: [{
                role: 'user',
                parts: [{ text: fullPrompt }]
            }],
            config: {
                maxOutputTokens: 2048, // Increased from 500 to allow longer responses
                temperature: 0.7,
            }
        });
        
        const result = await Promise.race([apiCallPromise, timeoutPromise]);

        const responseText = result.text;
        console.log('Gemini API response received, length:', responseText ? responseText.length : 0);
        console.log('Response preview:', responseText ? responseText.substring(0, 100) + '...' : 'No response');

        res.status(200).json({
            success: true,
            response: responseText
        });

    } catch (error) {
        console.error('Gemini API Error:', error);
        
        // Handle timeout errors first
        if (error.message && error.message.includes('timeout')) {
            return res.status(408).json({
                success: false,
                message: 'Request timed out. The response is taking longer than expected. Please try again.'
            });
        }

        // Handle specific Gemini errors
        if (error.response) {
            const status = error.response.status;
            const errorMessage = error.response.data?.error?.message || 'Gemini API error';
            
            if (status === 401) {
                return res.status(500).json({
                    success: false,
                    message: 'AI service authentication error. Please try again later.'
                });
            } else if (status === 429) {
                return res.status(429).json({
                    success: false,
                    message: 'AI service is currently busy. Please try again in a moment.'
                });
            } else if (status >= 500) {
                return res.status(503).json({
                    success: false,
                    message: 'AI service is temporarily unavailable. Please try again later.'
                });
            }
        }

        res.status(500).json({
            success: false,
            message: 'Sorry, I\'m having trouble processing your request. Please try again later.'
        });
    }
};
