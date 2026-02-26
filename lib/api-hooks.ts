// lib/api-hooks.ts
// Reusable hooks for API calls

import { useCallback, useState } from "react";
import { apiService, GroupedInvoice } from "./api";

export function useDeliveries() {
  const [deliveries, setDeliveries] = useState<GroupedInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getInvoicesGrouped();
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
  const [details, setDetails] = useState<GroupedInvoice | null>(null);
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
