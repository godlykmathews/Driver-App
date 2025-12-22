// lib/api-hooks.ts
// Reusable hooks for API calls

import { useCallback, useState } from "react";
import { apiService } from "./api";

export function useDeliveries() {
  const [deliveries, setDeliveries] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliveries = useCallback(async (filters: any = {}) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getGroupedInvoices(filters);
      setDeliveries(response);
      return response;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fetch deliveries";
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => fetchDeliveries(), [fetchDeliveries]);

  return { deliveries, loading, error, fetchDeliveries, refresh };
}

export function useDeliveryDetails(customerVisitGroup: string) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getDeliveryDetails(customerVisitGroup);
      setDetails(response);
      return response;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fetch details";
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [customerVisitGroup]);

  return { details, loading, error, fetchDetails };
}

export function useUpdateDeliveryStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = useCallback(
    async (customerVisitGroup: string, status: "pending" | "delivered") => {
      try {
        setLoading(true);
        setError(null);
        await apiService.updateDeliveryStatus(customerVisitGroup, status);
        return true;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to update status";
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateStatus, loading, error };
}
