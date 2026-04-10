-- AlterTable
ALTER TABLE "users" ADD COLUMN     "temp_view_message_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
