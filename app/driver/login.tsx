import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity } from "react-native";
import Feather from "react-native-vector-icons/Feather";
import { apiService } from "../../lib/api";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function DriverLoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Get theme-aware colors
  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const borderColor = colorScheme === 'dark' ? '#444' : '#ddd';
  const placeholderColor = colorScheme === 'dark' ? '#888' : '#999';

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Please enter username and password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiService.login(username, password);

      console.log("Login successful:", response);

      // Check if user is a driver
      if (response.user.role !== "driver") {
        setError("This app is for drivers only");
        return;
      }

      // Navigate to driver home screen using replace (not push)
      // This prevents going back to login screen
      router.replace({
        pathname: "/driver/home",
        params: {
          username: response.user.name || response.user.username || username,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.logoContainer}>
        <Feather name="truck" size={80} color="#0a7ea4" />
        <ThemedText type="title" style={styles.title}>
          Driver Login
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Sign in to access your delivery dashboard
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.formContainer}>
        <ThemedView style={[styles.inputContainer, { borderColor }]}>
          <IconSymbol
            name="house.fill"
            size={20}
            color={iconColor}
            style={styles.inputIcon}
          />
          <TextInput
            style={[styles.input, { color: textColor }]}
            placeholder="Username"
            placeholderTextColor={placeholderColor}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </ThemedView>

        <ThemedView style={[styles.inputContainer, { borderColor }]}>
          <IconSymbol
            name="chevron.right"
            size={20}
            color={iconColor}
            style={styles.inputIcon}
          />
          <TextInput
            style={[styles.input, { color: textColor }]}
            placeholder="Password"
            placeholderTextColor={placeholderColor}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
          >
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={20}
              color={iconColor}
            />
          </TouchableOpacity>
        </ThemedView>

        {error ? (
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        ) : null}

        <TouchableOpacity
          style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          <ThemedText style={styles.loginButtonText}>
            {isLoading ? "Signing In..." : "Sign In"}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 60,
    marginBottom: 40,
  },
  title: {
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
  formContainer: {
    flex: 1,
    justifyContent: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  eyeIcon: {
    marginLeft: 10,
    padding: 4,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    marginBottom: 10,
    textAlign: "center",
  },
  loginButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: 8,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
