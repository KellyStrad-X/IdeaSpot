import React, { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  getIdea,
  updateIdea,
  createCanvas,
  updateCanvas,
  setCurrentCanvas,
  migrateNotesToCanvas
} from '../../services/firestore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DOUBLE_TAP_DELAY = 220;
const DRAG_ACTIVATION_THRESHOLD = 8;
const NOTE_CARD_DEFAULT_WIDTH = 200;
const NOTE_CARD_DEFAULT_HEIGHT = 140;
const NOTE_CARD_MIN_WIDTH = 150;
const NOTE_CARD_MIN_HEIGHT = 100;
const NOTE_CARD_MAX_WIDTH = 400;
const NOTE_CARD_MAX_HEIGHT = 600;
const CANVAS_WIDTH = SCREEN_WIDTH * 2;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 1.5;
const GRID_SPACING = 40;

const NOTE_CATEGORIES = [
  { id: 'feature', label: 'Feature', color: '#4A9EFF' },
  { id: 'question', label: 'Question', color: '#FFD93D' },
  { id: 'todo', label: 'To-Do', color: '#A78BFA' },
];

// Memoized NoteCard component to prevent unnecessary re-renders
const NoteCard = React.memo(({ note, category, panResponder, pan, isDragging, resizePanResponder, isResizing }) => {
  const animatedTransform = [];
  if (isDragging && pan) {
    animatedTransform.push({ translateX: pan.x }, { translateY: pan.y });
  }
  if (isDragging) {
    animatedTransform.push({ scale: 1.1 });
  }

  const noteWidth = note.dimensions?.width || NOTE_CARD_DEFAULT_WIDTH;
  const noteHeight = note.dimensions?.height || NOTE_CARD_DEFAULT_HEIGHT;

  return (
    <Animated.View
      key={note.id}
      style={[
        styles.noteCard,
        {
          left: note.position.x,
          top: note.position.y,
          width: noteWidth,
          minHeight: noteHeight,
          borderLeftColor: category?.color || Colors.accent1,
          transform: animatedTransform,
          zIndex: note.zIndex || 1,
          opacity: isDragging ? 0.9 : 1,
        }
      ]}
    >
      {/* Draggable content area */}
      <View {...panResponder.panHandlers} style={styles.noteCardContent}>
        <Text style={styles.noteCardTitle}>{note.title}</Text>
        {note.content ? (
          <Text style={styles.noteCardContentText}>
            {note.content}
          </Text>
        ) : null}
      </View>

      {/* Category Badge - Bottom Left */}
      <View style={[styles.noteCategoryBadge, { backgroundColor: category?.color }]}>
        <Text style={styles.categoryBadgeText}>{category?.label}</Text>
      </View>

      {/* Resize Handle */}
      <Animated.View
        {...resizePanResponder.panHandlers}
        style={[
          styles.resizeHandle,
          {
            opacity: isResizing ? 1 : 0.6,
          }
        ]}
      >
        <Ionicons name="resize" size={16} color={Colors.textSecondary} />
      </Animated.View>
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
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isResizing === nextProps.isResizing &&
    prevProps.note.dimensions?.width === nextProps.note.dimensions?.width &&
    prevProps.note.dimensions?.height === nextProps.note.dimensions?.height
  );
});

export default function WorkspaceScreen({ navigation, route }) {
  const { ideaId } = route.params || {};
  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const [mvpGuidance, setMvpGuidance] = useState([]);
  const [notesVisible, setNotesVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Canvas state
  const [canvases, setCanvases] = useState([]);
  const [currentCanvasId, setCurrentCanvasIdState] = useState(null);
  const [canvasPickerVisible, setCanvasPickerVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renamingCanvasId, setRenamingCanvasId] = useState(null);
  const [newCanvasName, setNewCanvasName] = useState('');
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const canvasZoomAnim = useRef(new Animated.Value(1)).current;
  const canvasLabelScaleAnim = useRef(new Animated.Value(1)).current;

  // Business name edit modal state
  const [editBusinessNameModalVisible, setEditBusinessNameModalVisible] = useState(false);
  const [editBusinessNameValue, setEditBusinessNameValue] = useState('');

  // Notes canvas state
  const [notes, setNotes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentNote, setCurrentNote] = useState(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState('feature');
  const [noteContent, setNoteContent] = useState('');
  const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
  const [draggingNoteId, setDraggingNoteId] = useState(null);
  const [resizingNoteId, setResizingNoteId] = useState(null);
  const notePanValues = useRef({}).current;
  const notePanResponders = useRef({}).current;
  const noteResizePanResponders = useRef({}).current;
  const justFinishedDrag = useRef(false);
  const carouselScrollRef = useRef(null);

  const gridDots = useMemo(() => {
    const rows = Math.ceil(CANVAS_HEIGHT / GRID_SPACING);
    const cols = Math.ceil(CANVAS_WIDTH / GRID_SPACING);
    const dots = [];

    for (let row = 0; row <= rows; row += 1) {
      for (let col = 0; col <= cols; col += 1) {
        dots.push({
          key: `dot-${row}-${col}`,
          top: row * GRID_SPACING,
          left: col * GRID_SPACING,
        });
      }
    }

    return dots;
  }, []);

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
        let ideaData = await getIdea(ideaId);
        if (ideaData) {
          // Migrate to canvas structure if needed
          await migrateNotesToCanvas(ideaId);

          // Reload idea data after migration
          ideaData = await getIdea(ideaId);

          setIdea(ideaData);

          // Mark analysis as reviewed if it hasn't been reviewed yet
          if (ideaData.analyzing === false && ideaData.analysisReviewed === false) {
            try {
              await updateIdea(ideaId, { analysisReviewed: true });
              console.log('✅ Marked idea as reviewed');
            } catch (error) {
              console.error('Error marking idea as reviewed:', error);
            }
          }

          // Populate branding fields if they exist
          if (ideaData.cards?.mvp) {
            setBusinessName(ideaData.cards.mvp.name || '');
            setMvpGuidance(ideaData.cards.mvp.guidance || []);
          } else if (ideaData.cards?.conceptBranding) {
            // Fallback for old data structure
            setBusinessName(ideaData.cards.conceptBranding.name || '');
            setMvpGuidance([]);
          }

          // Load canvases
          if (ideaData.canvases && Array.isArray(ideaData.canvases)) {
            console.log('📥 LOADING CANVASES FROM FIRESTORE:', ideaData.canvases);
            setCanvases(ideaData.canvases);

            // Set current canvas
            const activeCanvasId = ideaData.currentCanvasId || ideaData.canvases[0]?.id;
            setCurrentCanvasIdState(activeCanvasId);

            // Load notes for current canvas
            const activeCanvas = ideaData.canvases.find(c => c.id === activeCanvasId);
            if (activeCanvas && activeCanvas.notes) {
              setNotes(activeCanvas.notes);
            }
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

  // Save notes to current canvas whenever they change
  useEffect(() => {
    // Skip saving on initial mount and when idea hasn't loaded yet
    if (!idea || !ideaId || !currentCanvasId) return;

    // CRITICAL: Do NOT save during active drag to prevent re-renders and flickering
    if (draggingNoteId !== null) {
      console.log('⏸️ Skipping save - drag in progress');
      return;
    }

    const saveNotes = async () => {
      try {
        console.log('=== SAVING NOTES TO CANVAS ===');
        console.log('Canvas ID:', currentCanvasId);
        console.log('Notes being saved:', JSON.stringify(notes, null, 2));
        await updateCanvas(ideaId, currentCanvasId, { notes });

        // Update local canvases state to keep carousel in sync
        setCanvases(prevCanvases => prevCanvases.map(c =>
          c.id === currentCanvasId ? { ...c, notes } : c
        ));

        console.log('Notes saved successfully to canvas');
        justFinishedDrag.current = false; // Reset flag after save
      } catch (error) {
        console.error('Error saving notes to canvas:', error);
        // Optionally show error to user, but don't block UI
      }
    };

    // If we just finished a drag, save immediately; otherwise debounce
    const delay = justFinishedDrag.current ? 0 : 500;
    const timeoutId = setTimeout(saveNotes, delay);
    return () => clearTimeout(timeoutId);
  }, [notes, ideaId, idea, currentCanvasId, draggingNoteId]);


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

  // Calculate initial scroll position for carousel
  const getCarouselInitialOffset = () => {
    const currentIndex = canvases.findIndex(c => c.id === currentCanvasId);
    return { x: currentIndex >= 0 ? currentIndex * SCREEN_WIDTH : 0, y: 0 };
  };

  // Canvas management functions
  const toggleCanvasPicker = () => {
    if (canvasPickerVisible) {
      // Close picker - zoom back in
      Animated.spring(canvasZoomAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start(() => {
        setCanvasPickerVisible(false);
      });
    } else {
      // Open picker - zoom out and set carousel to current canvas
      const currentIndex = canvases.findIndex(c => c.id === currentCanvasId);
      setCurrentCarouselIndex(currentIndex >= 0 ? currentIndex : 0);
      setCanvasPickerVisible(true);
      Animated.spring(canvasZoomAnim, {
        toValue: 0.92,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start();
    }
  };

  const handleCarouselScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);

    if (index !== currentCarouselIndex) {
      // Trigger pop animation when switching canvases
      canvasLabelScaleAnim.setValue(0.85);
      Animated.spring(canvasLabelScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 7,
      }).start();
      setCurrentCarouselIndex(index);
    }
  };

  const handleCreateCanvas = async () => {
    try {
      const canvasNumber = canvases.length + 1;
      const newCanvas = await createCanvas(ideaId, `Canvas ${canvasNumber}`);
      setCanvases([...canvases, newCanvas]);

      // Switch to new canvas and close picker with animation
      await setCurrentCanvas(ideaId, newCanvas.id);
      setCurrentCanvasIdState(newCanvas.id);
      setNotes([]); // New canvas is empty

      Animated.spring(canvasZoomAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start(() => {
        setCanvasPickerVisible(false);
      });

      console.log('✅ Created new canvas:', newCanvas);
    } catch (error) {
      console.error('Error creating canvas:', error);
      Alert.alert('Error', 'Failed to create new canvas');
    }
  };

  const handleSwitchCanvas = async (canvasId) => {
    if (canvasId === currentCanvasId) {
      // Just close picker with animation if selecting current canvas
      Animated.spring(canvasZoomAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start(() => {
        setCanvasPickerVisible(false);
      });
      return;
    }

    try {
      // Save current canvas notes before switching
      if (currentCanvasId) {
        await updateCanvas(ideaId, currentCanvasId, { notes });
      }

      // Set new current canvas
      await setCurrentCanvas(ideaId, canvasId);
      setCurrentCanvasIdState(canvasId);

      // Load notes for new canvas
      const canvas = canvases.find(c => c.id === canvasId);
      if (canvas) {
        setNotes(canvas.notes || []);
      }

      // Close picker with zoom animation
      Animated.spring(canvasZoomAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start(() => {
        setCanvasPickerVisible(false);
      });

      console.log('✅ Switched to canvas:', canvasId);
    } catch (error) {
      console.error('Error switching canvas:', error);
      Alert.alert('Error', 'Failed to switch canvas');
    }
  };

  const handleRenameCanvas = (canvasId, currentName) => {
    setRenamingCanvasId(canvasId);
    setNewCanvasName(currentName);
    setRenameModalVisible(true);
  };

  const handleSaveCanvasRename = async () => {
    if (newCanvasName && newCanvasName.trim()) {
      try {
        await updateCanvas(ideaId, renamingCanvasId, { name: newCanvasName.trim() });
        // Update local state
        setCanvases(canvases.map(c =>
          c.id === renamingCanvasId ? { ...c, name: newCanvasName.trim() } : c
        ));
        console.log('✅ Renamed canvas:', renamingCanvasId, 'to', newCanvasName);
        setRenameModalVisible(false);
        setRenamingCanvasId(null);
        setNewCanvasName('');
      } catch (error) {
        console.error('Error renaming canvas:', error);
        Alert.alert('Error', 'Failed to rename canvas');
      }
    }
  };

  const handleEditBusinessName = () => {
    setEditBusinessNameValue(businessName);
    setEditBusinessNameModalVisible(true);
  };

  const handleSaveBusinessName = async () => {
    if (editBusinessNameValue !== undefined && editBusinessNameValue.trim()) {
      try {
        // Update in Firestore - use mvp card, fallback to conceptBranding for legacy data
        const updateData = idea.cards?.mvp
          ? {
              cards: {
                ...idea.cards,
                mvp: {
                  ...idea.cards.mvp,
                  name: editBusinessNameValue.trim(),
                }
              }
            }
          : {
              cards: {
                ...idea.cards,
                conceptBranding: {
                  ...idea.cards?.conceptBranding,
                  name: editBusinessNameValue.trim(),
                }
              }
            };

        await updateIdea(ideaId, updateData);

        // Update local state
        setBusinessName(editBusinessNameValue.trim());
        setIdea({
          ...idea,
          cards: {
            ...idea.cards,
            conceptBranding: {
              ...idea.cards?.conceptBranding,
              name: editBusinessNameValue.trim(),
            }
          }
        });

        console.log('✅ Updated business name to:', editBusinessNameValue);
        setEditBusinessNameModalVisible(false);
        setEditBusinessNameValue('');
      } catch (error) {
        console.error('Error updating business name:', error);
        Alert.alert('Error', 'Failed to update business name');
      }
    }
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
      dimensions: currentNote?.dimensions || {
        width: NOTE_CARD_DEFAULT_WIDTH,
        height: NOTE_CARD_DEFAULT_HEIGHT,
      },
      zIndex: currentNote?.zIndex || Date.now(),
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

          // Bring note to front by updating its zIndex
          setNotes(prevNotes => prevNotes.map(n =>
            n.id === note.id ? { ...n, zIndex: Date.now() } : n
          ));
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

            // Update note position in state
            // IMPORTANT: Look up current note position from state, not from closure
            setNotes(prevNotes => {
              return prevNotes.map(n => {
                if (n.id === note.id) {
                  // Use current position from state, not stale closure variable
                  const newX = n.position.x + dx;
                  const newY = n.position.y + dy;

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

  // Create resize PanResponder for each note
  const getNoteResizePanResponder = (note) => {
    if (noteResizePanResponders[note.id]) {
      return noteResizePanResponders[note.id];
    }

    let initialWidth = 0;
    let initialHeight = 0;

    noteResizePanResponders[note.id] = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: () => {
        setResizingNoteId(note.id);
        // Get current dimensions from state, not stale closure
        setNotes(prevNotes => {
          const currentNote = prevNotes.find(n => n.id === note.id);
          initialWidth = currentNote?.dimensions?.width || NOTE_CARD_DEFAULT_WIDTH;
          initialHeight = currentNote?.dimensions?.height || NOTE_CARD_DEFAULT_HEIGHT;
          return prevNotes; // Don't modify state, just read current values
        });
      },

      onPanResponderMove: (evt, gestureState) => {
        // Calculate new dimensions based on drag delta from initial size
        const newWidth = Math.max(NOTE_CARD_MIN_WIDTH, Math.min(NOTE_CARD_MAX_WIDTH, initialWidth + gestureState.dx));
        const newHeight = Math.max(NOTE_CARD_MIN_HEIGHT, Math.min(NOTE_CARD_MAX_HEIGHT, initialHeight + gestureState.dy));

        // Update note dimensions in real-time
        setNotes(prevNotes => prevNotes.map(n => {
          if (n.id === note.id) {
            return {
              ...n,
              dimensions: {
                width: newWidth,
                height: newHeight,
              }
            };
          }
          return n;
        }));
      },

      onPanResponderRelease: () => {
        setResizingNoteId(null);
        justFinishedDrag.current = true; // Trigger save
      },

      onPanResponderTerminate: () => {
        setResizingNoteId(null);
      },
    });

    return noteResizePanResponders[note.id];
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
            <View style={styles.highlightBox}>
              <Text style={styles.sectionText}>{idea.cards.summary.problem}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Target Audience</Text>
            <View style={styles.highlightBox}>
              <Text style={styles.sectionText}>{idea.cards.summary.audience}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Core Features</Text>
            <View style={styles.highlightBox}>
              {idea.cards.summary.features.map((feature, index) => (
                <Text key={index} style={styles.bulletText}>
                  • {feature}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Value Proposition</Text>
            <View style={styles.highlightBox}>
              <Text style={styles.sectionText}>{idea.cards.summary.valueProp}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reality Check</Text>
            <View style={styles.highlightBox}>
              {idea.cards.summary.realityCheck.map((check, index) => (
                <Text key={index} style={styles.bulletText}>
                  • {check}
                </Text>
              ))}
            </View>
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
              <View style={styles.highlightBox}>
                <View style={styles.insightHeader}>
                  <Text style={styles.sectionTitle}>{insight.title}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{insight.category}</Text>
                  </View>
                </View>
                <Text style={styles.sectionText}>{insight.advice}</Text>
              </View>
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
                  <View style={styles.highlightBox}>
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
                <View style={styles.highlightBox}>
                  <Text style={styles.monetizationModel}>{idea.cards.monetization.primaryModel}</Text>
                  <Text style={styles.sectionText}>{idea.cards.monetization.modelRationale}</Text>
                </View>
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
                    <View key={index} style={styles.highlightBox}>
                      <Text style={styles.altModelName}>{alt.name}</Text>
                      <Text style={styles.sectionText}>{alt.description}</Text>
                    </View>
                  ))}
                </View>
              )}

              {idea.cards.monetization.projections && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Revenue Projections</Text>
                  <View style={styles.highlightBox}>
                    <Text style={styles.projectionText}>100 users: {idea.cards.monetization.projections.users100}</Text>
                    <Text style={styles.projectionText}>500 users: {idea.cards.monetization.projections.users500}</Text>
                    <Text style={styles.projectionText}>1000 users: {idea.cards.monetization.projections.users1000}</Text>
                  </View>
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

  const renderMinimumViableProductCard = () => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => toggleCard('mvp')}
      >
        <Text style={styles.cardTitle}>MVP Roadmap</Text>
        <Text style={styles.expandIcon}>
          {expandedCard === 'mvp' ? '−' : '+'}
        </Text>
      </TouchableOpacity>

      {expandedCard === 'mvp' && (
        <View style={styles.cardContent}>
          {mvpGuidance && mvpGuidance.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Getting Started</Text>
              {mvpGuidance.map((item, index) => (
                <View key={index} style={styles.highlightBox}>
                  <View style={styles.guidanceItem}>
                    <View style={styles.guidanceNumber}>
                      <Text style={styles.guidanceNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.guidanceText}>{item}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>
                MVP roadmap will be generated by AI with tactical guidance specific to your idea
              </Text>
            </View>
          )}
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
    idea.cards.mvp ||
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
              {(idea.cards?.mvp?.name || idea.cards?.conceptBranding?.name) && (
                <TouchableOpacity
                  style={styles.businessNameContainer}
                  onPress={handleEditBusinessName}
                  activeOpacity={0.7}
                >
                  <Text style={styles.businessName}>
                    {idea.cards?.mvp?.name || idea.cards?.conceptBranding?.name}
                  </Text>
                  <Ionicons name="pencil" size={14} color="#fff" style={styles.editIcon} />
                </TouchableOpacity>
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
        {renderMinimumViableProductCard()}

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
        {canvasPickerVisible ? (
          /* Canvas Carousel View - Show all canvases horizontally */
          <View style={{ flex: 1 }}>
            {/* Canvas Name Header - Shows current canvas info */}
            <Animated.View style={[styles.carouselHeader, { transform: [{ scale: canvasLabelScaleAnim }] }]}>
              <Text style={styles.carouselCanvasName}>
                {currentCarouselIndex < canvases.length ? canvases[currentCarouselIndex]?.name : 'New Canvas'}
              </Text>
              <Text style={styles.carouselNoteCount}>
                {currentCarouselIndex < canvases.length ? `${canvases[currentCarouselIndex]?.notes?.length || 0} notes` : ''}
              </Text>
            </Animated.View>

            <Animated.View style={{ flex: 1, transform: [{ scale: canvasZoomAnim }] }}>
              <ScrollView
              ref={carouselScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.canvasCarousel}
              contentContainerStyle={styles.canvasCarouselContent}
              contentOffset={getCarouselInitialOffset()}
              decelerationRate="fast"
              snapToInterval={SCREEN_WIDTH}
              snapToAlignment="center"
              onScroll={handleCarouselScroll}
              scrollEventThrottle={16}
            >
            {canvases.map((canvas) => {
              const isActive = canvas.id === currentCanvasId;
              return (
                <TouchableOpacity
                  key={canvas.id}
                  activeOpacity={0.9}
                  onPress={() => handleSwitchCanvas(canvas.id)}
                  onLongPress={() => handleRenameCanvas(canvas.id, canvas.name)}
                  style={styles.carouselCanvasWrapper}
                >
                  <View style={styles.carouselCanvas}>
                    <View style={styles.carouselCanvasScaleWrapper}>
                      <View style={[styles.notesCanvas, styles.carouselNotesCanvas]}>
                        {/* Grid Background */}
                      <View style={styles.gridBackground}>
                        {gridDots.map(dot => (
                          <View
                            key={dot.key}
                            style={[
                              styles.gridDot,
                              { top: dot.top, left: dot.left }
                            ]}
                          />
                        ))}
                      </View>

                      {/* Render notes for this canvas */}
                      {canvas.notes && canvas.notes.map(note => {
                        const category = NOTE_CATEGORIES.find(c => c.id === note.category);
                        return (
                          <View
                            key={note.id}
                            style={[
                              styles.noteCard,
                              {
                                left: note.position.x,
                                top: note.position.y,
                                width: note.dimensions?.width || NOTE_CARD_DEFAULT_WIDTH,
                                minHeight: note.dimensions?.height || NOTE_CARD_DEFAULT_HEIGHT,
                                borderLeftColor: category?.color || Colors.accent1,
                                zIndex: note.zIndex || 1,
                              }
                            ]}
                          >
                            <View style={styles.noteCardContent}>
                              <Text style={styles.noteCardTitle}>{note.title}</Text>
                              {note.content ? (
                                <Text style={styles.noteCardContentText} numberOfLines={3}>
                                  {note.content}
                                </Text>
                              ) : null}
                            </View>
                            <View style={[styles.noteCategoryBadge, { backgroundColor: category?.color }]}>
                              <Text style={styles.categoryBadgeText}>{category?.label}</Text>
                            </View>
                          </View>
                        );
                      })}

                      {/* Floating Buttons Preview (non-interactive) */}
                      <View pointerEvents="none">
                        {/* Floating Close Button */}
                        <View style={styles.floatingCloseButton}>
                          <Ionicons name="close" size={28} color="#fff" />
                        </View>

                        {/* Floating Action Buttons Container */}
                        <View style={styles.floatingActionsContainer}>
                          {/* Canvas Stack Button */}
                          <View style={styles.floatingCanvasButton}>
                            <Ionicons name="layers-outline" size={20} color={Colors.textPrimary} />
                            {canvases.length > 1 && (
                              <View style={styles.canvasCountBadge}>
                                <Text style={styles.canvasCountText}>{canvases.length}</Text>
                              </View>
                            )}
                          </View>

                          {/* Import Button */}
                          <View style={styles.floatingImportButton}>
                            <Ionicons name="cloud-upload-outline" size={20} color={Colors.textPrimary} />
                          </View>

                          {/* New Note Button */}
                          <View style={styles.floatingNewNoteButton}>
                            <Ionicons name="add" size={32} color={Colors.textPrimary} />
                          </View>
                        </View>
                      </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Add New Canvas Card */}
            <TouchableOpacity
              style={styles.carouselCanvasWrapper}
              onPress={handleCreateCanvas}
            >
              <View
                style={[
                  styles.carouselCanvas,
                  styles.addNewCanvasCard,
                ]}
              >
                <Ionicons name="add-circle-outline" size={80} color={Colors.accent1} />
                <Text style={styles.addNewCanvasText}>Create New Canvas</Text>
              </View>
            </TouchableOpacity>
              </ScrollView>

              {/* Pagination Dots */}
              <View style={styles.paginationContainer}>
                {[...canvases, { id: 'add-new' }].map((canvas, index) => (
                  <View
                    key={canvas.id}
                    style={[
                      styles.paginationDot,
                      index === currentCarouselIndex && styles.paginationDotActive
                    ]}
                  />
                ))}
              </View>
            </Animated.View>
          </View>
        ) : (
          /* Single Active Canvas View - Full zoom */
          <View style={styles.notesCanvas}>
          <View style={styles.gridBackground}>
            {gridDots.map(dot => (
              <View
                key={dot.key}
                style={[
                  styles.gridDot,
                  { top: dot.top, left: dot.left }
                ]}
              />
            ))}
          </View>

          {/* Render notes */}
          {notes.map(note => {
            const category = NOTE_CATEGORIES.find(c => c.id === note.category);
            const panResponder = getNotePanResponder(note);
            const resizePanResponder = getNoteResizePanResponder(note);
            const pan = notePanValues[note.id];
            const isDragging = draggingNoteId === note.id;
            const isResizing = resizingNoteId === note.id;

            return (
              <NoteCard
                key={note.id}
                note={note}
                category={category}
                panResponder={panResponder}
                pan={pan}
                isDragging={isDragging}
                resizePanResponder={resizePanResponder}
                isResizing={isResizing}
              />
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
            {/* Canvas Stack Button */}
            <TouchableOpacity
              style={styles.floatingCanvasButton}
              onPress={(e) => {
                e.stopPropagation();
                toggleCanvasPicker();
              }}
            >
              <Ionicons name="layers-outline" size={20} color={Colors.textPrimary} />
              {canvases.length > 1 && (
                <View style={styles.canvasCountBadge}>
                  <Text style={styles.canvasCountText}>{canvases.length}</Text>
                </View>
              )}
            </TouchableOpacity>

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
                setTapPosition({
                  x: SCREEN_WIDTH / 2 - NOTE_CARD_DEFAULT_WIDTH / 2,
                  y: 200,
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
        )}
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

      {/* Rename Canvas Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Rename Canvas</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Canvas name..."
                placeholderTextColor={Colors.textTertiary}
                value={newCanvasName}
                onChangeText={setNewCanvasName}
                autoFocus
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setRenameModalVisible(false);
                    setRenamingCanvasId(null);
                    setNewCanvasName('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSaveButton]}
                  onPress={handleSaveCanvasRename}
                >
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Edit Business Name Modal */}
      <Modal
        visible={editBusinessNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditBusinessNameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Business Name</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Business name..."
                placeholderTextColor={Colors.textTertiary}
                value={editBusinessNameValue}
                onChangeText={setEditBusinessNameValue}
                autoFocus
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setEditBusinessNameModalVisible(false);
                    setEditBusinessNameValue('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSaveButton]}
                  onPress={handleSaveBusinessName}
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
  businessNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    gap: 6,
  },
  businessName: {
    color: Colors.accent4,
    fontSize: 17,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  editIcon: {
    opacity: 0.8,
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
  highlightBox: {
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
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
  guidanceItem: {
    flexDirection: 'row',
    paddingLeft: 0,
  },
  guidanceNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  guidanceNumberText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  guidanceText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
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
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  gridBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
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
    zIndex: 2000,
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
    zIndex: 2000,
  },
  floatingCanvasButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#9B59B6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    position: 'relative',
  },
  canvasCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E74C3C',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  canvasCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
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
  noteCard: {
    position: 'absolute',
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
    flex: 1,
    paddingBottom: 32,
  },
  noteCardContentText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  resizeHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    cursor: 'nwse-resize',
  },
  noteCategoryBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
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
  carouselHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    paddingTop: (StatusBar.currentHeight || 24) + 8,
    backgroundColor: Colors.background,
  },
  carouselCanvasName: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  carouselNoteCount: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  canvasCarousel: {
    flex: 1,
  },
  canvasCarouselContent: {
    alignItems: 'center',
  },
  carouselCanvasWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselCanvas: {
    width: SCREEN_WIDTH * 0.95,
    height: SCREEN_HEIGHT * 0.85,
    backgroundColor: Colors.background,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 20,
  },
  carouselCanvasScaleWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselNotesCanvas: {
    transform: [{ scale: 0.85 }],
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 1000,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: Colors.accent1,
  },
  addNewCanvasCard: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
  },
  addNewCanvasText: {
    color: Colors.accent1,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  canvasNameLabel: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    zIndex: 10000,
  },
  canvasNameText: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  canvasNoteCountText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
});
