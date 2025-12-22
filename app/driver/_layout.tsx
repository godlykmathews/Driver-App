import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import "react-native-reanimated";
import Feather from "react-native-vector-icons/Feather";

export const unstable_settings = {
  initialRouteName: "login",
};

export default function DriverLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();

    // Listen for authentication changes
    const authInterval = setInterval(checkAuthentication, 1000);

    return () => clearInterval(authInterval);
  }, []);

  // Redirect based on authentication state
  useEffect(() => {
    if (isAuthenticated === true) {
      // User is authenticated, ensure we're on home
      router.replace("/driver/home");
    } else if (isAuthenticated === false) {
      // User is not authenticated, ensure we're on login
      router.replace("/driver/login");
    }
  }, [isAuthenticated]);

  const checkAuthentication = async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const newAuthState = !!token;

      // Only update if state actually changed to prevent infinite loops
      if (newAuthState !== isAuthenticated) {
        setIsAuthenticated(newAuthState);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error checking authentication:", error);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <View style={loadingStyles.container}>
        <Feather name="truck" size={80} color="#0a7ea4" />
        <ActivityIndicator size="large" color="#0a7ea4" style={loadingStyles.spinner} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Prevent back gestures from authenticated screens going back to login
        gestureEnabled: false,
        // Prevent hardware back button from going to login
        gestureDirection: "horizontal",
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
          // Once logged in, don't allow going back to login via back button
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="home"
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="pending-uploads"
        options={{
          headerShown: false,
          gestureEnabled: true,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="order/[id]"
        options={{
          headerShown: false,
          // Allow back navigation within order screens
          gestureEnabled: true,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="order/[id]/signature"
        options={{
          headerShown: false,
          gestureEnabled: true,
          presentation: "card",
        }}
      />
    </Stack>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    marginTop: 20,
  },
});
