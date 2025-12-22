import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { apiService } from "./api";

export interface OfflineAction {
  id: string;
  type: "acknowledge_group" | "update_status" | "submit_signature";
  timestamp: number;
  payload: any;
  retryCount: number;
}

export interface CachedInvoiceDetails {
  [key: string]: any; // Store invoice details by ID
}

class OfflineService {
  private readonly OFFLINE_ACTIONS_KEY = "offline_actions";
  private readonly CACHED_INVOICES_KEY = "cached_invoices";
  private readonly CACHED_GROUPS_KEY = "cached_groups";
  private readonly CACHED_ROUTES_KEY = "cached_routes";
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;

  constructor() {
    this.initNetworkListener();
  }

  private initNetworkListener() {
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      console.log("Network state changed:", {
        isConnected: this.isOnline,
        type: state.type,
        wasOffline,
      });

      // If we just came online, sync pending actions
      if (wasOffline && this.isOnline && !this.syncInProgress) {
        this.syncOfflineActions();
      }
    });
  }

  async isNetworkAvailable(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  }

  // Save failed action for later sync
  async saveOfflineAction(
    action: Omit<OfflineAction, "id" | "timestamp" | "retryCount">
  ): Promise<void> {
    try {
      const offlineAction: OfflineAction = {
        ...action,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        retryCount: 0,
      };

      const existingActions = await this.getOfflineActions();
      existingActions.push(offlineAction);

      await AsyncStorage.setItem(
        this.OFFLINE_ACTIONS_KEY,
        JSON.stringify(existingActions)
      );
      console.log("Saved offline action:", action.type);
    } catch (error) {
      console.error("Error saving offline action:", error);
    }
  }

  // Get all pending offline actions
  async getOfflineActions(): Promise<OfflineAction[]> {
    try {
      const actionsJson = await AsyncStorage.getItem(this.OFFLINE_ACTIONS_KEY);
      return actionsJson ? JSON.parse(actionsJson) : [];
    } catch (error) {
      console.error("Error getting offline actions:", error);
      return [];
    }
  }

  // Remove specific offline action
  async removeOfflineAction(actionId: string): Promise<void> {
    try {
      const actions = await this.getOfflineActions();
      const filteredActions = actions.filter(
        (action) => action.id !== actionId
      );
      await AsyncStorage.setItem(
        this.OFFLINE_ACTIONS_KEY,
        JSON.stringify(filteredActions)
      );
      console.log("Removed offline action:", actionId);
    } catch (error) {
      console.error("Error removing offline action:", error);
    }
  }

  // Sync all pending offline actions
  async syncOfflineActions(): Promise<void> {
    if (this.syncInProgress) {
      console.log("Sync already in progress, skipping...");
      return;
    }

    this.syncInProgress = true;
    console.log("Starting offline actions sync...");

    try {
      const actions = await this.getOfflineActions();
      console.log(`Found ${actions.length} offline actions to sync`);

      for (const action of actions) {
        try {
          let success = false;

          switch (action.type) {
            case "acknowledge_group":
              await apiService.acknowledgeGroup(
                action.payload.customerVisitGroup,
                action.payload.signatureData,
                action.payload.signerName
              );
              success = true;
              break;

            case "update_status":
              await apiService.updateDeliveryStatus(
                action.payload.customerVisitGroup,
                action.payload.status
              );
              success = true;
              break;

            case "submit_signature":
              await apiService.submitSignature(
                action.payload.invoiceId,
                action.payload.signatureData
              );
              success = true;
              break;

            default:
              console.warn("Unknown action type:", action.type);
              success = true; // Remove unknown actions
          }

          if (success) {
            await this.removeOfflineAction(action.id);
            console.log(`Successfully synced action: ${action.type}`);
          }
        } catch (error) {
          console.error(`Failed to sync action ${action.id}:`, error);

          // Increment retry count
          action.retryCount += 1;

          // Remove action if retry count exceeds limit (e.g., 5 attempts)
          if (action.retryCount > 5) {
            await this.removeOfflineAction(action.id);
            console.log(
              `Removing action ${action.id} after ${action.retryCount} failed attempts`
            );
          } else {
            // Update the action with new retry count
            const actions = await this.getOfflineActions();
            const actionIndex = actions.findIndex((a) => a.id === action.id);
            if (actionIndex !== -1) {
              actions[actionIndex] = action;
              await AsyncStorage.setItem(
                this.OFFLINE_ACTIONS_KEY,
                JSON.stringify(actions)
              );
            }
          }
        }
      }

      console.log("Offline actions sync completed");
    } catch (error) {
      console.error("Error during offline actions sync:", error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Cache invoice details for offline access
  async cacheInvoiceDetails(invoiceId: string, details: any): Promise<void> {
    try {
      const cached = await this.getCachedInvoices();
      cached[invoiceId] = {
        ...details,
        cachedAt: Date.now(),
      };
      await AsyncStorage.setItem(
        this.CACHED_INVOICES_KEY,
        JSON.stringify(cached)
      );
      console.log("Cached invoice details for:", invoiceId);
    } catch (error) {
      console.error("Error caching invoice details:", error);
    }
  }

  // Get cached invoice details
  async getCachedInvoiceDetails(invoiceId: string): Promise<any | null> {
    try {
      const cached = await this.getCachedInvoices();
      const invoice = cached[invoiceId];

      if (invoice) {
        // Check if cache is still valid (e.g., 24 hours)
        const isValid = Date.now() - invoice.cachedAt < 24 * 60 * 60 * 1000;
        if (isValid) {
          console.log("Retrieved cached invoice details for:", invoiceId);
          return invoice;
        } else {
          // Remove expired cache
          delete cached[invoiceId];
          await AsyncStorage.setItem(
            this.CACHED_INVOICES_KEY,
            JSON.stringify(cached)
          );
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting cached invoice details:", error);
      return null;
    }
  }

  // Get all cached invoices
  async getCachedInvoices(): Promise<CachedInvoiceDetails> {
    try {
      const cachedJson = await AsyncStorage.getItem(this.CACHED_INVOICES_KEY);
      return cachedJson ? JSON.parse(cachedJson) : {};
    } catch (error) {
      console.error("Error getting cached invoices:", error);
      return {};
    }
  }

  // Cache grouped invoices for offline access
  async cacheGroupedInvoices(
    groups: any[],
    date?: string,
    routeNumber?: number
  ): Promise<void> {
    try {
      const key = `${this.CACHED_GROUPS_KEY}_${date || "all"}_${
        routeNumber || "all"
      }`;
      const cacheData = {
        groups,
        cachedAt: Date.now(),
        date,
        routeNumber,
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
      console.log("Cached grouped invoices");
    } catch (error) {
      console.error("Error caching grouped invoices:", error);
    }
  }

  // Get cached grouped invoices
  async getCachedGroupedInvoices(
    date?: string,
    routeNumber?: number
  ): Promise<any[] | null> {
    try {
      const key = `${this.CACHED_GROUPS_KEY}_${date || "all"}_${
        routeNumber || "all"
      }`;
      const cachedJson = await AsyncStorage.getItem(key);

      if (cachedJson) {
        const cached = JSON.parse(cachedJson);
        // Check if cache is still valid (e.g., 1 hour for groups)
        const isValid = Date.now() - cached.cachedAt < 60 * 60 * 1000;
        if (isValid) {
          console.log("Retrieved cached grouped invoices");
          return cached.groups;
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting cached grouped invoices:", error);
      return null;
    }
  }

  // Cache routes for offline access
  async cacheRoutes(routes: any[]): Promise<void> {
    try {
      const cacheData = {
        routes,
        cachedAt: Date.now(),
      };
      await AsyncStorage.setItem(
        this.CACHED_ROUTES_KEY,
        JSON.stringify(cacheData)
      );
      console.log("Cached routes");
    } catch (error) {
      console.error("Error caching routes:", error);
    }
  }

  // Get cached routes
  async getCachedRoutes(): Promise<any[] | null> {
    try {
      const cachedJson = await AsyncStorage.getItem(this.CACHED_ROUTES_KEY);

      if (cachedJson) {
        const cached = JSON.parse(cachedJson);
        // Check if cache is still valid (e.g., 24 hours for routes)
        const isValid = Date.now() - cached.cachedAt < 24 * 60 * 60 * 1000;
        if (isValid) {
          console.log("Retrieved cached routes");
          return cached.routes;
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting cached routes:", error);
      return null;
    }
  }

  // Clear all cached data
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.CACHED_INVOICES_KEY,
        this.CACHED_GROUPS_KEY,
        this.CACHED_ROUTES_KEY,
      ]);
      console.log("Cleared all cached data");
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  }

  // Get sync status for UI
  async getSyncStatus(): Promise<{
    pendingActions: number;
    isOnline: boolean;
    lastSyncTime?: number;
  }> {
    const actions = await this.getOfflineActions();
    return {
      pendingActions: actions.length,
      isOnline: this.isOnline,
      lastSyncTime:
        actions.length > 0
          ? Math.max(...actions.map((a) => a.timestamp))
          : undefined,
    };
  }
}

export const offlineService = new OfflineService();
