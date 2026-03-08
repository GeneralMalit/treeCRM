import { describe, expect, it } from "vitest";
import { parseSystemSettingsPatch } from "../../src/services/systemSettings";

describe("systemSettings", () => {
  it("rejects empty and invalid patches", () => {
    expect(parseSystemSettingsPatch({})).toEqual({
      error:
        "Provide at least one setting to update: availabilityRefreshMinutes, defaultCasePriority, priorityStyleMap.",
    });
    expect(parseSystemSettingsPatch({ availabilityRefreshMinutes: 0 })).toEqual({
      error: "availabilityRefreshMinutes must be between 1 and 240.",
    });
    expect(parseSystemSettingsPatch({ defaultCasePriority: "Urgent" })).toEqual({
      error: "defaultCasePriority must be one of: High, Medium, Low.",
    });
  });

  it("normalizes valid partial patches", () => {
    expect(
      parseSystemSettingsPatch({
        availabilityRefreshMinutes: 15.4,
        priorityStyleMap: { High: { label: " Rush ", color: " #f00 ", background: " #fee " } },
      }),
    ).toEqual({
      data: {
        availabilityRefreshMinutes: 15,
        priorityStyleMap: {
          High: { label: "Rush", color: "#f00", background: "#fee" },
          Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
          Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
        },
      },
    });
  });
});
