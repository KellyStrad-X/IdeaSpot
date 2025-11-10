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
 * Generate all AI cards for an idea
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

  const { ideaId, ideaText, conversationTranscript, category } = data;

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
    const conversationContext = conversationTranscript || ideaText;
    const ideaCategory = category || 'General';

    const [
      summaryCard,
      actionableInsightsCard,
      userScenariosCard,
      monetizationCard,
      mvpCard,
      title,
    ] = await Promise.all([
      generateSummaryCard(conversationContext, ideaCategory),
      generateActionableInsightsCard(conversationContext, ideaCategory),
      generateUserScenariosCard(conversationContext, ideaCategory),
      generateMonetizationCard(conversationContext, ideaCategory),
      generateMVPCard(conversationContext, ideaCategory),
      generateTitle(ideaText),
    ]);

    // Update the idea document with all cards and title, clear analyzing flag
    await ideaRef.update({
      title,
      cards: {
        summary: summaryCard,
        actionableInsights: actionableInsightsCard,
        userScenarios: userScenariosCard,
        monetization: monetizationCard,
        mvp: mvpCard,
      },
      analyzing: false, // Clear the analyzing flag
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
        mvp: mvpCard,
      },
    };
  } catch (error) {
    console.error('Error generating cards:', error);

    // Clear analyzing flag on error
    try {
      const ideaRef = db.collection('ideas').doc(ideaId);
      await ideaRef.update({ analyzing: false });
    } catch (updateError) {
      console.error('Error clearing analyzing flag:', updateError);
    }

    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Generate Summary Card
 */
async function generateSummaryCard(conversationContext, category) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an insightful idea analyst who creates personalized summaries. Based on the conversation provided, generate a tailored summary that captures:

- Problem statement: The core problem being solved (1-2 sentences, specific to what was discussed)
- Target audience: Who this is for (be specific based on the conversation - demographics, psychographics, behaviors)
- Core features: 3-5 key capabilities or offerings (drawn from the discussion)
- Value proposition: The unique benefit in one compelling sentence
- Reality check: 2-3 honest challenges or obstacles (be a thoughtful devil's advocate)

Be conversational and personalized. Reference specific details from the discussion. The category is "${category}" - let that inform your analysis without being prescriptive.

Return ONLY a JSON object with these fields: problem, audience, features (array), valueProp, realityCheck (array).`,
      },
      {
        role: 'user',
        content: conversationContext,
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
async function generateActionableInsightsCard(conversationContext, category) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a strategic business advisor creating personalized, actionable insights. Based on the conversation, generate exactly 5 high-impact recommendations tailored to this specific idea.

Focus on what matters MOST for THIS idea:
- Critical validation steps specific to their context
- Business model decisions that fit their situation
- Strategic moves relevant to their category and audience
- Key risks they should address first
- Growth opportunities that align with their resources

Be specific and personal - reference details from the conversation. Avoid generic advice. The category is "${category}" - use that context wisely.

Return ONLY a JSON object with an "insights" array of exactly 5 items. Each insight should have:
- title (string): Clear, specific heading
- advice (string): 2-3 sentences of tailored, actionable guidance
- category (string): One of "validation", "business-model", "strategy", "risk", "growth"`,
      },
      {
        role: 'user',
        content: conversationContext,
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
async function generateUserScenariosCard(conversationContext, category) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a user experience storyteller. Based on the conversation, create 2 vivid, realistic scenarios showing how different people would benefit from this idea.

Craft each scenario to:
- Feature a specific persona (name, role, context) that fits the target audience discussed
- Describe their unique problem or need
- Show their journey using this solution (be concrete and detailed)
- Highlight the meaningful outcome they achieve

Make scenarios diverse and personal - draw from details in the conversation. Be story-driven and engaging. The category is "${category}" - let that shape the scenarios naturally.

Return ONLY a JSON object with a "scenarios" array. Each scenario should have:
- persona (string): Name and descriptor (e.g., "Marcus, a small bakery owner")
- context (string): Their specific situation/problem
- journey (string): How they engage with and use the solution (3-4 sentences)
- outcome (string): The tangible benefit/result they experience`,
      },
      {
        role: 'user',
        content: conversationContext,
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
async function generateMonetizationCard(conversationContext, category) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a revenue strategist who creates personalized monetization plans. Based on the conversation, recommend a pricing approach that fits this specific idea.

Consider:
- The category is "${category}" - tailor your recommendations accordingly
- For physical products: focus on one-time sales, wholesale/retail margins, not subscriptions (unless consumables/refills)
- For services: emphasize project fees, retainers, or performance-based pricing
- For apps/software: subscriptions only if there's recurring value; otherwise usage-based or one-time

Provide:
1. Primary Revenue Model - The best fit based on the discussion (with clear reasoning)
2. Pricing Tiers - 2-3 realistic tiers tailored to their market
3. Alternative Models - 1-2 alternatives that could work
4. Revenue Projections - Realistic monthly revenue at 100, 500, and 1000 customers/users

Be specific and grounded in the conversation details. Avoid generic template answers.

Return ONLY a JSON object with:
- primaryModel (string): Name of recommended model
- modelRationale (string): 2-3 sentences explaining why this fits their situation
- pricingTiers (array): 2-3 tiers with name, price, and features (array)
- alternativeModels (array): 1-2 alternatives with name and description
- projections (object): revenue estimates with keys users100, users500, users1000`,
      },
      {
        role: 'user',
        content: conversationContext,
      },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate MVP Card (Business Name + MVP Guidance)
 */
async function generateMVPCard(conversationContext, category) {
  const openai = getOpenAI();

  // Generate business name and MVP guidance in parallel
  const [nameResponse, mvpResponse] = await Promise.all([
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
          content: conversationContext,
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
          content: `You are an MVP strategist who helps founders build their minimum viable product. Based on the conversation, provide tactical, category-specific guidance.

The category is "${category}". Tailor your advice accordingly:

- For Apps/Software: recommend tech stacks, core MVP features to include, features to avoid (feature creep), development approach
- For Products: focus on LLC/business formation, supplier sourcing, fulfillment setup, prototyping steps
- For Services: cover business structure, operations setup, client management systems, service delivery process
- For general business: provide formation, legal, operational, and go-to-market essentials

Be practical and actionable. Give specific recommendations drawn from the conversation details. Include 4-6 key items they need to get started.

Return ONLY a JSON object with:
- guidance (array): 4-6 tactical action items, each a string describing what to do and why`,
        },
        {
          role: 'user',
          content: conversationContext,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  ]);

  const nameData = JSON.parse(nameResponse.choices[0].message.content);
  const mvpData = JSON.parse(mvpResponse.choices[0].message.content);

  return {
    name: nameData.name,
    nameRationale: nameData.rationale,
    guidance: mvpData.guidance,
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
    const category = data.category || 'General';

    switch (cardType) {
      case 'summary':
        newCard = await generateSummaryCard(prompt, category);
        break;
      case 'actionableInsights':
        newCard = await generateActionableInsightsCard(prompt, category);
        break;
      case 'userScenarios':
        newCard = await generateUserScenariosCard(prompt, category);
        break;
      case 'monetization':
        newCard = await generateMonetizationCard(prompt, category);
        break;
      case 'mvp':
        newCard = await generateMVPCard(prompt, category);
        break;
      default:
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid cardType. Must be one of: summary, actionableInsights, userScenarios, monetization, mvp'
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
        content: `You are an enthusiastic idea development assistant. Your goal is to help users flesh out their ideas through natural conversation.

After the user shares their initial idea, ask 3-4 thoughtful questions to understand:
- Who this is for and what problem it solves
- Key features or offerings
- What makes it unique
- Any constraints or considerations

Be natural and conversational - adapt your questions based on what they tell you. When you feel you have enough detail (typically after 3-4 exchanges), let them know you're ready to analyze their idea and create personalized insights.

Don't follow a rigid script - respond genuinely to what they share.`,
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

    // Update only the business name in mvp card
    const currentMVP = ideaDoc.data().cards?.mvp || {};
    await ideaRef.update({
      'cards.mvp.name': nameData.name,
      'cards.mvp.nameRationale': nameData.rationale,
      'cards.mvp.guidance': currentMVP.guidance || [], // Keep existing guidance
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
