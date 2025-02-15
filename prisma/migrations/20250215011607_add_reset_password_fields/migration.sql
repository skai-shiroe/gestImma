-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('User', 'User2', 'User3', 'Admin', 'SuperAdmin');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "location" JSONB,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "isOnline" BOOLEAN DEFAULT false,
    "isActive" BOOLEAN DEFAULT true,
    "role" "UserRole" DEFAULT 'User',
    "refreshToken" TEXT,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
