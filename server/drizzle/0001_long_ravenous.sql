ALTER TABLE `activity_logs` MODIFY COLUMN `shop_id` bigint unsigned NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_snapshots` MODIFY COLUMN `shop_id` bigint unsigned NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_snapshots` MODIFY COLUMN `product_id` bigint unsigned NOT NULL;--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `shop_id` bigint unsigned NOT NULL;--> statement-breakpoint
ALTER TABLE `restock_plans` MODIFY COLUMN `shop_id` bigint unsigned NOT NULL;--> statement-breakpoint
ALTER TABLE `restock_plans` MODIFY COLUMN `product_id` bigint unsigned NOT NULL;