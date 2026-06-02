import { describe, expect, it } from "vitest";
import { fileName, formatBytes } from "./utils";

describe("formatBytes", () => {
  it("formats byte values into compact labels", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("fileName", () => {
  it("returns the final segment of a Windows path", () => {
    expect(fileName("C:\\Users\\example\\Pictures")).toBe("Pictures");
  });
});
