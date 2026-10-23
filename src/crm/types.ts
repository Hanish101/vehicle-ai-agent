export type AllocationStatus =
  | "In Transit"
  | "Dispatch Pending"
  | "Delivered";

export type LeadInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  vehicleModel: string;
  /** YYYY-MM-DD */
  demoDate?: string;
  /** HH:MM */
  demoTime?: string;
};

export type LeadRecord = LeadInput & { id: string };

export type DealRecord = {
  id: string;
  name: string;
  stage: string;
  phone?: string;
  contactName?: string;
  vehicleModel?: string;
  amount?: number;
  testDriveTime?: string;
  bookingId?: string;
  allocationStatus?: AllocationStatus;
  vin?: string;
  balancePaymentUrl?: string;
  description?: string;
};

export type BookingRecord = {
  id: string;
  bookingId: string;
  dealId: string;
  phone?: string;
  contactName?: string;
  vehicleModel?: string;
  allocationStatus: AllocationStatus;
  vin?: string;
  balancePaymentUrl?: string;
  description?: string;
};

export type ServiceCaseInput = {
  registrationNumber: string;
  odometerKm: number;
  issueOrServiceType: string;
  preferredCenter: string;
  phone?: string;
  contactId?: string;
};

export type ServiceCaseRecord = ServiceCaseInput & {
  id: string;
  contactName?: string;
  /** Set when Case was saved but no Contact could be linked. */
  warning?: string;
};

export type CrmResult<T> =
  | { ok: true; data: T }
  | { ok: false; notFound?: boolean; error: string };

export interface CrmClient {
  createLead(input: LeadInput): Promise<CrmResult<LeadRecord>>;
  lookupDeal(query: {
    phone?: string;
    dealId?: string;
  }): Promise<CrmResult<DealRecord>>;
  updateFollowUp(input: {
    dealId: string;
    testDriveTime?: string;
    notes?: string;
    vehicleModel?: string;
  }): Promise<CrmResult<DealRecord>>;
  lookupBooking(query: {
    bookingId?: string;
    phone?: string;
  }): Promise<CrmResult<BookingRecord>>;
  createServiceCase(
    input: ServiceCaseInput,
  ): Promise<CrmResult<ServiceCaseRecord>>;
}
