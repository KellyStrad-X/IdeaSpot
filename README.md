# IdeaSpot

A mobile app for capturing and developing ideas on the go — turning raw thoughts into structured, research-backed concept cards. Built with React Native and powered by OpenAI API.

## Features

- **Conversational Idea Capture**: Chat-based interface for capturing ideas naturally
- **AI-Powered Analysis**: Automatically generates three cards for each idea:
  - **Summary Card**: Problem, target audience, core features, value proposition, and reality check
  - **Next Steps Card**: 5-7 actionable validation tasks to complete in the next 48 hours
  - **Similar Concepts Card**: Competitive landscape with differentiation analysis
- **Idea Dashboard**: Visual library of all your ideas with search and filtering
- **Real-time Sync**: Firebase Firestore for instant updates across devices

## Tech Stack

### Frontend
- React Native (Expo)
- React Navigation
- React Native Gesture Handler & Reanimated

### Backend
- Firebase Authentication
- Firebase Firestore (NoSQL database)
- Firebase Cloud Functions (for OpenAI API integration)

### AI Integration
- OpenAI GPT-4 for text generation
- Structured outputs using function calling
- Future: Whisper API for voice-to-text

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Firebase project (see setup below)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd IdeaSpot
```

2. Install dependencies:
```bash
npm install
```

3. Configure Firebase:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication (Email/Password and Google Sign-In)
   - Enable Firestore Database
   - Copy your Firebase config and update `src/config/firebase.js`
   - Or create a `.env` file based on `.env.example`

4. Start the development server:
```bash
npm start
```

5. Run on your device:
   - iOS: Press `i` or run `npm run ios`
   - Android: Press `a` or run `npm run android`
   - Web: Press `w` or run `npm run web`

## Project Structure

```
IdeaSpot/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── cards/       # Card components
│   │   ├── chat/        # Chat-related components
│   │   └── common/      # Common UI elements
│   ├── screens/         # App screens
│   │   ├── Dashboard/   # Idea library screen
│   │   ├── Chat/        # Idea capture screen
│   │   └── Workspace/   # Idea workspace screen
│   ├── navigation/      # Navigation configuration
│   ├── services/        # External services
│   │   ├── firestore.js # Firestore operations
│   │   └── openai.js    # OpenAI API integration
│   ├── config/          # App configuration
│   │   └── firebase.js  # Firebase setup
│   ├── constants/       # Constants and theme
│   │   ├── colors.js    # Color palette
│   │   └── theme.js     # Typography, spacing, etc.
│   └── utils/           # Helper functions
├── App.js               # App entry point
├── app.json             # Expo configuration
└── package.json         # Dependencies
```

## Firebase Setup

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    match /ideas/{ideaId} {
      allow read, write: if request.auth.uid == resource.data.userId;
      allow create: if request.auth.uid == request.resource.data.userId;

      match /chatHistory/{messageId} {
        allow read, write: if request.auth.uid == get(/databases/$(database)/documents/ideas/$(ideaId)).data.userId;
      }
    }
  }
}
```

## Development Roadmap

### Phase 1: Firebase Setup + AI (1-2 weeks) ✅
- [x] Set up Firebase project
- [x] Configure Firebase in React Native app
- [x] Build Cloud Function for OpenAI integration
- [x] Test prompt quality for all 3 cards
- [ ] Set up Firestore security rules

### Phase 2: Frontend Core (3-4 weeks)
- [x] Build dashboard UI
- [x] Build chat interface
- [x] Build workspace/card view
- [x] Implement navigation
- [ ] Wire up Firebase real-time listeners
- [ ] Connect OpenAI integration

### Phase 3: Polish + Testing (2 weeks)
- [ ] Animations and transitions
- [ ] Voice input integration (Whisper API)
- [ ] Error handling
- [ ] Offline caching
- [ ] Beta testing with 10-20 users

### Phase 4: Launch Prep (1 week)
- [ ] App Store submission
- [ ] Landing page
- [ ] Firebase Analytics setup

## Contributing

This is a private project. For any questions or suggestions, please contact the project owner.

## License

Copyright © 2025. All rights reserved.
