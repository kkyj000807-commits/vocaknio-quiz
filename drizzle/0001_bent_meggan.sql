CREATE TABLE `user_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`wrongNums` text NOT NULL DEFAULT ('[]'),
	`bookmarkNums` text NOT NULL DEFAULT ('[]'),
	`totalAnswered` int NOT NULL DEFAULT 0,
	`totalCorrect` int NOT NULL DEFAULT 0,
	`streakDays` int NOT NULL DEFAULT 0,
	`lastStudiedAt` varchar(10) NOT NULL DEFAULT '',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_data_userId_unique` UNIQUE(`userId`)
);
