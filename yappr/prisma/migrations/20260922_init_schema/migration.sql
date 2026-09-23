-- Full schema rebuild for `chityapp`.
--
-- WHY THIS EXISTS: on 2026-09-22 the scratch DROP/TRUNCATE statements at the
-- bottom of the working DDL file were executed against the live TiDB database.
-- Every table except `AllChats` and the legacy `sessions` table was dropped.
-- This script recreates the schema from prisma/schema.prisma.
--
-- Generated with:
--   prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
--
-- Differences from the original DDL, both deliberate:
--   1. The four chat-ownership FKs are ON DELETE CASCADE. Deleting an AllChats
--      row now clears the chat, its members and its messages.
--   2. Chat_Users' chat_id FK is `fk_chat_users_chat_id`. The original DDL used
--      `fk_chat_id` for both it and Chats, which MySQL rejects as a duplicate.
--
-- ============================== READ FIRST ==============================
--
-- RESTORE DATA BEFORE RUNNING THIS. Check TiDB Cloud's automatic backups or
-- point-in-time recovery first — that is the only route that recovers data
-- written after the last dump. `chityapp_backup.sql` in the repo root holds an
-- older snapshot of users/chats/chat_users/friends/messages/settings, but its
-- tables are lowercase and it predates the random-chat tables, so it needs
-- rewriting before it can load into this schema.
--
-- Running this script against a database that still holds data will destroy it.
--
-- ========================================================================

-- Section 1 is DESTRUCTIVE. It removes the two survivors of the accidental
-- drop: an `AllChats` table whose rows now reference nothing, and the legacy
-- express-mysql-session table that `@quixo3/prisma-session-store` replaces.
-- Skip this section if you still need either one.

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `AllChats`;
DROP TABLE IF EXISTS `sessions`;
SET FOREIGN_KEY_CHECKS = 1;

-- Section 2: schema.

-- CreateTable
CREATE TABLE `Users` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(30) NOT NULL,
    `password` VARCHAR(225) NOT NULL,
    `email` VARCHAR(225) NOT NULL,
    `joined_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `description` TEXT NULL,
    `last_updated_username` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uniq_username`(`username`),
    UNIQUE INDEX `uniq_email`(`email`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Friends` (
    `friend_id` INTEGER NOT NULL AUTO_INCREMENT,
    `sender_id` INTEGER NOT NULL,
    `receiver_id` INTEGER NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_friends_sender`(`sender_id`),
    INDEX `fk_friends_receiver`(`receiver_id`),
    PRIMARY KEY (`friend_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AllChats` (
    `chat_id` INTEGER NOT NULL AUTO_INCREMENT,
    `if_random` TINYINT NULL DEFAULT 0,

    PRIMARY KEY (`chat_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Chats` (
    `chat_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `creator_id` INTEGER NOT NULL,
    `chat_name` VARCHAR(30) NOT NULL,

    INDEX `fk_chat_creator`(`creator_id`),
    PRIMARY KEY (`chat_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Chat_Users` (
    `chat_user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `chat_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `joined_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `last_seen_message_id` INTEGER NOT NULL DEFAULT 0,

    INDEX `fk_chat_id`(`chat_id`),
    INDEX `fk_chat_user_id`(`user_id`),
    PRIMARY KEY (`chat_user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Messages` (
    `message_id` INTEGER NOT NULL AUTO_INCREMENT,
    `chat_id` INTEGER NOT NULL,
    `sender_id` INTEGER NOT NULL,
    `message` TEXT NOT NULL,
    `sent_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted` TINYINT NULL DEFAULT 0,
    `askGemini` TINYINT NULL DEFAULT 0,
    `random_chat` TINYINT NULL DEFAULT 0,

    INDEX `fk_msgs_chat_id`(`chat_id`),
    INDEX `fk_sender_id`(`sender_id`),
    PRIMARY KEY (`message_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Settings` (
    `user_id` INTEGER NOT NULL,
    `light_mode` TINYINT NULL DEFAULT 1,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RandomChats` (
    `chat_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `user_id_1` INTEGER NOT NULL,
    `user_id_2` INTEGER NOT NULL,

    UNIQUE INDEX `RandomChats_user_id_1_key`(`user_id_1`),
    UNIQUE INDEX `RandomChats_user_id_2_key`(`user_id_2`),
    PRIMARY KEY (`chat_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RandomChatPool` (
    `random_chat_user` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `available` TINYINT NULL DEFAULT 1,
    `time_joined` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `RandomChatPool_user_id_key`(`user_id`),
    PRIMARY KEY (`random_chat_user`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `sid` VARCHAR(191) NOT NULL,
    `data` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_sid_key`(`sid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Friends` ADD CONSTRAINT `fk_friends_sender` FOREIGN KEY (`sender_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Friends` ADD CONSTRAINT `fk_friends_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chats` ADD CONSTRAINT `fk_chat_id` FOREIGN KEY (`chat_id`) REFERENCES `AllChats`(`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chats` ADD CONSTRAINT `fk_chat_creator` FOREIGN KEY (`creator_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chat_Users` ADD CONSTRAINT `fk_chat_users_chat_id` FOREIGN KEY (`chat_id`) REFERENCES `Chats`(`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chat_Users` ADD CONSTRAINT `fk_chat_user_id` FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Messages` ADD CONSTRAINT `fk_msgs_chat_id` FOREIGN KEY (`chat_id`) REFERENCES `AllChats`(`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Messages` ADD CONSTRAINT `fk_sender_id` FOREIGN KEY (`sender_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Settings` ADD CONSTRAINT `fk_settings_user_id` FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RandomChats` ADD CONSTRAINT `fk_random_chat_id` FOREIGN KEY (`chat_id`) REFERENCES `AllChats`(`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RandomChats` ADD CONSTRAINT `fk_random_user_1` FOREIGN KEY (`user_id_1`) REFERENCES `RandomChatPool`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RandomChats` ADD CONSTRAINT `fk_random_user_2` FOREIGN KEY (`user_id_2`) REFERENCES `RandomChatPool`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RandomChatPool` ADD CONSTRAINT `fk_random_pool_id` FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Section 3: required seed row.
--
-- sender_id -1 is the "server" account used for system messages (chat created,
-- user joined, start of random chat). Messages.sender_id has a FK to Users, so
-- without this row every system message insert fails.

INSERT INTO `Users` (`user_id`, `username`, `password`, `email`)
VALUES (-1, 'server', '0', 'TEMPLATE');
