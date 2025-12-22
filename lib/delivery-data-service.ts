import { GroupedInvoice } from "./api";
import { offlineService } from "./offline-service";

class DeliveryDataService {
  private cachedGroupedInvoices: GroupedInvoice[] = [];
  private lastCacheTime: number = 0;
  private readonly CACHE_DURATION = 15 * 60 * 1000; // Increased to 15 minutes for better user experience

  // Set cached grouped invoices (called from home screen)
  setCachedGroupedInvoices(invoices: GroupedInvoice[]): void {
    this.cachedGroupedInvoices = invoices;
    this.lastCacheTime = Date.now();
    console.log(`Cached ${invoices.length} grouped invoices in memory`);
  }

  // Get delivery by ID from cached data
  async getDeliveryById(id: string): Promise<GroupedInvoice | null> {
    // First try in-memory cache if it's recent
    if (this.isCacheValid() && this.cachedGroupedInvoices.length > 0) {
      console.log("📦 Using in-memory cache for delivery lookup");
      const delivery = this.findDeliveryInList(this.cachedGroupedInvoices, id);
      if (delivery) {
        console.log(`✅ Found delivery ${id} in memory cache`);
        return delivery;
      }
    }

    // Try to get from offline service cache
    console.log(
      "⚠️ In-memory cache expired or empty, trying offline service cache"
    );
    try {
      // Try all possible cached combinations
      const cacheKeys = [
        { date: undefined, routeNumber: undefined }, // All routes, today
        { date: undefined, routeNumber: undefined }, // All routes, all dates (changed null to undefined)
      ];

      for (const { date, routeNumber } of cacheKeys) {
        const cached = await offlineService.getCachedGroupedInvoices(
          date,
          routeNumber
        );
        if (cached && cached.length > 0) {
          console.log(
            `📋 Found ${cached.length} cached invoices from offline service`
          );
          const delivery = this.findDeliveryInList(cached, id);
          if (delivery) {
            console.log(`✅ Found delivery ${id} in offline cache`);
            // Update in-memory cache
            this.setCachedGroupedInvoices(cached);
            return delivery;
          }
        }
      }
    } catch (error) {
      console.error("Error getting cached delivery data:", error);
    }

    console.log(`❌ Delivery ${id} not found in any cache`);
    return null;
  }

  // Check if delivery has been acknowledged (delivered)
  isDeliveryAcknowledged(delivery: GroupedInvoice): boolean {
    return (
      delivery.status === "delivered" || delivery.status === "acknowledged"
    );
  }

  // Update delivery status in cache
  updateDeliveryStatus(deliveryId: string, newStatus: string): void {
    if (this.cachedGroupedInvoices.length > 0) {
      const delivery = this.findDeliveryInList(
        this.cachedGroupedInvoices,
        deliveryId
      );
      if (delivery) {
        delivery.status = newStatus;
        console.log(
          `Updated delivery ${deliveryId} status to ${newStatus} in cache`
        );
      }
    }
  }

  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheTime < this.CACHE_DURATION;
  }

  private findDeliveryInList(
    invoices: GroupedInvoice[],
    id: string
  ): GroupedInvoice | null {
    return (
      invoices.find(
        (group) =>
          group.first_invoice_id?.toString() === id ||
          group.customer_visit_group === id ||
          group.invoice_numbers.includes(id)
      ) || null
    );
  }

  // Clear cache
  clearCache(): void {
    this.cachedGroupedInvoices = [];
    this.lastCacheTime = 0;
    console.log("Cleared in-memory delivery cache");
  }

  // Get cache info for debugging
  getCacheInfo(): {
    count: number;
    age: number;
    isValid: boolean;
  } {
    return {
      count: this.cachedGroupedInvoices.length,
      age: Date.now() - this.lastCacheTime,
      isValid: this.isCacheValid(),
    };
  }
}

export const deliveryDataService = new DeliveryDataService();
