/**
 * @jest-environment node
 */

const mockPrisma = {
  settings: { findFirst: jest.fn() },
  user: { findUnique: jest.fn(), update: jest.fn() },
  oAuthProvider: { findMany: jest.fn() },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("@/lib/providers", () => ({ providerMap: {} }));
jest.mock("next/headers", () => ({ cookies: jest.fn(async () => ({ get: jest.fn() })) }));
jest.mock("@/lib/settings", () => ({ getSettingsCached: jest.fn(async () => ({})) }));

import bcrypt from "bcryptjs";
import { getAuthOptions } from "@/lib/auth";
import { resetRateLimit } from "@/lib/rate-limit";
import { sealTotpSecret, totpCode, totpCounter } from "@/lib/totp";

type Authorize = (c: Record<string, string>, req: unknown) => Promise<unknown>;

async function getAuthorize(): Promise<Authorize> {
  const options = await getAuthOptions();
  const provider = options.providers.find((p) => p.id === "credentials") as unknown as {
    options: { authorize: Authorize };
  };
  return provider.options.authorize;
}

const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const req = { headers: { "x-forwarded-for": "10.0.0.1" } };

describe("credentials authorize with TOTP", () => {
  let authorize: Authorize;

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    mockPrisma.settings.findFirst.mockResolvedValue({ allowSignin: true });
    mockPrisma.oAuthProvider.findMany.mockResolvedValue([]);
    authorize = await getAuthorize();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    resetRateLimit("login", "10.0.0.1:a@b.c");
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      name: null,
      password: await bcrypt.hash("pw", 4),
      emailVerified: null,
      totpEnabled: true,
      totpSecret: sealTotpSecret(SECRET),
      totpLastCounter: null,
    });
  });

  it("asks for a code after a correct password", async () => {
    await expect(authorize({ email: "a@b.c", password: "pw" }, req)).rejects.toThrow(
      "TotpRequired"
    );
  });

  it("refuses a wrong code", async () => {
    await expect(
      authorize({ email: "a@b.c", password: "pw", totp: "000000" }, req)
    ).rejects.toThrow("TotpInvalid");
  });

  it("signs in with a valid code and records its time step", async () => {
    const code = totpCode(SECRET, totpCounter());
    await expect(authorize({ email: "a@b.c", password: "pw", totp: code }, req)).resolves.toEqual({
      id: "u1",
      email: "a@b.c",
      name: null,
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { totpLastCounter: expect.any(Number) },
    });
  });

  it("does not reveal TOTP state on a wrong password", async () => {
    await expect(authorize({ email: "a@b.c", password: "nope" }, req)).resolves.toBeNull();
  });
});
