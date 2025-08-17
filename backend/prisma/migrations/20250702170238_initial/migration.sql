BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[users] (
    [user_id] INT NOT NULL IDENTITY(1,1),
    [username] NVARCHAR(255) NOT NULL,
    [password] NVARCHAR(255) NOT NULL,
    [role] NVARCHAR(50) NOT NULL,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([user_id]),
    CONSTRAINT [users_username_key] UNIQUE NONCLUSTERED ([username])
);

-- CreateTable
CREATE TABLE [dbo].[products] (
    [mvd_number] NVARCHAR(255) NOT NULL,
    [product_name] NVARCHAR(255) NOT NULL,
    [is_archived] BIT NOT NULL CONSTRAINT [products_is_archived_df] DEFAULT 0,
    CONSTRAINT [products_pkey] PRIMARY KEY CLUSTERED ([mvd_number])
);

-- CreateTable
CREATE TABLE [dbo].[configurations] (
    [config_number] NVARCHAR(255) NOT NULL,
    [mvd_number] NVARCHAR(255) NOT NULL,
    [config_name] NVARCHAR(255) NOT NULL,
    CONSTRAINT [configurations_pkey] PRIMARY KEY CLUSTERED ([config_number])
);

-- CreateTable
CREATE TABLE [dbo].[manufacturingProcedures] (
    [mp_number] NVARCHAR(255) NOT NULL,
    [procedure_name] NVARCHAR(255) NOT NULL,
    CONSTRAINT [manufacturingProcedures_pkey] PRIMARY KEY CLUSTERED ([mp_number])
);

-- CreateTable
CREATE TABLE [dbo].[lots] (
    [lot_number] NVARCHAR(255) NOT NULL,
    [ys_number] NVARCHAR(255),
    [config_number] NVARCHAR(255) NOT NULL,
    [quantity] INT NOT NULL,
    [description] NVARCHAR(255),
    CONSTRAINT [lots_pkey] PRIMARY KEY CLUSTERED ([lot_number])
);

-- CreateTable
CREATE TABLE [dbo].[configMpSpecs] (
    [config_number] NVARCHAR(255) NOT NULL,
    [mp_number] NVARCHAR(255) NOT NULL,
    [spec_name] NVARCHAR(255) NOT NULL,
    [type] NVARCHAR(50) NOT NULL,
    [upper_spec] FLOAT(53),
    [lower_spec] FLOAT(53),
    [nominal] FLOAT(53),
    [attribute_value] NVARCHAR(255),
    CONSTRAINT [configMpSpecs_pkey] PRIMARY KEY CLUSTERED ([config_number],[mp_number],[spec_name])
);

-- CreateTable
CREATE TABLE [dbo].[inspectionLogs] (
    [log_id] INT NOT NULL IDENTITY(1,1),
    [username] NVARCHAR(255) NOT NULL,
    [lot_number] NVARCHAR(255) NOT NULL,
    [config_number] NVARCHAR(255) NOT NULL,
    [mp_number] NVARCHAR(255) NOT NULL,
    [spec_name] NVARCHAR(255) NOT NULL,
    [inspection_type] NVARCHAR(255) NOT NULL,
    [unit_number] INT NOT NULL,
    [inspection_value] FLOAT(53),
    [pass_fail] NVARCHAR(10) NOT NULL,
    [timestamp] DATETIME NOT NULL CONSTRAINT [inspectionLogs_timestamp_df] DEFAULT CURRENT_TIMESTAMP,
    [reject_code] NVARCHAR(50),
    [process_parameters_snapshot] NVARCHAR(max),
    CONSTRAINT [inspectionLogs_pkey] PRIMARY KEY CLUSTERED ([log_id])
);

-- CreateTable
CREATE TABLE [dbo].[activeBuilds] (
    [build_id] INT NOT NULL IDENTITY(1,1),
    [username] NVARCHAR(255) NOT NULL,
    [lot_number] NVARCHAR(255) NOT NULL,
    [config_number] NVARCHAR(255) NOT NULL,
    [mp_number] NVARCHAR(255) NOT NULL,
    [start_time] DATETIME NOT NULL CONSTRAINT [activeBuilds_start_time_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [activeBuilds_pkey] PRIMARY KEY CLUSTERED ([build_id]),
    CONSTRAINT [activeBuilds_username_key] UNIQUE NONCLUSTERED ([username])
);

-- CreateTable
CREATE TABLE [dbo].[buildRecords] (
    [br_number] NVARCHAR(255) NOT NULL,
    [config_number] NVARCHAR(255) NOT NULL,
    CONSTRAINT [buildRecords_pkey] PRIMARY KEY CLUSTERED ([br_number])
);

-- CreateTable
CREATE TABLE [dbo].[Equipment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(255),
    CONSTRAINT [Equipment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Equipment_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[Parameter] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(255),
    CONSTRAINT [Parameter_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Parameter_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[EquipmentParameter] (
    [id] INT NOT NULL IDENTITY(1,1),
    [equipment_id] INT NOT NULL,
    [parameter_id] INT NOT NULL,
    CONSTRAINT [EquipmentParameter_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EquipmentParameter_equipment_id_parameter_id_key] UNIQUE NONCLUSTERED ([equipment_id],[parameter_id])
);

-- CreateTable
CREATE TABLE [dbo].[ProcessRecipe] (
    [id] INT NOT NULL IDENTITY(1,1),
    [config_number] NVARCHAR(255) NOT NULL,
    [mp_number] NVARCHAR(255) NOT NULL,
    [equipment_id] INT NOT NULL,
    [parameter_id] INT NOT NULL,
    [nominal_setpoint] FLOAT(53) NOT NULL,
    [min_setpoint] FLOAT(53) NOT NULL,
    [max_setpoint] FLOAT(53) NOT NULL,
    [recipe_name] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [ProcessRecipe_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ProcessRecipe_config_number_mp_number_recipe_name_parameter_id_key] UNIQUE NONCLUSTERED ([config_number],[mp_number],[recipe_name],[parameter_id])
);

-- CreateTable
CREATE TABLE [dbo].[LotProcessSetpoint] (
    [id] INT NOT NULL IDENTITY(1,1),
    [lot_number] NVARCHAR(255) NOT NULL,
    [parameter_name] NVARCHAR(100) NOT NULL,
    [setpoint_value] FLOAT(53) NOT NULL,
    CONSTRAINT [LotProcessSetpoint_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [LotProcessSetpoint_lot_number_parameter_name_key] UNIQUE NONCLUSTERED ([lot_number],[parameter_name])
);

-- CreateTable
CREATE TABLE [dbo].[RejectType] (
    [id] INT NOT NULL IDENTITY(1,1),
    [reject_code] NVARCHAR(50) NOT NULL,
    [description] NVARCHAR(255) NOT NULL,
    CONSTRAINT [RejectType_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RejectType_reject_code_key] UNIQUE NONCLUSTERED ([reject_code])
);

-- CreateTable
CREATE TABLE [dbo].[ProductRejects] (
    [id] INT NOT NULL IDENTITY(1,1),
    [mvd_number] NVARCHAR(255) NOT NULL,
    [reject_code] NVARCHAR(50) NOT NULL,
    CONSTRAINT [ProductRejects_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ProductRejects_mvd_number_reject_code_key] UNIQUE NONCLUSTERED ([mvd_number],[reject_code])
);

-- CreateTable
CREATE TABLE [dbo].[RejectAssignments] (
    [id] INT NOT NULL IDENTITY(1,1),
    [product_reject_id] INT NOT NULL,
    [mp_number] NVARCHAR(255) NOT NULL,
    CONSTRAINT [RejectAssignments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RejectAssignments_product_reject_id_mp_number_key] UNIQUE NONCLUSTERED ([product_reject_id],[mp_number])
);

-- CreateTable
CREATE TABLE [dbo].[_configurationsTomanufacturingProcedures] (
    [A] NVARCHAR(255) NOT NULL,
    [B] NVARCHAR(255) NOT NULL,
    CONSTRAINT [_configurationsTomanufacturingProcedures_AB_unique] UNIQUE NONCLUSTERED ([A],[B])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [_configurationsTomanufacturingProcedures_B_index] ON [dbo].[_configurationsTomanufacturingProcedures]([B]);

-- AddForeignKey
ALTER TABLE [dbo].[configurations] ADD CONSTRAINT [configurations_mvd_number_fkey] FOREIGN KEY ([mvd_number]) REFERENCES [dbo].[products]([mvd_number]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[lots] ADD CONSTRAINT [lots_config_number_fkey] FOREIGN KEY ([config_number]) REFERENCES [dbo].[configurations]([config_number]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[configMpSpecs] ADD CONSTRAINT [configMpSpecs_config_number_fkey] FOREIGN KEY ([config_number]) REFERENCES [dbo].[configurations]([config_number]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[configMpSpecs] ADD CONSTRAINT [configMpSpecs_mp_number_fkey] FOREIGN KEY ([mp_number]) REFERENCES [dbo].[manufacturingProcedures]([mp_number]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[inspectionLogs] ADD CONSTRAINT [inspectionLogs_config_number_mp_number_spec_name_fkey] FOREIGN KEY ([config_number], [mp_number], [spec_name]) REFERENCES [dbo].[configMpSpecs]([config_number],[mp_number],[spec_name]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inspectionLogs] ADD CONSTRAINT [inspectionLogs_lot_number_fkey] FOREIGN KEY ([lot_number]) REFERENCES [dbo].[lots]([lot_number]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[inspectionLogs] ADD CONSTRAINT [inspectionLogs_username_fkey] FOREIGN KEY ([username]) REFERENCES [dbo].[users]([username]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[activeBuilds] ADD CONSTRAINT [activeBuilds_username_fkey] FOREIGN KEY ([username]) REFERENCES [dbo].[users]([username]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[buildRecords] ADD CONSTRAINT [buildRecords_config_number_fkey] FOREIGN KEY ([config_number]) REFERENCES [dbo].[configurations]([config_number]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EquipmentParameter] ADD CONSTRAINT [EquipmentParameter_equipment_id_fkey] FOREIGN KEY ([equipment_id]) REFERENCES [dbo].[Equipment]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EquipmentParameter] ADD CONSTRAINT [EquipmentParameter_parameter_id_fkey] FOREIGN KEY ([parameter_id]) REFERENCES [dbo].[Parameter]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProcessRecipe] ADD CONSTRAINT [ProcessRecipe_config_number_fkey] FOREIGN KEY ([config_number]) REFERENCES [dbo].[configurations]([config_number]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProcessRecipe] ADD CONSTRAINT [ProcessRecipe_equipment_id_fkey] FOREIGN KEY ([equipment_id]) REFERENCES [dbo].[Equipment]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProcessRecipe] ADD CONSTRAINT [ProcessRecipe_mp_number_fkey] FOREIGN KEY ([mp_number]) REFERENCES [dbo].[manufacturingProcedures]([mp_number]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProcessRecipe] ADD CONSTRAINT [ProcessRecipe_parameter_id_fkey] FOREIGN KEY ([parameter_id]) REFERENCES [dbo].[Parameter]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LotProcessSetpoint] ADD CONSTRAINT [LotProcessSetpoint_lot_number_fkey] FOREIGN KEY ([lot_number]) REFERENCES [dbo].[lots]([lot_number]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProductRejects] ADD CONSTRAINT [ProductRejects_mvd_number_fkey] FOREIGN KEY ([mvd_number]) REFERENCES [dbo].[products]([mvd_number]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProductRejects] ADD CONSTRAINT [ProductRejects_reject_code_fkey] FOREIGN KEY ([reject_code]) REFERENCES [dbo].[RejectType]([reject_code]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RejectAssignments] ADD CONSTRAINT [RejectAssignments_mp_number_fkey] FOREIGN KEY ([mp_number]) REFERENCES [dbo].[manufacturingProcedures]([mp_number]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RejectAssignments] ADD CONSTRAINT [RejectAssignments_product_reject_id_fkey] FOREIGN KEY ([product_reject_id]) REFERENCES [dbo].[ProductRejects]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[_configurationsTomanufacturingProcedures] ADD CONSTRAINT [_configurationsTomanufacturingProcedures_A_fkey] FOREIGN KEY ([A]) REFERENCES [dbo].[configurations]([config_number]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[_configurationsTomanufacturingProcedures] ADD CONSTRAINT [_configurationsTomanufacturingProcedures_B_fkey] FOREIGN KEY ([B]) REFERENCES [dbo].[manufacturingProcedures]([mp_number]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
