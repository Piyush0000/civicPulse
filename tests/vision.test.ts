import { describe, expect, it } from "vitest";
import { normalizeAnalysis } from "@/lib/ai/vision";

describe("photo analysis normalisation", () => {
  it("keeps a well-formed model answer", () => {
    const a = normalizeAnalysis(
      {
        description: "A large pothole filled with water on an asphalt road.",
        issue_category: "roads_transport",
        severity: "high",
        hazards: ["deep pothole", "stagnant water"],
        matches_complaint: "yes",
        match_reason: "Shows the pothole described.",
        suggested_action: "Barricade and patch the pothole.",
        people_visible: false,
        confidence: 0.86,
      },
      true,
    );
    expect(a.issue_category).toBe("roads_transport");
    expect(a.severity).toBe("high");
    expect(a.matches_complaint).toBe("yes");
    expect(a.hazards).toEqual(["deep pothole", "stagnant water"]);
    expect(a.confidence).toBe(0.86);
  });

  it("coerces drifting output into the safe schema", () => {
    const a = normalizeAnalysis({ issue_category: "potholes", severity: "extreme", hazards: "fire", confidence: 7, people_visible: "yes" }, true);
    expect(a.issue_category).toBe("none");
    expect(a.severity).toBe("none");
    expect(a.hazards).toEqual([]);
    expect(a.confidence).toBe(1);
    expect(a.people_visible).toBe(false);
    expect(a.matches_complaint).toBe("partly");
    expect(a.description).toBe("No description.");
  });

  it("marks photo-only reports", () => {
    expect(normalizeAnalysis({ matches_complaint: "yes" }, false).matches_complaint).toBe("no_text");
  });
});
