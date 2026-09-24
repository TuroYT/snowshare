/**
 * Tests for the validation module
 */
import { isValidDisplayName } from "@/lib/validation";

describe("validation", () => {
  describe("isValidDisplayName", () => {
    it("should accept a valid display name", () => {
      expect(isValidDisplayName("My Provider")).toEqual({ valid: true });
    });

    it("should reject a non-string value", () => {
      const result = isValidDisplayName(123 as unknown as string);
      expect(result.valid).toBe(false);
    });

    it("should reject an empty or whitespace-only name", () => {
      expect(isValidDisplayName("").valid).toBe(false);
      expect(isValidDisplayName("   ").valid).toBe(false);
    });

    it("should reject a name longer than the max length", () => {
      const result = isValidDisplayName("a".repeat(101));
      expect(result.valid).toBe(false);
    });

    it("should respect a custom max length", () => {
      const result = isValidDisplayName("toolong", 5);
      expect(result.valid).toBe(false);
    });
  });
});
