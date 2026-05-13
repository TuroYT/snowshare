import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { S3ServiceException } from "@aws-sdk/client-s3";
import { apiError, ErrorCode } from "@/lib/api-errors";

// HTTP status codes that prove the S3 server is reachable and understands the request.
// 200 = bucket accessible, 301 = wrong region (bucket exists), 403 = auth/ACL issue (server reached),
// 404 = bucket not found (server reached), 301/400 = various redirect/config issues — all mean connectivity works.
const REACHABLE_STATUS_CODES = new Set([200, 301, 400, 403, 404]);

async function resolveS3TestSecret(fromBody: string | undefined): Promise<string | undefined> {
  if (fromBody) return fromBody;
  const settings = await prisma.settings.findFirst({ select: { s3SecretAccessKey: true } });
  return settings?.s3SecretAccessKey ?? undefined;
}

function buildS3TestClient(
  region: string,
  endpoint: string | undefined,
  accessKeyId: string | undefined,
  secretAccessKey: string | undefined
): S3Client {
  return new S3Client({
    region,
    ...(endpoint && { endpoint }),
    ...(accessKeyId && secretAccessKey && { credentials: { accessKeyId, secretAccessKey } }),
    forcePathStyle: !!endpoint,
  });
}

async function testS3Connectivity(
  s3: S3Client,
  bucket: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return { success: true };
  } catch (err) {
    if (err instanceof S3ServiceException) {
      const status = err.$metadata?.httpStatusCode;
      if (status && REACHABLE_STATUS_CODES.has(status)) return { success: true };
      return { success: false, error: err.message };
    }
    throw err;
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError(request, ErrorCode.UNAUTHORIZED);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isAdmin) return apiError(request, ErrorCode.ADMIN_ONLY);

  try {
    const body = await request.json();
    const bucket: string | undefined = body.s3Bucket || undefined;
    const region: string = body.s3Region || "us-east-1";
    const endpoint: string | undefined = body.s3Endpoint || undefined;
    const accessKeyId: string | undefined = body.s3AccessKeyId || undefined;
    const secretFromBody: string | undefined =
      body.s3SecretAccessKey && body.s3SecretAccessKey !== "••••••••"
        ? body.s3SecretAccessKey
        : undefined;

    if (!bucket) {
      return NextResponse.json(
        { success: false, error: "Bucket name is required" },
        { status: 400 }
      );
    }

    const resolvedSecret = await resolveS3TestSecret(secretFromBody);
    const s3 = buildS3TestClient(region, endpoint, accessKeyId, resolvedSecret);
    const result = await testS3Connectivity(s3, bucket);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    console.error("S3 test error:", error);
    return NextResponse.json({ success: false, error: message });
  }
}
