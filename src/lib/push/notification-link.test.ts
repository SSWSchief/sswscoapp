import { describe, expect, it } from "vitest";
import { notificationLink, notificationTag } from "./notification-link";

describe("notificationLink", () => {
  it("sends a driver to their own job screen", () => {
    expect(notificationLink("driver", "job-1")).toBe("/driver/jobs/job-1");
  });

  it("sends dispatch and administrators to the dispatch job screen", () => {
    expect(notificationLink("dispatcher", "job-1")).toBe(
      "/dispatcher/jobs/job-1",
    );
    expect(notificationLink("admin", "job-1")).toBe("/dispatcher/jobs/job-1");
  });

  it("falls back to the portal landing screen when no job is attached", () => {
    expect(notificationLink("driver", null)).toBe("/driver/jobs");
    expect(notificationLink("dispatcher", null)).toBe("/dispatcher/dashboard");
  });

  it("treats an unknown role as staff rather than sending them nowhere", () => {
    expect(notificationLink(undefined, undefined)).toBe("/dispatcher/dashboard");
  });
});

describe("notificationTag", () => {
  it("collapses everything about one job onto a single notification", () => {
    expect(notificationTag("n-1", "j-1")).toBe("job-j-1");
    expect(notificationTag("n-2", "j-1")).toBe("job-j-1");
  });

  it("keeps job-less notifications distinct from one another", () => {
    expect(notificationTag("n-1", null)).toBe("notification-n-1");
    expect(notificationTag("n-2", null)).toBe("notification-n-2");
  });
});
