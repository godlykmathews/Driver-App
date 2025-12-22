import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { offlineService } from "../lib/offline-service";

export interface OfflineHookState {
  isOnline: boolean;
  syncStatus: {
    pendingActions: number;
    isOnline: boolean;
    lastSyncTime?: number;
  };
  manualSync: () => Promise<void>;
}

export const useOffline = (): OfflineHookState => {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<{
    pendingActions: number;
    isOnline: boolean;
    lastSyncTime?: number;
  }>({ pendingActions: 0, isOnline: true });

  useEffect(() => {
    // Set up network listener
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    // Update sync status periodically
    const updateSyncStatus = async () => {
      try {
        const status = await offlineService.getSyncStatus();
        setSyncStatus(status);
      } catch (error) {
        console.error("Failed to get sync status:", error);
      }
    };

    updateSyncStatus();
    const interval = setInterval(updateSyncStatus, 30000); // Update every 30 seconds

    // Cleanup
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const manualSync = async () => {
    try {
      await offlineService.syncOfflineActions();
      // Update sync status after manual sync
      const status = await offlineService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error("Manual sync failed:", error);
      throw error;
    }
  };

  return {
    isOnline,
    syncStatus,
    manualSync,
  };
};
