CREATE TABLE `activity_logs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`shop_id` int unsigned NOT NULL,
	`actor` varchar(100) NOT NULL DEFAULT 'system',
	`action` varchar(100) NOT NULL,
	`detail` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_snapshots` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`shop_id` int unsigned NOT NULL,
	`product_id` int unsigned NOT NULL,
	`available` int NOT NULL,
	`captured_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`shop_id` int unsigned NOT NULL,
	`shopify_product_id` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`sku` varchar(100) NOT NULL,
	`available` int NOT NULL DEFAULT 0,
	`daily_sales` decimal(10,2) NOT NULL DEFAULT '0',
	`lead_time_days` int NOT NULL DEFAULT 7,
	`unit_cost` decimal(10,2) NOT NULL DEFAULT '0',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `restock_plans` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`shop_id` int unsigned NOT NULL,
	`product_id` int unsigned NOT NULL,
	`quantity` int NOT NULL,
	`status` enum('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `restock_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`shop_domain` varchar(255) NOT NULL,
	`access_token` text,
	`scope` varchar(500),
	`installed_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shops_id` PRIMARY KEY(`id`),
	CONSTRAINT `shops_shop_domain_unique` UNIQUE(`shop_domain`)
);
--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_snapshots` ADD CONSTRAINT `inventory_snapshots_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_snapshots` ADD CONSTRAINT `inventory_snapshots_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `restock_plans` ADD CONSTRAINT `restock_plans_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `restock_plans` ADD CONSTRAINT `restock_plans_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_shop_created_idx` ON `activity_logs` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `snapshot_product_captured_idx` ON `inventory_snapshots` (`product_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `shop_product_unique` ON `products` (`shop_id`,`shopify_product_id`);--> statement-breakpoint
CREATE INDEX `restock_shop_status_idx` ON `restock_plans` (`shop_id`,`status`);