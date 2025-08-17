BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[UserFavoriteSpec] (
    [user_id] INT NOT NULL,
    [config_number] NVARCHAR(255) NOT NULL,
    [mp_number] NVARCHAR(255) NOT NULL,
    [spec_name] NVARCHAR(255) NOT NULL,
    CONSTRAINT [UserFavoriteSpec_pkey] PRIMARY KEY CLUSTERED ([user_id],[config_number],[mp_number],[spec_name])
);

-- AddForeignKey
ALTER TABLE [dbo].[UserFavoriteSpec] ADD CONSTRAINT [UserFavoriteSpec_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([user_id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserFavoriteSpec] ADD CONSTRAINT [UserFavoriteSpec_config_number_mp_number_spec_name_fkey] FOREIGN KEY ([config_number], [mp_number], [spec_name]) REFERENCES [dbo].[configMpSpecs]([config_number],[mp_number],[spec_name]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
