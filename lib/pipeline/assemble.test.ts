import { describe, expect, it } from "vitest";
import { assemble, FEE_LINE, greeting, signOff } from "./assemble";

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

const A3_BODY =
  "This week Riya worked on Chapter 5, linear equations. She scored 14/20 (70%) in Thursday's test, up from her recent average of 58%, so the extra practice is paying off. She is quick with word problems. Small sign errors in algebra still cost her marks; asking her to re-check each step aloud at home would help. She missed homework twice, so a fixed homework time this week would be great.";

describe("assemble (§S10)", () => {
  it("matches the spec's English example exactly", () => {
    const { message, bodyOffset } = assemble({ language: "en", studentName: "Riya", parentName: "Mrs Sen", range: "12–18 Oct", body: `${A3_BODY}\n`, feeLine: false, signature: "Mita Ma'am" });
    expect(message).toBe(`*Weekly update — Riya (12–18 Oct)*\nHello Mrs Sen,\n\n${A3_BODY}\n\n— Mita Ma'am`);
    expect(message.slice(bodyOffset, bodyOffset + 9)).toBe("This week");
  });

  it("adds the fee line before the sign-off, and greets without a name in Bengali and Hindi", () => {
    expect(assemble({ language: "bn", studentName: "রিয়া", parentName: null, range: "12–18 অক্টো", body: "শরীর", feeLine: true, signature: "Mita Ma'am" }).message).toBe(
      `*রিয়া-এর সাপ্তাহিক আপডেট (12–18 অক্টো)*\nনমস্কার,\n\nশরীর\n\n${FEE_LINE.bn}\n— Mita Ma'am`,
    );
    expect(assemble({ language: "hi", studentName: "कबीर", parentName: "श्रीमती मेहता", range: "12–18 अक्तू॰", body: "x", feeLine: false, signature: "Mita" }).message).toBe(
      "*कबीर का साप्ताहिक अपडेट (12–18 अक्तू॰)*\nनमस्ते श्रीमती मेहता,\n\nx\n\n— Mita",
    );
  });
});
