/** Typed from the deployed public schema. Regenerate with `supabase gen types`
 * when project-level CLI access is available. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AccessRole = "admin" | "dispatcher" | "driver";
export type UserRole = "dispatcher" | "driver" | "office" | "management";
export type EmployeeStatus = "active" | "inactive";
export type JobStatus =
  "pending" | "en_route" | "arrived" | "complete" | "cancelled";
export type TimeEntryType =
  "clock_in" | "break_start" | "break_end" | "clock_out";

type Table<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface UserRow extends Record<string, unknown> {
  id: string;
  auth_user_id: string | null;
  employee_id: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  access_role: AccessRole;
  permission_overrides: Json;
  status: EmployeeStatus;
  initials: string;
  pto_balance_hours: number | null;
  weekly_hours: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface CustomerRow extends Record<string, unknown> {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  customer_group: "Big GC" | "Commercial" | "Residential" | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface TruckRow extends Record<string, unknown> {
  id: string;
  number: string;
  type: string;
  status: "in_use" | "down" | "in_shop";
  license_plate: string;
  registration_due_date: string | null;
  mileage: number;
  last_pm_date: string | null;
  last_pm_mileage: number;
  next_pm_date: string | null;
  next_pm_mileage: number;
  make: string;
  model: string;
  vin: string;
  assigned_driver_id: string | null;
  current_job_id: string | null;
  notes: string;
  air_tag_id: string | null;
  gps_source: "manual" | "airtag" | "gps_placeholder" | null;
  last_known_location: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface DumpsterRow extends Record<string, unknown> {
  id: string;
  code: string;
  size: "10 Yard" | "20 Yard" | "30 Yard" | "40 Yard";
  status: "out" | "in_yard" | "in_shop";
  type: string;
  current_customer_id: string | null;
  current_location: string;
  current_job_id: string | null;
  air_tag_id: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface JobRow extends Record<string, unknown> {
  id: string;
  reference: string;
  customer_id: string;
  address: string;
  phone: string;
  service_type: string;
  dumpster_size: string;
  assigned_driver_id: string | null;
  assigned_truck_id: string | null;
  assigned_dumpster_id: string | null;
  scheduled_for: string;
  status: JobStatus;
  notes: string;
  traffic_instructions: string | null;
  created_by_id: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface JobEventRow extends Record<string, unknown> {
  job_id: string;
  event_type: string;
  occurred_at: string | null;
}
export interface JobPhotoRow extends Record<string, unknown> {
  id: string;
  job_id: string;
  storage_path: string | null;
  url: string | null;
  uploaded_by_id: string;
  created_at: string;
}
export interface JobNoteRow extends Record<string, unknown> {
  id: string;
  job_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
export interface JobActivityRow extends Record<string, unknown> {
  id: string;
  job_id: string;
  actor_id: string;
  actor_name: string;
  activity_type: string;
  body: string;
  dispatch_notified: boolean;
  created_at: string;
}
export interface NotificationRow extends Record<string, unknown> {
  id: string;
  recipient_user_id: string;
  source_role: AccessRole;
  category: string;
  title: string;
  body: string;
  related_job_id: string | null;
  requires_acknowledgement: boolean;
  acknowledged_at: string | null;
  created_at: string;
}
export interface TimeEntryRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  entry_type: TimeEntryType;
  occurred_at: string;
  created_at: string;
}
export interface TimeRequestRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  kind: "edit_time" | "pto";
  status: "pending" | "approved" | "denied";
  requested_for: string;
  hours: number;
  reason: string;
  target_entry_id: string | null;
  requested_entry_type: TimeEntryType | null;
  requested_at: string | null;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface AbsenceRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  event_date: string;
  absence_type: "pto" | "sick" | "unavailable";
  status: "pending" | "approved";
  note: string;
  created_at: string;
}
export interface InvoiceRow extends Record<string, unknown> {
  id: string;
  invoice_number: string;
  customer_id: string;
  job_id: string | null;
  amount_cents: number;
  status: "draft" | "sent" | "paid" | "overdue" | "closed" | "void";
  due_date: string;
  notes: string;
  sent_at: string | null;
  paid_at: string | null;
  closed_at: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface MessageChannelRow extends Record<string, unknown> {
  id: string;
  name: string;
  kind: "channel" | "direct" | "announcement";
  created_by_id: string | null;
  created_at: string;
}
export interface MessageRow extends Record<string, unknown> {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}
export interface MessageReadRow extends Record<string, unknown> {
  message_id: string;
  user_id: string;
  read_at: string;
}
export interface PretripTemplateRow extends Record<string, unknown> {
  id: string;
  title: string;
  version: number;
  is_published: boolean;
  items: Json;
  created_by_id: string | null;
  created_at: string;
}
export interface PretripSubmissionRow extends Record<string, unknown> {
  id: string;
  template_id: string;
  driver_id: string;
  truck_id: string;
  mileage: number;
  signature: string;
  results: Json;
  has_failures: boolean;
  submitted_at: string;
}
export interface SopDocumentRow extends Record<string, unknown> {
  id: string;
  title: string;
  category: string;
  version: number;
  body: string;
  is_published: boolean;
  required_for_drivers: boolean;
  created_by_id: string | null;
  created_at: string;
}
export interface SopAcknowledgementRow extends Record<string, unknown> {
  sop_id: string;
  user_id: string;
  acknowledged_at: string;
}
export interface CompanySettingsRow extends Record<string, unknown> {
  id: boolean;
  company_name: string;
  address: string;
  phone: string;
  email: string;
  time_zone: string;
  date_format: string;
  message_retention_days: number;
  invoice_prefix: string;
  updated_at: string;
}
export interface ProtectedAdministratorRow extends Record<string, unknown> {
  user_id: string;
  reason: string;
  expires_at: string | null;
  created_at: string;
}
export interface TrainingDatasetRow extends Record<string, unknown> {
  dataset_key: "training-v1";
  status: "active" | "removed";
  record_ids: Json;
  created_by_id: string | null;
  created_at: string;
  removed_by_id: string | null;
  removed_at: string | null;
  updated_at: string;
}
export interface CorrectionRow extends Record<string, unknown> {
  id: string;
  request_id: string;
  original_entry_id: string | null;
  user_id: string;
  replacement_type: TimeEntryType;
  replacement_at: string;
  reason: string;
  approved_by_id: string;
  created_at: string;
}
export interface AuditRow extends Record<string, unknown> {
  id: number;
  actor_id: string | null;
  entity_table: string;
  entity_id: string;
  action: string;
  old_values: Json | null;
  new_values: Json | null;
  reason: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      users: Table<UserRow>;
      customers: Table<CustomerRow>;
      trucks: Table<TruckRow>;
      dumpsters: Table<DumpsterRow>;
      jobs: Table<JobRow>;
      job_events: Table<JobEventRow>;
      job_photos: Table<JobPhotoRow>;
      job_notes: Table<JobNoteRow>;
      job_activities: Table<JobActivityRow>;
      notifications: Table<NotificationRow>;
      time_entries: Table<TimeEntryRow>;
      time_requests: Table<TimeRequestRow>;
      absence_events: Table<AbsenceRow>;
      time_entry_corrections: Table<CorrectionRow>;
      audit_log: Table<AuditRow>;
      invoices: Table<InvoiceRow>;
      message_channels: Table<MessageChannelRow>;
      message_channel_members: Table<
        Record<string, unknown> & { channel_id: string; user_id: string }
      >;
      messages: Table<MessageRow>;
      message_reads: Table<MessageReadRow>;
      pretrip_templates: Table<PretripTemplateRow>;
      pretrip_submissions: Table<PretripSubmissionRow>;
      sop_documents: Table<SopDocumentRow>;
      sop_acknowledgements: Table<SopAcknowledgementRow>;
      company_settings: Table<CompanySettingsRow>;
      export_audit: Table<Record<string, unknown>>;
      import_runs: Table<Record<string, unknown>>;
      unassigned_job_alerts: Table<
        Record<string, unknown> & { job_id: string; alerted_at: string }
      >;
      api_rate_limits: Table<
        Record<string, unknown> & {
          subject: string;
          bucket: string;
          window_started_at: string;
          attempts: number;
        }
      >;
      protected_administrators: Table<ProtectedAdministratorRow>;
      training_datasets: Table<TrainingDatasetRow>;
    };
    Views: Record<string, never>;
    Functions: {
      admin_mfa_verified: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      assert_active_user: {
        Args: { target_user_id: string; required_role?: AccessRole };
        Returns: undefined;
      };
      create_job: {
        Args: {
          customer_id: string;
          job_address: string;
          job_phone: string;
          service: string;
          container_size: string;
          driver_id: string | null;
          truck_id: string | null;
          dumpster_id: string | null;
          schedule_at: string;
          job_notes?: string;
          traffic?: string;
        };
        Returns: JobRow;
      };
      edit_job: {
        Args: {
          target_job_id: string;
          customer_id: string;
          job_address: string;
          job_phone: string;
          service: string;
          container_size: string;
          driver_id: string | null;
          truck_id: string | null;
          dumpster_id: string | null;
          schedule_at: string;
          job_notes?: string;
          traffic?: string;
        };
        Returns: JobRow;
      };
      assign_job: {
        Args: { target_job_id: string; driver_id: string };
        Returns: JobRow;
      };
      cancel_job: {
        Args: { target_job_id: string; cancel_reason: string };
        Returns: JobRow;
      };
      update_assigned_job_status: {
        Args: { target_job_id: string; next_status: JobStatus };
        Returns: undefined;
      };
      complete_job_as_dispatch: {
        Args: { target_job_id: string; override_reason?: string | null };
        Returns: JobRow;
      };
      log_assigned_job_dry_run: {
        Args: { target_job_id: string; dry_run_reason: string };
        Returns: JobRow;
      };
      record_time_event: {
        Args: { next_type: TimeEntryType };
        Returns: TimeEntryRow;
      };
      review_time_request: {
        Args: { request_id: string; decision: string };
        Returns: TimeRequestRow;
      };
      audit_admin_action: {
        Args: { target_user_id: string; admin_action: string };
        Returns: undefined;
      };
      has_permission: { Args: { permission_key: string }; Returns: boolean };
      current_app_user_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      current_access_role: {
        Args: Record<PropertyKey, never>;
        Returns: AccessRole | null;
      };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      apply_operations_import: {
        Args: { payload: Json; source_name: string; source_hash: string };
        Returns: Json;
      };
      run_scheduled_maintenance: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      run_scheduled_maintenance_safe: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      release_job_assets: {
        Args: { previous_job: JobRow };
        Returns: undefined;
      };
      reserve_job_assets: {
        Args: { next_job: JobRow };
        Returns: undefined;
      };
      consume_api_rate_limit: {
        Args: {
          rate_bucket: string;
          maximum_attempts: number;
          window_seconds: number;
        };
        Returns: boolean;
      };
      customer_active_job_counts: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{ customer_id: string; active_jobs: number }>;
      };
      list_protected_administrator_ids: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{ user_id: string }>;
      };
      get_training_dataset_status: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      provision_training_dataset: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      remove_training_dataset: {
        Args: { requested_dataset_key: string };
        Returns: Json;
      };
      save_company_settings: {
        Args: {
          company_name: string;
          company_address: string;
          company_phone: string;
          company_email: string;
          company_time_zone: string;
          company_date_format: string;
          retention_days: number;
          invoice_prefix: string;
        };
        Returns: CompanySettingsRow;
      };
      publish_sop_document: {
        Args: {
          sop_title: string;
          sop_category: string;
          sop_body: string;
          required_for_drivers?: boolean;
        };
        Returns: SopDocumentRow;
      };
      publish_pretrip_template: {
        Args: { template_title: string; item_labels: string[] };
        Returns: PretripTemplateRow;
      };
      list_message_recipients: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; full_name: string }[];
      };
      list_message_channels: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name: string;
          kind: "channel" | "direct" | "announcement";
          created_at: string;
        }[];
      };
      create_direct_message_channel: {
        Args: { other_user_id: string };
        Returns: string;
      };
      write_audit: {
        Args: {
          audit_action: string;
          audit_reason?: string;
          previous_values?: Json;
          resulting_values?: Json;
          target_id: string;
          target_table: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      access_role: AccessRole;
      user_role: UserRole;
      employee_status: EmployeeStatus;
      job_status: JobStatus;
      time_entry_type: TimeEntryType;
    };
    CompositeTypes: Record<string, never>;
  };
}
