/**
 * OpenAI Service
 *
 * This service handles communication with OpenAI API via Firebase Cloud Functions
 * Direct API calls are avoided to keep API keys secure
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

/**
 * Generate all three cards for an idea
 * @param {string} ideaText - The user's raw idea input
 * @returns {Promise<Object>} - Object containing summary, nextSteps, and similarConcepts cards
 */
export const generateIdeaCards = async (ideaText) => {
  try {
    const generateCards = httpsCallable(functions, 'generateIdeaCards');
    const result = await generateCards({ ideaText });
    return result.data;
  } catch (error) {
    console.error('Error generating idea cards:', error);
    throw error;
  }
};

/**
 * Regenerate a specific card with optional refinement prompt
 * @param {string} cardType - 'summary', 'nextSteps', or 'similarConcepts'
 * @param {string} ideaText - The original idea text
 * @param {string} refinementPrompt - Optional prompt to refine the regeneration
 * @returns {Promise<Object>} - The regenerated card data
 */
export const regenerateCard = async (cardType, ideaText, refinementPrompt = '') {
  try {
    const regenerate = httpsCallable(functions, 'regenerateCard');
    const result = await regenerate({ cardType, ideaText, refinementPrompt });
    return result.data;
  } catch (error) {
    console.error('Error regenerating card:', error);
    throw error;
  }
};

/**
 * Continue chat conversation with AI
 * @param {string} ideaId - The ID of the idea being discussed
 * @param {Array} chatHistory - Previous chat messages
 * @param {string} userMessage - New message from user
 * @returns {Promise<string>} - AI response
 */
export const continueChat = async (ideaId, chatHistory, userMessage) => {
  try {
    const chat = httpsCallable(functions, 'continueChat');
    const result = await chat({ ideaId, chatHistory, userMessage });
    return result.data.response;
  } catch (error) {
    console.error('Error in chat:', error);
    throw error;
  }
};

/**
 * Transcribe voice input to text using Whisper API
 * @param {string} audioUri - URI of the audio file
 * @returns {Promise<string>} - Transcribed text
 */
export const transcribeAudio = async (audioUri) => {
  try {
    const transcribe = httpsCallable(functions, 'transcribeAudio');
    const result = await transcribe({ audioUri });
    return result.data.text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
};
