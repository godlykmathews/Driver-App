import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SignatureCanvas, {
  SignatureViewRef,
} from "react-native-signature-canvas";
import Feather from "react-native-vector-icons/Feather";

import { apiService, GroupedInvoice } from "../../../../lib/api";
import { deliveryDataService } from "../../../../lib/delivery-data-service";

export default function SignatureScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [delivery, setDelivery] = useState<GroupedInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState(""); // Removed default - must enter manually
  const [signature, setSignature] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const signatureRef = useRef<SignatureViewRef | null>(null);

  useEffect(() => {
    // Only load if we haven't loaded once
    if (!hasLoadedOnce) {
      loadDeliveryDetails();
    }
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
      console.log("Attempting to load delivery from cache for signature...");
      const cachedDelivery = await deliveryDataService.getDeliveryById(id);

      if (cachedDelivery) {
        console.log("✅ Found delivery in cache, using cached data");

        // Check if already acknowledged
        if (deliveryDataService.isDeliveryAcknowledged(cachedDelivery)) {
          setError("This delivery has already been acknowledged");
          setLoading(false);
          setHasLoadedOnce(true);
          return;
        }

        setDelivery(cachedDelivery);
        setLoading(false);
        setHasLoadedOnce(true);
        return;
      }

      // If not in cache, fall back to API call (only if really necessary)
      console.log("⚠️ Delivery not in cache, fetching from API...");
      const groupedInvoices = await apiService.getInvoicesGrouped();

      const foundDelivery = groupedInvoices.find(
        (group) =>
          group.first_invoice_id?.toString() === id ||
          group.customer_visit_group === id ||
          group.invoice_numbers.includes(id)
      );

      if (foundDelivery) {
        // Check if already acknowledged
        if (deliveryDataService.isDeliveryAcknowledged(foundDelivery)) {
          setError("This delivery has already been acknowledged");
          setLoading(false);
          setHasLoadedOnce(true);
          return;
        }

        setDelivery(foundDelivery);
        // Update the cache with fresh data
        deliveryDataService.setCachedGroupedInvoices(groupedInvoices);
        setHasLoadedOnce(true);
        // DO NOT pre-fill - user must enter name manually
      } else {
        setError("Delivery not found");
      }
    } catch (err) {
      console.error("Error loading delivery details:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load delivery details"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!delivery) return;

    // Enhanced validation: Check signer name
    if (!signerName.trim()) {
      Alert.alert(
        "Missing Signer Name",
        "Please enter the full name of the person signing for these invoices."
      );
      return;
    }

    // Enhanced validation: Check signature
    if (!signature) {
      Alert.alert(
        "Missing Signature",
        "Please draw your signature in the signature area before submitting."
      );
      return;
    }

    // Validate signature is not empty
    if (signature.length < 100) {
      Alert.alert(
        "Invalid Signature",
        "Signature appears to be too short. Please draw a proper signature."
      );
      return;
    }

    try {
      setSubmitting(true);

      console.log("Submitting acknowledgment:", {
        group: delivery.customer_visit_group,
        signer: signerName.trim(),
        signatureLength: signature.length,
      });

      // Submit the acknowledgment
      await apiService.acknowledgeGroup(
        delivery.customer_visit_group,
        signature, // PNG base64 data
        signerName.trim() // Name of the signer
      );

      // Update the delivery status in cache immediately
      deliveryDataService.updateDeliveryStatus(
        delivery.customer_visit_group,
        "delivered"
      );

      Alert.alert(
        "Success",
        `Successfully acknowledged all ${delivery.invoice_count} invoice${
          delivery.invoice_count !== 1 ? "s" : ""
        } for ${delivery.customer_name}.\n\nSigned by: ${signerName}`,
        [
          {
            text: "OK",
            onPress: () => {
              // Clear the entire navigation stack and go to home
              // This prevents the "slideshow" effect when back button is pressed
              router.dismissAll();
              router.replace("/driver/home");
            },
          },
        ]
      );
    } catch (err) {
      console.error("Acknowledgment failed:", err);
      Alert.alert(
        "Submission Failed",
        err instanceof Error
          ? err.message
          : "Failed to submit signature. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature?.();
    setSignature(null);
  };

  const handleSignatureOK = (sig: string) => {
    if (sig && sig.trim() && sig.length > 50) {
      console.log("Signature captured:", {
        length: sig.length,
        preview: sig.substring(0, 50) + "...",
      });
      setSignature(sig);
    } else {
      console.warn("Signature too short or empty");
      setSignature(null);
    }
  };

  const handleSignatureEmpty = () => {
    console.log("Signature cleared");
    setSignature(null);
  };

  const handleSignatureEnd = () => {
    // Automatically read signature when user lifts finger/stylus
    setTimeout(() => {
      signatureRef.current?.readSignature?.();
    }, 100);
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
            <Feather name="arrow-left" size={20} color="#1D4ED8" /> Back to
            Invoices
          </Text>
        </TouchableOpacity>

        {/* Header Info */}
        <View style={styles.headerCard}>
          <Text style={styles.title}>Invoice Acknowledgment</Text>
          <Text style={styles.subtitle}>
            Customer: {delivery.customer_name}
          </Text>
          <Text style={styles.invoiceCount}>
            {delivery.invoice_count} Invoice
            {delivery.invoice_count !== 1 ? "s" : ""} • Total: ₹
            {delivery.total_amount.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        {/* Signer Name Input - Required and Empty by Default */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Signer's Full Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter full name of person signing"
            value={signerName}
            onChangeText={setSignerName}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Fixed Signature Pad */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Signature <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.signaturePad}>
            <SignatureCanvas
              ref={(ref) => {
                signatureRef.current = ref;
              }}
              onOK={handleSignatureOK}
              onEmpty={handleSignatureEmpty}
              onEnd={handleSignatureEnd}
              autoClear={false}
              trimWhitespace={true}
              penColor="#1D4ED8"
              backgroundColor="#FFFFFF"
              webStyle={`
                .m-signature-pad--footer {
                  display: none !important;
                }
                .m-signature-pad {
                  position: relative;
                  font-size: 10px;
                  width: 100%;
                  height: 100%;
                  border: none;
                  background-color: #FFFFFF;
                }
                .m-signature-pad--body {
                  position: relative;
                  width: 100%;
                  height: 100%;
                  background-color: #FFFFFF;
                }
                .m-signature-pad--body canvas {
                  position: relative;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: 100%;
                  touch-action: none;
                  background-color: #FFFFFF;
                }
                body, html {
                  background-color: #FFFFFF;
                  margin: 0;
                  padding: 0;
                  width: 100%;
                  height: 100%;
                }
              `}
            />
          </View>

          {signature ? (
            <View style={styles.signatureStatus}>
              <Feather name="check-circle" size={16} color="#027A48" />
              <Text style={styles.signatureConfirm}>
                Signature captured ({Math.round(signature.length / 1024)}KB)
              </Text>
            </View>
          ) : (
            <Text style={styles.helperText}>
              Touch and drag to draw your signature above
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleClear}
            disabled={submitting}
          >
            <Feather name="refresh-cw" size={16} color="#6B7280" />
            <Text style={styles.secondaryButtonText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              submitting && styles.buttonDisabled,
              (!signature || !signerName.trim()) && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || !signature || !signerName.trim()}
          >
            {submitting ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Submitting...</Text>
              </>
            ) : (
              <>
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Submit</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 20, gap: 20 },
  backLink: { fontSize: 16, color: "#1D4ED8", fontWeight: "600" },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#0F172A" },
  subtitle: { fontSize: 16, color: "#6B7280", fontWeight: "600" },
  invoiceCount: { fontSize: 14, color: "#1D4ED8", fontWeight: "600" },
  section: { gap: 8 },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    flexDirection: "row",
    alignItems: "center",
  },
  required: { color: "#EF4444", fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5F5",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "#FFFFFF",
  },
  helperText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  signatureInstructions: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
    marginBottom: 8,
  },
  signaturePad: {
    height: 220, // Increased height for better signing experience
    borderWidth: 2,
    borderColor: "#BFDBFE",
    borderRadius: 16,
    borderStyle: "dashed",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  signatureStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  signatureConfirm: {
    fontSize: 14,
    color: "#027A48",
    fontWeight: "600",
  },
  buttonRow: { flexDirection: "row", gap: 12 },
  primaryButton: {
    flex: 2,
    backgroundColor: "#1D4ED8",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#CBD5F5",
  },
  secondaryButtonText: { color: "#6B7280", fontWeight: "600", fontSize: 14 },
  buttonDisabled: { opacity: 0.5 },
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
});
