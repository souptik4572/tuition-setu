import { describe, expect, it } from "vitest";
import { isLoopbackHost } from "./lan";

describe("isLoopbackHost", () => {
  it.each(["http://127.0.0.1:11434", "http://localhost:11434", "http://127.8.0.1", "http://[::1]:11434", "http://LOCALHOST"])("%s is this machine", (url) => {
    expect(isLoopbackHost(url)).toBe(true);
  });

  it.each(["http://192.168.1.5:11434", "https://inference.example.com/v1", "http://127.0.0.1.example.com", "http://10.0.0.2", "not a url"])("%s is not", (url) => {
    expect(isLoopbackHost(url)).toBe(false);
  });
});
