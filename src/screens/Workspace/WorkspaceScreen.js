import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Colors } from '../../constants/colors';
import { getIdea } from '../../services/firestore';

export default function WorkspaceScreen({ navigation, route }) {
  const { ideaId } = route.params || {};
  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const [elevatorPitch, setElevatorPitch] = useState('');

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
          numberOfLines={4}
          textAlignVertical="top"
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.ideaTitle}>{idea.title}</Text>
          <View style={styles.metadata}>
            <View style={styles.tags}>
              {idea.tags && idea.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
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

        {/* Continue Chat Button */}
        <TouchableOpacity
          style={styles.continueChatButton}
          onPress={() => navigation.navigate('Chat', { ideaId: idea.id })}
        >
          <Text style={styles.continueChatText}>Continue Chat</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
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
    minHeight: 100,
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
  continueChatButton: {
    margin: 16,
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
