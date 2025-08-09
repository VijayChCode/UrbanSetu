import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: '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'
});

export const chatWithOpenAI = async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Message is required' 
            });
        }

        // Prepare conversation history
        const messages = [
            {
                role: 'system',
                content: `You are a helpful AI assistant specializing in real estate. You help users with:
                - Property search and recommendations
                - Real estate market information
                - Home buying and selling advice
                - Property valuation insights
                - Real estate investment guidance
                - Legal and regulatory information about real estate
                - Tips for first-time homebuyers
                - Property management advice
                
                Always provide accurate, helpful, and professional responses. If you're not sure about something, recommend consulting with a real estate professional.`
            },
            ...history.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            {
                role: 'user',
                content: message
            }
        ];

        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 500,
            temperature: 0.7,
        });

        const response = completion.choices[0].message.content;

        res.status(200).json({
            success: true,
            response: response
        });

    } catch (error) {
        console.error('OpenAI API Error:', error);
        
        // Handle specific OpenAI errors
        if (error.response) {
            const status = error.response.status;
            const errorMessage = error.response.data?.error?.message || 'OpenAI API error';
            
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
