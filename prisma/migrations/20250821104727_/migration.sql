-- CreateEnum
CREATE TYPE "public"."ShareType" AS ENUM ('FILE', 'PASTE', 'URL');

-- CreateEnum
CREATE TYPE "public"."pasteType" AS ENUM ('PLAIN', 'JAVASCRIPT', 'TYPESCRIPT', 'PYTHON', 'JAVA', 'CSHARP', 'RUBY', 'PHP', 'GO', 'SWIFT', 'KOTLIN', 'HTML', 'CSS', 'SQL', 'BASH');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Share" (
    "id" TEXT NOT NULL,
    "type" "public"."ShareType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "filePath" TEXT,
    "paste" TEXT,
    "pastelanguage" "public"."pasteType",
    "urlOriginal" TEXT,
    "slug" TEXT NOT NULL,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Share_slug_key" ON "public"."Share"("slug");

-- AddForeignKey
ALTER TABLE "public"."Share" ADD CONSTRAINT "Share_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
