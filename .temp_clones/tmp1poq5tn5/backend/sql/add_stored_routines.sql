USE financial_system;

-- Safe migration: adds or replaces only stored functions and procedures.
-- No tables, data, or existing application rows are dropped.

DROP PROCEDURE IF EXISTS sp_get_open_fraud_cases;
DROP PROCEDURE IF EXISTS sp_get_branch_dashboard_summary;
DROP PROCEDURE IF EXISTS sp_transfer_money;
DROP PROCEDURE IF EXISTS sp_get_customer_recent_transfers;
DROP PROCEDURE IF EXISTS sp_get_customer_recent_transactions;
DROP PROCEDURE IF EXISTS sp_get_customer_dashboard_summary;

DROP FUNCTION IF EXISTS fn_branch_customer_count;
DROP FUNCTION IF EXISTS fn_customer_age_years;
DROP FUNCTION IF EXISTS fn_customer_active_account_count;
DROP FUNCTION IF EXISTS fn_customer_total_balance;

DELIMITER $$

CREATE FUNCTION fn_customer_total_balance(p_customer_id INT)
RETURNS DECIMAL(15,2)
READS SQL DATA
BEGIN
    DECLARE total_balance DECIMAL(15,2) DEFAULT 0.00;

    SELECT COALESCE(SUM(a.account_balance), 0.00)
      INTO total_balance
      FROM Accounts a
     WHERE a.customer_id = p_customer_id
       AND a.account_status IN ('Active', 'Inactive', 'Frozen');

    RETURN total_balance;
END$$

CREATE FUNCTION fn_customer_active_account_count(p_customer_id INT)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE active_accounts INT DEFAULT 0;

    SELECT COUNT(*)
      INTO active_accounts
      FROM Accounts a
     WHERE a.customer_id = p_customer_id
       AND a.account_status = 'Active';

    RETURN active_accounts;
END$$

CREATE FUNCTION fn_customer_age_years(p_customer_id INT)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE age_years INT DEFAULT NULL;

    SELECT TIMESTAMPDIFF(YEAR, c.date_of_birth, CURDATE())
      INTO age_years
      FROM Customers c
     WHERE c.customer_id = p_customer_id
     LIMIT 1;

    RETURN age_years;
END$$

CREATE FUNCTION fn_branch_customer_count(p_branch_id INT)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE customer_count INT DEFAULT 0;

    SELECT COUNT(DISTINCT a.customer_id)
      INTO customer_count
      FROM Accounts a
     WHERE a.branch_id = p_branch_id;

    RETURN customer_count;
END$$

CREATE PROCEDURE sp_get_customer_dashboard_summary(IN p_customer_id INT)
BEGIN
    SELECT
        c.customer_id,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        c.customer_email,
        fn_customer_age_years(c.customer_id) AS customer_age_years,
        fn_customer_total_balance(c.customer_id) AS total_balance,
        fn_customer_active_account_count(c.customer_id) AS active_accounts,
        (
            SELECT COUNT(*)
            FROM Cards cd
            JOIN Accounts a ON a.account_id = cd.account_id
            WHERE a.customer_id = c.customer_id
              AND cd.card_status = 'Active'
        ) AS active_cards,
        (
            SELECT COALESCE(SUM(l.outstanding_amount), 0.00)
            FROM Loans l
            WHERE l.customer_id = c.customer_id
              AND l.loan_status = 'Active'
        ) AS loan_exposure,
        (
            SELECT COUNT(*)
            FROM Transactions t
            JOIN Accounts a ON a.account_id = t.account_id
            WHERE a.customer_id = c.customer_id
        ) AS lifetime_transaction_count
    FROM Customers c
    WHERE c.customer_id = p_customer_id
    LIMIT 1;
END$$

CREATE PROCEDURE sp_get_customer_recent_transactions(IN p_customer_id INT, IN p_limit INT)
BEGIN
    DECLARE effective_limit INT DEFAULT 10;

    SET effective_limit = IFNULL(NULLIF(p_limit, 0), 10);

    SELECT
        t.transaction_id,
        a.account_number,
        a.account_type,
        t.transaction_type,
        t.transaction_amount,
        t.balance_after_txn,
        t.transaction_desc,
        t.transaction_channel,
        t.reference_number,
        t.transaction_status,
        t.transaction_date
    FROM Transactions t
    JOIN Accounts a ON a.account_id = t.account_id
    WHERE a.customer_id = p_customer_id
    ORDER BY t.transaction_date DESC, t.transaction_id DESC
    LIMIT effective_limit;
END$$

CREATE PROCEDURE sp_get_customer_recent_transfers(IN p_customer_id INT, IN p_limit INT)
BEGIN
    DECLARE effective_limit INT DEFAULT 10;

    SET effective_limit = IFNULL(NULLIF(p_limit, 0), 10);

    SELECT
        tr.transfer_id,
        CASE
            WHEN sender.customer_id = p_customer_id THEN 'Outgoing'
            WHEN receiver.customer_id = p_customer_id THEN 'Incoming'
            ELSE 'Related'
        END AS transfer_direction,
        sender.account_number AS sender_account_number,
        receiver.account_number AS receiver_account_number,
        tr.transfer_amount,
        tr.transfer_mode,
        tr.reference_number,
        tr.transfer_remarks,
        tr.transfer_status,
        tr.initiated_at,
        tr.completed_at
    FROM Transfers tr
    JOIN Accounts sender ON sender.account_id = tr.sender_account_id
    JOIN Accounts receiver ON receiver.account_id = tr.receiver_account_id
    WHERE sender.customer_id = p_customer_id
       OR receiver.customer_id = p_customer_id
    ORDER BY tr.initiated_at DESC, tr.transfer_id DESC
    LIMIT effective_limit;
END$$

CREATE PROCEDURE sp_transfer_money(
    IN p_sender_account_id INT,
    IN p_receiver_account_id INT,
    IN p_transfer_amount DECIMAL(15,2),
    IN p_transfer_mode VARCHAR(20),
    IN p_transfer_remarks VARCHAR(255),
    OUT p_transfer_id INT,
    OUT p_transfer_reference VARCHAR(30),
    OUT p_debit_transaction_reference VARCHAR(30),
    OUT p_credit_transaction_reference VARCHAR(30)
)
BEGIN
    DECLARE sender_balance DECIMAL(15,2) DEFAULT 0.00;
    DECLARE receiver_balance DECIMAL(15,2) DEFAULT 0.00;
    DECLARE sender_account_number VARCHAR(20);
    DECLARE receiver_account_number VARCHAR(20);
    DECLARE sender_status VARCHAR(20);
    DECLARE receiver_status VARCHAR(20);
    DECLARE sender_next_balance DECIMAL(15,2) DEFAULT 0.00;
    DECLARE receiver_next_balance DECIMAL(15,2) DEFAULT 0.00;
    DECLARE debit_reference VARCHAR(30);
    DECLARE credit_reference VARCHAR(30);

    IF p_sender_account_id IS NULL OR p_receiver_account_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Sender and receiver account ids are required.';
    END IF;

    IF p_sender_account_id = p_receiver_account_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Sender and receiver accounts must be different.';
    END IF;

    IF p_transfer_amount IS NULL OR p_transfer_amount <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Transfer amount must be greater than zero.';
    END IF;

    SELECT account_balance, account_number, account_status
      INTO sender_balance, sender_account_number, sender_status
      FROM Accounts
     WHERE account_id = p_sender_account_id
     FOR UPDATE;

    SELECT account_balance, account_number, account_status
      INTO receiver_balance, receiver_account_number, receiver_status
      FROM Accounts
     WHERE account_id = p_receiver_account_id
     FOR UPDATE;

    IF sender_account_number IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Sender account not found.';
    END IF;

    IF receiver_account_number IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Receiver account not found.';
    END IF;

    IF sender_status <> 'Active' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Sender account is not active.';
    END IF;

    IF receiver_status <> 'Active' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Receiver account is not active.';
    END IF;

    IF sender_balance < p_transfer_amount THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Insufficient balance for transfer.';
    END IF;

    SET sender_next_balance = sender_balance - p_transfer_amount;
    SET receiver_next_balance = receiver_balance + p_transfer_amount;
    SET p_transfer_reference = CONCAT(
        'TRF',
        DATE_FORMAT(NOW(), '%y%m%d%H%i%s'),
        LPAD(MOD(UUID_SHORT(), 1000000), 6, '0')
    );

    INSERT INTO Transfers (
        sender_account_id,
        receiver_account_id,
        transfer_amount,
        transfer_mode,
        reference_number,
        transfer_remarks,
        transfer_status,
        completed_at
    )
    VALUES (
        p_sender_account_id,
        p_receiver_account_id,
        p_transfer_amount,
        COALESCE(NULLIF(p_transfer_mode, ''), 'Internal'),
        p_transfer_reference,
        NULLIF(p_transfer_remarks, ''),
        'Success',
        NOW()
    );

    SET p_transfer_id = LAST_INSERT_ID();

    UPDATE Accounts
       SET account_balance = sender_next_balance
     WHERE account_id = p_sender_account_id;

    UPDATE Accounts
       SET account_balance = receiver_next_balance
     WHERE account_id = p_receiver_account_id;

    SET debit_reference = CONCAT(
        'TXN',
        DATE_FORMAT(NOW(), '%y%m%d%H%i%s'),
        LPAD(MOD(UUID_SHORT(), 1000000), 6, '0')
    );
    SET credit_reference = CONCAT(
        'TXN',
        DATE_FORMAT(NOW(), '%y%m%d%H%i%s'),
        LPAD(MOD(UUID_SHORT(), 1000000), 6, '0')
    );

    INSERT INTO Transactions (
        account_id,
        transaction_type,
        transaction_amount,
        balance_after_txn,
        transaction_desc,
        transaction_channel,
        reference_number,
        transaction_status
    )
    VALUES (
        p_sender_account_id,
        'Debit',
        p_transfer_amount,
        sender_next_balance,
        CONCAT('Transfer to ', receiver_account_number, ': ', COALESCE(NULLIF(p_transfer_remarks, ''), 'Fund transfer')),
        'Online Banking',
        debit_reference,
        'Success'
    );

    INSERT INTO Transactions (
        account_id,
        transaction_type,
        transaction_amount,
        balance_after_txn,
        transaction_desc,
        transaction_channel,
        reference_number,
        transaction_status
    )
    VALUES (
        p_receiver_account_id,
        'Credit',
        p_transfer_amount,
        receiver_next_balance,
        CONCAT('Transfer from ', sender_account_number, ': ', COALESCE(NULLIF(p_transfer_remarks, ''), 'Fund transfer')),
        'Online Banking',
        credit_reference,
        'Success'
    );

    SET p_debit_transaction_reference = debit_reference;
    SET p_credit_transaction_reference = credit_reference;
END$$

CREATE PROCEDURE sp_get_branch_dashboard_summary(IN p_branch_id INT)
BEGIN
    SELECT
        b.branch_id,
        b.branch_name,
        b.branch_city,
        b.branch_state,
        fn_branch_customer_count(b.branch_id) AS branch_customer_count,
        (
            SELECT COUNT(*)
            FROM Accounts a
            WHERE a.branch_id = b.branch_id
        ) AS branch_account_count,
        (
            SELECT COALESCE(SUM(a.account_balance), 0.00)
            FROM Accounts a
            WHERE a.branch_id = b.branch_id
              AND a.account_status IN ('Active', 'Inactive', 'Frozen')
        ) AS managed_deposit_balance,
        (
            SELECT COUNT(*)
            FROM Loans l
            WHERE l.branch_id = b.branch_id
              AND l.loan_status = 'Active'
        ) AS active_loans,
        (
            SELECT COALESCE(SUM(l.outstanding_amount), 0.00)
            FROM Loans l
            WHERE l.branch_id = b.branch_id
              AND l.loan_status = 'Active'
        ) AS active_loan_exposure
    FROM Branches b
    WHERE b.branch_id = p_branch_id
    LIMIT 1;
END$$

CREATE PROCEDURE sp_get_open_fraud_cases(IN p_min_risk_score INT)
BEGIN
    SELECT
        fl.fraud_log_id,
        fl.fraud_category,
        fl.risk_score,
        fl.fraud_severity,
        fl.action_taken,
        fl.detected_at,
        a.account_number,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name
    FROM Fraud_Logs fl
    JOIN Accounts a ON a.account_id = fl.account_id
    JOIN Customers c ON c.customer_id = a.customer_id
    WHERE fl.resolved_at IS NULL
      AND fl.risk_score >= IFNULL(p_min_risk_score, 0)
    ORDER BY fl.risk_score DESC, fl.detected_at DESC;
END$$

DELIMITER ;

SELECT
    ROUTINE_TYPE,
    ROUTINE_NAME
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = DATABASE()
ORDER BY ROUTINE_TYPE, ROUTINE_NAME;
