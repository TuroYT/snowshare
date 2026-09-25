/**
 * @jest-environment node
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    settings: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getOrCreateSettings, getSettingsCached, invalidateSettingsCache } from "@/lib/settings";

const mockFindFirst = prisma.settings.findFirst as jest.Mock;
const mockUpsert = prisma.settings.upsert as jest.Mock;

describe("getSettingsCached", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockFindFirst.mockResolvedValue({ id: 1, appName: "SnowShare" });
  });

  it("queries the database once and serves later reads from memory", async () => {
    await getSettingsCached();
    await getSettingsCached();
    await getSettingsCached();

    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent reads", async () => {
    const results = await Promise.all([getSettingsCached(), getSettingsCached()]);

    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(results[0]).toBe(results[1]);
  });

  it("reloads after invalidation", async () => {
    await getSettingsCached();
    mockFindFirst.mockResolvedValue({ id: 1, appName: "Renamed" });

    invalidateSettingsCache();
    const settings = await getSettingsCached();

    expect(mockFindFirst).toHaveBeenCalledTimes(2);
    expect(settings?.appName).toBe("Renamed");
  });

  it("reloads once the TTL has elapsed", async () => {
    jest.useFakeTimers();
    await getSettingsCached();

    jest.advanceTimersByTime(31 * 1000);
    await getSettingsCached();

    expect(mockFindFirst).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    mockFindFirst.mockRejectedValueOnce(new Error("db down"));

    await expect(getSettingsCached()).rejects.toThrow("db down");
    await expect(getSettingsCached()).resolves.toEqual({ id: 1, appName: "SnowShare" });
  });
});

describe("getOrCreateSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates the settings row with database defaults when missing", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({ id: 1 });

    const settings = await getOrCreateSettings();

    expect(settings).toEqual({ id: 1 });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  });
});
