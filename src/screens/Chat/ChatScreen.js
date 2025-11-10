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
  Animated,
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
  const [ideaContext, setIdeaContext] = useState(null);
  const [isContinuation, setIsContinuation] = useState(false);
  const flatListRef = useRef(null);
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  const categories = ['App', 'Product', 'Service', 'Software'];
  const maxQuestions = 4; // AI will ask 3-4 qualifying questions

  // Load idea context if this is a continuation
  useEffect(() => {
    const loadIdeaContext = async () => {
      if (ideaId) {
        try {
          const ideaData = await getIdea(ideaId);
          if (ideaData && ideaData.cards && !ideaData.analyzing) {
            // This is a continuation - idea has been analyzed
            setIsContinuation(true);
            setIdeaContext({
              title: ideaData.title,
              category: ideaData.tags?.[0] || 'General',
              summary: ideaData.cards.summary,
            });
            // Change greeting for continuation
            setMessages([
              {
                id: '1',
                role: 'assistant',
                content: `Welcome back! Let's continue exploring your idea. What would you like to discuss?`,
              },
            ]);
          }
        } catch (error) {
          console.error('Error loading idea context:', error);
        }
      }
    };

    loadIdeaContext();
  }, [ideaId]);

  // Load chat history based on mode
  useEffect(() => {
    if (!currentIdeaId) return;

    if (isContinuation) {
      // For continuation: subscribe to NEW continuation messages only
      // Use a separate subcollection or filter by timestamp after analysis
      const unsubscribe = subscribeToChatHistory(currentIdeaId, (chatMessages) => {
        // Filter to only messages marked as continuation (we'll add this flag when saving)
        const continuationMessages = chatMessages.filter(msg => msg.isContinuation);

        if (continuationMessages.length > 0) {
          setMessages((prevMessages) => {
            const greeting = prevMessages[0];
            const historyMessages = continuationMessages.map((msg, index) => ({
              id: `cont-${index}-${msg.content.substring(0, 10)}`,
              role: msg.role,
              content: msg.content,
            }));

            return [greeting, ...historyMessages];
          });
        }
      });

      return () => unsubscribe();
    } else {
      // For initial intake: load intake messages
      const unsubscribe = subscribeToChatHistory(currentIdeaId, (chatMessages) => {
        setMessages((prevMessages) => {
          const greeting = prevMessages[0];

          const historyMessages = chatMessages.map((msg, index) => ({
            id: `history-${index}-${msg.content.substring(0, 10)}`,
            role: msg.role,
            content: msg.content,
          }));

          const allMessages = [greeting, ...historyMessages];
          const uniqueMessages = allMessages.filter((msg, index, self) =>
            index === 0 ||
            self.findIndex(m => m.content === msg.content && m.role === msg.role) === index
          );

          return uniqueMessages;
        });

        const assistantMessages = chatMessages.filter(msg => msg.role === 'assistant');
        setQuestionCount(assistantMessages.length);
      });

      return () => unsubscribe();
    }
  }, [currentIdeaId, isContinuation]);

  // Auto-scroll when messages change or AI is thinking
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isAIThinking]);

  // Bouncing dots animation
  useEffect(() => {
    if (isAIThinking) {
      const bounce = (anim, delay) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: -8,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const dot1Animation = bounce(dot1Anim, 0);
      const dot2Animation = bounce(dot2Anim, 150);
      const dot3Animation = bounce(dot3Anim, 300);

      dot1Animation.start();
      dot2Animation.start();
      dot3Animation.start();

      return () => {
        dot1Animation.stop();
        dot2Animation.stop();
        dot3Animation.stop();
        dot1Anim.setValue(0);
        dot2Anim.setValue(0);
        dot3Anim.setValue(0);
      };
    }
  }, [isAIThinking]);

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

      // Save user message to Firestore (mark as continuation if applicable)
      await addChatMessage(tempIdeaId, 'user', userMessageContent, isContinuation);

      // Get chat history (excluding the initial greeting)
      const chatHistory = messages.slice(1).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Call AI via Cloud Function with continuation context
      const aiResponse = await continueChat(
        tempIdeaId,
        chatHistory,
        userMessageContent,
        isContinuation,
        ideaContext
      );

      // Save AI response to Firestore (mark as continuation if applicable)
      await addChatMessage(tempIdeaId, 'assistant', aiResponse, isContinuation);

      // Increment question count
      const newQuestionCount = questionCount + 1;
      setQuestionCount(newQuestionCount);

      // Check if AI is ready to analyze (after 3-4 questions)
      if (newQuestionCount >= maxQuestions - 1 &&
          (aiResponse.toLowerCase().includes('ready') ||
           aiResponse.toLowerCase().includes('analyze') ||
           aiResponse.toLowerCase().includes('insights'))) {
        setShowQuickReplies(true);
      }

    } catch (error) {
      console.error('Error getting AI response:', error);
      Alert.alert('Error', 'Failed to get AI response. Please try again.');

      // Remove the user message from UI on error
      setMessages((prev) => prev.filter(msg => msg.id !== userMessage.id));
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

  const renderTypingIndicator = () => {
    if (!isAIThinking) return null;

    return (
      <View style={styles.typingIndicatorContainer}>
        <Image
          source={require('../../../assets/logo.png')}
          style={styles.aiProfileIcon}
          resizeMode="contain"
        />
        <View style={styles.typingBubble}>
          <View style={styles.typingDots}>
            <Animated.View
              style={[
                styles.typingDot,
                styles.typingDot1,
                { transform: [{ translateY: dot1Anim }] },
              ]}
            />
            <Animated.View
              style={[
                styles.typingDot,
                styles.typingDot2,
                { transform: [{ translateY: dot2Anim }] },
              ]}
            />
            <Animated.View
              style={[
                styles.typingDot,
                styles.typingDot3,
                { transform: [{ translateY: dot3Anim }] },
              ]}
            />
          </View>
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
        onLayout={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
        ListFooterComponent={renderTypingIndicator}
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
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    marginTop: 8,
  },
  typingBubble: {
    backgroundColor: Colors.aiMessage,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    maxWidth: '80%',
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.7,
  },
  typingDot3: {
    opacity: 1,
  },
});
