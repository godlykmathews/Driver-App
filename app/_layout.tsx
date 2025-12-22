import {
    DefaultTheme,
    ThemeProvider
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";


export const unstable_settings = {
  initialRouteName: "driver",
};

export default function RootLayout() {
  // Force light theme for consistency across all devices
  // This prevents dark mode issues on some phones
  
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack initialRouteName="driver" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="driver" />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
