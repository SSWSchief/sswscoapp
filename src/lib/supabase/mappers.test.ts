import { describe, expect, it } from "vitest";
import * as mappers from "./mappers";

const base = {
  id: "one",
  created_at: "2026-08-07T12:00:00.000Z",
  updated_at: "2026-08-07T12:00:00.000Z",
};

describe("database mappers", () => {
  it("maps core operational records into UI contracts", () => {
    expect(
      mappers.mapUser({
        ...base,
        auth_user_id: null,
        employee_id: "E-1",
        full_name: "Alex Driver",
        email: "alex@example.invalid",
        phone: "555-0100",
        role: "driver",
        access_role: "driver",
        permission_overrides: null,
        status: "active",
        initials: "AD",
        pto_balance_hours: null,
        weekly_hours: 40,
        deleted_at: null,
      }).weeklyHours,
    ).toBe(40);
    expect(
      mappers.mapCustomer(
        {
          ...base,
          name: "Customer",
          phone: "",
          email: "",
          address: "1 Main",
          customer_group: null,
          is_active: true,
          deleted_at: null,
        },
        2,
      ),
    ).toMatchObject({ activeJobs: 2, group: undefined });
    expect(
      mappers.mapTruck({
        ...base,
        number: "T-1",
        type: "Roll-off",
        status: "in_use",
        license_plate: "",
        registration_due_date: null,
        mileage: 10,
        last_pm_date: null,
        last_pm_mileage: 0,
        next_pm_date: null,
        next_pm_mileage: 0,
        make: "",
        model: "",
        vin: "",
        assigned_driver_id: null,
        current_job_id: null,
        notes: "",
        air_tag_id: null,
        gps_source: null,
        last_known_location: null,
        last_seen_at: null,
        deleted_at: null,
      }),
    ).toMatchObject({ registrationDueDate: "", gpsSource: undefined });
    expect(
      mappers.mapDumpster({
        ...base,
        code: "D-1",
        size: "20 Yard",
        status: "in_yard",
        type: "Roll-off",
        current_customer_id: null,
        current_location: "Yard",
        current_job_id: null,
        air_tag_id: null,
        notes: "",
        deleted_at: null,
      }).code,
    ).toBe("D-1");
  });

  it("maps jobs and their visible detail records", () => {
    const job = mappers.mapJob(
      {
        ...base,
        reference: "#1",
        customer_id: "customer",
        address: "1 Main",
        phone: "",
        service_type: "Delivery",
        dumpster_size: "20 Yard",
        assigned_driver_id: null,
        assigned_truck_id: null,
        assigned_dumpster_id: null,
        scheduled_for: base.created_at,
        status: "pending",
        notes: "",
        traffic_instructions: null,
        created_by_id: null,
        cancellation_reason: null,
        deleted_at: null,
      },
      [
        {
          ...base,
          id: "photo",
          job_id: "one",
          storage_path: null,
          url: "photo-url",
          uploaded_by_id: "driver",
        },
        {
          ...base,
          id: "other-photo",
          job_id: "other",
          storage_path: null,
          url: null,
          uploaded_by_id: "driver",
        },
      ],
      [
        { job_id: "one", event_type: "created", occurred_at: base.created_at },
        { job_id: "other", event_type: "created", occurred_at: null },
      ],
    );
    expect(job.photos).toHaveLength(1);
    expect(job.timeline).toEqual([{ type: "created", at: base.created_at }]);
    expect(job.trafficInstructions).toBeUndefined();
  });

  it("maps supporting operational and expanded records", () => {
    expect(
      mappers.mapNotification({
        ...base,
        recipient_user_id: "driver",
        source_role: "dispatcher",
        category: "job_assignment",
        title: "Assigned",
        body: "Body",
        related_job_id: "job",
        requires_acknowledgement: true,
        acknowledged_at: null,
      }).requiresAcknowledgement,
    ).toBe(true);
    expect(
      mappers.mapActivity({
        ...base,
        job_id: "job",
        actor_id: "actor",
        actor_name: "Actor",
        activity_type: "created",
        body: "Created",
        dispatch_notified: false,
      }).type,
    ).toBe("created");
    expect(
      mappers.mapJobNote({
        ...base,
        job_id: "job",
        author_id: "actor",
        body: "Note",
      }).authorName,
    ).toBe("Employee");
    expect(
      mappers.mapTimeEntry({
        ...base,
        user_id: "driver",
        entry_type: "clock_in",
        occurred_at: base.created_at,
      }).type,
    ).toBe("clock_in");
    expect(
      mappers.mapTimeCorrection({
        ...base,
        request_id: "request",
        original_entry_id: null,
        user_id: "driver",
        replacement_type: "clock_in",
        replacement_at: base.created_at,
        reason: "Correction",
        approved_by_id: "admin",
      }).requestId,
    ).toBe("request");
    expect(
      mappers.mapTimeRequest({
        ...base,
        user_id: "driver",
        kind: "pto",
        status: "pending",
        requested_for: "2026-08-08",
        hours: 8,
        reason: "Vacation",
        target_entry_id: null,
        requested_entry_type: null,
        requested_at: null,
        reviewed_by_id: null,
        reviewed_at: null,
      }).hours,
    ).toBe(8);
    expect(
      mappers.mapAbsence({
        ...base,
        user_id: "driver",
        event_date: "2026-08-08",
        absence_type: "pto",
        status: "approved",
        note: "",
      }).date,
    ).toBe("2026-08-08");
    expect(
      mappers.mapInvoice({
        ...base,
        invoice_number: "INV-1",
        customer_id: "customer",
        job_id: null,
        amount_cents: 100,
        status: "draft",
        due_date: "2026-09-01",
        notes: "",
        sent_at: null,
        paid_at: null,
        closed_at: null,
        created_by_id: null,
      }).amountCents,
    ).toBe(100);
    expect(
      mappers.mapMessageChannel({
        ...base,
        name: "Dispatch",
        kind: "channel",
        created_by_id: null,
      }).name,
    ).toBe("Dispatch");
    expect(
      mappers.mapTeamMessage({
        ...base,
        channel_id: "channel",
        sender_id: "sender",
        body: "Hello",
      }, true).read,
    ).toBe(true);
    expect(
      mappers.mapPretripTemplate({
        ...base,
        title: "Daily",
        version: 1,
        is_published: true,
        items: [{ id: "tires", label: "Tires" }],
        created_by_id: "admin",
      }).items,
    ).toHaveLength(1);
    expect(
      mappers.mapPretripSubmission({
        id: "submission",
        template_id: "template",
        driver_id: "driver",
        truck_id: "truck",
        mileage: 10,
        signature: "Driver",
        results: { tires: "pass" },
        has_failures: false,
        submitted_at: base.created_at,
      }).hasFailures,
    ).toBe(false);
    expect(
      mappers.mapSopDocument({
        ...base,
        title: "Safety",
        category: "Safety",
        version: 1,
        body: "Instructions",
        is_published: true,
        required_for_drivers: true,
        created_by_id: "admin",
      }, true).acknowledged,
    ).toBe(true);
    expect(
      mappers.mapCompanySettings({
        id: true,
        company_name: "SSWS",
        address: "1 Main",
        phone: "",
        email: "",
        time_zone: "America/Los_Angeles",
        date_format: "MM/DD/YYYY",
        message_retention_days: 365,
        invoice_prefix: "INV",
        updated_at: base.updated_at,
      }).invoicePrefix,
    ).toBe("INV");
  });
});
