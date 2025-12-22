import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";

import { useOffline } from "../../hooks/use-offline";
import { OfflineAction, offlineService } from "../../lib/offline-service";

export default function PendingUploadsScreen() {
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { isOnline, syncStatus, manualSync } = useOffline();

  const loadPendingActions = useCallback(async () => {
    try {
      setLoading(true);
      const actions = await offlineService.getOfflineActions();
      setPendingActions(actions);
    } catch (error) {
      console.error("Error loading pending actions:", error);
      Alert.alert("Error", "Failed to load pending uploads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingActions();
  }, [loadPendingActions]);

  // Refresh when sync status changes
  useEffect(() => {
    loadPendingActions();
  }, [syncStatus.pendingActions, loadPendingActions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPendingActions();
    setRefreshing(false);
  };

  const handleForceUpload = async () => {
    if (!isOnline) {
      Alert.alert(
        "No Internet Connection",
        "Please check your internet connection and try again."
      );
      return;
    }

    if (pendingActions.length === 0) {
      Alert.alert(
        "No Pending Actions",
        "There are no pending uploads to sync."
      );
      return;
    }

    Alert.alert(
      "Force Upload",
      `Are you sure you want to upload ${
        pendingActions.length
      } pending acknowledgment${pendingActions.length !== 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Upload",
          style: "default",
          onPress: async () => {
            try {
              setUploading(true);
              await manualSync();
              await loadPendingActions(); // Refresh the list
              Alert.alert(
                "Upload Complete",
                "All pending acknowledgments have been uploaded successfully."
              );
            } catch (error) {
              console.error("Force upload failed:", error);
              Alert.alert(
                "Upload Failed",
                "Some uploads may have failed. Please try again."
              );
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  const getActionTitle = (action: OfflineAction): string => {
    switch (action.type) {
      case "acknowledge_group":
        return `Acknowledge Group: ${
          action.payload?.customerVisitGroup || "Unknown"
        }`;
      case "update_status":
        return `Update Status: ${action.payload?.invoiceId || "Unknown"}`;
      case "submit_signature":
        return `Submit Signature: ${
          action.payload?.customerVisitGroup || "Unknown"
        }`;
      default:
        return `Unknown Action: ${action.type}`;
    }
  };

  const getActionDescription = (action: OfflineAction): string => {
    switch (action.type) {
      case "acknowledge_group":
        return `Customer: ${
          action.payload?.customerName || "Unknown"
        }\nSigner: ${action.payload?.signerName || "Unknown"}`;
      case "update_status":
        return `New Status: ${action.payload?.newStatus || "Unknown"}`;
      case "submit_signature":
        return `Signature captured for delivery group`;
      default:
        return "No additional details available";
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderPendingAction = ({ item }: { item: OfflineAction }) => (
    <View style={styles.actionCard}>
      <View style={styles.actionHeader}>
        <View style={styles.actionTitleContainer}>
          <Feather name="upload-cloud" size={20} color="#D97706" />
          <Text style={styles.actionTitle} numberOfLines={2}>
            {getActionTitle(item)}
          </Text>
        </View>
        <View style={styles.retryBadge}>
          <Text style={styles.retryText}>
            {item.retryCount > 0 ? `Retry ${item.retryCount}` : "Pending"}
          </Text>
        </View>
      </View>

      <Text style={styles.actionDescription}>{getActionDescription(item)}</Text>

      <View style={styles.actionFooter}>
        <Text style={styles.timestamp}>
          <Feather name="clock" size={12} color="#6B7280" />{" "}
          {formatTimestamp(item.timestamp)}
        </Text>
        <Text style={styles.actionId}>ID: {item.id.slice(-8)}</Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="check-circle" size={64} color="#10B981" />
      <Text style={styles.emptyTitle}>All Caught Up!</Text>
      <Text style={styles.emptySubtitle}>
        No pending acknowledgments to upload. All your deliveries are synced.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Uploads</Text>
        <TouchableOpacity
          onPress={handleForceUpload}
          style={[
            styles.uploadButton,
            (!isOnline || uploading || pendingActions.length === 0) &&
              styles.uploadButtonDisabled,
          ]}
          disabled={!isOnline || uploading || pendingActions.length === 0}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="upload" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.statusBar}>
        <View style={styles.statusInfo}>
          <View
            style={[
              styles.connectionIndicator,
              isOnline ? styles.onlineIndicator : styles.offlineIndicator,
            ]}
          >
            <Feather
              name={isOnline ? "wifi" : "wifi-off"}
              size={14}
              color={isOnline ? "#059669" : "#DC2626"}
            />
            <Text
              style={[
                styles.connectionText,
                isOnline ? styles.onlineText : styles.offlineText,
              ]}
            >
              {isOnline ? "Online" : "Offline"}
            </Text>
          </View>
          <Text style={styles.pendingCount}>
            {pendingActions.length} pending upload
            {pendingActions.length !== 1 ? "s" : ""}
          </Text>
        </View>
        {!isOnline && (
          <Text style={styles.offlineWarning}>
            Connect to internet to upload pending acknowledgments
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text style={styles.loadingText}>Loading pending uploads...</Text>
        </View>
      ) : (
        <FlatList
          data={pendingActions}
          renderItem={renderPendingAction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  uploadButton: {
    backgroundColor: "#1D4ED8",
    borderRadius: 8,
    padding: 12,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
  statusBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  connectionIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  onlineIndicator: {
    backgroundColor: "#D1FAE5",
  },
  offlineIndicator: {
    backgroundColor: "#FEE2E2",
  },
  connectionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  onlineText: {
    color: "#059669",
  },
  offlineText: {
    color: "#DC2626",
  },
  pendingCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  offlineWarning: {
    fontSize: 12,
    color: "#DC2626",
    fontStyle: "italic",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  listContainer: {
    padding: 20,
    gap: 16,
  },
  actionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
    elevation: 1,
    gap: 12,
  },
  actionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  actionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
    flex: 1,
  },
  retryBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retryText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#D97706",
  },
  actionDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  actionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  timestamp: {
    fontSize: 12,
    color: "#6B7280",
    flex: 1,
  },
  actionId: {
    fontSize: 11,
    color: "#9CA3AF",
    fontFamily: "monospace",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
});
