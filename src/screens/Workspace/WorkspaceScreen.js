import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { getIdea } from '../../services/firestore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const NOTE_CATEGORIES = [
  { id: 'feature', label: 'Feature Idea', color: '#4A9EFF' },
  { id: 'risk', label: 'Risk/Concern', color: '#FF6B6B' },
  { id: 'question', label: 'Question', color: '#FFD93D' },
  { id: 'insight', label: 'Insight', color: '#6BCF7F' },
  { id: 'todo', label: 'To-Do', color: '#A78BFA' },
];

export default function WorkspaceScreen({ navigation, route }) {
  const { ideaId } = route.params || {};
  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const [elevatorPitch, setElevatorPitch] = useState('');
  const [notesVisible, setNotesVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Notes canvas state
  const [notes, setNotes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentNote, setCurrentNote] = useState(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState('feature');
  const [noteContent, setNoteContent] = useState('');
  const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });

  // Fetch idea from Firestore
  useEffect(() => {
    if (!ideaId) {
      Alert.alert('Error', 'No idea ID provided');
      navigation.goBack();
      return;
    }

    const loadIdea = async () => {
      try {
        const ideaData = await getIdea(ideaId);
        if (ideaData) {
          setIdea(ideaData);
          // Populate branding fields if they exist
          if (ideaData.cards?.conceptBranding) {
            setBusinessName(ideaData.cards.conceptBranding.name || '');
            setElevatorPitch(ideaData.cards.conceptBranding.elevatorPitch || '');
          }
        } else {
          Alert.alert('Error', 'Idea not found');
          navigation.goBack();
        }
      } catch (error) {
        console.error('Error loading idea:', error);
        Alert.alert('Error', 'Failed to load idea');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadIdea();
  }, [ideaId]);

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const toggleCard = (cardName) => {
    setExpandedCard(expandedCard === cardName ? null : cardName);
  };

  const toggleNotes = () => {
    const toValue = notesVisible ? 0 : -SCREEN_WIDTH;
    setNotesVisible(!notesVisible);
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  };

  const handleCanvasTap = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    setTapPosition({ x: locationX, y: locationY });
    setCurrentNote(null);
    setNoteTitle('');
    setNoteCategory('feature');
    setNoteContent('');
    setModalVisible(true);
  };

  const handleSaveNote = () => {
    if (!noteTitle.trim()) {
      Alert.alert('Error', 'Please enter a note title');
      return;
    }

    const newNote = {
      id: currentNote?.id || Date.now().toString(),
      title: noteTitle,
      category: noteCategory,
      content: noteContent,
      position: currentNote?.position || tapPosition,
    };

    if (currentNote) {
      // Edit existing note
      setNotes(notes.map(n => n.id === currentNote.id ? newNote : n));
    } else {
      // Add new note
      setNotes([...notes, newNote]);
    }

    setModalVisible(false);
    setNoteTitle('');
    setNoteCategory('feature');
    setNoteContent('');
    setCurrentNote(null);
  };

  const handleEditNote = (note) => {
    setCurrentNote(note);
    setNoteTitle(note.title);
    setNoteCategory(note.category);
    setNoteContent(note.content);
    setModalVisible(true);
  };

  const renderSummaryCard = () => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => toggleCard('summary')}
      >
        <Text style={styles.cardTitle}>Summary</Text>
        <Text style={styles.expandIcon}>
          {expandedCard === 'summary' ? '−' : '+'}
        </Text>
      </TouchableOpacity>

      {expandedCard === 'summary' && idea?.cards?.summary && (
        <View style={styles.cardContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Problem</Text>
            <Text style={styles.sectionText}>{idea.cards.summary.problem}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Target Audience</Text>
            <Text style={styles.sectionText}>{idea.cards.summary.audience}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Core Features</Text>
            {idea.cards.summary.features.map((feature, index) => (
              <Text key={index} style={styles.bulletText}>
                • {feature}
              </Text>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Value Proposition</Text>
            <Text style={styles.sectionText}>{idea.cards.summary.valueProp}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reality Check</Text>
            {idea.cards.summary.realityCheck.map((check, index) => (
              <Text key={index} style={styles.bulletText}>
                • {check}
              </Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderActionableInsightsCard = () => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => toggleCard('actionableInsights')}
      >
        <Text style={styles.cardTitle}>Actionable Insights</Text>
        <Text style={styles.expandIcon}>
          {expandedCard === 'actionableInsights' ? '−' : '+'}
        </Text>
      </TouchableOpacity>

      {expandedCard === 'actionableInsights' && idea?.cards?.actionableInsights && (
        <View style={styles.cardContent}>
          <Text style={styles.stepsHeader}>Strategic advice to develop your idea:</Text>
          {idea.cards.actionableInsights.insights.map((insight, index) => (
            <View key={index} style={styles.section}>
              <View style={styles.insightHeader}>
                <Text style={styles.sectionTitle}>{insight.title}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{insight.category}</Text>
                </View>
              </View>
              <Text style={styles.sectionText}>{insight.advice}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderUserScenariosCard = () => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => toggleCard('userScenarios')}
      >
        <Text style={styles.cardTitle}>User Scenarios</Text>
        <Text style={styles.expandIcon}>
          {expandedCard === 'userScenarios' ? '−' : '+'}
        </Text>
      </TouchableOpacity>

      {expandedCard === 'userScenarios' && (
        <View style={styles.cardContent}>
          {idea?.cards?.userScenarios ? (
            <>
              {idea.cards.userScenarios.scenarios.map((scenario, index) => (
                <View key={index} style={styles.scenarioItem}>
                  <Text style={styles.personaText}>{scenario.persona}</Text>
                  <View style={styles.scenarioSection}>
                    <Text style={styles.scenarioLabel}>Context:</Text>
                    <Text style={styles.sectionText}>{scenario.context}</Text>
                  </View>
                  <View style={styles.scenarioSection}>
                    <Text style={styles.scenarioLabel}>Journey:</Text>
                    <Text style={styles.sectionText}>{scenario.journey}</Text>
                  </View>
                  <View style={styles.scenarioSection}>
                    <Text style={styles.scenarioLabel}>Outcome:</Text>
                    <Text style={styles.outcomeText}>{scenario.outcome}</Text>
                  </View>
                  {index < idea.cards.userScenarios.scenarios.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </View>
              ))}
            </>
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>User scenarios will be generated by AI</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderMonetizationCard = () => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => toggleCard('monetization')}
      >
        <Text style={styles.cardTitle}>Monetization</Text>
        <Text style={styles.expandIcon}>
          {expandedCard === 'monetization' ? '−' : '+'}
        </Text>
      </TouchableOpacity>

      {expandedCard === 'monetization' && (
        <View style={styles.cardContent}>
          {idea?.cards?.monetization ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Primary Revenue Model</Text>
                <Text style={styles.monetizationModel}>{idea.cards.monetization.primaryModel}</Text>
                <Text style={styles.sectionText}>{idea.cards.monetization.modelRationale}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pricing Tiers</Text>
                {idea.cards.monetization.pricingTiers.map((tier, index) => (
                  <View key={index} style={styles.pricingTier}>
                    <View style={styles.tierHeader}>
                      <Text style={styles.tierName}>{tier.name}</Text>
                      <Text style={styles.tierPrice}>{tier.price}</Text>
                    </View>
                    {tier.features.map((feature, fIndex) => (
                      <Text key={fIndex} style={styles.tierFeature}>
                        • {feature}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>

              {idea.cards.monetization.alternativeModels && idea.cards.monetization.alternativeModels.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Alternative Approaches</Text>
                  {idea.cards.monetization.alternativeModels.map((alt, index) => (
                    <View key={index} style={styles.alternativeModel}>
                      <Text style={styles.altModelName}>{alt.name}</Text>
                      <Text style={styles.sectionText}>{alt.description}</Text>
                    </View>
                  ))}
                </View>
              )}

              {idea.cards.monetization.projections && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Revenue Projections</Text>
                  <Text style={styles.projectionText}>100 users: {idea.cards.monetization.projections.users100}</Text>
                  <Text style={styles.projectionText}>500 users: {idea.cards.monetization.projections.users500}</Text>
                  <Text style={styles.projectionText}>1000 users: {idea.cards.monetization.projections.users1000}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>Monetization strategy will be generated by AI</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderConceptBrandingSection = () => (
    <View style={styles.brandingSection}>
      <Text style={styles.brandingSectionTitle}>Concept Branding</Text>

      {/* Business Name Field with Regen Button */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Business Name</Text>
        <View style={styles.inputWithButton}>
          <TextInput
            style={styles.businessNameInput}
            placeholder="Enter business name..."
            placeholderTextColor={Colors.textTertiary}
            value={businessName}
            onChangeText={setBusinessName}
          />
          <TouchableOpacity style={styles.regenIconButton}>
            <Text style={styles.regenIconText}>↻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Elevator Pitch Field */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Elevator Pitch</Text>
        <TextInput
          style={styles.elevatorPitchInput}
          placeholder="Enter elevator pitch..."
          placeholderTextColor={Colors.textTertiary}
          value={elevatorPitch}
          onChangeText={setElevatorPitch}
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
        />
      </View>

      {!businessName && !elevatorPitch && (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>
            Branding concepts will be generated by AI and can be edited
          </Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent1} />
        <Text style={styles.loadingText}>Loading idea...</Text>
      </View>
    );
  }

  if (!idea) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Idea not found</Text>
      </View>
    );
  }

  const hasCards = idea.cards && (
    idea.cards.summary ||
    idea.cards.actionableInsights ||
    idea.cards.userScenarios ||
    idea.cards.monetization ||
    idea.cards.conceptBranding
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.ideaTitle}>{idea.title}</Text>
          <View style={styles.metadata}>
            <View style={styles.tagsRow}>
              <View style={styles.tags}>
                {idea.tags && idea.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
              {idea.cards?.conceptBranding?.name && (
                <Text style={styles.businessName}>{idea.cards.conceptBranding.name}</Text>
              )}
            </View>
            <Text style={styles.date}>{formatDate(idea.createdAt)}</Text>
          </View>
        </View>

        {/* Cards - Always show, with placeholders if no data */}
        {renderSummaryCard()}
        {renderActionableInsightsCard()}
        {renderUserScenariosCard()}
        {renderMonetizationCard()}

        {/* Concept Branding - Always visible, not collapsible */}
        {renderConceptBrandingSection()}

        {/* Show empty state only if no cards at all */}
        {!hasCards && (
          <View style={styles.emptyCardsContainer}>
            <Text style={styles.emptyCardsTitle}>No AI Analysis Yet</Text>
            <Text style={styles.emptyCardsText}>
              AI-powered card generation will be available once Cloud Functions are set up.
            </Text>
            <Text style={styles.emptyCardsText} style={{ marginTop: 16 }}>
              Your idea: {idea.originalInput}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.continueChatButton}
            onPress={() => navigation.navigate('Chat', { ideaId: idea.id })}
          >
            <Text style={styles.continueChatText}>Continue Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.notesButton}
            onPress={toggleNotes}
          >
            <Ionicons name="document-text" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Notes Canvas Panel */}
      <Animated.View
        style={[
          styles.notesPanel,
          {
            transform: [{ translateX: slideAnim }],
          }
        ]}
      >
        {/* Canvas with stippled grid */}
        <Pressable
          style={styles.notesCanvas}
          onPress={handleCanvasTap}
        >
          <View style={styles.gridBackground}>
            {/* Stippled grid pattern */}
            {Array.from({ length: 40 }).map((_, row) =>
              Array.from({ length: 20 }).map((_, col) => (
                <View
                  key={`dot-${row}-${col}`}
                  style={[
                    styles.gridDot,
                    { top: row * 40, left: col * 40 }
                  ]}
                />
              ))
            )}
          </View>

          {/* Render notes */}
          {notes.map(note => {
            const category = NOTE_CATEGORIES.find(c => c.id === note.category);
            return (
              <Pressable
                key={note.id}
                style={[
                  styles.noteCard,
                  {
                    left: note.position.x,
                    top: note.position.y,
                    borderLeftColor: category?.color || Colors.accent1,
                  }
                ]}
                onPress={() => handleEditNote(note)}
              >
                <View style={[styles.categoryBadge, { backgroundColor: category?.color }]}>
                  <Text style={styles.categoryBadgeText}>{category?.label}</Text>
                </View>
                <Text style={styles.noteCardTitle}>{note.title}</Text>
                {note.content ? (
                  <Text style={styles.noteCardContent} numberOfLines={3}>
                    {note.content}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}

          {/* Floating Close Button */}
          <TouchableOpacity
            style={styles.floatingCloseButton}
            onPress={toggleNotes}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Floating Action Buttons Container */}
          <View style={styles.floatingActionsContainer}>
            {/* Import Button (Placeholder) */}
            <TouchableOpacity
              style={styles.floatingImportButton}
              onPress={(e) => {
                e.stopPropagation();
                Alert.alert('Import', 'Import functionality coming soon!');
              }}
            >
              <Ionicons name="cloud-upload-outline" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>

            {/* New Note Button */}
            <TouchableOpacity
              style={styles.floatingNewNoteButton}
              onPress={(e) => {
                e.stopPropagation();
                setTapPosition({ x: SCREEN_WIDTH / 2 - 100, y: 200 });
                setCurrentNote(null);
                setNoteTitle('');
                setNoteCategory('feature');
                setNoteContent('');
                setModalVisible(true);
              }}
            >
              <Ionicons name="add" size={32} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Animated.View>

      {/* Add/Edit Note Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {currentNote ? 'Edit Note' : 'New Note'}
              </Text>

              {/* Title Input */}
              <TextInput
                style={styles.modalInput}
                placeholder="Note title..."
                placeholderTextColor={Colors.textTertiary}
                value={noteTitle}
                onChangeText={setNoteTitle}
              />

              {/* Category Selector */}
              <Text style={styles.modalLabel}>Category</Text>
              <View style={styles.categorySelector}>
                {NOTE_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryOption,
                      { backgroundColor: cat.color },
                      noteCategory === cat.id && styles.categoryOptionSelected,
                    ]}
                    onPress={() => setNoteCategory(cat.id)}
                  >
                    <Text style={styles.categoryOptionText}>{cat.label}</Text>
                    {noteCategory === cat.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Content Input */}
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Note content (optional)..."
                placeholderTextColor={Colors.textTertiary}
                value={noteContent}
                onChangeText={setNoteContent}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSaveButton]}
                  onPress={handleSaveNote}
                >
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 16,
    marginTop: 16,
  },
  emptyCardsContainer: {
    margin: 16,
    padding: 24,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyCardsTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyCardsText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ideaTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  tags: {
    flexDirection: 'row',
  },
  tag: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 4,
  },
  tagText: {
    color: Colors.accent2,
    fontSize: 12,
    fontWeight: '500',
  },
  businessName: {
    color: Colors.accent4,
    fontSize: 17,
    fontWeight: '600',
    fontStyle: 'italic',
    marginLeft: 4,
  },
  date: {
    color: Colors.textTertiary,
    fontSize: 14,
  },
  card: {
    margin: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  expandIcon: {
    color: Colors.textSecondary,
    fontSize: 20,
    fontWeight: '700',
  },
  cardContent: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionText: {
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
  },
  bulletText: {
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
  },
  stepsHeader: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  stepItem: {
    marginBottom: 16,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.accent1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxText: {
    color: Colors.accent1,
    fontSize: 14,
    fontWeight: '700',
  },
  stepTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  stepDetail: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 36,
    marginBottom: 4,
  },
  placeholderContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: Colors.textTertiary,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  inputWithButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  businessNameInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 10,
    color: Colors.textPrimary,
    fontSize: 14,
    minHeight: 40,
  },
  regenIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.accent1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  regenIconText: {
    color: Colors.accent1,
    fontSize: 20,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 16,
    minHeight: 48,
  },
  brandingSection: {
    margin: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
  },
  brandingSectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  elevatorPitchInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 16,
    minHeight: 130,
  },
  actionButton: {
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.accent1,
  },
  actionButtonText: {
    color: Colors.accent1,
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    margin: 16,
    gap: 12,
  },
  continueChatButton: {
    flex: 1,
    backgroundColor: Colors.accent1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  continueChatText: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  notesButton: {
    width: 56,
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.accent1,
  },
  notesPanel: {
    position: 'absolute',
    top: 0,
    left: SCREEN_WIDTH,
    width: SCREEN_WIDTH,
    height: '100%',
    backgroundColor: Colors.background,
    zIndex: 1000,
  },
  notesCanvas: {
    flex: 1,
    backgroundColor: Colors.background,
    position: 'relative',
  },
  floatingCloseButton: {
    position: 'absolute',
    top: StatusBar.currentHeight + 16 || 56,
    left: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 10,
  },
  floatingActionsContainer: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  floatingImportButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4EC9E6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  floatingNewNoteButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  gridBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0a',
  },
  gridDot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.textTertiary,
    opacity: 0.3,
  },
  noteCard: {
    position: 'absolute',
    width: 200,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  noteCardTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  noteCardContent: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  modalLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 16,
    marginBottom: 12,
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categorySelector: {
    marginBottom: 12,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryOptionSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  categoryOptionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalSaveButton: {
    backgroundColor: Colors.accent1,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  // Actionable Insights styles
  insightHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: Colors.accent2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  categoryText: {
    color: Colors.background,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  // User Scenarios styles
  scenarioItem: {
    marginBottom: 24,
  },
  personaText: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  scenarioSection: {
    marginBottom: 8,
  },
  scenarioLabel: {
    color: Colors.accent2,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  outcomeText: {
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 16,
  },
  // Monetization styles
  monetizationModel: {
    color: Colors.accent1,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
  pricingTier: {
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  tierPrice: {
    color: Colors.accent1,
    fontSize: 16,
    fontWeight: '700',
  },
  tierFeature: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 8,
  },
  alternativeModel: {
    marginBottom: 12,
  },
  altModelName: {
    color: Colors.accent2,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  projectionText: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '500',
  },
});
