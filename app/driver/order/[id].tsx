import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";

import { apiService, GroupedInvoice } from "../../../lib/api";
import { deliveryDataService } from "../../../lib/delivery-data-service";

const statusStyles: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#FEF0C7", color: "#B54708" },
  delivered: { bg: "#DCFCE7", color: "#027A48" },
  failed: { bg: "#FEE2E2", color: "#991B1B" },
};

const formatAmount = (amount: number) =>
  `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [delivery, setDelivery] = useState<GroupedInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    // Only load if we haven't loaded once or if the ID changed
    if (!hasLoadedOnce || delivery?.first_invoice_id?.toString() !== id) {
      loadDeliveryDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadDeliveryDetails = async () => {
    if (!id) {
      setError("No delivery ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First try to get from cached data (much faster)
      console.log("Attempting to load delivery from cache...");
      const cachedDelivery = await deliveryDataService.getDeliveryById(id);

      if (cachedDelivery) {
        console.log("✅ Found delivery in cache, using cached data");
        setDelivery(cachedDelivery);
        setLoading(false);
        setHasLoadedOnce(true);
        return;
      }

      // If not in cache, fall back to API call (only if really necessary)
      console.log("⚠️ Delivery not in cache, fetching from API...");

      // If id looks like a customer_visit_group (contains "-"), fetch it directly
      let foundDelivery: GroupedInvoice | undefined;
      if (id.includes("-")) {
        try {
          foundDelivery = await apiService.getDeliveryDetails(id);
        } catch {
          // Fall through to broad search below
        }
      }

      if (!foundDelivery) {
        const groupedInvoices = await apiService.getInvoicesGrouped();
        foundDelivery = groupedInvoices.find(
          (group) =>
            group.first_invoice_id?.toString() === id ||
            group.customer_visit_group === id ||
            group.invoice_numbers.includes(id),
        );
        if (groupedInvoices.length > 0) {
          deliveryDataService.setCachedGroupedInvoices(groupedInvoices);
        }
      }

      if (foundDelivery) {
        setDelivery(foundDelivery);
        setHasLoadedOnce(true);
      } else {
        setError("Delivery not found");
      }
    } catch (err) {
      console.error("Error loading delivery details:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load delivery details",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignature = () => {
    if (!delivery) return;

    // Check if already acknowledged before navigating
    if (deliveryDataService.isDeliveryAcknowledged(delivery)) {
      Alert.alert(
        "Already Completed",
        "This delivery has already been acknowledged and signed.",
        [{ text: "OK" }],
      );
      return;
    }

    router.push({
      pathname: "/driver/order/[id]/signature",
      params: {
        id:
          delivery.first_invoice_id?.toString() ||
          delivery.customer_visit_group,
      },
    } as never);
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text style={styles.loadingText}>Loading delivery details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !delivery) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Feather name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.missingTitle}>
            {error || "Delivery not found"}
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>
            <Feather name="arrow-left" size={20} color="#1D4ED8" /> Back
          </Text>
        </TouchableOpacity>

        {/* Customer Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.customerInfo}>
            <Text style={styles.customer}>{delivery.customer_name}</Text>
            <Text style={styles.location}>
              {delivery.shop_address || "Address not available"}
            </Text>
            <Text style={styles.branch}>
              Branch: {delivery.branch || "N/A"}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.routeBadge}>
              <Text style={styles.routeBadgeText}>
                {delivery.route_display || `Route ${delivery.route_number}`}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    statusStyles[delivery.status]?.bg ||
                    statusStyles.pending.bg,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      statusStyles[delivery.status]?.color ||
                      statusStyles.pending.color,
                  },
                ]}
              >
                {delivery.status.charAt(0).toUpperCase() +
                  delivery.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Invoice Details Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Invoice Details ({delivery.invoice_count})
            </Text>
            <Text style={styles.sectionTotalLabel}>Total: </Text>
            <Text style={styles.sectionTotalValue}>
              {formatAmount(delivery.total_amount)}
            </Text>
          </View>

          {/* Invoice Numbers */}
          {delivery.invoice_numbers.map((invoiceNumber, index) => (
            <View key={invoiceNumber} style={styles.invoiceCard}>
              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceId}>{invoiceNumber}</Text>
                <View
                  style={[
                    styles.invoiceStatus,
                    {
                      backgroundColor:
                        statusStyles[delivery.status]?.bg ||
                        statusStyles.pending.bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.invoiceStatusText,
                      {
                        color:
                          statusStyles[delivery.status]?.color ||
                          statusStyles.pending.color,
                      },
                    ]}
                  >
                    {delivery.status.charAt(0).toUpperCase() +
                      delivery.status.slice(1)}
                  </Text>
                </View>
              </View>
              <Text style={styles.invoiceDate}>
                {new Date().toLocaleDateString("en-IN")} {/* Today's date */}
              </Text>
              <View style={styles.invoiceFooter}>
                <Text style={styles.invoiceAmountLabel}>Amount</Text>
                <Text style={styles.invoiceAmount}>
                  {formatAmount(delivery.total_amount / delivery.invoice_count)}
                </Text>
              </View>
              <View style={styles.sequenceInfo}>
                <Text style={styles.sequenceText}>
                  Sequence: {delivery.sequence_order || index + 1}
                </Text>
              </View>
            </View>
          ))}

          <View style={styles.sectionFooter}>
            <Text style={styles.sectionFooterLabel}>Total Amount</Text>
            <Text style={styles.sectionTotalValue}>
              {formatAmount(delivery.total_amount)}
            </Text>
          </View>
        </View>

        {/* Signature Button - Only show if not already delivered/acknowledged */}
        {!deliveryDataService.isDeliveryAcknowledged(delivery) ? (
          <>
            <TouchableOpacity
              style={styles.signatureButton}
              onPress={handleSignature}
            >
              <Feather name="edit-3" size={20} color="#FFFFFF" />
              <Text style={styles.signatureButtonText}>
                Capture Signature for All Invoices
              </Text>
            </TouchableOpacity>

            <Text style={styles.signatureHint}>
              One signature will acknowledge all {delivery.invoice_count}{" "}
              invoice
              {delivery.invoice_count !== 1 ? "s" : ""}
            </Text>
          </>
        ) : (
          <View style={styles.acknowledgedContainer}>
            <View style={styles.acknowledgedBadge}>
              <Feather name="check-circle" size={24} color="#059669" />
              <Text style={styles.acknowledgedText}>
                All invoices have been acknowledged
              </Text>
            </View>
            <Text style={styles.acknowledgedSubtext}>
              {delivery.invoice_count} invoice
              {delivery.invoice_count !== 1 ? "s" : ""} completed
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 20, gap: 16 },
  backLink: { fontSize: 16, color: "#1D4ED8", fontWeight: "600" },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  customerInfo: {
    flex: 1,
    marginRight: 16,
  },
  customer: { fontSize: 20, fontWeight: "700", color: "#0F172A" },
  location: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  branch: { fontSize: 13, color: "#9CA3AF", marginTop: 2 },
  headerRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  routeBadge: {
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  routeBadgeText: { color: "#1D4ED8", fontSize: 13, fontWeight: "600" },
  statusBadge: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  pendingButton: {
    backgroundColor: "#FEF0C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  pendingButtonText: {
    color: "#B54708",
    fontWeight: "600",
    fontSize: 14,
  },
  deliveredButton: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  deliveredButtonText: {
    color: "#027A48",
    fontWeight: "600",
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#1D4ED8",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    gap: 16,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937" },
  sectionTotalLabel: { fontSize: 16, color: "#475569" },
  sectionTotalValue: { fontSize: 18, fontWeight: "700", color: "#1D4ED8" },
  invoiceCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  invoiceId: { fontSize: 16, fontWeight: "600", color: "#0F172A" },
  invoiceStatus: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  invoiceStatusText: { fontSize: 12, fontWeight: "600" },
  invoiceDate: { fontSize: 13, color: "#6B7280" },
  invoiceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  invoiceAmountLabel: { fontSize: 13, color: "#475569" },
  invoiceAmount: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  sequenceInfo: {
    marginTop: 4,
  },
  sequenceText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  sectionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 12,
  },
  sectionFooterLabel: { fontSize: 16, color: "#475569" },
  signatureButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  signatureButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  signatureHint: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 13,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    gap: 12,
    elevation: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
    textAlign: "center",
  },
  loadingText: { fontSize: 16, color: "#64748B", fontWeight: "600" },
  acknowledgedContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
  acknowledgedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
  },
  acknowledgedText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#059669",
  },
  acknowledgedSubtext: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
