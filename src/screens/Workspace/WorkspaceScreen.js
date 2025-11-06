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
  PanResponder,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { getIdea, updateIdea } from '../../services/firestore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DOUBLE_TAP_DELAY = 220;
const DRAG_ACTIVATION_THRESHOLD = 8;
const NOTE_CARD_WIDTH = 200;
const NOTE_CARD_MIN_HEIGHT = 140;
const MIN_CANVAS_SCALE = 0.7;
const MAX_CANVAS_SCALE = 2.2;
const GRID_PATTERN_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAdElEQVR4nO3XIQ6AQAwF0YLcw67nBPi9MKg1CEiYn4CYcTXNS6q6tNaO+nHr14CnBNIE0gTSBNIE0gTSBNIE0uLA3vuW3BcFTlwSGQNeUSlkDDjG2O/mt0VPPFEpXFXV4tsJE0gTSBNIE0gTSBNIE0j7PfAEl50UTI4W3MEAAAAASUVORK5CYII=';

const NOTE_CATEGORIES = [
  { id: 'feature', label: 'Feature', color: '#4A9EFF' },
  { id: 'question', label: 'Question', color: '#FFD93D' },
  { id: 'todo', label: 'To-Do', color: '#A78BFA' },
];

// Memoized NoteCard component to prevent unnecessary re-renders
const NoteCard = React.memo(({ note, category, panResponder, pan, isDragging }) => {
  const animatedTransform = [];
  if (isDragging && pan) {
    animatedTransform.push({ translateX: pan.x }, { translateY: pan.y });
  }
  if (isDragging) {
    animatedTransform.push({ scale: 1.1 });
  }

  return (
    <Animated.View
      key={note.id}
      {...panResponder.panHandlers}
      style={[
        styles.noteCard,
        {
          left: note.position.x,
          top: note.position.y,
          borderLeftColor: category?.color || Colors.accent1,
          transform: animatedTransform,
          zIndex: isDragging ? 1000 : 1,
          opacity: isDragging ? 0.9 : 1,
        }
      ]}
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
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these props actually changed
  return (
    prevProps.note.id === nextProps.note.id &&
    prevProps.note.position.x === nextProps.note.position.x &&
    prevProps.note.position.y === nextProps.note.position.y &&
    prevProps.note.title === nextProps.note.title &&
    prevProps.note.content === nextProps.note.content &&
    prevProps.isDragging === nextProps.isDragging
  );
});

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
  const [draggingNoteId, setDraggingNoteId] = useState(null);
  const notePanValues = useRef({}).current;
  const notePanResponders = useRef({}).current;
  const justFinishedDrag = useRef(false);
  const canvasBaseOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const canvasPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const canvasScale = useRef(new Animated.Value(1)).current;
  const canvasOffsetRef = useRef({ x: 0, y: 0 });
  const canvasScaleRef = useRef(1);
  const viewportSizeRef = useRef({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
  const pinchGestureRef = useRef(null);

  const updateCanvasOffset = (offsetX, offsetY) => {
    canvasPan.setValue({
      x: offsetX - canvasOffsetRef.current.x,
      y: offsetY - canvasOffsetRef.current.y,
    });
    if (pinchGestureRef.current) {
      pinchGestureRef.current.currentOffset = { x: offsetX, y: offsetY };
    }
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const getDistance = (touch1, touch2) => {
    const dx = touch1.pageX - touch2.pageX;
    const dy = touch1.pageY - touch2.pageY;
    return Math.sqrt((dx * dx) + (dy * dy));
  };

  const getCenter = (touches) => {
    const touch1 = touches[0];
    const touch2 = touches[1];
    return {
      x: (touch1.pageX + touch2.pageX) / 2,
      y: (touch1.pageY + touch2.pageY) / 2,
    };
  };

  const canvasPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length >= 2,
    onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length >= 2,
    onPanResponderGrant: (evt) => {
      if (evt.nativeEvent.touches.length < 2) {
        return;
      }

      const touches = evt.nativeEvent.touches;
      const distance = getDistance(touches[0], touches[1]);
      if (distance <= 0) {
        return;
      }

      const center = getCenter(touches);
      const currentScale = canvasScaleRef.current;
      const worldPoint = {
        x: (center.x - canvasOffsetRef.current.x) / currentScale,
        y: (center.y - canvasOffsetRef.current.y) / currentScale,
      };

      pinchGestureRef.current = {
        mode: 'pinch',
        initialDistance: distance,
        initialScale: currentScale,
        worldPoint,
        currentScale,
        currentOffset: { ...canvasOffsetRef.current },
        lastCenter: center,
      };

      canvasPan.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: (evt) => {
      const touches = evt.nativeEvent.touches;

      if (touches.length >= 2) {
        const [touch1, touch2] = touches;
        const distance = getDistance(touch1, touch2);
        if (distance <= 0) {
          return;
        }

        const center = getCenter(touches);
        const currentScale = canvasScaleRef.current;
        const effectiveOffset =
          (pinchGestureRef.current && pinchGestureRef.current.currentOffset) ||
          canvasOffsetRef.current;
        const worldPoint = {
          x: (center.x - effectiveOffset.x) / currentScale,
          y: (center.y - effectiveOffset.y) / currentScale,
        };

        if (!pinchGestureRef.current) {
          pinchGestureRef.current = {
            mode: 'pinch',
            initialDistance: distance,
            initialScale: currentScale,
            worldPoint,
            currentScale,
            currentOffset: { ...canvasOffsetRef.current },
            lastCenter: center,
          };
          canvasPan.setValue({ x: 0, y: 0 });
        } else if (pinchGestureRef.current.mode !== 'pinch') {
          pinchGestureRef.current.mode = 'pinch';
          pinchGestureRef.current.initialDistance = distance;
          pinchGestureRef.current.initialScale = currentScale;
          pinchGestureRef.current.worldPoint = worldPoint;
        }

        if (!pinchGestureRef.current || pinchGestureRef.current.initialDistance <= 0) {
          return;
        }

        const initialScale = pinchGestureRef.current.initialScale;
        let nextScale = initialScale * (distance / pinchGestureRef.current.initialDistance);
        nextScale = clamp(nextScale, MIN_CANVAS_SCALE, MAX_CANVAS_SCALE);

        const offsetX = center.x - nextScale * worldPoint.x;
        const offsetY = center.y - nextScale * worldPoint.y;

        canvasScale.setValue(nextScale);
        canvasScaleRef.current = nextScale;
        updateCanvasOffset(offsetX, offsetY);

        pinchGestureRef.current.currentScale = nextScale;
        pinchGestureRef.current.lastCenter = center;
        return;
      }

      if (touches.length === 1 && pinchGestureRef.current) {
        let finger = touches[0];
        if (pinchGestureRef.current.mode !== 'pan') {
          pinchGestureRef.current.mode = 'pan';
          pinchGestureRef.current.panFingerId =
            typeof finger.identifier === 'number' ? finger.identifier : 0;
          pinchGestureRef.current.panStart = { x: finger.pageX, y: finger.pageY };
          pinchGestureRef.current.startOffset =
            pinchGestureRef.current.currentOffset || { ...canvasOffsetRef.current };
          pinchGestureRef.current.currentScale = canvasScaleRef.current;
        } else if (typeof pinchGestureRef.current.panFingerId === 'number') {
          const match = touches.find(
            t => t.identifier === pinchGestureRef.current.panFingerId
          );
          if (match) {
            finger = match;
          }
        }

        const startOffset = pinchGestureRef.current.startOffset || canvasOffsetRef.current;
        const dx = finger.pageX - pinchGestureRef.current.panStart.x;
        const dy = finger.pageY - pinchGestureRef.current.panStart.y;
        const offsetX = startOffset.x + dx;
        const offsetY = startOffset.y + dy;
        updateCanvasOffset(offsetX, offsetY);
      }
    },
    onPanResponderRelease: () => {
      if (pinchGestureRef.current) {
        canvasOffsetRef.current = pinchGestureRef.current.currentOffset;
        canvasBaseOffset.setValue(canvasOffsetRef.current);
        canvasPan.setValue({ x: 0, y: 0 });
        canvasScale.setValue(pinchGestureRef.current.currentScale);
        canvasScaleRef.current = pinchGestureRef.current.currentScale;
        pinchGestureRef.current = null;
      } else {
        canvasOffsetRef.current = {
          x: canvasOffsetRef.current.x + canvasPan.x._value,
          y: canvasOffsetRef.current.y + canvasPan.y._value,
        };
        canvasBaseOffset.setValue(canvasOffsetRef.current);
        canvasPan.setValue({ x: 0, y: 0 });
      }
    },
    onPanResponderTerminate: () => {
      if (pinchGestureRef.current) {
        canvasOffsetRef.current = pinchGestureRef.current.currentOffset;
        canvasBaseOffset.setValue(canvasOffsetRef.current);
        canvasPan.setValue({ x: 0, y: 0 });
        canvasScale.setValue(pinchGestureRef.current.currentScale);
        canvasScaleRef.current = pinchGestureRef.current.currentScale;
        pinchGestureRef.current = null;
      } else {
        canvasOffsetRef.current = {
          x: canvasOffsetRef.current.x + canvasPan.x._value,
          y: canvasOffsetRef.current.y + canvasPan.y._value,
        };
        canvasBaseOffset.setValue(canvasOffsetRef.current);
        canvasPan.setValue({ x: 0, y: 0 });
      }
    },
  })).current;

  // Category-specific fields
  const [featurePriority, setFeaturePriority] = useState('medium');
  const [questionUrgency, setQuestionUrgency] = useState('medium');
  const [questionBlocking, setQuestionBlocking] = useState(false);
  const [questionWhoToAsk, setQuestionWhoToAsk] = useState('');
  const [todoPriority, setTodoPriority] = useState('medium');

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
          // Load notes from Firestore
          if (ideaData.notes && Array.isArray(ideaData.notes)) {
            console.log('📥 LOADING NOTES FROM FIRESTORE:', ideaData.notes);
            setNotes(ideaData.notes);
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

  // Save notes to Firestore whenever they change
  useEffect(() => {
    // Skip saving on initial mount and when idea hasn't loaded yet
    if (!idea || !ideaId) return;

    // CRITICAL: Do NOT save during active drag to prevent re-renders and flickering
    if (draggingNoteId !== null) {
      console.log('⏸️ Skipping save - drag in progress');
      return;
    }

    const saveNotes = async () => {
      try {
        console.log('=== SAVING NOTES TO FIRESTORE ===');
        console.log('Notes being saved:', JSON.stringify(notes, null, 2));
        await updateIdea(ideaId, { notes });
        console.log('Notes saved successfully');
        justFinishedDrag.current = false; // Reset flag after save
      } catch (error) {
        console.error('Error saving notes:', error);
        // Optionally show error to user, but don't block UI
      }
    };

    // If we just finished a drag, save immediately; otherwise debounce
    const delay = justFinishedDrag.current ? 0 : 500;
    const timeoutId = setTimeout(saveNotes, delay);
    return () => clearTimeout(timeoutId);
  }, [notes, ideaId, idea, draggingNoteId]);

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

  const handleSaveNote = () => {
    if (!noteTitle.trim()) {
      Alert.alert('Error', 'Please enter a note title');
      return;
    }

    const categoryData = {};
    if (noteCategory === 'feature') {
      categoryData.priority = featurePriority;
    } else if (noteCategory === 'question') {
      categoryData.urgency = questionUrgency;
      categoryData.blocking = questionBlocking;
      categoryData.whoToAsk = questionWhoToAsk;
    } else if (noteCategory === 'todo') {
      categoryData.priority = todoPriority;
    }

    const newNote = {
      id: currentNote?.id || Date.now().toString(),
      title: noteTitle,
      category: noteCategory,
      content: noteContent,
      position: currentNote?.position || tapPosition,
      categoryData,
    };

    if (currentNote) {
      // Edit existing note
      setNotes(notes.map(n => n.id === currentNote.id ? newNote : n));
    } else {
      // Add new note
      setNotes([...notes, newNote]);
    }

    setModalVisible(false);
    resetNoteFields();
  };

  const resetNoteFields = () => {
    setNoteTitle('');
    setNoteCategory('feature');
    setNoteContent('');
    setCurrentNote(null);
    // Reset category-specific fields
    setFeaturePriority('medium');
    setQuestionUrgency('medium');
    setQuestionBlocking(false);
    setQuestionWhoToAsk('');
    setTodoPriority('medium');
  };

  const handleEditNote = (note) => {
    setCurrentNote(note);
    setNoteTitle(note.title);
    setNoteCategory(note.category);
    setNoteContent(note.content);

    // Load category-specific data
    if (note.categoryData) {
      if (note.category === 'feature') {
        setFeaturePriority(note.categoryData.priority || 'medium');
      } else if (note.category === 'question') {
        setQuestionUrgency(note.categoryData.urgency || 'medium');
        setQuestionBlocking(note.categoryData.blocking || false);
        setQuestionWhoToAsk(note.categoryData.whoToAsk || '');
      } else if (note.category === 'todo') {
        setTodoPriority(note.categoryData.priority || 'medium');
      }
    }

    setModalVisible(true);
  };

  const getNotePanResponder = (note) => {
    // Create pan value if it doesn't exist
    if (!notePanValues[note.id]) {
      notePanValues[note.id] = new Animated.ValueXY({ x: 0, y: 0 });
    }

    // Create pan responder if it doesn't exist
    if (!notePanResponders[note.id]) {
      let longPressTimeout = null;
      let singleTapTimeout = null;
      let lastTapTimestamp = 0;
      let isDragging = false;
      const pan = notePanValues[note.id];

      const activateDrag = () => {
        if (!isDragging) {
          isDragging = true;
          setDraggingNoteId(note.id);
        }
        if (longPressTimeout) {
          clearTimeout(longPressTimeout);
          longPressTimeout = null;
        }
      };

      const clearTimers = () => {
        if (longPressTimeout) {
          clearTimeout(longPressTimeout);
          longPressTimeout = null;
        }
        if (singleTapTimeout) {
          clearTimeout(singleTapTimeout);
          singleTapTimeout = null;
        }
      };

      notePanResponders[note.id] = PanResponder.create({
        onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 1,
        onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length === 1,
        onMoveShouldSetPanResponder: (evt, gestureState) =>
          isDragging && gestureState.numberActiveTouches === 1,
        onMoveShouldSetPanResponderCapture: (evt, gestureState) =>
          isDragging && gestureState.numberActiveTouches === 1,

        onPanResponderGrant: (evt) => {
          if (evt.nativeEvent.touches.length !== 1) {
            return;
          }
          pan.setValue({ x: 0, y: 0 });
          if (singleTapTimeout) {
            clearTimeout(singleTapTimeout);
            singleTapTimeout = null;
          }

          longPressTimeout = setTimeout(() => {
            activateDrag();
          }, 250);
        },

        onPanResponderMove: Animated.event(
          [null, { dx: pan.x, dy: pan.y }],
          {
            useNativeDriver: false,
            listener: (_, gesture) => {
              if (gesture.numberActiveTouches > 1) {
                clearTimers();
                if (isDragging) {
                  isDragging = false;
                  setDraggingNoteId(null);
                }
                pan.setValue({ x: 0, y: 0 });
                lastTapTimestamp = 0;
                return;
              }

              if (!isDragging) {
                const distanceSq = (gesture.dx * gesture.dx) + (gesture.dy * gesture.dy);
                if (distanceSq > (DRAG_ACTIVATION_THRESHOLD * DRAG_ACTIVATION_THRESHOLD)) {
                  if (longPressTimeout) {
                    clearTimeout(longPressTimeout);
                    longPressTimeout = null;
                  }
                  activateDrag();
                }
              }
            },
          }
        ),

        onPanResponderRelease: () => {
          if (longPressTimeout) {
            clearTimeout(longPressTimeout);
            longPressTimeout = null;
          }

          if (isDragging) {
            isDragging = false;
            setDraggingNoteId(null);
            justFinishedDrag.current = true; // Mark that we just finished dragging

            // Get the current animated values (these are the actual drag deltas)
            const dx = pan.x._value;
            const dy = pan.y._value;
            const scale = canvasScaleRef.current || 1;
            const dxWorld = dx / scale;
            const dyWorld = dy / scale;

            // Update note position in state
            // IMPORTANT: Look up current note position from state, not from closure
            setNotes(prevNotes => {
              return prevNotes.map(n => {
                if (n.id === note.id) {
                  // Use current position from state, not stale closure variable
                  const newX = n.position.x + dxWorld;
                  const newY = n.position.y + dyWorld;

                  return { ...n, position: { x: newX, y: newY } };
                }
                return n;
              });
            });

            // Reset pan value AFTER state update completes and React re-renders
            // This prevents the visual "pop" where the note jumps back then forward
            requestAnimationFrame(() => {
              pan.setValue({ x: 0, y: 0 });
            });

            lastTapTimestamp = 0;
            if (singleTapTimeout) {
              clearTimeout(singleTapTimeout);
              singleTapTimeout = null;
            }
          } else {
            // Short tap (released before long-press activated)
            // Reset pan value to prevent visual artifacts
            pan.setValue({ x: 0, y: 0 });
            const now = Date.now();
            const isDoubleTap = now - lastTapTimestamp <= DOUBLE_TAP_DELAY;

            if (isDoubleTap) {
              lastTapTimestamp = 0;
              if (singleTapTimeout) {
                clearTimeout(singleTapTimeout);
                singleTapTimeout = null;
              }
              handleEditNote(note);
            } else {
              lastTapTimestamp = now;
              singleTapTimeout = setTimeout(() => {
                handleEditNote(note);
                singleTapTimeout = null;
                lastTapTimestamp = 0;
              }, DOUBLE_TAP_DELAY);
            }
          }
        },

        onPanResponderTerminate: () => {
          clearTimers();
          if (isDragging) {
            isDragging = false;
            setDraggingNoteId(null);
          }
          // Always reset pan value to prevent visual artifacts
          pan.setValue({ x: 0, y: 0 });
          lastTapTimestamp = 0;
        },
      });
    }

    return notePanResponders[note.id];
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
        <View
          style={styles.notesCanvas}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            viewportSizeRef.current = { width, height };
          }}
        >
          <Animated.View
            style={[
              styles.canvasContentWrapper,
              {
                transform: [
                  { translateX: Animated.add(canvasBaseOffset.x, canvasPan.x) },
                  { translateY: Animated.add(canvasBaseOffset.y, canvasPan.y) },
                ],
              },
            ]}
            {...canvasPanResponder.panHandlers}
          >
            <Animated.View
              style={[
                styles.canvasContent,
                {
                  transform: [{ scale: canvasScale }],
                },
              ]}
            >
              <Image
                source={{ uri: GRID_PATTERN_URI }}
                style={styles.gridImage}
                resizeMode="repeat"
                pointerEvents="none"
              />

              {/* Render notes */}
              {notes.map(note => {
                const category = NOTE_CATEGORIES.find(c => c.id === note.category);
                const panResponder = getNotePanResponder(note);
                const pan = notePanValues[note.id];
                const isDragging = draggingNoteId === note.id;

                return (
                  <NoteCard
                    key={note.id}
                    note={note}
                    category={category}
                    panResponder={panResponder}
                    pan={pan}
                    isDragging={isDragging}
                  />
                );
              })}
            </Animated.View>
          </Animated.View>

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
              onPress={() => {
                const { width: viewportWidth, height: viewportHeight } = viewportSizeRef.current;
                const scale = canvasScaleRef.current || 1;
                const targetScreenX = (viewportWidth / 2) - (NOTE_CARD_WIDTH / 2);
                const targetScreenY = (viewportHeight / 2) - (NOTE_CARD_MIN_HEIGHT / 2);
                const worldX = (targetScreenX - canvasOffsetRef.current.x) / scale;
                const worldY = (targetScreenY - canvasOffsetRef.current.y) / scale;
                setTapPosition({
                  x: worldX,
                  y: worldY,
                });
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
        </View>
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
              <View style={styles.categoryBubbles}>
                {NOTE_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryBubble,
                      { backgroundColor: cat.color },
                      noteCategory === cat.id && styles.categoryBubbleSelected,
                    ]}
                    onPress={() => setNoteCategory(cat.id)}
                  >
                    <Text style={styles.categoryBubbleText}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Category-Specific Fields */}
              {noteCategory === 'feature' && (
                <View style={styles.categoryFields}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Priority:</Text>
                    <View style={styles.segmentedControl}>
                      {['low', 'medium', 'high', 'critical'].map(p => (
                        <TouchableOpacity
                          key={p}
                          style={[styles.segment, featurePriority === p && styles.segmentActive]}
                          onPress={() => setFeaturePriority(p)}
                        >
                          <Text style={[styles.segmentText, featurePriority === p && styles.segmentTextActive]}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {noteCategory === 'question' && (
                <View style={styles.categoryFields}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Urgency:</Text>
                    <View style={styles.segmentedControl}>
                      {['low', 'medium', 'high'].map(u => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.segment, questionUrgency === u && styles.segmentActive]}
                          onPress={() => setQuestionUrgency(u)}
                        >
                          <Text style={[styles.segmentText, questionUrgency === u && styles.segmentTextActive]}>
                            {u.charAt(0).toUpperCase() + u.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setQuestionBlocking(!questionBlocking)}
                  >
                    <View style={[styles.checkbox, questionBlocking && styles.checkboxChecked]}>
                      {questionBlocking && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={styles.checkboxLabel}>Blocking Decision</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Who to ask (optional)..."
                    placeholderTextColor={Colors.textTertiary}
                    value={questionWhoToAsk}
                    onChangeText={setQuestionWhoToAsk}
                  />
                </View>
              )}

              {noteCategory === 'todo' && (
                <View style={styles.categoryFields}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Priority:</Text>
                    <View style={styles.segmentedControl}>
                      {['low', 'medium', 'high'].map(p => (
                        <TouchableOpacity
                          key={p}
                          style={[styles.segment, todoPriority === p && styles.segmentActive]}
                          onPress={() => setTodoPriority(p)}
                        >
                          <Text style={[styles.segmentText, todoPriority === p && styles.segmentTextActive]}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}

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
    overflow: 'hidden',
  },
  canvasContentWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  canvasContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0a',
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
  gridImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  noteCard: {
    position: 'absolute',
    width: NOTE_CARD_WIDTH,
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
  categoryBubbles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryBubble: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryBubbleSelected: {
    borderColor: '#fff',
  },
  categoryBubbleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryFields: {
    marginBottom: 16,
  },
  fieldRow: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  segmentedControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentActive: {
    backgroundColor: Colors.accent1,
    borderColor: Colors.accent1,
  },
  segmentText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  sliderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  sliderDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  sliderDotActive: {
    borderColor: '#FF6B6B',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: Colors.accent1,
    borderColor: Colors.accent1,
  },
  checkboxLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  smallTextArea: {
    minHeight: 60,
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
