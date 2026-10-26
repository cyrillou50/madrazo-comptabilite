-- Les écritures de stock, caisse et audit sont compensées, jamais modifiées ni supprimées.
CREATE TRIGGER stock_movements_no_update BEFORE UPDATE ON stock_movements
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un mouvement de stock est immuable';
-- statement-breakpoint
CREATE TRIGGER stock_movements_no_delete BEFORE DELETE ON stock_movements
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un mouvement de stock est immuable';
-- statement-breakpoint
CREATE TRIGGER cash_movements_no_update BEFORE UPDATE ON cash_movements
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un mouvement de caisse est immuable';
-- statement-breakpoint
CREATE TRIGGER cash_movements_no_delete BEFORE DELETE ON cash_movements
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un mouvement de caisse est immuable';
-- statement-breakpoint
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Le journal audit est immuable';
-- statement-breakpoint
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Le journal audit est immuable';
