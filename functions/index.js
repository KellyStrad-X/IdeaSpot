const functions = require('firebase-functions');
const admin = require('firebase-admin');
const OpenAI = require('openai');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Initialize OpenAI lazily to use Firebase config
function getOpenAI() {
  return new OpenAI({
    apiKey: functions.config().openai.api_key,
  });
}

/**
 * Generate all 3 AI cards for an idea
 * Triggered when user clicks "Summarize & analyze"
 */
exports.generateIdeaCards = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to generate cards.'
    );
  }

  const { ideaId, ideaText } = data;

  if (!ideaId || !ideaText) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'ideaId and ideaText are required.'
    );
  }

  try {
    // Verify the idea belongs to the user
    const ideaRef = db.collection('ideas').doc(ideaId);
    const ideaDoc = await ideaRef.get();

    if (!ideaDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Idea not found.');
    }

    if (ideaDoc.data().userId !== context.auth.uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not have permission to modify this idea.'
      );
    }

    // Generate all three cards in parallel for speed
    const [summaryCard, nextStepsCard, similarConceptsCard] = await Promise.all([
      generateSummaryCard(ideaText),
      generateNextStepsCard(ideaText),
      generateSimilarConceptsCard(ideaText),
    ]);

    // Generate a better title using AI
    const title = await generateTitle(ideaText);

    // Update the idea document with the cards and title
    await ideaRef.update({
      title,
      cards: {
        summary: summaryCard,
        nextSteps: nextStepsCard,
        similarConcepts: similarConceptsCard,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      title,
      cards: {
        summary: summaryCard,
        nextSteps: nextStepsCard,
        similarConcepts: similarConceptsCard,
      },
    };
  } catch (error) {
    console.error('Error generating cards:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Generate Summary Card
 */
async function generateSummaryCard(ideaText) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are an idea analysis assistant. Generate a structured summary with:
- Problem statement (1-2 sentences)
- Target audience (specific demographics)
- Core features (3-5 bullet points)
- Value proposition (1 sentence)
- Reality check (2-3 realistic challenges/obstacles)

Be realistic but encouraging. For the reality check, think like a devil's advocate - what could go wrong or hinder this idea? Focus on real business challenges, not technical ones.

Return ONLY a JSON object with these fields: problem, audience, features (array), valueProp, realityCheck (array).`,
      },
      {
        role: 'user',
        content: ideaText,
      },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate Next Steps Card
 */
async function generateNextStepsCard(ideaText) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are a startup validation coach. Given an idea, generate 5-7 concrete actions the person can take in the next 48 hours to validate demand.

Focus on:
- Customer interviews
- Competitor research
- Quick experiments (landing pages, surveys)
- Unit economics calculations

Be specific. Don't suggest "build an MVP" — that comes later.

Return ONLY a JSON object with a "steps" array. Each step should have: title (string), details (array of strings), completed (false).`,
      },
      {
        role: 'user',
        content: ideaText,
      },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate Similar Concepts Card
 */
async function generateSimilarConceptsCard(ideaText) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are a market research assistant. Given an idea, identify 3-4 similar apps, businesses, or products that serve a related need.

For each, explain:
- Name
- Type (App, Business, Product, etc.)
- Description (what they do)
- Gap (what opportunity remains)

End with a 1-sentence differentiation statement.

Adjust examples based on idea type:
- If it's an app idea, show similar apps
- If it's a physical business, show similar businesses
- If it's a product, show similar products

Return ONLY a JSON object with: concepts (array with name, type, description, gap), differentiation (string).`,
      },
      {
        role: 'user',
        content: ideaText,
      },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate a concise title from the idea
 */
async function generateTitle(ideaText) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'Generate a short, catchy title (max 50 characters) for this idea. Return ONLY the title, no quotes or extra text.',
      },
      {
        role: 'user',
        content: ideaText,
      },
    ],
    temperature: 0.7,
    max_tokens: 20,
  });

  return response.choices[0].message.content.trim();
}

/**
 * Regenerate a specific card
 */
exports.regenerateCard = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated.'
    );
  }

  const { ideaId, cardType, ideaText, refinementPrompt } = data;

  if (!ideaId || !cardType || !ideaText) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'ideaId, cardType, and ideaText are required.'
    );
  }

  try {
    const ideaRef = db.collection('ideas').doc(ideaId);
    const ideaDoc = await ideaRef.get();

    if (!ideaDoc.exists || ideaDoc.data().userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied.');
    }

    let newCard;
    const prompt = refinementPrompt || ideaText;

    switch (cardType) {
      case 'summary':
        newCard = await generateSummaryCard(prompt);
        break;
      case 'nextSteps':
        newCard = await generateNextStepsCard(prompt);
        break;
      case 'similarConcepts':
        newCard = await generateSimilarConceptsCard(prompt);
        break;
      default:
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid cardType.'
        );
    }

    // Update only the specific card
    await ideaRef.update({
      [`cards.${cardType}`]: newCard,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, card: newCard };
  } catch (error) {
    console.error('Error regenerating card:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Continue chat conversation with context
 */
exports.continueChat = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated.'
    );
  }

  const { ideaId, userMessage, chatHistory } = data;

  if (!ideaId || !userMessage) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'ideaId and userMessage are required.'
    );
  }

  try {
    const ideaRef = db.collection('ideas').doc(ideaId);
    const ideaDoc = await ideaRef.get();

    if (!ideaDoc.exists || ideaDoc.data().userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied.');
    }

    // Build conversation history for OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are an idea development assistant helping someone refine and develop their business idea. Be conversational, encouraging, and provide specific, actionable advice.`,
      },
    ];

    // Add chat history if provided
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg) => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      });
    }

    // Add the new user message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    // Get AI response
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.8,
      max_tokens: 500,
    });

    const aiResponse = response.choices[0].message.content;

    // Save messages to Firestore
    const chatRef = ideaRef.collection('chatHistory');
    await chatRef.add({
      role: 'user',
      content: userMessage,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    await chatRef.add({
      role: 'assistant',
      content: aiResponse,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, response: aiResponse };
  } catch (error) {
    console.error('Error in chat:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
