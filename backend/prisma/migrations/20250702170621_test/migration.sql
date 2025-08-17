/*
  Warnings:

  - A unique constraint covering the columns `[lot_number,recipe_name,parameter_name]` on the table `LotProcessSetpoint` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `recipe_name` to the `LotProcessSetpoint` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- DropIndex
ALTER TABLE [dbo].[LotProcessSetpoint] DROP CONSTRAINT [LotProcessSetpoint_lot_number_parameter_name_key];

-- AlterTable
ALTER TABLE [dbo].[LotProcessSetpoint] ADD [recipe_name] NVARCHAR(1000) NOT NULL;

-- CreateIndex
ALTER TABLE [dbo].[LotProcessSetpoint] ADD CONSTRAINT [LotProcessSetpoint_lot_number_recipe_name_parameter_name_key] UNIQUE NONCLUSTERED ([lot_number], [recipe_name], [parameter_name]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
