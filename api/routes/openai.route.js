import express from 'express';
import { chatWithOpenAI } from '../controllers/openai.controller.js';

const router = express.Router();

router.post('/chat', chatWithOpenAI);

export default router;