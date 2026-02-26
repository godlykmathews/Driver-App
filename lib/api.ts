import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

// Import offline service (will be imported after it's created)
let offlineService: any;

// Lazy import to avoid circular dependency
const getOfflineService = async () => {
  if (!offlineService) {
    const { offlineService: service } = await import("./offline-service");
    offlineService = service;
  }
  return offlineService;
};

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_address: string;
  customer_phone?: string;
  total_amount: number;
  delivery_date?: string;
  status: "pending" | "delivered" | "failed";
  items?: string;
  signature_data?: string;
  signature_timestamp?: string;
  delivery_notes?: string;
  driver_id?: number;
}

// Keep existing interfaces for backward compatibility
export interface DriverRoute {
  route_number: number;
  route_name?: string | null;
  route_display: string;
  invoice_count: number;
  driver_name: string;
  created_date: string;
}

export interface DriverRoutesResponse {
  routes: DriverRoute[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

export interface GroupedInvoice {
  customer_visit_group: string;
  customer_name: string;
  shop_address?: string | null;
  route_number?: number;
  route_name?: string | null;
  route_display?: string | null;
  invoice_count: number;
  total_amount: number;
  status: "pending" | "delivered" | "failed" | string;
  first_invoice_id?: number;
  invoice_numbers: string[];
  sequence_order?: number;
  branch?: string | null;
}

class ApiService {
  private baseURL = "https://driver-backend-ten.vercel.app/api/v1/";
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem("auth_token");
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }

  async setToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem("auth_token", token);
    } catch (error) {
      console.error("Error setting token:", error);
    }
  }

  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem("auth_token");
      await AsyncStorage.removeItem("refresh_token");
      await AsyncStorage.removeItem("user_name");
    } catch (error) {
      console.error("Error during logout:", error);
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = await this.getToken();

    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, config);

      if (!response.ok) {
        // Try to get error details from response body
        let errorDetails = "";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorDetails = JSON.stringify(errorData);
          } else {
            errorDetails = await response.text();
          }
        } catch {
          errorDetails = "Unable to parse error response";
        }

        if (response.status === 401) {
          // Token expired or invalid - logout and redirect to login
          await this.logout();
          router.replace("/driver/login");
          throw new Error("Session expired. Please login again.");
        }

        if (response.status === 400) {
          console.error(`Bad Request (400) for ${endpoint}:`, errorDetails);
          throw new Error(
            `Bad Request: ${errorDetails || "Invalid request parameters"}`,
          );
        }

        if (response.status === 404) {
          console.error(`Not Found (404) for ${endpoint}:`, errorDetails);
          throw new Error(`Resource not found: ${endpoint}`);
        }

        console.error(
          `HTTP ${response.status} error for ${endpoint}:`,
          errorDetails,
        );
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorDetails}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async login(
    username: string,
    password: string,
  ): Promise<{
    token: string;
    user: {
      id: string;
      username: string;
      name: string;
      role: string;
      branches: string[];
      is_active: boolean;
    };
  }> {
    try {
      const response = await fetch(`${this.baseURL}login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Login failed:", errorData);
        throw new Error("Invalid credentials");
      }

      const data = await response.json();
      console.log("Login response:", data);

      // Store the token (not access_token)
      await this.setToken(data.token); // Changed from data.access_token to data.token

      // Store user info if needed
      await AsyncStorage.setItem("user_info", JSON.stringify(data.user));

      return data;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  async getInvoicesGrouped(
    date?: string | null,
    routeNumber?: number,
  ): Promise<GroupedInvoice[]> {
    const offline = await getOfflineService();

    // Try to get cached data first if offline
    const isOnline = await offline.isNetworkAvailable();
    if (!isOnline) {
      console.log("Device is offline, trying to get cached data...");
      const cachedData = await offline.getCachedGroupedInvoices(
        date,
        routeNumber,
      );
      if (cachedData) {
        return cachedData;
      }
      throw new Error("No internet connection and no cached data available");
    }

    try {
      const params = new URLSearchParams();

      // Only add date filter if date is provided and not null
      if (date !== null && date !== undefined) {
        const d = date || new Date().toISOString().split("T")[0];
        params.append("created_date", d);
      }

      if (routeNumber) {
        params.append("route_number", routeNumber.toString());
      }

      const queryString = params.toString();
      const endpoint = `invoices-grouped${
        queryString ? `?${queryString}` : ""
      }`;
      const res = await this.request<any>(endpoint);

      // support either direct array or { groups: [...] } response shapes
      let groups: GroupedInvoice[] = [];
      if (Array.isArray(res)) {
        groups = res as GroupedInvoice[];
      } else if (res && Array.isArray(res.groups)) {
        groups = res.groups as GroupedInvoice[];
      }

      // Cache the data for offline use
      if (groups.length > 0) {
        await offline.cacheGroupedInvoices(groups, date, routeNumber);
      }

      return groups;
    } catch (error) {
      // If online request fails, try to get cached data as fallback
      console.log("Online request failed, trying cached data...");
      const cachedData = await offline.getCachedGroupedInvoices(
        date,
        routeNumber,
      );
      if (cachedData) {
        return cachedData;
      }
      throw error;
    }
  }

  // Get driver routes (no date filter needed)
  async getDriverRoutes(): Promise<DriverRoutesResponse> {
    const offline = await getOfflineService();

    // Try to get cached data first if offline
    const isOnline = await offline.isNetworkAvailable();
    if (!isOnline) {
      console.log("Device is offline, trying to get cached routes...");
      const cachedRoutes = await offline.getCachedRoutes();
      if (cachedRoutes) {
        return {
          routes: cachedRoutes,
          pagination: {
            current_page: 1,
            total_pages: 1,
            total_count: cachedRoutes.length,
            per_page: cachedRoutes.length,
          },
        };
      }
      throw new Error("No internet connection and no cached routes available");
    }

    try {
      const result = await this.request<DriverRoutesResponse>("driver-routes");

      // Cache the routes for offline use
      if (result.routes && result.routes.length > 0) {
        await offline.cacheRoutes(result.routes);
      }

      return result;
    } catch (error) {
      // If online request fails, try to get cached data as fallback
      console.log("Online request failed, trying cached routes...");
      const cachedRoutes = await offline.getCachedRoutes();
      if (cachedRoutes) {
        return {
          routes: cachedRoutes,
          pagination: {
            current_page: 1,
            total_pages: 1,
            total_count: cachedRoutes.length,
            per_page: cachedRoutes.length,
          },
        };
      }
      throw error;
    }
  }

  async getInvoiceDetails(invoiceId: string): Promise<Invoice> {
    const offline = await getOfflineService();

    // Try to get cached data first if offline
    const isOnline = await offline.isNetworkAvailable();
    if (!isOnline) {
      console.log("Device is offline, trying to get cached invoice details...");
      const cachedDetails = await offline.getCachedInvoiceDetails(invoiceId);
      if (cachedDetails) {
        return cachedDetails;
      }
      throw new Error(
        "No internet connection and no cached invoice details available",
      );
    }

    try {
      const details = await this.request<Invoice>(`invoices/${invoiceId}`);

      // Cache the details for offline use
      await offline.cacheInvoiceDetails(invoiceId, details);

      return details;
    } catch (error) {
      // If online request fails, try to get cached data as fallback
      console.log("Online request failed, trying cached invoice details...");
      const cachedDetails = await offline.getCachedInvoiceDetails(invoiceId);
      if (cachedDetails) {
        return cachedDetails;
      }
      throw error;
    }
  }

  async getDeliveryDetails(groupId: string): Promise<GroupedInvoice> {
    const res = await this.request<{
      customer_visit_group: string;
      customer_name: string;
      route_number: number;
      route_name: string;
      route_display: string;
      invoices: {
        invoice_id: number;
        n_inv_no: string;
        amount: number;
        status: string;
        cust_name?: string;
        shop_address?: string;
      }[];
      total_amount: number;
      invoice_count: number;
      all_acknowledged: boolean;
      branch: string;
    }>(`customer-group/${encodeURIComponent(groupId)}`);

    return {
      customer_visit_group: res.customer_visit_group,
      customer_name: res.customer_name,
      shop_address: res.invoices[0]?.shop_address ?? null,
      route_number: res.route_number,
      route_name: res.route_name,
      route_display: res.route_display,
      invoice_count: res.invoice_count,
      total_amount: res.total_amount,
      status: res.all_acknowledged ? "delivered" : "pending",
      first_invoice_id: res.invoices[0]?.invoice_id,
      invoice_numbers: res.invoices.map((inv) => inv.n_inv_no),
      branch: res.branch,
    };
  }

  async acknowledgeGroup(
    customerVisitGroup: string,
    signatureData: string,
    signerName: string,
  ): Promise<void> {
    // Validate inputs before sending
    if (!customerVisitGroup) {
      throw new Error("Customer visit group is required");
    }

    if (!signatureData) {
      throw new Error("Signature data is required");
    }

    if (!signerName.trim()) {
      throw new Error("Signer name is required");
    }

    const offline = await getOfflineService();

    // Check if online
    const isOnline = await offline.isNetworkAvailable();
    if (!isOnline) {
      console.log("Device is offline, saving acknowledgment for later sync...");
      await offline.saveOfflineAction({
        type: "acknowledge_group",
        payload: {
          customerVisitGroup,
          signatureData,
          signerName,
        },
      });
      throw new Error(
        "No internet connection. Acknowledgment saved for later sync.",
      );
    }

    try {
      const token = await this.getToken();

      // Create FormData for React Native - Direct data URI approach
      const formData = new FormData();

      // Add signature as data URI directly (React Native compatible)
      formData.append("signature", {
        uri: signatureData, // Full data URI: data:image/png;base64,iVBORw0KG...
        type: "image/png",
        name: "signature.png",
      } as any);

      formData.append("notes", signerName.trim());

      console.log("Sending acknowledgment request:", {
        customerVisitGroup,
        notes: signerName.trim(),
        signatureDataLength: signatureData.length,
        hasDataUriPrefix: signatureData.startsWith("data:"),
      });

      const response = await fetch(
        `${this.baseURL}acknowledge-group/${encodeURIComponent(
          customerVisitGroup,
        )}`,
        {
          method: "POST",
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
            // Don't set Content-Type for multipart/form-data - let React Native handle it
          },
          body: formData,
        },
      );

      console.log(`Acknowledgment response status: ${response.status}`);

      if (!response.ok) {
        let errorData;
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json();
        } else {
          errorData = await response.text();
        }

        console.error("Acknowledgment API Error Response:", errorData);

        if (response.status === 401) {
          await this.logout();
          throw new Error("Authentication required");
        }

        if (response.status === 422) {
          const errorMessage =
            typeof errorData === "object" && errorData.detail
              ? `Validation error: ${JSON.stringify(errorData.detail)}`
              : typeof errorData === "string"
                ? errorData
                : `Validation error: ${JSON.stringify(errorData)}`;
          throw new Error(errorMessage);
        }

        throw new Error(
          `HTTP error! status: ${response.status}, details: ${JSON.stringify(
            errorData,
          )}`,
        );
      }

      const result = await response.json();
      console.log("Acknowledgment successful:", result);
    } catch (error) {
      console.error("Acknowledgment request failed:", error);

      // If it's a network error, save for offline sync
      if (
        error instanceof Error &&
        (error.message.includes("Network request failed") ||
          error.message.includes("fetch") ||
          error.message.includes("ERR_NETWORK"))
      ) {
        console.log(
          "Network error detected, saving acknowledgment for later sync...",
        );
        await offline.saveOfflineAction({
          type: "acknowledge_group",
          payload: {
            customerVisitGroup,
            signatureData,
            signerName,
          },
        });
        throw new Error("Network error. Acknowledgment saved for later sync.");
      }

      throw error;
    }
  }

  // Prefetch invoice details for offline access
  async prefetchInvoiceDetails(groups: GroupedInvoice[]): Promise<void> {
    const offline = await getOfflineService();
    const isOnline = await offline.isNetworkAvailable();

    if (!isOnline) {
      console.log("Device is offline, skipping prefetch");
      return;
    }

    console.log(`📦 Starting prefetch for ${groups.length} groups`);

    // Debug: Log the structure of groups to understand data
    if (groups.length > 0) {
      console.log("📋 Sample group structure:", {
        customer_visit_group: groups[0].customer_visit_group,
        first_invoice_id: groups[0].first_invoice_id,
        invoice_numbers: groups[0].invoice_numbers,
        has_first_invoice_id: groups[0].first_invoice_id !== undefined,
        first_invoice_id_type: typeof groups[0].first_invoice_id,
      });
    }

    // Extract only numeric invoice IDs from groups
    const invoiceIds: string[] = [];
    groups.forEach((group, index) => {
      // Only use first_invoice_id which should be numeric
      if (
        group.first_invoice_id &&
        typeof group.first_invoice_id === "number"
      ) {
        invoiceIds.push(group.first_invoice_id.toString());
      } else {
        console.log(`⚠️ Group ${index} missing or invalid first_invoice_id:`, {
          customer_visit_group: group.customer_visit_group,
          first_invoice_id: group.first_invoice_id,
          type: typeof group.first_invoice_id,
        });
      }
      // Note: invoice_numbers are string identifiers like "INV001002"
      // and cannot be used as numeric IDs for the API endpoint
    });

    // Remove duplicates and filter out any non-numeric values
    const uniqueInvoiceIds = [...new Set(invoiceIds)].filter((id) => {
      const isNumeric = /^\d+$/.test(id);
      if (!isNumeric) {
        console.warn(`⚠️ Skipping non-numeric invoice ID: ${id}`);
      }
      return isNumeric;
    });

    if (uniqueInvoiceIds.length === 0) {
      console.log("⚠️ No valid numeric invoice IDs found for prefetch");
      return;
    }

    console.log(
      `🚀 Prefetching details for ${
        uniqueInvoiceIds.length
      } valid invoice IDs: [${uniqueInvoiceIds.join(", ")}]`,
    );

    // Prefetch in batches to avoid overwhelming the server
    const batchSize = 3; // Reduced batch size to prevent server overload
    for (let i = 0; i < uniqueInvoiceIds.length; i += batchSize) {
      const batch = uniqueInvoiceIds.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (invoiceId) => {
          try {
            // Check if already cached
            const cached = await offline.getCachedInvoiceDetails(invoiceId);
            if (cached) {
              console.log(`✅ Invoice ${invoiceId} already cached, skipping`);
              return;
            }

            // Fetch and cache invoice details using numeric ID
            console.log(`🔄 Fetching invoice details for ID: ${invoiceId}`);
            const details = await this.request<Invoice>(
              `invoices/${invoiceId}`,
            );
            await offline.cacheInvoiceDetails(invoiceId, details);
            console.log(`✅ Prefetched and cached invoice ${invoiceId}`);
          } catch (error) {
            // Log warning but don't break the prefetch process
            console.warn(`⚠️ Failed to prefetch invoice ${invoiceId}:`, error);
          }
        }),
      );

      // Longer delay between batches to be nice to the server
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log("🎉 Prefetch completed");
  }
}

export const apiService = new ApiService();
