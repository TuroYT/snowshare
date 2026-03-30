/**
 * Tests for size formatting utilities (formatSize.ts)
 */

import {
  formatBytes,
  convertFromMB,
  convertToMB,
  isUsingGiB,
  getUnitLabel,
} from "@/lib/formatSize";

describe("formatBytes", () => {
  describe("edge cases", () => {
    it("should return '0 Bytes' for 0", () => {
      expect(formatBytes(0)).toBe("0 Bytes");
    });

    it("should return '0 Bytes' for 0 in binary mode", () => {
      expect(formatBytes(0, true)).toBe("0 Bytes");
    });
  });

  describe("decimal units (default)", () => {
    it("should format as Bytes for small values", () => {
      expect(formatBytes(500)).toBe("500 Bytes");
    });

    it("should format as KB", () => {
      expect(formatBytes(1000)).toBe("1 KB");
    });

    it("should format as MB", () => {
      expect(formatBytes(1000000)).toBe("1 MB");
    });

    it("should format as GB", () => {
      expect(formatBytes(1000000000)).toBe("1 GB");
    });

    it("should format as TB", () => {
      expect(formatBytes(1000000000000)).toBe("1 TB");
    });

    it("should round to 2 decimal places", () => {
      expect(formatBytes(1500000)).toBe("1.5 MB");
    });
  });

  describe("binary units (useBinary = true)", () => {
    it("should format as KiB", () => {
      expect(formatBytes(1024, true)).toBe("1 KiB");
    });

    it("should format as MiB", () => {
      expect(formatBytes(1024 * 1024, true)).toBe("1 MiB");
    });

    it("should format as GiB", () => {
      expect(formatBytes(1024 * 1024 * 1024, true)).toBe("1 GiB");
    });

    it("should format as TiB", () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024, true)).toBe("1 TiB");
    });
  });
});

describe("convertFromMB", () => {
  describe("MiB -> GiB conversion (useGiB = true)", () => {
    it("should convert 1024 MiB to 1 GiB", () => {
      expect(convertFromMB(1024, true)).toBe(1);
    });

    it("should convert 512 MiB to 0.5 GiB", () => {
      expect(convertFromMB(512, true)).toBe(0.5);
    });

    it("should convert 2048 MiB to 2 GiB", () => {
      expect(convertFromMB(2048, true)).toBe(2);
    });

    it("should round to 2 decimal places", () => {
      expect(convertFromMB(100, true)).toBe(0.1);
    });
  });

  describe("keep as MiB (useGiB = false)", () => {
    it("should return the value unchanged in MiB", () => {
      expect(convertFromMB(1024, false)).toBe(1024);
    });

    it("should return 0 for 0", () => {
      expect(convertFromMB(0, false)).toBe(0);
    });

    it("should return 2048 for 2048", () => {
      expect(convertFromMB(2048, false)).toBe(2048);
    });
  });
});

describe("convertToMB", () => {
  describe("GiB -> MiB conversion (useGiB = true)", () => {
    it("should convert 1 GiB to 1024 MiB", () => {
      expect(convertToMB(1, true)).toBe(1024);
    });

    it("should convert 0.5 GiB to 512 MiB", () => {
      expect(convertToMB(0.5, true)).toBe(512);
    });

    it("should convert 2 GiB to 2048 MiB", () => {
      expect(convertToMB(2, true)).toBe(2048);
    });
  });

  describe("keep as MiB (useGiB = false)", () => {
    it("should return the rounded value in MiB", () => {
      expect(convertToMB(1024, false)).toBe(1024);
    });

    it("should return 0 for 0", () => {
      expect(convertToMB(0, false)).toBe(0);
    });

    it("should round decimal values", () => {
      expect(convertToMB(1.7, false)).toBe(2);
    });
  });

  describe("MiB <-> GiB round-trip", () => {
    it("should be consistent in both directions", () => {
      const original = 2048; // MiB
      const inGiB = convertFromMB(original, true);
      const backToMB = convertToMB(inGiB, true);
      expect(backToMB).toBe(original);
    });
  });
});

describe("isUsingGiB", () => {
  it("should return useGiBForAuth when authenticated", () => {
    expect(isUsingGiB(true, false, true)).toBe(true);
    expect(isUsingGiB(true, true, false)).toBe(false);
  });

  it("should return useGiBForAnon when not authenticated", () => {
    expect(isUsingGiB(false, true, false)).toBe(true);
    expect(isUsingGiB(false, false, true)).toBe(false);
  });
});

describe("getUnitLabel", () => {
  it("should return 'GiB' when useGiB is true", () => {
    expect(getUnitLabel(true)).toBe("GiB");
  });

  it("should return 'MiB' when useGiB is false", () => {
    expect(getUnitLabel(false)).toBe("MiB");
  });
});
