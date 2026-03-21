import { describe, expect, it } from "vitest";
import {
  canUsersChatInternally,
  getAllowedInternalPeerRoles,
  parseMessageBody,
  parseUuidParam,
} from "../../src/domain/employeeChatLogic";

describe("employeeChatLogic", () => {
  it("validates message bodies and uuid params", () => {
    expect(parseMessageBody({ messageText: "   " })).toEqual({
      error: "messageText cannot be empty.",
    });
    expect(parseMessageBody({ messageText: 123 })).toEqual({
      error: "messageText must be a string.",
    });
    expect(parseMessageBody({ messageText: "x".repeat(4001) })).toEqual({
      error: "messageText must be at most 4000 characters.",
    });
    expect(parseMessageBody({ messageText: "Hello" })).toEqual({
      data: { messageText: "Hello" },
    });
    expect(parseUuidParam("not-a-uuid", "peerUserId")).toEqual({
      error: "peerUserId must be a valid UUID.",
    });
  });

  it("enforces internal chat role rules", () => {
    expect(getAllowedInternalPeerRoles("CSR")).toEqual(["Manager", "Executive", "Admin"]);
    expect(getAllowedInternalPeerRoles("Admin")).toEqual([
      "CSR",
      "Manager",
      "Executive",
      "Admin",
    ]);
    expect(getAllowedInternalPeerRoles("Customer")).toEqual([]);
    expect(canUsersChatInternally("CSR", "Manager")).toBe(true);
    expect(canUsersChatInternally("CSR", "Customer")).toBe(false);
    expect(canUsersChatInternally("Admin", "Executive")).toBe(true);
  });
});
