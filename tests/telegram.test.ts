import { describe, expect, it } from "vitest";
import { SMALLTALK } from "@/lib/messaging/telegram";

describe("telegram small talk", () => {
  it.each(["Ok", "ok!", "okay", "Thanks", "thank you", "hi", "Hello", "theek hai", "धन्यवाद", "👍", "🙏🙏", "k"])("ignores %s", (m) => {
    expect(SMALLTALK.test(m)).toBe(true);
  });
  it.each(["There is water shortage in dwarka", "ok the drain is blocked near school", "Dwarka mein paani nahi hai", "no water", "streetlight broken"])("keeps complaint %s", (m) => {
    expect(SMALLTALK.test(m)).toBe(false);
  });
});
