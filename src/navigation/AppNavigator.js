import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Text, Alert, Image } from 'react-native';
import { Colors } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';

// Import screens
import LoginScreen from '../screens/Auth/LoginScreen';
import SignupScreen from '../screens/Auth/SignupScreen';
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import ChatScreen from '../screens/Chat/ChatScreen';
import WorkspaceScreen from '../screens/Workspace/WorkspaceScreen';

const Stack = createStackNavigator();

// Custom theme that merges DarkTheme to preserve fonts
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.accent1,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.textPrimary,
    border: Colors.border,
    notification: Colors.accent2,
  },
};

// Loading screen shown while checking auth state
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.accent1} />
    </View>
  );
}

// Auth stack for unauthenticated users
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {
          backgroundColor: Colors.background,
        },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

// Custom header for Dashboard with logo
function DashboardHeader() {
  return (
    <View style={styles.dashboardHeader}>
      <Image
        source={require('../../public/logos/IdeaSpot Logo Main.png')}
        style={styles.headerLogo}
        resizeMode="contain"
      />
      <Text style={styles.dashboardTitle}>Ideas Dashboard</Text>
    </View>
  );
}

// Sign out button component
function SignOutButton() {
  const { signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={handleSignOut}
      style={{ marginRight: 16 }}
    >
      <Text style={{ color: Colors.accent1, fontSize: 16, fontWeight: '500' }}>
        Sign Out
      </Text>
    </TouchableOpacity>
  );
}

// Main app stack for authenticated users
function MainStack() {
  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
        },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        cardStyle: {
          backgroundColor: Colors.background,
        },
      }}
    >
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerTitle: () => <DashboardHeader />,
          headerShown: true,
          headerRight: () => <SignOutButton />,
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: 'New Idea',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="Workspace"
        component={WorkspaceScreen}
        options={{
          title: 'Idea Workspace',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  return (
    <NavigationContainer theme={navigationTheme}>
      {loading ? (
        <LoadingScreen />
      ) : user ? (
        <MainStack />
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 80,
    height: 40,
    marginRight: 12,
  },
  dashboardTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
});
