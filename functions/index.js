const functions = require('firebase-functions');
const admin = require('firebase-admin');
const OpenAI = require('openai');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Initialize OpenAI lazily to use Firebase config
function getOpenAI() {
  const config = functions.config();
  const apiKey = config?.openai?.apikey || config?.openai?.api_key;

  if (!apiKey) {
    throw new Error('OpenAI API key is not configured in functions config.');
  }

  return new OpenAI({
    apiKey,
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

    // Generate all cards in parallel for speed
    const [
      summaryCard,
      actionableInsightsCard,
      userScenariosCard,
      monetizationCard,
      conceptBranding,
      title,
    ] = await Promise.all([
      generateSummaryCard(ideaText),
      generateActionableInsightsCard(ideaText),
      generateUserScenariosCard(ideaText),
      generateMonetizationCard(ideaText),
      generateConceptBranding(ideaText),
      generateTitle(ideaText),
    ]);

    // Update the idea document with all cards and title
    await ideaRef.update({
      title,
      cards: {
        summary: summaryCard,
        actionableInsights: actionableInsightsCard,
        userScenarios: userScenariosCard,
        monetization: monetizationCard,
        conceptBranding: conceptBranding,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      title,
      cards: {
        summary: summaryCard,
        actionableInsights: actionableInsightsCard,
        userScenarios: userScenariosCard,
        monetization: monetizationCard,
        conceptBranding: conceptBranding,
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
    model: 'gpt-4o',
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
 * Generate Actionable Insights Card
 */
async function generateActionableInsightsCard(ideaText) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a business strategy advisor. Generate 5-7 actionable insights to develop this idea into a viable business.

Focus on:
- Market validation strategies
- Business model considerations
- Key strategic decisions to make
- Risk mitigation approaches
- Growth and scaling insights

Provide GENERAL, STRATEGIC advice (not just 48-hour tasks). Be consistent in tone and concise in delivery. Each insight should be practical and immediately useful.

Return ONLY a JSON object with an "insights" array. Each insight should have:
- title (string): Clear, concise heading
- advice (string): 2-3 sentences of actionable guidance
- category (string): One of "validation", "business-model", "strategy", "risk", "growth"`,
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
    model: 'gpt-4o',
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
    model: 'gpt-4o',
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
 * Generate User Scenarios Card
 */
async function generateUserScenariosCard(ideaText) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a UX researcher and user journey expert. Generate 3-4 realistic user scenarios that demonstrate how different people would use this idea to solve their problems.

For each scenario:
- Create a specific persona (name, role, context)
- Describe their problem/need
- Show step-by-step how they would use this idea
- Highlight the outcome/benefit they receive

Make scenarios DIVERSE (different user types, contexts, use cases). Be concrete and story-driven. Keep each scenario to 4-6 sentences.

Return ONLY a JSON object with a "scenarios" array. Each scenario should have:
- persona (string): Name and brief descriptor (e.g., "Sarah, a freelance designer")
- context (string): Their situation/problem
- journey (string): How they use the product/service (3-4 sentences)
- outcome (string): The benefit/result they achieve`,
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
 * Generate Monetization Card
 */
async function generateMonetizationCard(ideaText) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a pricing strategist and business model expert. Analyze this idea and suggest viable monetization approaches.

Provide:
1. Primary Revenue Model - Most suitable model (subscription, one-time, freemium, marketplace, etc.) with brief justification
2. Pricing Tiers - Suggest 2-3 pricing tiers with what each includes
3. Alternative Models - 1-2 alternative monetization approaches to consider
4. Revenue Projections - Realistic monthly revenue estimates at 100, 500, and 1000 customers/users

Be REALISTIC and SPECIFIC. Consider the idea type (app, service, product, etc.) and target market. Focus on proven monetization patterns.

Return ONLY a JSON object with:
- primaryModel (string): Name of recommended model
- modelRationale (string): 2-3 sentences why this fits
- pricingTiers (array): 2-3 tiers with name, price, and features (array)
- alternativeModels (array): 1-2 alternative approaches with name and description
- projections (object): revenue estimates with keys users100, users500, users1000`,
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
 * Generate Concept Branding (Business Name + Slogan)
 */
async function generateConceptBranding(ideaText) {
  const openai = getOpenAI();

  // Generate business name and slogan in parallel
  const [nameResponse, sloganResponse] = await Promise.all([
    openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a creative brand strategist specializing in naming. Generate a memorable, relevant business name for this idea.

The name should:
- Be 1-3 words maximum
- Clearly relate to the core value/function
- Be easy to pronounce and remember
- Sound professional yet approachable
- Avoid clichés and overused terms

Return ONLY a JSON object with:
- name (string): The suggested business name
- rationale (string): 1-2 sentences explaining the name choice`,
        },
        {
          role: 'user',
          content: ideaText,
        },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    }),
    openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a copywriter specializing in brand taglines. Create a compelling slogan for this business idea.

The slogan should:
- Be 3-8 words maximum
- Capture the core benefit or differentiation
- Be memorable and catchy
- Use active, benefit-focused language
- Avoid being too generic

Return ONLY a JSON object with:
- slogan (string): The tagline`,
        },
        {
          role: 'user',
          content: ideaText,
        },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    }),
  ]);

  const nameData = JSON.parse(nameResponse.choices[0].message.content);
  const sloganData = JSON.parse(sloganResponse.choices[0].message.content);

  return {
    name: nameData.name,
    nameRationale: nameData.rationale,
    slogan: sloganData.slogan,
  };
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
      case 'actionableInsights':
        newCard = await generateActionableInsightsCard(prompt);
        break;
      case 'userScenarios':
        newCard = await generateUserScenariosCard(prompt);
        break;
      case 'monetization':
        newCard = await generateMonetizationCard(prompt);
        break;
      case 'conceptBranding':
        newCard = await generateConceptBranding(prompt);
        break;
      default:
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid cardType. Must be one of: summary, actionableInsights, userScenarios, monetization, conceptBranding'
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
      model: 'gpt-4o',
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

/**
 * Regenerate just the business name
 * Used by the regen button in Concept Branding section
 */
exports.regenerateBusinessName = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated.'
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
    const ideaRef = db.collection('ideas').doc(ideaId);
    const ideaDoc = await ideaRef.get();

    if (!ideaDoc.exists || ideaDoc.data().userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied.');
    }

    // Generate only a new business name
    const openai = getOpenAI();
    const nameResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a creative brand strategist specializing in naming. Generate a memorable, relevant business name for this idea.

The name should:
- Be 1-3 words maximum
- Clearly relate to the core value/function
- Be easy to pronounce and remember
- Sound professional yet approachable
- Avoid clichés and overused terms

Return ONLY a JSON object with:
- name (string): The suggested business name
- rationale (string): 1-2 sentences explaining the name choice`,
        },
        {
          role: 'user',
          content: ideaText,
        },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const nameData = JSON.parse(nameResponse.choices[0].message.content);

    // Update only the business name in conceptBranding
    const currentBranding = ideaDoc.data().cards?.conceptBranding || {};
    await ideaRef.update({
      'cards.conceptBranding.name': nameData.name,
      'cards.conceptBranding.nameRationale': nameData.rationale,
      'cards.conceptBranding.slogan': currentBranding.slogan || '', // Keep existing slogan
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      name: nameData.name,
      nameRationale: nameData.rationale,
    };
  } catch (error) {
    console.error('Error regenerating business name:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
