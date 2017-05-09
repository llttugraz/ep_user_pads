-- Group constraints

DELETE from GroupPads
WHERE groupID NOT IN
(SELECT groupID FROM Groups);

DELETE from NotRegisteredUsersGroups
WHERE groupID NOT IN
(SELECT groupID FROM Groups);

DELETE from UserGroup
WHERE groupID NOT IN
(SELECT groupID FROM Groups);

-- User constraints

DELETE from UserGroup
WHERE userID NOT IN
(SELECT UserID FROM User);

DELETE from UserSessions
WHERE userID NOT IN
(SELECT UserID FROM User);

-- alter tables

ALTER TABLE `NotRegisteredUsersGroups`
	ALTER `groupID` DROP DEFAULT;
ALTER TABLE `NotRegisteredUsersGroups`
	COLLATE='utf8_general_ci',
	ENGINE=InnoDB,
	CHANGE COLUMN `groupID` `group_id` INT(11) NOT NULL AFTER `email`,
	ADD INDEX `group_id` (`group_id`),
	ADD INDEX `email` (`email`);
ALTER TABLE `NotRegisteredUsersGroups`
	ALTER `group_id` DROP DEFAULT;
ALTER TABLE `NotRegisteredUsersGroups`
	CHANGE COLUMN `group_id` `group_id` INT(11) UNSIGNED NOT NULL AFTER `email`;
ALTER TABLE `NotRegisteredUsersGroups`
	ALTER `email` DROP DEFAULT;
ALTER TABLE `NotRegisteredUsersGroups`
	CHANGE COLUMN `email` `email` VARCHAR(255) NOT NULL COLLATE 'utf8_general_ci' FIRST;
ALTER TABLE `GroupPads`
	ALTER `GroupID` DROP DEFAULT,
	ALTER `PadName` DROP DEFAULT;
ALTER TABLE `GroupPads`
	CHANGE COLUMN `GroupID` `group_id` INT(11) UNSIGNED NOT NULL FIRST,
	CHANGE COLUMN `PadName` `pad_name` VARCHAR(255) NOT NULL COLLATE 'utf8_bin' AFTER `group_id`,
	DROP PRIMARY KEY,
	ADD PRIMARY KEY (`group_id`, `pad_name`);
ALTER TABLE `Groups`
	CHANGE COLUMN `groupID` `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT FIRST;
ALTER TABLE `NotRegisteredUsersGroups`
	DROP INDEX `email`,
	DROP INDEX `group_id`,
	ADD PRIMARY KEY (`email`, `group_id`);
ALTER TABLE `GroupPads`
	DROP PRIMARY KEY,
	ADD PRIMARY KEY (`group_id`, `pad_name`);
ALTER TABLE `Groups`
	DROP PRIMARY KEY,
	ADD PRIMARY KEY (`id`);
ALTER TABLE `User`
	CHANGE COLUMN `userID` `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
	DROP PRIMARY KEY,
	ADD PRIMARY KEY (`id`),
	ADD UNIQUE INDEX `name` (`name`);
ALTER TABLE `UserGroup`
	CHANGE COLUMN `userID` `user_id` INT(11) UNSIGNED NOT NULL DEFAULT '0' FIRST,
	CHANGE COLUMN `groupID` `group_id` INT(11) UNSIGNED NOT NULL DEFAULT '0' AFTER `user_id`,
	CHANGE COLUMN `Role` `role_id` INT(11) NULL DEFAULT NULL AFTER `group_id`;
ALTER TABLE `UserGroup`
	CHANGE COLUMN `role_id` `role_id` INT(11) UNSIGNED NULL DEFAULT NULL AFTER `group_id`;
ALTER TABLE `UserGroup`
	ALTER `user_id` DROP DEFAULT,
	ALTER `group_id` DROP DEFAULT,
	ALTER `role_id` DROP DEFAULT;
ALTER TABLE `UserGroup`
	CHANGE COLUMN `user_id` `user_id` INT(11) UNSIGNED NOT NULL FIRST,
	CHANGE COLUMN `group_id` `group_id` INT(11) UNSIGNED NOT NULL AFTER `user_id`,
	CHANGE COLUMN `role_id` `role_id` INT(11) UNSIGNED NOT NULL AFTER `group_id`;
ALTER TABLE `UserSessions`
	ALTER `sessionID` DROP DEFAULT,
	ALTER `userID` DROP DEFAULT;
ALTER TABLE `UserSessions`
	CHANGE COLUMN `sessionID` `session_id` VARCHAR(255) NOT NULL COLLATE 'utf8_bin' FIRST,
	CHANGE COLUMN `userID` `user_id` INT(11) UNSIGNED NOT NULL AFTER `session_id`;
ALTER TABLE `GroupPads`
	ADD CONSTRAINT `FK_GroupPads_Groups` FOREIGN KEY (`group_id`) REFERENCES `Groups` (`id`) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE `NotRegisteredUsersGroups`
	ADD CONSTRAINT `FK_NotRegisteredUsersGroups_Groups` FOREIGN KEY (`group_id`) REFERENCES `Groups` (`id`) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE `UserGroup`
	ADD CONSTRAINT `FK_UserGroup_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	ADD CONSTRAINT `FK_UserGroup_Groups` FOREIGN KEY (`group_id`) REFERENCES `Groups` (`id`) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE `UserSessions`
	ADD CONSTRAINT `FK_UserSessions_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE CASCADE ON DELETE CASCADE;
