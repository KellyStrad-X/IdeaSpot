/**
 * OpenAI Service
 *
 * This service handles communication with OpenAI API via Firebase Cloud Functions
 * Direct API calls are avoided to keep API keys secure
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

/**
 * Generate all analysis cards for an idea
 * @param {string} ideaId - The Firestore document ID of the idea
 * @param {string} ideaText - The user's raw idea input
 * @param {string} conversationTranscript - Full conversation transcript (optional)
 * @param {string} category - Detected or selected category (optional)
 * @returns {Promise<Object>} - Object containing title and cards
 */
export const generateIdeaCards = async (ideaId, ideaText, conversationTranscript = null, category = null) => {
  try {
    const generateCards = httpsCallable(functions, 'generateIdeaCards');
    const result = await generateCards({
      ideaId,
      ideaText,
      conversationTranscript,
      category
    });
    return result.data;
  } catch (error) {
    console.error('Error generating idea cards:', error);
    throw error;
  }
};

/**
 * Regenerate a specific card with optional refinement prompt
 * @param {string} ideaId - The Firestore document ID of the idea
 * @param {string} cardType - 'summary', 'actionableInsights', 'userScenarios', 'monetization', or 'conceptBranding'
 * @param {string} ideaText - The original idea text
 * @param {string} refinementPrompt - Optional prompt to refine the regeneration
 * @returns {Promise<Object>} - The regenerated card data
 */
export const regenerateCard = async (ideaId, cardType, ideaText, refinementPrompt = '') => {
  try {
    const regenerate = httpsCallable(functions, 'regenerateCard');
    const result = await regenerate({ ideaId, cardType, ideaText, refinementPrompt });
    return result.data;
  } catch (error) {
    console.error('Error regenerating card:', error);
    throw error;
  }
};

/**
 * Regenerate just the business name in Concept Branding
 * @param {string} ideaId - The Firestore document ID of the idea
 * @param {string} ideaText - The original idea text
 * @returns {Promise<Object>} - Object containing new name and rationale
 */
export const regenerateBusinessName = async (ideaId, ideaText) => {
  try {
    const regenerate = httpsCallable(functions, 'regenerateBusinessName');
    const result = await regenerate({ ideaId, ideaText });
    return result.data;
  } catch (error) {
    console.error('Error regenerating business name:', error);
    throw error;
  }
};

/**
 * Continue chat conversation with AI
 * @param {string} ideaId - The ID of the idea being discussed
 * @param {Array} chatHistory - Previous chat messages
 * @param {string} userMessage - New message from user
 * @param {boolean} isContinuation - Whether this is continuing an analyzed idea
 * @param {Object} ideaContext - Context about the idea (title, category, summary)
 * @returns {Promise<string>} - AI response
 */
export const continueChat = async (ideaId, chatHistory, userMessage, isContinuation = false, ideaContext = null) => {
  try {
    const chat = httpsCallable(functions, 'continueChat');
    const result = await chat({
      ideaId,
      chatHistory,
      userMessage,
      isContinuation,
      ideaContext
    });
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
