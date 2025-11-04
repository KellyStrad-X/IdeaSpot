# IdeaSpot Cloud Functions

Firebase Cloud Functions for IdeaSpot's OpenAI integration.

## Setup

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Initialize Firebase Project

```bash
# From the IdeaSpot root directory
firebase use --add
# Select your Firebase project
```

### 4. Install Dependencies

```bash
cd functions
npm install
```

### 5. Set Environment Variables

Set your OpenAI API key as a Firebase environment variable:

```bash
firebase functions:config:set openai.api_key="sk-your-openai-api-key-here"
```

To view current config:
```bash
firebase functions:config:get
```

### 6. Deploy Functions

```bash
# From the functions directory
npm run deploy

# Or from the root directory
firebase deploy --only functions
```

## Available Functions

### `generateIdeaCards`
**Type:** Callable HTTPS Function  
**Purpose:** Generates all 3 AI cards (Summary, Next Steps, Similar Concepts) for an idea  
**Parameters:**
- `ideaId` (string): The Firestore document ID of the idea
- `ideaText` (string): The original idea text

**Returns:**
- `title` (string): AI-generated title
- `cards` (object): All three generated cards

### `regenerateCard`
**Type:** Callable HTTPS Function  
**Purpose:** Regenerate a specific card with optional refinement  
**Parameters:**
- `ideaId` (string): The Firestore document ID
- `cardType` (string): 'summary', 'nextSteps', or 'similarConcepts'
- `ideaText` (string): The idea text
- `refinementPrompt` (string, optional): Additional context for regeneration

**Returns:**
- `card` (object): The regenerated card

### `continueChat`
**Type:** Callable HTTPS Function  
**Purpose:** Continue a conversation about an idea  
**Parameters:**
- `ideaId` (string): The Firestore document ID
- `userMessage` (string): The user's new message
- `chatHistory` (array, optional): Previous conversation messages

**Returns:**
- `response` (string): AI's response

## Local Development

### Run Functions Emulator

```bash
# From the functions directory
npm run serve
```

This starts the Firebase emulator on http://localhost:5001

### Test Functions Locally

Update your app's Firebase config to point to the emulator:

```javascript
// In src/config/firebase.js (development only)
if (__DEV__) {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

## Deployment Notes

- Functions require Node.js 18 runtime
- OpenAI API key is stored as Firebase environment config (not in code)
- All functions verify user authentication before execution
- Functions check that users can only access their own ideas

## Cost Considerations

- **Firebase:** Cloud Functions free tier includes 2M invocations/month
- **OpenAI:** GPT-4 costs ~$0.03-0.06 per idea analysis
- Monitor usage in Firebase Console and OpenAI Dashboard

## Troubleshooting

### "Permission denied" errors
- Check Firestore security rules
- Verify user is authenticated
- Ensure userId matches idea owner

### OpenAI API errors
- Check API key is set: `firebase functions:config:get openai`
- Verify API key is valid in OpenAI Dashboard
- Check OpenAI account has credits

### Deployment fails
- Run `npm install` in functions directory
- Check Node version matches (18)
- Review deployment logs: `firebase functions:log`

## Security

- Never commit `.env` files or API keys
- API keys are stored in Firebase environment config
- All functions validate user authentication
- Firestore rules enforce data ownership

## Logs

View function logs:
```bash
firebase functions:log
```

View specific function:
```bash
firebase functions:log --only generateIdeaCards
```
