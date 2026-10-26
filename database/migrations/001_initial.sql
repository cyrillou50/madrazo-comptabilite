-- Madrazo - schéma initial. Exécuter avec l'utilisateur dédié sur la base dédiée.
-- Chaque marqueur est une frontière de requête pour le migrateur TypeScript.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
-- statement-breakpoint
CREATE TABLE roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME(3) NULL,
  last_login_at DATETIME(3) NULL,
  password_changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  INDEX idx_users_active (is_active, archived_at)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE user_permissions (
  user_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  effect ENUM('allow','deny') NOT NULL,
  PRIMARY KEY (user_id, permission_id),
  CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE user_sessions (
  sid VARCHAR(128) PRIMARY KEY,
  data LONGTEXT NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_sessions_expiry (expires_at),
  INDEX idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE `groups` (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  type ENUM('organisation','gang','mc','revendeur','independant','autre') NOT NULL,
  manager_name VARCHAR(150) NULL,
  phone VARCHAR(50) NULL,
  description TEXT NULL,
  status ENUM('actif','regulier','occasionnel','vip','surveillance','blackliste','inactif') NOT NULL DEFAULT 'actif',
  internal_notes TEXT NULL,
  block_orders BOOLEAN NOT NULL DEFAULT FALSE,
  last_activity_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  INDEX idx_groups_name (name),
  INDEX idx_groups_status (status, archived_at)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE group_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_group_notes_group FOREIGN KEY (group_id) REFERENCES `groups`(id),
  CONSTRAINT fk_group_notes_author FOREIGN KEY (author_id) REFERENCES users(id),
  INDEX idx_group_notes_group (group_id, created_at)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE contacts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  nickname VARCHAR(100) NULL,
  phone VARCHAR(50) NULL,
  role_in_group VARCHAR(100) NULL,
  status ENUM('actif','vip','surveillance','blackliste','inactif') NOT NULL DEFAULT 'actif',
  notes TEXT NULL,
  last_contact_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  CONSTRAINT fk_contacts_group FOREIGN KEY (group_id) REFERENCES `groups`(id),
  INDEX idx_contacts_group (group_id),
  INDEX idx_contacts_name (last_name, first_name),
  INDEX idx_contacts_phone (phone)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE contact_interactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contact_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  interaction_type VARCHAR(50) NOT NULL,
  notes TEXT NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_interactions_contact FOREIGN KEY (contact_id) REFERENCES contacts(id),
  CONSTRAINT fk_interactions_author FOREIGN KEY (author_id) REFERENCES users(id),
  INDEX idx_interactions_contact_date (contact_id, occurred_at)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE item_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(500) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  sku VARCHAR(80) NOT NULL UNIQUE,
  unit_cost_cents BIGINT UNSIGNED NOT NULL,
  default_price_cents BIGINT UNSIGNED NOT NULL,
  minimum_price_cents BIGINT UNSIGNED NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'unité',
  alert_threshold INT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  CONSTRAINT chk_item_prices CHECK (default_price_cents >= minimum_price_cents),
  CONSTRAINT fk_items_category FOREIGN KEY (category_id) REFERENCES item_categories(id),
  INDEX idx_items_category (category_id, archived_at),
  INDEX idx_items_name (name)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE group_prices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  price_cents BIGINT UNSIGNED NOT NULL,
  valid_from DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  valid_until DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_group_prices_group FOREIGN KEY (group_id) REFERENCES `groups`(id),
  CONSTRAINT fk_group_prices_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT fk_group_prices_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_group_price_lookup (group_id, item_id, valid_from, valid_until)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE price_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  old_price_cents BIGINT UNSIGNED NOT NULL,
  new_price_cents BIGINT UNSIGNED NOT NULL,
  changed_by BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_price_history_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT fk_price_history_user FOREIGN KEY (changed_by) REFERENCES users(id),
  INDEX idx_price_history_item (item_id, created_at)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE quantity_tiers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  minimum_quantity INT UNSIGNED NOT NULL,
  price_cents BIGINT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_quantity_tiers_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  UNIQUE KEY uq_quantity_tier (item_id, minimum_quantity)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(40) NOT NULL UNIQUE,
  group_id BIGINT UNSIGNED NULL,
  contact_id BIGINT UNSIGNED NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  order_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  subtotal_cents BIGINT UNSIGNED NOT NULL,
  discount_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_cents BIGINT UNSIGNED NOT NULL,
  cost_cents BIGINT UNSIGNED NOT NULL,
  margin_cents BIGINT NOT NULL,
  notes TEXT NULL,
  status ENUM('draft','pending','confirmed','partially_delivered','delivered','cancelled') NOT NULL DEFAULT 'pending',
  payment_status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  cancelled_at DATETIME(3) NULL,
  CONSTRAINT chk_order_totals CHECK (subtotal_cents >= discount_cents AND total_cents = subtotal_cents - discount_cents),
  CONSTRAINT fk_orders_group FOREIGN KEY (group_id) REFERENCES `groups`(id),
  CONSTRAINT fk_orders_contact FOREIGN KEY (contact_id) REFERENCES contacts(id),
  CONSTRAINT fk_orders_seller FOREIGN KEY (seller_id) REFERENCES users(id),
  INDEX idx_orders_group_date (group_id, order_date),
  INDEX idx_orders_status_date (status, order_date),
  INDEX idx_orders_payment_status (payment_status, order_date)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  item_name_snapshot VARCHAR(150) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price_cents BIGINT UNSIGNED NOT NULL,
  unit_cost_cents BIGINT UNSIGNED NOT NULL,
  discount_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
  line_total_cents BIGINT UNSIGNED NOT NULL,
  CONSTRAINT chk_order_item_quantity CHECK (quantity > 0),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_items_item FOREIGN KEY (item_id) REFERENCES items(id),
  UNIQUE KEY uq_order_item (order_id, item_id),
  INDEX idx_order_items_item (item_id)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE stock_reservations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_item_id BIGINT UNSIGNED NOT NULL UNIQUE,
  item_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  released_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('active','consumed','released') NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_reservation_release CHECK (released_quantity <= quantity),
  CONSTRAINT fk_reservations_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  CONSTRAINT fk_reservations_item FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_reservations_item_status (item_id, status)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE deliveries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  delivered_by BIGINT UNSIGNED NOT NULL,
  notes VARCHAR(500) NULL,
  delivered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_deliveries_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_deliveries_user FOREIGN KEY (delivered_by) REFERENCES users(id),
  UNIQUE KEY uq_delivery_idempotency (order_id, idempotency_key)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE delivery_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  CONSTRAINT chk_delivery_quantity CHECK (quantity > 0),
  CONSTRAINT fk_delivery_items_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
  CONSTRAINT fk_delivery_items_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  UNIQUE KEY uq_delivery_order_item (delivery_id, order_item_id)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE stock_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('entry','delivery','adjustment','return','reservation','release') NOT NULL,
  quantity_delta INT NOT NULL,
  reason VARCHAR(500) NOT NULL,
  source_type VARCHAR(50) NULL,
  source_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_stock_delta CHECK (quantity_delta <> 0),
  CONSTRAINT fk_stock_movements_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT fk_stock_movements_user FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uq_stock_source (source_type, source_id),
  INDEX idx_stock_item_date (item_id, occurred_at)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  method ENUM('cash','bank','other') NOT NULL DEFAULT 'cash',
  reference VARCHAR(100) NULL,
  notes VARCHAR(500) NULL,
  received_by BIGINT UNSIGNED NOT NULL,
  paid_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reversed_at DATETIME(3) NULL,
  reversed_by BIGINT UNSIGNED NULL,
  reversal_reason VARCHAR(500) NULL,
  CONSTRAINT chk_payment_amount CHECK (amount_cents > 0),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_payments_received_by FOREIGN KEY (received_by) REFERENCES users(id),
  CONSTRAINT fk_payments_reversed_by FOREIGN KEY (reversed_by) REFERENCES users(id),
  INDEX idx_payments_order (order_id, reversed_at),
  INDEX idx_payments_date (paid_at)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE expense_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE expenses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(200) NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  notes VARCHAR(500) NULL,
  expense_date DATETIME(3) NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reversed_at DATETIME(3) NULL,
  reversed_by BIGINT UNSIGNED NULL,
  reversal_reason VARCHAR(500) NULL,
  CONSTRAINT chk_expense_amount CHECK (amount_cents > 0),
  CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  CONSTRAINT fk_expenses_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_expenses_reversed_by FOREIGN KEY (reversed_by) REFERENCES users(id),
  INDEX idx_expenses_date (expense_date)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE cash_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  movement_type ENUM('income','expense','adjustment','refund') NOT NULL,
  amount_cents BIGINT NOT NULL,
  label VARCHAR(200) NOT NULL,
  source_type VARCHAR(50) NULL,
  source_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_cash_amount CHECK (amount_cents <> 0),
  CONSTRAINT fk_cash_movements_user FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uq_cash_source (source_type, source_id),
  INDEX idx_cash_date (occurred_at)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_actor_date (actor_id, created_at),
  INDEX idx_audit_action_date (action, created_at)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE TABLE settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  value_json JSON NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB;
-- statement-breakpoint
CREATE VIEW item_inventory AS
SELECT i.id AS item_id,
       COALESCE(SUM(sm.quantity_delta), 0) AS stock_quantity,
       COALESCE((SELECT SUM(sr.quantity - sr.released_quantity) FROM stock_reservations sr WHERE sr.item_id = i.id AND sr.status = 'active'), 0) AS reserved_quantity,
       COALESCE(SUM(sm.quantity_delta), 0) - COALESCE((SELECT SUM(sr.quantity - sr.released_quantity) FROM stock_reservations sr WHERE sr.item_id = i.id AND sr.status = 'active'), 0) AS available_quantity
FROM items i
LEFT JOIN stock_movements sm ON sm.item_id = i.id
GROUP BY i.id;
-- statement-breakpoint
INSERT INTO roles (code, label) VALUES
  ('patron', 'Patron'), ('bras_droit', 'Bras droit'), ('vendeur', 'Vendeur'), ('lecture', 'Lecture seule');
-- statement-breakpoint
INSERT INTO permissions (code, description) VALUES
  ('dashboard:read','Voir le tableau de bord'),
  ('groups:read','Voir les groupes'),('groups:write','Gérer les groupes'),('groups:override_block','Forcer une commande bloquée'),
  ('contacts:read','Voir les contacts'),('contacts:write','Gérer les contacts'),('contacts:private_notes','Voir les notes privées'),
  ('catalog:read','Voir le catalogue'),('catalog:write','Gérer le catalogue et les prix'),
  ('orders:read','Voir les commandes'),('orders:write','Créer et modifier les commandes'),('orders:deliver','Livrer les commandes'),('orders:cancel','Annuler les commandes'),
  ('stocks:read','Voir les stocks'),('stocks:write','Créer des mouvements de stock'),
  ('payments:read','Voir les paiements'),('payments:write','Enregistrer les paiements'),('payments:reverse','Annuler un paiement'),
  ('expenses:read','Voir les dépenses'),('expenses:write','Gérer les dépenses'),
  ('users:read','Voir les utilisateurs'),('users:write','Gérer les utilisateurs'),
  ('audit:read','Voir le journal'),('settings:read','Voir les paramètres'),('settings:write','Gérer les paramètres');
-- statement-breakpoint
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'patron';
-- statement-breakpoint
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'dashboard:read','groups:read','groups:write','groups:override_block','contacts:read','contacts:write','contacts:private_notes',
  'catalog:read','catalog:write','orders:read','orders:write','orders:deliver','orders:cancel','stocks:read','stocks:write',
  'payments:read','payments:write','expenses:read','expenses:write','settings:read'
) WHERE r.code = 'bras_droit';
-- statement-breakpoint
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'dashboard:read','groups:read','contacts:read','catalog:read','orders:read','orders:write','stocks:read','payments:read','payments:write'
) WHERE r.code = 'vendeur';
-- statement-breakpoint
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'dashboard:read','groups:read','contacts:read','catalog:read','orders:read','stocks:read','payments:read','expenses:read'
) WHERE r.code = 'lecture';
-- statement-breakpoint
INSERT INTO item_categories (name) VALUES ('Armes'),('Munitions'),('Produits illicites fictifs'),('Matériaux'),('Équipements'),('Autres marchandises');
-- statement-breakpoint
INSERT INTO expense_categories (name) VALUES ('Achat de stock'),('Logistique'),('Personnel'),('Protection'),('Autre');
