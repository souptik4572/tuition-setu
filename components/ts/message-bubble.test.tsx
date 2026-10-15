// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageBubble, segmentMessage } from "./message-bubble";

describe("segmentMessage", () => {
  it("renders *bold* without its asterisks", () => {
    expect(segmentMessage("*Weekly update*\nHello,")).toEqual([
      { text: "Weekly update", bold: true, highlight: null },
      { text: "\nHello,", bold: false, highlight: null },
    ]);
  });

  it("leaves a lone asterisk and asterisks across lines alone", () => {
    const text = "5 * 3 and *not\nbold*";
    expect(segmentMessage(text).map((s) => s.text).join("")).toBe(text);
  });

  it("shifts body highlights by the body offset", () => {
    const prefix = "*Title*\nHello,\n\n";
    const body = "She scored 18/25 in the quiz.";
    const start = body.indexOf("18/25");
    const segments = segmentMessage(prefix + body, [{ start, end: start + 5, label: "Not in your notes" }], prefix.length);
    expect(segments.find((s) => s.highlight)).toEqual({ text: "18/25", bold: false, highlight: "Not in your notes" });
    expect(segments.map((s) => s.text).join("")).toBe("Title\nHello,\n\n" + body);
  });

  it("keeps Bengali text intact around a highlight", () => {
    const body = "কুইজে ও 17/25 পেয়েছে।";
    const start = body.indexOf("17/25");
    const segments = segmentMessage(body, [{ start, end: start + 5, label: "x" }]);
    expect(segments.map((s) => s.text)).toEqual(["কুইজে ও ", "17/25", " পেয়েছে।"]);
  });
});

describe("MessageBubble", () => {
  it("shows the bold title, the language and the preview label", () => {
    const { container, getByText } = render(
      <MessageBubble header="To Mrs Sen · বাংলা" language="bn" message={"*তন্ময়-এর সাপ্তাহিক আপডেট*\nনমস্কার,"} />,
    );
    expect(container.querySelector("strong")!.textContent).toBe("তন্ময়-এর সাপ্তাহিক আপডেট");
    expect(container.textContent).not.toContain("*");
    expect(container.querySelector('[lang="bn"]')).not.toBeNull();
    expect(getByText("Preview · not sent").getAttribute("lang")).toBe("en");
  });

  it("marks a flagged number and names the problem for screen readers", () => {
    const { container } = render(
      <MessageBubble header="To Mrs Sen" language="en" message="scored 18/25" highlights={[{ start: 7, end: 12, label: "Not in your notes" }]} />,
    );
    const mark = container.querySelector("mark")!;
    expect(mark.textContent).toBe("18/25 (Not in your notes)");
  });
});
