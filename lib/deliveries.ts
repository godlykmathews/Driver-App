export interface Invoice {
  id: string;
  status: "Completed" | "In Transit" | "Pending";
  date: string;
  amount: number;
}

export interface Delivery {
  id: string;
  customer: string;
  location: string;
  route: string;
  address: string;
  status: "Completed" | "In Transit" | "Pending";
  scheduledFor: string;
  invoices: Invoice[];
}

export const deliveries: Delivery[] = [
  {
    id: "1",
    customer: "Acme Corp.",
    location: "123 Main St, Springfield",
    route: "Route 12",
    address: "123 Main St, Springfield",
    status: "Completed",
    scheduledFor: "2025-10-30T09:00:00Z",
    invoices: [
      {
        id: "INV-1001",
        status: "Completed",
        date: "2025-10-28",
        amount: 12850.5,
      },
      { id: "INV-1002", status: "Completed", date: "2025-10-29", amount: 4850 },
    ],
  },
  {
    id: "2",
    customer: "Globex Industries",
    location: "456 Elm Ave, Shelbyville",
    route: "Route 7",
    address: "456 Elm Ave, Shelbyville",
    status: "In Transit",
    scheduledFor: "2025-10-31T11:30:00Z",
    invoices: [
      {
        id: "INV-2001",
        status: "In Transit",
        date: "2025-10-29",
        amount: 7600.75,
      },
      { id: "INV-2002", status: "Pending", date: "2025-10-30", amount: 3425.4 },
    ],
  },
  {
    id: "3",
    customer: "Ko Industries",
    location: "456 Elm Ave, Shelbyville",
    route: "Route 6",
    address: "456 Elm Ave, Shelbyville",
    status: "Pending",
    scheduledFor: "2025-10-31T11:30:00Z",
    invoices: [
      {
        id: "INV-2301",
        status: "Pending",
        date: "2025-10-29",
        amount: 6300.75,
      },
      { id: "INV-2302", status: "Pending", date: "2025-10-30", amount: 4435.4 },
      { id: "INV-2303", status: "Pending", date: "2025-10-30", amount: 3125.4 },
    ],
  },
];

export const getDeliveryById = (id: string): Delivery | undefined =>
  deliveries.find((delivery) => delivery.id === id);

export const getDelivery = (id: string): Delivery | undefined => {
  return getDeliveryById(id);
};
