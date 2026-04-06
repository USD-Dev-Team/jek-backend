-- CreateEnum
CREATE TYPE "jekRoles" AS ENUM ('User', 'JEK', 'INSPECTION');

-- CreateEnum
CREATE TYPE "Status_Flow" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "District" AS ENUM ('GULISTON_SHAHAR', 'YANGIYER_SHAHAR', 'SHIRIN_SHAHAR', 'GULISTON_TUMANI', 'BOYOVUT_TUMANI', 'SAYXUNOBOD_TUMANI', 'MIRZAOBOD_TUMANI', 'OQOLTIN_TUMANI', 'SARD_OBA_TUMANI', 'XOVOS_TUMANI', 'SARDOBA_TUMANI');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phoneNumber" TEXT,
    "registration_step" TEXT DEFAULT 'START',
    "temp_district" "District",
    "temp_mahalla" TEXT,
    "temp_street" TEXT,
    "temp_house" TEXT,
    "temp_address" TEXT,
    "temp_description" TEXT,
    "temp_photos" JSONB,
    "role" "jekRoles" NOT NULL DEFAULT 'User',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "district" "District" NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "role" "jekRoles" NOT NULL DEFAULT 'JEK',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "refreshToken" TEXT,
    "jti" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "request_number" VARCHAR(20) NOT NULL,
    "user_id" TEXT NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "assigned_jek_id" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "description" TEXT NOT NULL,
    "status" "Status_Flow" NOT NULL DEFAULT 'PENDING',
    "district" "District" NOT NULL,
    "note" TEXT,
    "rejection_reason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_photos" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "telegram_file_id" VARCHAR(255),
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_status_logs" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "old_status" "Status_Flow" NOT NULL,
    "new_status" "Status_Flow" NOT NULL,
    "changed_by_role" VARCHAR(50) NOT NULL,
    "changed_by_id" VARCHAR(50) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "admins_phoneNumber_key" ON "admins"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "requests_request_number_key" ON "requests"("request_number");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_assigned_jek_id_fkey" FOREIGN KEY ("assigned_jek_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_photos" ADD CONSTRAINT "request_photos_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_logs" ADD CONSTRAINT "request_status_logs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
