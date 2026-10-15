import { describe, expect, it } from "vitest";
import { FEE_LINE, greeting, signOff } from "./assemble";

describe("message templates (Appendix A)", () => {
  it("greets the parent by name when known", () => {
    expect(greeting("en", "Mrs Sen")).toBe("Hello Mrs Sen,");
    expect(greeting("bn", "মিসেস সেন")).toBe("নমস্কার মিসেস সেন,");
    expect(greeting("hi", " ")).toBe("नमस्ते,");
    expect(greeting("en", null)).toBe("Hello,");
  });

  it("has the fee line and sign-off from the spec", () => {
    expect(FEE_LINE.en).toBe("A gentle reminder that this month's tuition fee is pending.");
    expect(signOff(" Mita Ma'am ")).toBe("— Mita Ma'am");
  });
});
