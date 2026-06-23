import { Groq } from 'groq-sdk';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Groq Whisper API configuration (FREE tier)
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const WHISPER_MODEL = 'whisper-large-v3-turbo';

const groq = new Groq({
    apiKey: GROQ_API_KEY
});

// Retry function with exponential backoff for rate limiting
const callWhisperAPIWithRetry = async (fileBuffer, fileName, mimeType, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Groq SDK expects a File-like object
            const file = new File([fileBuffer], fileName, { type: mimeType });
            
            const response = await groq.audio.transcriptions.create({
                file: file,
                model: WHISPER_MODEL,
                response_format: 'verbose_json',
                language: 'en'
            });
            return response;
        } catch (error) {
            console.log(`Groq Whisper API attempt ${attempt} failed:`, error.status, error.message);
            
            // If it's a rate limit error (429), wait and retry
            if (error.status === 429 && attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            
            // If it's not a rate limit error or we've exhausted retries, throw
            throw error;
        }
    }
};

export const transcribeAudio = async (req, res) => {
    try {
        const { audioUrl } = req.body;

        if (!audioUrl) {
            return res.status(400).json({
                success: false,
                message: 'Audio URL is required'
            });
        }

        if (!GROQ_API_KEY) {
            return res.status(500).json({
                success: false,
                message: 'Speech-to-text service not configured. Please add GROQ_API_KEY to environment variables.'
            });
        }

        // Download the audio file from Cloudinary
        console.log('📥 Downloading audio file for transcription:', audioUrl);
        const audioResponse = await axios.get(audioUrl, {
            responseType: 'arraybuffer',
            timeout: 60000 // 60 second timeout for large files
        });

        const contentType = audioResponse.headers['content-type'] || 'audio/webm';
        
        // Determine file extension from content type
        const extMap = {
            'audio/webm': 'webm',
            'audio/mpeg': 'mp3',
            'audio/mp3': 'mp3',
            'audio/wav': 'wav',
            'audio/ogg': 'ogg',
            'audio/aac': 'aac',
            'audio/mp4': 'm4a',
            'audio/m4a': 'm4a',
            'audio/flac': 'flac',
            'video/webm': 'webm',  // Some audio recorded as video/webm
            'video/mp4': 'mp4'
        };
        const ext = extMap[contentType] || 'webm';
        const fileName = `audio.${ext}`;

        console.log(`🎤 Sending ${(audioResponse.data.byteLength / 1024).toFixed(1)}KB audio to Groq Whisper...`);

        // Call Groq Whisper API with retry logic
        const whisperResponse = await callWhisperAPIWithRetry(
            audioResponse.data,
            fileName,
            contentType,
            3
        );

        // Extract transcription from Groq response
        const text = whisperResponse.text;
        const language = whisperResponse.language || 'en';
        const duration = whisperResponse.duration || 0;
        const segments = whisperResponse.segments || [];

        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Could not transcribe audio. Please ensure the audio is clear and contains speech.'
            });
        }

        // Calculate average confidence from segments
        let avgConfidence = 0.9;
        if (segments && segments.length > 0) {
            const totalConfidence = segments.reduce((sum, segment) => sum + (segment.avg_logprob || 0), 0);
            avgConfidence = Math.max(0, Math.min(1, Math.exp(totalConfidence / segments.length)));
        }

        console.log(`✅ Transcription complete: ${text.length} chars, ${duration.toFixed(1)}s, lang=${language}`);

        res.json({
            success: true,
            transcription: text.trim(),
            confidence: avgConfidence,
            language: language,
            duration: duration,
            segments: segments
        });

    } catch (error) {
        console.error('Groq Whisper API error:', error);
        
        if (error.status === 400) {
            return res.status(400).json({
                success: false,
                message: 'Invalid audio format or poor audio quality. Please try recording again.',
                error: error.message
            });
        }

        if (error.status === 401) {
            return res.status(500).json({
                success: false,
                message: 'Groq API key is invalid. Please check your API key configuration.'
            });
        }

        if (error.status === 429) {
            return res.status(429).json({
                success: false,
                message: 'Rate limit exceeded. Please wait a moment before trying again.',
                retryAfter: 10
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to transcribe audio. Please try again.',
            error: error.message
        });
    }
};

// Get Web Speech API information
export const getWebSpeechInfo = (req, res) => {
    try {
        res.json({
            success: true,
            supported: true,
            provider: 'Groq Whisper (Free Tier)',
            languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'],
            features: [
                'automatic_punctuation',
                'word_timing',
                'confidence_scores',
                'language_detection',
                'noise_robustness',
                'accent_adaptation'
            ],
            model: WHISPER_MODEL,
            cost: 'FREE (Groq free tier)',
            advantages: [
                'High accuracy transcription',
                'Supports 99+ languages',
                'Handles various accents and dialects',
                'Works with noisy audio',
                'Automatic punctuation and capitalization',
                'Free tier with generous rate limits'
            ]
        });
    } catch (error) {
        console.error('Web Speech API info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get Web Speech API information'
        });
    }
};