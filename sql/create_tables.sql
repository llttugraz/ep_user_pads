
CREATE TABLE IF NOT EXISTS `Groups` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_bin NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

CREATE TABLE IF NOT EXISTS `GroupPads` (
  `group_id` int(11) unsigned NOT NULL,
  `pad_name` varchar(255) COLLATE utf8_bin NOT NULL,
  PRIMARY KEY (`group_id`,`pad_name`),
  CONSTRAINT `FK_GroupPads_Groups` FOREIGN KEY (`group_id`) REFERENCES `Groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;


CREATE TABLE IF NOT EXISTS `NotRegisteredUsersGroups` (
  `email` varchar(255) NOT NULL,
  `group_id` int(11) unsigned NOT NULL,
  PRIMARY KEY (`email`,`group_id`),
  KEY `FK_NotRegisteredUsersGroups_Groups` (`group_id`),
  CONSTRAINT `FK_NotRegisteredUsersGroups_Groups` FOREIGN KEY (`group_id`) REFERENCES `Groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE IF NOT EXISTS `User` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_bin NOT NULL DEFAULT '',
  `pwd` varchar(255) COLLATE utf8_bin DEFAULT NULL,
  `considered` tinyint(11) DEFAULT NULL,
  `SSO` tinyint(4) DEFAULT NULL,
  `FullName` varchar(255) COLLATE utf8_bin DEFAULT NULL,
  `considerationString` varchar(50) COLLATE utf8_bin DEFAULT NULL,
  `salt` varchar(255) COLLATE utf8_bin DEFAULT NULL,
  `active` int(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

CREATE TABLE IF NOT EXISTS `UserGroup` (
  `user_id` int(11) unsigned NOT NULL,
  `group_id` int(11) unsigned NOT NULL,
  `role_id` int(11) unsigned NOT NULL,
  PRIMARY KEY (`user_id`,`group_id`),
  KEY `FK_UserGroup_Groups` (`group_id`),
  CONSTRAINT `FK_UserGroup_Groups` FOREIGN KEY (`group_id`) REFERENCES `Groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_UserGroup_User` FOREIGN KEY (`user_id`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;


CREATE TABLE IF NOT EXISTS `UserSessions` (
  `session_id` varchar(255) COLLATE utf8_bin NOT NULL,
  `user_id` int(11) unsigned NOT NULL,
  PRIMARY KEY (`session_id`),
  KEY `FK_UserSessions_User` (`user_id`),
  CONSTRAINT `FK_UserSessions_User` FOREIGN KEY (`user_id`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
