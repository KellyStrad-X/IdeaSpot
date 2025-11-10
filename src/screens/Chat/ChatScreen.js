import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import {
  createIdea,
  addChatMessage,
  subscribeToChatHistory,
  getIdea,
} from '../../services/firestore';
import { generateIdeaCards, continueChat } from '../../services/openai';

export default function ChatScreen({ navigation, route }) {
  const { user } = useAuth();
  const { ideaId } = route.params || {};

  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm here to help you capture and develop your idea. Tell me what you're thinking about.",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentIdeaId, setCurrentIdeaId] = useState(ideaId);
  const [firstUserMessage, setFirstUserMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const flatListRef = useRef(null);

  const categories = ['App', 'Product', 'Service', 'Software'];
  const maxQuestions = 4; // AI will ask 3-4 qualifying questions

  // Load existing chat history if continuing an idea
  useEffect(() => {
    if (currentIdeaId) {
      const unsubscribe = subscribeToChatHistory(currentIdeaId, (chatMessages) => {
        // Keep the initial greeting and add chat history
        const historyMessages = chatMessages.map((msg, index) => ({
          id: `history-${index}`,
          role: msg.role,
          content: msg.content,
        }));
        setMessages([messages[0], ...historyMessages]);
      });

      return () => unsubscribe();
    }
  }, [currentIdeaId]);

  const handleSend = async () => {
    if (inputText.trim() === '' || isAIThinking) return;

    const userMessageContent = inputText.trim();

    // Add user message to UI immediately
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsAIThinking(true);

    // Store first user message for creating idea title
    if (!firstUserMessage) {
      setFirstUserMessage(userMessageContent);
    }

    try {
      // Get AI response using the conversational AI
      const chatHistory = messages.slice(1).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // System prompt for AI to be inquisitive and ask qualifying questions
      const systemPrompt = `You are an enthusiastic, creative idea development assistant. Your goal is to help the user flesh out their idea by asking 3-4 insightful qualifying questions.

Be:
- Inquisitive and genuinely interested in their idea
- Personable and conversational
- Creative in helping them shape the idea
- Focused on understanding the core aspects: target audience, key features/offerings, unique value, and any constraints

Ask ONE question at a time. After ${maxQuestions} questions (or when you have enough detail), let the user know you're ready to analyze and show them insights.

Try to naturally determine if this is an App, Product, Service, or Software idea based on the conversation.`;

      // Build full conversation for AI
      const fullContext = [
        { role: 'system', content: systemPrompt },
        ...chatHistory,
        { role: 'user', content: userMessageContent }
      ];

      // Create a temporary idea if we don't have one yet (for chat history)
      let tempIdeaId = currentIdeaId;
      if (!tempIdeaId) {
        tempIdeaId = await createIdea(user.uid, {
          title: 'New Idea',
          originalInput: userMessageContent,
          tags: ['In Progress'],
          status: 'active',
        });
        setCurrentIdeaId(tempIdeaId);
      }

      // Save user message
      await addChatMessage(tempIdeaId, 'user', userMessageContent);

      // Get AI response - we'll use a simple prompt-based approach since continueChat needs an existing idea
      // For now, we'll create a conversational flow with predetermined logic
      const currentQuestionNum = questionCount + 1;

      let aiResponse = '';

      if (currentQuestionNum === 1) {
        // First question - ask about target audience or users
        aiResponse = "That sounds interesting! Tell me more - who is this for? Who would benefit most from this idea?";
      } else if (currentQuestionNum === 2) {
        // Second question - ask about core value or features
        aiResponse = "Great! And what's the main problem this solves for them? What would be the core offering or key feature?";
      } else if (currentQuestionNum === 3) {
        // Third question - ask about unique angle or delivery
        aiResponse = "I'm getting a clearer picture. What makes this different from existing solutions? Is there a unique angle or approach you're considering?";
      } else if (currentQuestionNum === 4) {
        // Fourth question - ask about constraints or monetization hints
        aiResponse = "Excellent! Last question - are there any specific constraints I should know about? Budget, timeline, or resources you're working with?";
        setQuestionCount(currentQuestionNum);

        // After answering, show the analyze button
        setTimeout(() => {
          const readyMessage = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: "Perfect! I have a good understanding of your idea now. Ready for me to analyze it and create your personalized insights?",
          };
          setMessages((prev) => [...prev, readyMessage]);
          setShowQuickReplies(true);
          setIsAIThinking(false);
        }, 1000);

        await addChatMessage(tempIdeaId, 'assistant', aiResponse);

        const aiMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiResponse,
        };
        setMessages((prev) => [...prev, aiMessage]);
        setIsAIThinking(false);
        return;
      }

      setQuestionCount(currentQuestionNum);

      // Save AI response
      await addChatMessage(tempIdeaId, 'assistant', aiResponse);

      // Add AI message to UI
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
      };
      setMessages((prev) => [...prev, aiMessage]);

    } catch (error) {
      console.error('Error getting AI response:', error);
      Alert.alert('Error', 'Failed to get AI response. Please try again.');
    } finally {
      setIsAIThinking(false);
    }
  };

  const generateIdeaTitle = (text) => {
    // Generate a title from the first message (max 50 chars)
    const words = text.split(' ').slice(0, 8).join(' ');
    return words.length > 50 ? words.substring(0, 47) + '...' : words;
  };

  const handleCategorySelection = (category) => {
    setSelectedCategory(category);
    setShowCategorySelection(false);

    // Add category selection as a user message
    const categoryMessage = {
      id: (Date.now()).toString(),
      role: 'user',
      content: category,
    };
    setMessages((prev) => [...prev, categoryMessage]);

    // AI confirms and asks next steps
    setTimeout(() => {
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Perfect! I've categorized this as a ${category}. Would you like me to analyze it?`,
      };
      setMessages((prev) => [...prev, aiMessage]);
      setShowQuickReplies(true);
    }, 800);
  };

  const handleQuickReply = async (reply) => {
    if (reply !== 'Summarize & analyze') return;

    setShowQuickReplies(false);
    setSaving(true);

    try {
      // AI responds "Getting started!"
      const gettingStartedMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Getting started! ✨',
      };
      setMessages((prev) => [...prev, gettingStartedMessage]);

      // Wait a moment for the message to appear
      await new Promise(resolve => setTimeout(resolve, 500));

      // Build full conversation transcript for AI analysis
      const conversationTranscript = messages
        .filter((msg) => msg.id !== '1') // Exclude initial greeting
        .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');

      // Try to detect category from conversation
      const conversationText = conversationTranscript.toLowerCase();
      let detectedCategory = selectedCategory || '';

      if (!detectedCategory) {
        // Simple keyword-based detection
        if (conversationText.includes('app') || conversationText.includes('mobile') || conversationText.includes('web app')) {
          detectedCategory = 'App';
        } else if (conversationText.includes('product') || conversationText.includes('physical') || conversationText.includes('device')) {
          detectedCategory = 'Product';
        } else if (conversationText.includes('service') || conversationText.includes('consulting') || conversationText.includes('coaching')) {
          detectedCategory = 'Service';
        } else if (conversationText.includes('software') || conversationText.includes('platform') || conversationText.includes('saas')) {
          detectedCategory = 'Software';
        } else {
          detectedCategory = 'General';
        }
      }

      // Update the idea with analyzing flag (use existing ideaId from conversation)
      const title = generateIdeaTitle(firstUserMessage);

      if (currentIdeaId) {
        // Update existing idea
        const { updateIdea } = require('../../services/firestore');
        await updateIdea(currentIdeaId, {
          title,
          tags: [detectedCategory],
          analyzing: true,
          analysisReviewed: false,
        });

        // Save the "Getting started!" message
        await addChatMessage(currentIdeaId, 'assistant', 'Getting started! ✨');

        // Navigate to dashboard
        navigation.reset({
          index: 0,
          routes: [{ name: 'DashboardHome' }],
        });

        // Generate AI cards with full conversation context
        generateIdeaCards(
          currentIdeaId,
          firstUserMessage,
          conversationTranscript,
          detectedCategory
        ).catch((error) => {
          console.error('Error generating cards:', error);
        });
      }
    } catch (error) {
      console.error('Error processing idea:', error);
      const errorMessage = error.message || 'Failed to process idea. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.aiMessageContainer,
        ]}
      >
        {!isUser && (
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.aiProfileIcon}
            resizeMode="contain"
          />
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.aiBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userText : styles.aiText,
            ]}
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <StatusBar barStyle="light-content" />

      {/* Background Logo */}
      <Image
        source={require('../../../assets/logo.png')}
        style={styles.backgroundLogo}
        resizeMode="contain"
      />

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {/* Category Selection */}
      {showCategorySelection && (
        <View style={styles.quickRepliesContainer}>
          {categories.map((category, index) => (
            <TouchableOpacity
              key={index}
              style={styles.categoryChip}
              onPress={() => handleCategorySelection(category)}
            >
              <Text style={styles.categoryText}>{category}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Quick Replies */}
      {showQuickReplies && (
        <View style={styles.quickRepliesContainer}>
          {saving ? (
            <View style={styles.savingContainer}>
              <ActivityIndicator size="small" color={Colors.accent1} />
              <Text style={styles.savingText}>Preparing analysis...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.quickReplyChip}
              onPress={() => handleQuickReply('Summarize & analyze')}
            >
              <Text style={styles.quickReplyText}>Summarize & analyze</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type your idea..."
          placeholderTextColor={Colors.textTertiary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={!isAIThinking}
        />
        <TouchableOpacity
          style={[styles.sendButton, isAIThinking && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isAIThinking}
        >
          {isAIThinking ? (
            <ActivityIndicator size="small" color={Colors.textPrimary} />
          ) : (
            <Text style={styles.sendButtonText}>→</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  aiProfileIcon: {
    width: 32,
    height: 32,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 16,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: Colors.userMessage,
  },
  aiBubble: {
    backgroundColor: Colors.aiMessage,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: Colors.textPrimary,
  },
  aiText: {
    color: Colors.textPrimary,
  },
  quickRepliesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  quickReplyChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.accent1,
  },
  quickReplyText: {
    color: Colors.accent1,
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChip: {
    backgroundColor: Colors.accent1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  savingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    color: Colors.textPrimary,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  backgroundLogo: {
    position: 'absolute',
    width: 450,
    height: 180,
    opacity: 0.22,
    top: '35%',
    left: '50%',
    marginLeft: -225,
    zIndex: 0,
  },
});
