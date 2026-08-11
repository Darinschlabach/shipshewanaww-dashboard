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

/** Stages shown in Jobs filters, forms, and detail progress (excludes legacy `quote` and `delivery`). */
export const JOB_ACTIVE_STAGES: JobStage[] = [
  "design",
  "production",
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
  | "drafting"
  | "finishing"
  | "production"
  | "delivery"
  | "shop_closed"
  | "quote"
  | "installation"
  | "personal"
  | "deadline"
  | "other";
export type UserRole = "owner" | "office" | "shop";
export type RoomFinishType = string;

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
  birthday: string | null;
  contact_type: ContactType;
  graph_drive_id?: string | null;
  graph_jobs_folder_item_id?: string | null;
  graph_quotes_folder_item_id?: string | null;
  graph_jobs_folder_web_url?: string | null;
  graph_quotes_folder_web_url?: string | null;
  qb_id?: string | null;
  qb_sync_token?: string | null;
  qb_sync_status?: string | null;
  qb_last_synced_at?: string | null;
  qb_sync_error?: string | null;
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
  graph_drive_id?: string | null;
  graph_folder_item_id?: string | null;
  graph_web_url?: string | null;
  graph_provided_drawings_item_id?: string | null;
  graph_quote_forms_item_id?: string | null;
  graph_misc_item_id?: string | null;
  graph_production_drawings_item_id?: string | null;
  graph_face_frame_drawings_item_id?: string | null;
  graph_assembly_drawings_item_id?: string | null;
  graph_cv_client_drawings_item_id?: string | null;
  graph_appliance_specs_item_id?: string | null;
  graph_purchase_orders_item_id?: string | null;
  graph_invoices_item_id?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  fax?: string | null;
  created_at: string;
  updated_at: string;
  contacts?: Contact | null;
}

export const ROOM_OVERLAY_OPTIONS = [
  "Full Overlay",
  "Half Overlay",
  "Inset",
] as const;

export const ROOM_HARDWARE_OPTIONS = ["Blum", "Salice"] as const;

export type RoomOverlay = (typeof ROOM_OVERLAY_OPTIONS)[number];
export type RoomHardware = (typeof ROOM_HARDWARE_OPTIONS)[number];

export const DRAFTING_FOR_ALL_ROOMS = "All rooms";
export const DRAFTING_FOR_MISC = "Misc";

export interface DraftingQuestion {
  id: string;
  job_id: string;
  room_id: string | null;
  for_room: string;
  question: string;
  answer: string | null;
  status: "open" | "answered";
  asked_on: string;
  answered_on: string | null;
  created_at: string;
}

export interface ProductionTask {
  id: string;
  job_id: string;
  room_id: string | null;
  for_room: string;
  subject: string;
  details: string | null;
  due_date: string;
  completed: boolean;
  created_at: string;
}

export interface Room {
  id: string;
  job_id: string;
  name: string;
  wood_species: string | null;
  door_style: string | null;
  finish_type: RoomFinishType | null;
  finish_color: string | null;
  overlay: string | null;
  hardware: string | null;
  base_molding: string | null;
  crown_molding: string | null;
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
  is_delivery: boolean;
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
  lead_time_weeks?: number | null;
  graph_drive_id?: string | null;
  graph_folder_item_id?: string | null;
  graph_web_url?: string | null;
  graph_provided_drawings_item_id?: string | null;
  graph_quote_forms_item_id?: string | null;
  graph_misc_item_id?: string | null;
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
  title?: string | null;
  category?: string | null;
  po_type?: string | null;
  received_amount?: number | null;
  ui_status?: string | null;
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
  location: string | null;
  description: string | null;
  reminder_minutes?: number | null;
  recurrence_series_id?: string | null;
  user_id: string | null;
  calendar_scope: "production" | "personal" | null;
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
