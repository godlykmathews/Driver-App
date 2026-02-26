import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";

// Import API service with proper error handling
import {
  apiService,
  type DriverRoute,
  type GroupedInvoice,
} from "../../lib/api";

import { useOffline } from "../../hooks/use-offline";
import { deliveryDataService } from "../../lib/delivery-data-service";

// Filter pill component
const FilterPill = React.memo(
  ({
    label,
    active = false,
    onPress,
  }: {
    label: string;
    active?: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.filterPill, active && styles.filterPillActive]}
      onPress={onPress}
    >
      <Text
        style={[styles.filterPillText, active && styles.filterPillTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  ),
);
FilterPill.displayName = "FilterPill";

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "delivered"
  >("all");
  const [routeFilter, setRouteFilter] = useState<number | "all">("all");
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);
  const [groups, setGroups] = useState<GroupedInvoice[]>([]);
  const [routes, setRoutes] = useState<DriverRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // Use offline hook
  const { isOnline, syncStatus } = useOffline();

  useEffect(() => {
    // Only load on initial mount
    if (!hasInitialLoad) {
      loadInvoices();
      loadRoutes();
      setHasInitialLoad(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use focus effect to refresh data only when returning from completed signature
  useFocusEffect(
    useCallback(() => {
      // Check if we need to refresh data (e.g., after completing a signature)
      const shouldRefresh = async () => {
        // Only refresh if we have initial data and cache is getting old
        if (hasInitialLoad && groups.length > 0) {
          const cacheInfo = deliveryDataService.getCacheInfo();
          // Refresh if cache is older than 10 minutes
          if (cacheInfo.age > 10 * 60 * 1000) {
            console.log("🔄 Cache is old, refreshing on focus");
            await handleRefresh();
          }
        }
      };

      shouldRefresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasInitialLoad, groups.length]),
  );

  useEffect(() => {
    // Only reload when route filter changes, not on every mount
    if (hasInitialLoad) {
      loadInvoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFilter]);

  const loadRoutes = async () => {
    try {
      const routesResponse = await apiService.getDriverRoutes();
      setRoutes(routesResponse.routes);
    } catch (err) {
      console.error("Error loading routes:", err);
      // Don't show error for routes as it's supplementary data
      // But still try to show offline message if appropriate
      if (
        err instanceof Error &&
        err.message.includes("No internet connection")
      ) {
        console.log("Using cached routes due to offline status");
      }
    }
  };

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const routeNumber = routeFilter === "all" ? undefined : routeFilter;
      // When route is selected, don't pass date to get all invoices for that route
      // When "All Routes" is selected, get today's invoices
      const date = routeFilter === "all" ? undefined : null; // null means don't filter by date
      const groupedInvoices = await apiService.getInvoicesGrouped(
        date,
        routeNumber,
      );
      setGroups(groupedInvoices);

      // Cache grouped invoices in delivery data service for faster access
      deliveryDataService.setCachedGroupedInvoices(groupedInvoices);

      // Prefetch invoice details for offline access (only when online)
      if (isOnline && groupedInvoices.length > 0) {
        // Don't await this to avoid blocking the UI
        apiService.prefetchInvoiceDetails(groupedInvoices).catch((error) => {
          console.warn(
            "📱 Prefetch failed (this won't affect app functionality):",
            error,
          );
        });
      }
    } catch (err) {
      console.error("Error loading invoices:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load invoices";

      // Show more helpful error messages for offline scenarios
      if (errorMessage.includes("No internet connection")) {
        setError("You're offline. Showing cached data if available.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);

      // Refresh both routes and invoices
      await loadRoutes();

      const routeNumber = routeFilter === "all" ? undefined : routeFilter;
      const date = routeFilter === "all" ? undefined : null;
      const groupedInvoices = await apiService.getInvoicesGrouped(
        date,
        routeNumber,
      );
      setGroups(groupedInvoices);

      // Update the cache with fresh data
      deliveryDataService.setCachedGroupedInvoices(groupedInvoices);
    } catch (err) {
      console.error("Error refreshing invoices:", err);
      setError(
        err instanceof Error ? err.message : "Failed to refresh invoices",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await apiService.logout();
            // Clear delivery cache on logout
            deliveryDataService.clearCache();
            // Use replace to prevent going back to home and clear entire stack
            router.dismissAll();
            router.replace("/driver/login");
          } catch (error) {
            console.error("Logout error:", error);
            // Even if logout API fails, clear local data and navigate to login
            deliveryDataService.clearCache();
            router.dismissAll();
            router.replace("/driver/login");
          }
        },
      },
    ]);
  };

  const navigateToDetails = (delivery: GroupedInvoice) => {
    router.push({
      pathname: "/driver/order/[id]",
      params: {
        id:
          delivery.first_invoice_id?.toString() ||
          delivery.customer_visit_group,
      },
    });
  };

  const getRouteDisplayName = () => {
    if (routeFilter === "all") return "All Routes";
    const selectedRoute = routes.find((r) => r.route_number === routeFilter);
    return selectedRoute ? selectedRoute.route_display : "All Routes";
  };

  const handleRouteSelect = (routeNumber: number | "all") => {
    setRouteFilter(routeNumber);
    setShowRouteDropdown(false);
  };

  // Filter groups based on search and status
  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      !searchQuery ||
      group.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.customer_visit_group
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || group.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const renderDeliveryCard = ({ item: delivery }: { item: GroupedInvoice }) => (
    <TouchableOpacity
      style={styles.deliveryCard}
      key={delivery.customer_visit_group}
      onPress={() => navigateToDetails(delivery)}
      activeOpacity={0.7}
    >
      <View style={styles.deliveryHeader}>
        <View style={styles.deliveryTitleContainer}>
          <Text style={styles.customerName} numberOfLines={1}>
            {delivery.customer_name}
          </Text>
          <View
            style={[
              styles.statusBadge,
              delivery.status === "pending" && styles.statusPending,
              delivery.status === "delivered" && styles.statusDelivered,
            ]}
          >
            <Text
              style={[
                styles.deliveryStatusText,
                delivery.status === "pending" && styles.statusTextPending,
                delivery.status === "delivered" && styles.statusTextDelivered,
              ]}
            >
              {delivery.status.charAt(0).toUpperCase() +
                delivery.status.slice(1)}
            </Text>
          </View>
        </View>

        {delivery.shop_address && (
          <Text style={styles.address} numberOfLines={2}>
            <Feather name="map-pin" size={12} color="#6B7280" />{" "}
            {delivery.shop_address}
          </Text>
        )}
      </View>

      <View style={styles.deliveryDetails}>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Feather name="package" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {delivery.invoice_count} Invoice
              {delivery.invoice_count !== 1 ? "s" : ""}
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailText}>
              ₹
              {delivery.total_amount.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>

        {delivery.route_display && (
          <View style={styles.detailItem}>
            <Feather name="navigation" size={16} color="#6B7280" />
            <Text style={styles.detailText}>{delivery.route_display}</Text>
          </View>
        )}
      </View>

      <View style={styles.clickIndicator}>
        <Feather name="chevron-right" size={20} color="#6B7280" />
      </View>
    </TouchableOpacity>
  );

  if (loading && groups.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text style={styles.loadingText}>Loading deliveries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>
              {routeFilter === "all"
                ? "Today's Deliveries"
                : `${
                    routes.find((r) => r.route_number === routeFilter)
                      ?.route_display || "Route"
                  } Deliveries`}
            </Text>
            {/* Connection and sync status indicator */}
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.connectionStatus,
                  isOnline ? styles.onlineStatus : styles.offlineStatus,
                ]}
              >
                <Feather
                  name={isOnline ? "wifi" : "wifi-off"}
                  size={12}
                  color={isOnline ? "#059669" : "#DC2626"}
                />
                <Text
                  style={[
                    styles.statusText,
                    isOnline ? styles.onlineText : styles.offlineText,
                  ]}
                >
                  {isOnline ? "Online" : "Offline"}
                </Text>
              </View>
              {syncStatus.pendingActions > 0 && (
                <TouchableOpacity
                  style={styles.syncStatus}
                  onPress={() => router.push("/driver/pending-uploads")}
                  activeOpacity={0.7}
                >
                  <Feather name="upload-cloud" size={12} color="#D97706" />
                  <Text style={styles.syncText}>
                    {syncStatus.pendingActions} pending
                  </Text>
                  <Feather name="chevron-right" size={12} color="#D97706" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Feather name="log-out" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Feather
            name="search"
            size={20}
            color="#6B7280"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer or group..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setShowRouteDropdown(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filter */}
        <View style={styles.filterContainer}>
          <FilterPill
            label="All"
            active={statusFilter === "all"}
            onPress={() => setStatusFilter("all")}
          />
          <FilterPill
            label="Pending"
            active={statusFilter === "pending"}
            onPress={() => setStatusFilter("pending")}
          />
          <FilterPill
            label="Delivered"
            active={statusFilter === "delivered"}
            onPress={() => setStatusFilter("delivered")}
          />
        </View>

        {/* Route Filter Dropdown */}
        <View style={styles.routeFilterContainer}>
          <Text style={styles.filterLabel}>Routes:</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowRouteDropdown(!showRouteDropdown)}
          >
            <Text style={styles.dropdownText}>{getRouteDisplayName()}</Text>
            <Feather
              name={showRouteDropdown ? "chevron-up" : "chevron-down"}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>

          {showRouteDropdown && (
            <View style={styles.dropdownMenu}>
              <TouchableOpacity
                style={[
                  styles.dropdownItem,
                  routeFilter === "all" && styles.dropdownItemActive,
                ]}
                onPress={() => handleRouteSelect("all")}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    routeFilter === "all" && styles.dropdownItemTextActive,
                  ]}
                >
                  All Routes
                </Text>
              </TouchableOpacity>
              {routes.map((route, index) => (
                <TouchableOpacity
                  key={route.route_number}
                  style={[
                    styles.dropdownItem,
                    routeFilter === route.route_number &&
                      styles.dropdownItemActive,
                    index === routes.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => handleRouteSelect(route.route_number)}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      routeFilter === route.route_number &&
                        styles.dropdownItemTextActive,
                    ]}
                  >
                    {route.route_display}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={20} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadInvoices} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredGroups}
        renderItem={renderDeliveryCard}
        keyExtractor={(item) => item.customer_visit_group}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onScrollBeginDrag={() => setShowRouteDropdown(false)}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Feather name="package" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No deliveries found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || statusFilter !== "all" || routeFilter !== "all"
                ? "Try adjusting your search or filters"
                : routeFilter === "all"
                  ? "No deliveries assigned for today"
                  : "No deliveries found for this route"}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: { fontSize: 16, color: "#64748B", fontWeight: "500" },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 16,
    elevation: 999,
    zIndex: 999,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleContainer: {
    flex: 1,
    gap: 8,
  },
  title: { fontSize: 24, fontWeight: "700", color: "#0F172A" },
  statusContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  onlineStatus: {
    backgroundColor: "#D1FAE5",
  },
  offlineStatus: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  onlineText: {
    color: "#059669",
  },
  offlineText: {
    color: "#DC2626",
  },
  syncStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  syncText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#D97706",
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: { opacity: 0.7 },
  searchInput: { flex: 1, fontSize: 16, color: "#0F172A" },
  filterContainer: {
    flexDirection: "row",
    gap: 8,
  },
  routeFilterContainer: {
    gap: 8,
    position: "relative",
    zIndex: 1000,
    elevation: 1000,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dropdownText: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "500",
  },
  dropdownMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 1000,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    zIndex: 1001,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownItemActive: {
    backgroundColor: "#EBF4FF",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#374151",
  },
  dropdownItemTextActive: {
    color: "#1D4ED8",
    fontWeight: "600",
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterPillActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  filterPillText: { fontSize: 14, fontWeight: "500", color: "#64748B" },
  filterPillTextActive: { color: "#FFFFFF" },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: { flex: 1, color: "#DC2626", fontSize: 14 },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#DC2626",
    borderRadius: 4,
  },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  listContainer: { padding: 20, gap: 16 },
  deliveryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    gap: 16,
  },
  clickIndicator: {
    alignItems: "flex-end",
    paddingTop: 8,
  },
  deliveryHeader: { gap: 8 },
  deliveryTitleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  customerName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: { backgroundColor: "#FEF3C7" },
  statusDelivered: { backgroundColor: "#D1FAE5" },
  statusFailed: { backgroundColor: "#FEE2E2" },
  deliveryStatusText: { fontSize: 12, fontWeight: "600" },
  statusTextPending: { color: "#D97706" },
  statusTextDelivered: { color: "#059669" },
  statusTextFailed: { color: "#DC2626" },
  deliveryGroup: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  address: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  deliveryDetails: { gap: 8 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
});
