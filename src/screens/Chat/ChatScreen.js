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
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

export default function ChatScreen({ navigation, route }) {
  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm here to help you capture and develop your idea. Tell me what you're thinking about.",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const flatListRef = useRef(null);

  const quickReplies = [
    'Summarize & analyze',
    'List next steps',
    'Show similar concepts',
    'Add to library',
  ];

  const handleSend = () => {
    if (inputText.trim() === '') return;

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');

    // Simulate AI response (will be replaced with actual OpenAI integration)
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

  const handleQuickReply = (reply) => {
    setShowQuickReplies(false);
    // Handle quick reply action
    // This will trigger card generation in the actual implementation
    console.log('Quick reply:', reply);
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
          {quickReplies.map((reply, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickReplyChip}
              onPress={() => handleQuickReply(reply)}
            >
              <Text style={styles.quickReplyText}>{reply}</Text>
            </TouchableOpacity>
          ))}
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
    padding: Spacing.md,
  },
  messageContainer: {
    marginBottom: Spacing.md,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  userBubble: {
    backgroundColor: Colors.userMessage,
  },
  aiBubble: {
    backgroundColor: Colors.aiMessage,
  },
  messageText: {
    fontSize: Typography.base,
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  quickReplyChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accent1,
  },
  quickReplyText: {
    color: Colors.accent1,
    fontSize: Typography.sm,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    maxHeight: 100,
    marginRight: Spacing.sm,
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
    fontSize: Typography.xl,
    fontWeight: '700',
  },
});
