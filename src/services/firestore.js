/**
 * Firestore Service
 *
 * Handles all database operations for ideas, cards, and chat history
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Create a new idea in Firestore
 * @param {string} userId - User ID
 * @param {Object} ideaData - Idea data including title, originalInput, tags, etc.
 * @returns {Promise<string>} - The new idea's document ID
 */
export const createIdea = async (userId, ideaData) => {
  try {
    const ideasRef = collection(db, 'ideas');
    const newIdea = {
      userId,
      ...ideaData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: 'active',
    };
    const docRef = await addDoc(ideasRef, newIdea);
    return docRef.id;
  } catch (error) {
    console.error('Error creating idea:', error);
    throw error;
  }
};

/**
 * Get all ideas for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of idea objects with IDs
 */
export const getUserIdeas = async (userId) => {
  try {
    const ideasRef = collection(db, 'ideas');
    const q = query(
      ideasRef,
      where('userId', '==', userId),
      where('status', '!=', 'deleted'),
      orderBy('status'),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting user ideas:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time updates for user's ideas
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function to handle updates
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToUserIdeas = (userId, callback) => {
  try {
    const ideasRef = collection(db, 'ideas');
    const q = query(
      ideasRef,
      where('userId', '==', userId),
      where('status', '!=', 'deleted'),
      orderBy('status'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (querySnapshot) => {
      const ideas = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(ideas);
    });
  } catch (error) {
    console.error('Error subscribing to ideas:', error);
    throw error;
  }
};

/**
 * Get a single idea by ID
 * @param {string} ideaId - Idea document ID
 * @returns {Promise<Object>} - Idea object with ID
 */
export const getIdea = async (ideaId) => {
  try {
    const ideaRef = doc(db, 'ideas', ideaId);
    const ideaDoc = await getDoc(ideaRef);
    if (ideaDoc.exists()) {
      return { id: ideaDoc.id, ...ideaDoc.data() };
    }
    throw new Error('Idea not found');
  } catch (error) {
    console.error('Error getting idea:', error);
    throw error;
  }
};

/**
 * Update an idea
 * @param {string} ideaId - Idea document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const updateIdea = async (ideaId, updates) => {
  try {
    const ideaRef = doc(db, 'ideas', ideaId);
    await updateDoc(ideaRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating idea:', error);
    throw error;
  }
};

/**
 * Update idea cards
 * @param {string} ideaId - Idea document ID
 * @param {Object} cards - Cards object with summary, nextSteps, similarConcepts
 * @returns {Promise<void>}
 */
export const updateIdeaCards = async (ideaId, cards) => {
  try {
    const ideaRef = doc(db, 'ideas', ideaId);
    await updateDoc(ideaRef, {
      cards,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating idea cards:', error);
    throw error;
  }
};

/**
 * Archive an idea (soft delete)
 * @param {string} ideaId - Idea document ID
 * @returns {Promise<void>}
 */
export const archiveIdea = async (ideaId) => {
  try {
    await updateIdea(ideaId, { status: 'archived' });
  } catch (error) {
    console.error('Error archiving idea:', error);
    throw error;
  }
};

/**
 * Delete an idea (soft delete)
 * @param {string} ideaId - Idea document ID
 * @returns {Promise<void>}
 */
export const deleteIdea = async (ideaId) => {
  try {
    await updateIdea(ideaId, { status: 'deleted' });
  } catch (error) {
    console.error('Error deleting idea:', error);
    throw error;
  }
};

/**
 * Add a message to chat history
 * @param {string} ideaId - Idea document ID
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - Message content
 * @returns {Promise<string>} - Message document ID
 */
export const addChatMessage = async (ideaId, role, content) => {
  try {
    const chatRef = collection(db, 'ideas', ideaId, 'chatHistory');
    const message = {
      role,
      content,
      timestamp: Timestamp.now()
    };
    const docRef = await addDoc(chatRef, message);
    return docRef.id;
  } catch (error) {
    console.error('Error adding chat message:', error);
    throw error;
  }
};

/**
 * Get chat history for an idea
 * @param {string} ideaId - Idea document ID
 * @returns {Promise<Array>} - Array of chat messages
 */
export const getChatHistory = async (ideaId) => {
  try {
    const chatRef = collection(db, 'ideas', ideaId, 'chatHistory');
    const q = query(chatRef, orderBy('timestamp', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting chat history:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time chat updates
 * @param {string} ideaId - Idea document ID
 * @param {Function} callback - Callback function to handle updates
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToChatHistory = (ideaId, callback) => {
  try {
    const chatRef = collection(db, 'ideas', ideaId, 'chatHistory');
    const q = query(chatRef, orderBy('timestamp', 'asc'));

    return onSnapshot(q, (querySnapshot) => {
      const messages = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(messages);
    });
  } catch (error) {
    console.error('Error subscribing to chat:', error);
    throw error;
  }
};
