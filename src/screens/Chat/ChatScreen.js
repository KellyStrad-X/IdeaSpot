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
import { generateIdeaCards } from '../../services/openai';

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
  const [currentIdeaId, setCurrentIdeaId] = useState(ideaId);
  const [firstUserMessage, setFirstUserMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const flatListRef = useRef(null);

  const quickReplies = [
    'Summarize & analyze',
    'List next steps',
    'Show similar concepts',
    'Save to library',
  ];

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
    if (inputText.trim() === '') return;

    const userMessageContent = inputText.trim();

    // Add user message to UI immediately
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');

    // Store first user message for creating idea title
    if (!firstUserMessage) {
      setFirstUserMessage(userMessageContent);
    }

    // Save message to Firestore if we have an ideaId
    if (currentIdeaId) {
      try {
        await addChatMessage(currentIdeaId, 'user', userMessageContent);
      } catch (error) {
        console.error('Error saving message:', error);
      }
    }

    // Simulate AI response (will be replaced with actual OpenAI integration via Cloud Functions)
    setTimeout(() => {
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          'Got it — sounds like an interesting idea! Would you like me to summarize and analyze this concept?',
      };
      setMessages((prev) => [...prev, aiMessage]);
      setShowQuickReplies(true);
    }, 1000);
  };

  const generateIdeaTitle = (text) => {
    // Generate a title from the first message (max 50 chars)
    const words = text.split(' ').slice(0, 8).join(' ');
    return words.length > 50 ? words.substring(0, 47) + '...' : words;
  };

  const handleQuickReply = async (reply) => {
    setShowQuickReplies(false);
    setSaving(true);

    try {
      if (reply === 'Summarize & analyze') {
        // Create the idea in Firestore first
        const title = generateIdeaTitle(firstUserMessage);
        const newIdeaId = await createIdea(user.uid, {
          title,
          originalInput: firstUserMessage,
          tags: ['Uncategorized'], // Will be updated by AI
          status: 'active',
        });

        // Save chat messages to the idea
        const chatMessages = messages.filter((msg) => msg.id !== '1'); // Exclude initial greeting
        for (const msg of chatMessages) {
          await addChatMessage(newIdeaId, msg.role, msg.content);
        }

        // Generate AI cards via Cloud Function
        const result = await generateIdeaCards(newIdeaId, firstUserMessage);

        Alert.alert(
          'Success',
          'Your idea has been analyzed and saved!',
          [
            {
              text: 'View Analysis',
              onPress: () => navigation.replace('Workspace', { ideaId: newIdeaId }),
            },
            {
              text: 'Go to Dashboard',
              onPress: () => navigation.navigate('DashboardHome'),
            },
          ]
        );
      } else if (reply === 'Save to library') {
        // Simple save without AI analysis
        const title = generateIdeaTitle(firstUserMessage);
        const newIdeaId = await createIdea(user.uid, {
          title,
          originalInput: firstUserMessage,
          tags: ['Uncategorized'],
          status: 'active',
        });

        // Save chat messages to the idea
        const chatMessages = messages.filter((msg) => msg.id !== '1');
        for (const msg of chatMessages) {
          await addChatMessage(newIdeaId, msg.role, msg.content);
        }

        Alert.alert(
          'Success',
          'Your idea has been saved to the library!',
          [
            {
              text: 'View Idea',
              onPress: () => navigation.replace('Workspace', { ideaId: newIdeaId }),
            },
            {
              text: 'Go to Dashboard',
              onPress: () => navigation.navigate('DashboardHome'),
            },
          ]
        );
      } else {
        // Other quick replies (List next steps, Show similar concepts)
        Alert.alert(
          'Coming Soon',
          'This feature will generate specific cards. For now, use "Summarize & analyze" to generate all cards at once.',
          [{ text: 'OK' }]
        );
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

      {/* Quick Replies */}
      {showQuickReplies && (
        <View style={styles.quickRepliesContainer}>
          {saving ? (
            <View style={styles.savingContainer}>
              <ActivityIndicator size="small" color={Colors.accent1} />
              <Text style={styles.savingText}>Saving...</Text>
            </View>
          ) : (
            quickReplies.map((reply, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickReplyChip}
                onPress={() => handleQuickReply(reply)}
              >
                <Text style={styles.quickReplyText}>{reply}</Text>
              </TouchableOpacity>
            ))
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
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>→</Text>
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
  sendButtonText: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  backgroundLogo: {
    position: 'absolute',
    width: 300,
    height: 120,
    opacity: 0.22,
    top: '35%',
    left: '50%',
    marginLeft: -150,
    zIndex: 0,
  },
});
