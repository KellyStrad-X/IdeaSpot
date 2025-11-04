import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

export default function WorkspaceScreen({ navigation, route }) {
  const { ideaId } = route.params || {};
  const [idea, setIdea] = useState(null);
  const [expandedCard, setExpandedCard] = useState('summary');

  // Placeholder data - will be replaced with Firestore data
  useEffect(() => {
    // Fetch idea from Firestore using ideaId
    // For now, using placeholder data
    setIdea({
      id: ideaId,
      title: 'Pet Grooming Marketplace',
      tags: ['Business', 'Mobile', 'Marketplace'],
      date: 'Nov 4, 2025',
      cards: {
        summary: {
          problem: 'Pet owners struggle to find reliable, nearby groomers with available appointments.',
          audience: 'Urban pet owners aged 25-45 with disposable income who value convenience.',
          features: [
            'Location-based groomer search',
            'Real-time availability and booking',
            'Rating and review system',
            'In-app messaging and payments',
          ],
          valueProp: 'Book trusted pet grooming services in under 2 minutes.',
          realityCheck: [
            'Chicken-and-egg problem: Need groomers to attract customers.',
            'Trust barrier: People are protective of their pets.',
            'Low-frequency use: Most pet owners only groom 4-6 times per year.',
          ],
        },
        nextSteps: {
          steps: [
            {
              title: 'Interview 5 pet owners',
              details: ['Ask about their last grooming experience', 'What was frustrating?'],
              completed: false,
            },
            {
              title: 'Call 3 local grooming businesses',
              details: ['Would they use online booking?', 'What commission would they accept?'],
              completed: false,
            },
          ],
        },
        similarConcepts: {
          concepts: [
            {
              name: 'Rover',
              type: 'App',
              description: 'On-demand pet sitting and dog walking marketplace.',
              gap: "Doesn't specialize in grooming",
            },
          ],
          differentiation: "First mobile-first, grooming-specific marketplace with instant booking.",
        },
      },
    });
  }, [ideaId]);

  const toggleCard = (cardName) => {
    setExpandedCard(expandedCard === cardName ? null : cardName);
  };

  const renderSummaryCard = () => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => toggleCard('summary')}
      >
        <Text style={styles.cardTitle}>📝 Summary</Text>
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

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Regenerate</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderNextStepsCard = () => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => toggleCard('nextSteps')}
      >
        <Text style={styles.cardTitle}>✓ Next Steps</Text>
        <Text style={styles.expandIcon}>
          {expandedCard === 'nextSteps' ? '−' : '+'}
        </Text>
      </TouchableOpacity>

      {expandedCard === 'nextSteps' && idea?.cards?.nextSteps && (
        <View style={styles.cardContent}>
          <Text style={styles.stepsHeader}>Here's what to do in the next 48 hours:</Text>
          {idea.cards.nextSteps.steps.map((step, index) => (
            <View key={index} style={styles.stepItem}>
              <View style={styles.stepHeader}>
                <TouchableOpacity style={styles.checkbox}>
                  <Text style={styles.checkboxText}>
                    {step.completed ? '✓' : ''}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.stepTitle}>
                  {index + 1}. {step.title}
                </Text>
              </View>
              {step.details.map((detail, detailIndex) => (
                <Text key={detailIndex} style={styles.stepDetail}>
                  • {detail}
                </Text>
              ))}
            </View>
          ))}

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Regenerate</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderSimilarConceptsCard = () => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => toggleCard('similar')}
      >
        <Text style={styles.cardTitle}>🔍 Similar Concepts</Text>
        <Text style={styles.expandIcon}>
          {expandedCard === 'similar' ? '−' : '+'}
        </Text>
      </TouchableOpacity>

      {expandedCard === 'similar' && idea?.cards?.similarConcepts && (
        <View style={styles.cardContent}>
          {idea.cards.similarConcepts.concepts.map((concept, index) => (
            <View key={index} style={styles.conceptItem}>
              <Text style={styles.conceptName}>
                {concept.name} ({concept.type})
              </Text>
              <Text style={styles.conceptDescription}>{concept.description}</Text>
              <Text style={styles.conceptGap}>Gap: {concept.gap}</Text>
            </View>
          ))}

          <View style={styles.differentiationBox}>
            <Text style={styles.differentiationTitle}>What makes your idea different:</Text>
            <Text style={styles.differentiationText}>
              {idea.cards.similarConcepts.differentiation}
            </Text>
          </View>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Regenerate</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (!idea) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading idea...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.ideaTitle}>{idea.title}</Text>
          <View style={styles.metadata}>
            <View style={styles.tags}>
              {idea.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.date}>{idea.date}</Text>
          </View>
        </View>

        {/* Cards */}
        {renderSummaryCard()}
        {renderNextStepsCard()}
        {renderSimilarConceptsCard()}

        {/* Continue Chat Button */}
        <TouchableOpacity
          style={styles.continueChatButton}
          onPress={() => navigation.navigate('Chat', { ideaId: idea.id })}
        >
          <Text style={styles.continueChatText}>💬 Continue Chat</Text>
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
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ideaTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    marginBottom: Spacing.md,
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.xs,
  },
  tagText: {
    color: Colors.accent2,
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
  },
  date: {
    color: Colors.textTertiary,
    fontSize: Typography.sm,
  },
  card: {
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
  },
  expandIcon: {
    color: Colors.textSecondary,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
  },
  cardContent: {
    padding: Spacing.md,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.accent1,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.xs,
  },
  sectionText: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  bulletText: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    lineHeight: 22,
    marginBottom: Spacing.xs,
  },
  stepsHeader: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    marginBottom: Spacing.md,
  },
  stepItem: {
    marginBottom: Spacing.md,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.accent1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  checkboxText: {
    color: Colors.accent1,
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
  },
  stepTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    flex: 1,
  },
  stepDetail: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    lineHeight: 20,
    marginLeft: 36,
    marginBottom: Spacing.xs,
  },
  conceptItem: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  conceptName: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.xs,
  },
  conceptDescription: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  conceptGap: {
    color: Colors.accent2,
    fontSize: Typography.sm,
    fontStyle: 'italic',
  },
  differentiationBox: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  differentiationTitle: {
    color: Colors.accent1,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.xs,
  },
  differentiationText: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  actionButton: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent1,
  },
  actionButtonText: {
    color: Colors.accent1,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  continueChatButton: {
    margin: Spacing.md,
    backgroundColor: Colors.accent1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  continueChatText: {
    color: Colors.textPrimary,
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
  },
});
