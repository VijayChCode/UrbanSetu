import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const groq = new Groq({
    apiKey: GROQ_API_KEY
});

export const draftLegalClause = async (req, res, next) => {
    try {
        const { userInput } = req.body;

        if (!userInput) {
            return res.status(400).json({ message: "User input is required." });
        }

        const systemPrompt = `You are an expert real estate lawyer. A **Tenant** is drafting a custom clause to propose to their **Landlord** for an upcoming rental agreement.
    Your task is to convert the Tenant's plain English requirement into a formal, legally binding clause.
    
    Rules:
    - Focus on the Landlord's obligations and the Tenant's rights relative to the input.
    - Use formal legal terminology (e.g., "The Landlord shall ensure...", "The Tenant shall be granted the right to...").
    - If the Tenant asks for a service or right (e.g., "Landlord pays water bill"), the clause should explicitly state the Landlord's responsibility and any associated Tenant rights.
    - Ensure the clause is precise, enforceable, and suitable for a professional lease contract.
    - Return ONLY the text of the clause. Do not include titles, introductions, or quotes.
    `;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userInput }
            ],
            model: GROQ_MODEL,
            temperature: 0.3, // Low temperature for consistent, formal output
            max_tokens: 500
        });

        const draftedClause = completion.choices[0]?.message?.content?.trim() || "Could not generate clause.";

        res.json({
            success: true,
            draftedClause
        });

    } catch (error) {
        console.error("Legal AI Error:", error);
        res.status(500).json({ message: "Failed to draft legal clause." });
    }
};
