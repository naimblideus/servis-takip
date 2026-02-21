export type UserRole = 'ADMIN' | 'MANAGER' | 'TECHNICIAN' | 'RECEPTIONIST';

export type TicketStatus =
  | 'WAITING'
  | 'IN_SERVICE'
  | 'WAITING_PARTS'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  taxNo?: string;
  consent: boolean;
  createdAt: Date;
  _count?: { devices: number; tickets: number };
}

export interface Device {
  id: string;
  tenantId: string;
  customerId: string;
  brand: string;
  model: string;
  serialNo?: string;
  location?: string;
  publicCode: string;
  customer?: Customer;
  createdAt: Date;
}

export interface ServiceTicket {
  id: string;
  tenantId: string;
  deviceId: string;
  customerId: string;
  ticketNumber: string;
  status: TicketStatus;
  issueTemplate?: string;
  issueText?: string;
  actionText?: string;
  totalCost: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
  device?: Device;
  customer?: Customer;
  assignedUser?: User;
}

export interface Part {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  buyPrice: number;
  sellPrice: number;
  stockQty: number;
  minStock: number;
  createdAt: Date;
}

export interface DashboardStats {
  openTickets: number;
  todayTickets: number;
  waitingParts: number;
  readyForPickup: number;
  monthRevenue: number;
  lowStockItems: number;
}