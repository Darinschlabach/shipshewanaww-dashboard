export type LeadStatus =
  | "draft"
  | "sent"
  | "revision"
  | "approved"
  | "lost"
  | "converted"
  | "new_inquiry"
  | "quote_sent";
export type JobStage = "quote" | "design" | "production" | "delivery" | "complete";

/** Stages shown in Jobs filters, forms, and detail progress (excludes legacy `quote`). */
export const JOB_ACTIVE_STAGES: JobStage[] = [
  "design",
  "production",
  "delivery",
  "complete",
];

export const JOB_STAGE_LABELS: Record<JobStage, string> = {
  quote: "Quote",
  design: "Drafting",
  production: "Production",
  delivery: "Delivery",
  complete: "Archive",
};
export type PoStatus = "not_ordered" | "ordered" | "delivered" | "archived";
export type KanbanStatus =
  | "queued"
  | "in_progress"
  | "finishing"
  | "ready_to_ship"
  | "cutting"
  | "edgebanding"
  | "assembly"
  | "ready_for_delivery";
export type ProductionPriority = "high" | "medium" | "low";
export type CalendarEventType =
  | "production"
  | "delivery"
  | "quote"
  | "installation"
  | "personal"
  | "deadline"
  | "other";
export type UserRole = "owner" | "office" | "shop";
export type RoomFinishType = "Painted" | "Stained";

export const CONTACT_TYPES = [
  "Customers",
  "Vendors",
  "Contractors",
  "Employees",
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];

export const ASSOCIATED_POSITIONS = [
  "Owner",
  "Designer",
  "Receptionist",
  "Accounting",
  "Installation",
] as const;

export type AssociatedPosition = (typeof ASSOCIATED_POSITIONS)[number];

export interface ContactPerson {
  id: string;
  contact_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  positions: string[];
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
  contact_type: ContactType;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  name: string;
  customer_id: string | null;
  stage: JobStage;
  start_date: string | null;
  due_date: string | null;
  total_value: number;
  notes: string;
  quote_approved_at: string | null;
  design_approved_at: string | null;
  billing_collected: number;
  delivery_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  contacts?: Contact | null;
}

export interface Room {
  id: string;
  job_id: string;
  name: string;
  wood_species: string | null;
  door_style: string | null;
  finish_type: RoomFinishType | null;
  finish_color: string | null;
  notes: string | null;
  created_at: string;
}

export type QuoteRoomItemCategory = "cabinets" | "components" | "labor";

export interface QuoteRoom {
  id: string;
  lead_id: string;
  name: string;
  sort_order: number;
  wood_species_id: string | null;
  finish_type_id: string | null;
  door_style_id: string | null;
  created_at: string;
}

export interface QuoteService {
  id: string;
  lead_id: string;
  name: string;
  description: string | null;
  price: number;
  sort_order: number;
  created_at: string;
}

export interface QuoteRoomItem {
  id: string;
  room_id: string;
  item_type: string;
  description: string | null;
  qty_size: string | null;
  qty: number | null;
  width_in: number | null;
  length_in: number | null;
  height_in: number | null;
  catalogue_id: string | null;
  catalogue_source: string | null;
  base_price: number;
  sq_ft_price: number;
  price: number;
  category: QuoteRoomItemCategory;
  sort_order: number;
  created_at: string;
}

export interface Lead {
  id: string;
  customer_name: string;
  project_type: string;
  est_value: number;
  status: LeadStatus;
  notes: string;
  quote_number: string | null;
  source: string | null;
  designer: string | null;
  sent_at: string | null;
  job_address: string | null;
  contact_id: string | null;
  job_id: string | null;
  converted_job_id: string | null;
  created_at: string;
  updated_at: string;
  contacts?: Contact | null;
}

export interface PurchaseOrder {
  id: string;
  job_id: string;
  item_name: string;
  vendor: string;
  amount: number;
  status: PoStatus;
  po_number: string | null;
  received_percent: number | null;
  ordered_at: string | null;
  delivered_at: string | null;
  archived_at: string | null;
  expected_delivery: string | null;
  created_at: string;
  updated_at: string;
  jobs?: { id: string; name: string } | null;
}

export interface ProductionJob {
  id: string;
  job_id: string;
  kanban_status: KanbanStatus;
  due_date: string | null;
  priority: ProductionPriority | string | null;
  assignee: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
  jobs?: (Job & { contacts?: Contact | null }) | null;
}

export interface CatalogueItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  job_id: string | null;
  title: string;
  event_type: CalendarEventType;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean | null;
  created_at: string;
  jobs?: (Job & { contacts?: { name: string } | null }) | null;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}
