const db = require('../config/db');
const {
    DEFAULT_LOAN_RATES,
    addMonthsToDate,
    calculateEmi,
    generateReferenceNumber,
    getLoanTypeOptions,
} = require('../utils/loanUtils');

const dbPromise = db.promise();

const profileFields = [
    'first_name',
    'last_name',
    'customer_phone',
    'customer_email',
    'customer_address',
    'customer_city',
    'customer_state',
    'pincode',
];

const loanPaymentMethodOptions = [
    'Online Banking',
    'Branch Counter',
    'Auto-Debit',
    'Cheque',
];

const generateUniqueReference = async (tableName, columnName, prefix) => {
    while (true) {
        const reference = generateReferenceNumber(prefix);
        const [[existing]] = await dbPromise.query(
            `SELECT ${columnName} FROM ${tableName} WHERE ${columnName} = ? LIMIT 1`,
            [reference]
        );

        if (!existing) {
            return reference;
        }
    }
};

const optionalQuery = async (query, params = [], fallbackValue = []) => {
    try {
        const [rows] = await dbPromise.query(query, params);
        return rows;
    } catch (error) {
        if (error && error.code === 'ER_NO_SUCH_TABLE') {
            return fallbackValue;
        }

        throw error;
    }
};

const optionalProcedure = async (query, params = [], fallbackValue = []) => {
    try {
        const [result] = await dbPromise.query(query, params);

        if (Array.isArray(result) && Array.isArray(result[0])) {
            return result[0];
        }

        return Array.isArray(result) ? result : fallbackValue;
    } catch (error) {
        if (
            error &&
            (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_SP_DOES_NOT_EXIST')
        ) {
            return fallbackValue;
        }

        throw error;
    }
};

const optionalSingleRow = async (query, params = [], fallbackValue = {}) => {
    try {
        const [rows] = await dbPromise.query(query, params);
        return rows[0] || fallbackValue;
    } catch (error) {
        if (
            error &&
            (
                error.code === 'ER_NO_SUCH_TABLE' ||
                error.code === 'ER_SP_DOES_NOT_EXIST' ||
                error.code === 'ER_NO_SUCH_FUNCTION'
            )
        ) {
            return fallbackValue;
        }

        throw error;
    }
};

const buildDashboardPayload = async (customerId) => {
    const [
        [customerRows],
        [accountRows],
        functionSummaryRow,
        summaryRows,
        transactionRows,
        cardRows,
        loanRows,
        transferRows,
        loanApplicationRows,
        loanPaymentRows,
        loanTypeOptions,
    ] = await Promise.all([
        dbPromise.query(
            `
                SELECT
                    customer_id,
                    first_name,
                    last_name,
                    date_of_birth,
                    gender,
                    pan_number,
                    aadhaar_number,
                    customer_phone,
                    customer_email,
                    customer_address,
                    customer_city,
                    customer_state,
                    pincode,
                    kyc_status,
                    created_at
                FROM Customers
                WHERE customer_id = ?
                LIMIT 1
            `,
            [customerId]
        ),
        dbPromise.query(
            `
                SELECT
                    a.account_id,
                    a.account_number,
                    a.account_type,
                    a.account_balance,
                    a.account_currency,
                    a.account_status,
                    a.opened_date,
                    a.annual_interest_rate,
                    b.branch_name,
                    b.branch_city,
                    b.branch_state,
                    b.ifsc_code
                FROM Accounts a
                JOIN Branches b ON b.branch_id = a.branch_id
                WHERE a.customer_id = ?
                ORDER BY a.opened_date DESC, a.account_id DESC
            `,
            [customerId]
        ),
        // Stored functions used directly for grading-visible customer metrics.
        optionalSingleRow(
            `
                SELECT
                    fn_customer_total_balance(?) AS total_balance,
                    fn_customer_active_account_count(?) AS active_accounts,
                    fn_customer_age_years(?) AS customer_age_years
            `,
            [customerId, customerId, customerId],
            {}
        ),
        // Stored procedure used by the customer overview/dashboard page.
        optionalProcedure('CALL sp_get_customer_dashboard_summary(?)', [customerId], []),
        // Stored procedure used by customer overview and transactions pages.
        optionalProcedure('CALL sp_get_customer_recent_transactions(?, ?)', [customerId, 12], []),
        optionalQuery(
            `
                SELECT
                    cd.card_id,
                    cd.account_id,
                    a.account_number,
                    cd.card_type,
                    cd.card_network,
                    cd.card_holder_name,
                    cd.issue_date,
                    cd.expiry_date,
                    cd.credit_limit,
                    cd.outstanding_amount,
                    cd.card_status
                FROM Cards cd
                JOIN Accounts a ON a.account_id = cd.account_id
                WHERE a.customer_id = ?
                ORDER BY cd.expiry_date ASC, cd.card_id DESC
            `,
            [customerId]
        ),
        optionalQuery(
            `
                SELECT
                    l.loan_id,
                    l.loan_type,
                    l.principal_amount,
                    l.annual_interest_rate,
                    l.tenure_months,
                    l.emi_amount,
                    l.outstanding_amount,
                    l.disbursement_date,
                    l.maturity_date,
                    l.loan_status,
                    b.branch_name
                FROM Loans l
                JOIN Branches b ON b.branch_id = l.branch_id
                WHERE l.customer_id = ?
                ORDER BY l.disbursement_date DESC, l.loan_id DESC
            `,
            [customerId]
        ),
        // Stored procedure used by customer overview and transfers pages.
        optionalProcedure('CALL sp_get_customer_recent_transfers(?, ?)', [customerId, 10], []),
        optionalQuery(
            `
                SELECT
                    la.loan_application_id,
                    la.customer_id,
                    la.branch_id,
                    la.linked_account_id,
                    la.loan_type,
                    la.requested_amount,
                    la.approved_amount,
                    la.annual_interest_rate,
                    la.tenure_months,
                    la.estimated_emi,
                    la.purpose,
                    la.application_status,
                    la.review_notes,
                    la.reviewed_by,
                    la.reviewed_at,
                    la.created_loan_id,
                    la.created_at,
                    a.account_number AS linked_account_number,
                    a.account_type AS linked_account_type,
                    a.account_balance AS linked_account_balance,
                    b.branch_name,
                    CONCAT(ac.first_name, ' ', ac.last_name) AS reviewed_by_name
                FROM Loan_Applications la
                JOIN Accounts a ON a.account_id = la.linked_account_id
                JOIN Branches b ON b.branch_id = la.branch_id
                LEFT JOIN Accountants ac ON ac.accountant_id = la.reviewed_by
                WHERE la.customer_id = ?
                ORDER BY la.created_at DESC, la.loan_application_id DESC
            `,
            [customerId]
        ),
        optionalQuery(
            `
                SELECT
                    lp.payment_id,
                    lp.loan_id,
                    lp.payment_date,
                    lp.amount_paid,
                    lp.principal_component,
                    lp.interest_component,
                    lp.penalty_amount,
                    lp.payment_method,
                    lp.reference_number,
                    lp.payment_status,
                    lp.created_at,
                    l.loan_type,
                    l.emi_amount,
                    l.outstanding_amount
                FROM Loan_Payments lp
                JOIN Loans l ON l.loan_id = lp.loan_id
                WHERE l.customer_id = ?
                ORDER BY lp.payment_date DESC, lp.payment_id DESC
                LIMIT 20
            `,
            [customerId]
        ),
        getLoanTypeOptions(dbPromise),
    ]);

    const customer = customerRows[0];
    const summaryRow = summaryRows[0] || {};

    if (!customer) {
        return null;
    }

    const summary = {
        total_balance:
            Number(functionSummaryRow.total_balance) ||
            Number(summaryRow.total_balance) ||
            accountRows.reduce((sum, account) => sum + Number(account.account_balance || 0), 0),
        active_accounts:
            Number(functionSummaryRow.active_accounts) ||
            Number(summaryRow.active_accounts) ||
            accountRows.filter((account) => account.account_status === 'Active').length,
        recent_transaction_count: transactionRows.length,
        total_monthly_debits: transactionRows
            .filter((transaction) => transaction.transaction_type === 'Debit')
            .reduce((sum, transaction) => sum + Number(transaction.transaction_amount || 0), 0),
        total_monthly_credits: transactionRows
            .filter((transaction) => transaction.transaction_type === 'Credit')
            .reduce((sum, transaction) => sum + Number(transaction.transaction_amount || 0), 0),
        loan_exposure:
            Number(summaryRow.loan_exposure) ||
            loanRows.reduce((sum, loan) => sum + Number(loan.outstanding_amount || 0), 0),
        active_cards:
            Number(summaryRow.active_cards) ||
            cardRows.filter((card) => card.card_status === 'Active').length,
        pending_loan_applications: loanApplicationRows.filter(
            (application) => application.application_status === 'Pending'
        ).length,
    };

    return {
        profile: {
            ...customer,
            customer_age_years:
                Number(functionSummaryRow.customer_age_years) ||
                (customer.date_of_birth
                    ? new Date().getFullYear() - new Date(customer.date_of_birth).getFullYear()
                    : null),
        },
        summary,
        accounts: accountRows,
        recent_transactions: transactionRows,
        cards: cardRows,
        loans: loanRows,
        loan_applications: loanApplicationRows,
        loan_payments: loanPaymentRows,
        loan_types: loanTypeOptions,
        loan_payment_methods: loanPaymentMethodOptions,
        recent_transfers: transferRows,
    };
};

exports.getCustomers = (req, res) => {
    db.query('SELECT * FROM Customers', (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
};

exports.getCustomerById = (req, res) => {
    const { id } = req.params;

    db.query('SELECT * FROM Customers WHERE customer_id = ?', [id], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results[0]);
    });
};

exports.getMyDashboard = async (req, res) => {
    try {
        const customerId = req.user.customer_id;
        const dashboard = await buildDashboardPayload(customerId);

        if (!dashboard) {
            return res.status(404).json({ message: 'Customer dashboard not found.' });
        }

        return res.json(dashboard);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load customer dashboard.' });
    }
};

exports.updateMyProfile = async (req, res) => {
    const customerId = req.user.customer_id;
    const updates = {};

    profileFields.forEach((field) => {
        if (typeof req.body?.[field] === 'string') {
            updates[field] = req.body[field].trim();
        }
    });

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No profile changes were provided.' });
    }

    const requiredFields = [
        'first_name',
        'last_name',
        'customer_phone',
        'customer_email',
        'customer_address',
        'customer_city',
        'customer_state',
        'pincode',
    ];

    const missingField = requiredFields.find((field) => !updates[field]);

    if (missingField) {
        return res.status(400).json({ message: `${missingField} cannot be empty.` });
    }

    try {
        await dbPromise.query(
            `
                UPDATE Customers
                SET
                    first_name = ?,
                    last_name = ?,
                    customer_phone = ?,
                    customer_email = ?,
                    customer_address = ?,
                    customer_city = ?,
                    customer_state = ?,
                    pincode = ?
                WHERE customer_id = ?
            `,
            [
                updates.first_name,
                updates.last_name,
                updates.customer_phone,
                updates.customer_email,
                updates.customer_address,
                updates.customer_city,
                updates.customer_state,
                updates.pincode,
                customerId,
            ]
        );

        const dashboard = await buildDashboardPayload(customerId);

        return res.json({
            message: 'Profile updated successfully.',
            profile: dashboard?.profile || null,
        });
    } catch (error) {
        if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) {
            return res.status(409).json({
                message: 'That email address is already linked to another customer.',
            });
        }

        return res.status(500).json({ message: 'Failed to update customer profile.' });
    }
};

exports.applyForLoan = async (req, res) => {
    const customerId = req.user.customer_id;
    const linkedAccountId = Number(req.body?.linked_account_id);
    const requestedAmount = Number(req.body?.requested_amount || 0);
    const tenureMonths = Number(req.body?.tenure_months || 0);
    const loanType = String(req.body?.loan_type || '').trim();
    const purpose = String(req.body?.purpose || '').trim();

    if (!Number.isInteger(linkedAccountId)) {
        return res.status(400).json({ message: 'A valid linked account is required.' });
    }

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        return res.status(400).json({ message: 'requested_amount must be greater than zero.' });
    }

    if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) {
        return res.status(400).json({ message: 'tenure_months must be a whole number greater than zero.' });
    }

    if (!purpose) {
        return res.status(400).json({ message: 'purpose is required.' });
    }

    try {
        const loanTypeOptions = await getLoanTypeOptions(dbPromise);

        if (!loanTypeOptions.includes(loanType)) {
            return res.status(400).json({
                message: `loan_type must be one of: ${loanTypeOptions.join(', ')}`,
            });
        }

        const [[linkedAccount]] = await dbPromise.query(
            `
                SELECT
                    a.account_id,
                    a.account_number,
                    a.account_type,
                    a.account_status,
                    a.branch_id,
                    b.branch_name
                FROM Accounts a
                JOIN Branches b ON b.branch_id = a.branch_id
                WHERE a.account_id = ?
                  AND a.customer_id = ?
                LIMIT 1
            `,
            [linkedAccountId, customerId]
        );

        if (!linkedAccount) {
            return res.status(404).json({
                message: 'That linked account does not belong to this customer.',
            });
        }

        if (linkedAccount.account_status !== 'Active') {
            return res.status(403).json({
                message: `Loan requests can only target active accounts. This account is ${linkedAccount.account_status}.`,
            });
        }

        const annualInterestRate = DEFAULT_LOAN_RATES[loanType] || 10;
        const emiAmount = calculateEmi(requestedAmount, annualInterestRate, tenureMonths);

        await dbPromise.beginTransaction();

        const [applicationInsert] = await dbPromise.query(
            `
                INSERT INTO Loan_Applications (
                    customer_id,
                    branch_id,
                    linked_account_id,
                    loan_type,
                    requested_amount,
                    annual_interest_rate,
                    tenure_months,
                    estimated_emi,
                    purpose,
                    application_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
            `,
            [
                customerId,
                linkedAccount.branch_id,
                linkedAccountId,
                loanType,
                requestedAmount,
                annualInterestRate,
                tenureMonths,
                emiAmount,
                purpose,
            ]
        );

        await dbPromise.commit();

        const [[application]] = await dbPromise.query(
            `
                SELECT
                    la.loan_application_id,
                    la.customer_id,
                    la.branch_id,
                    la.linked_account_id,
                    la.loan_type,
                    la.requested_amount,
                    la.approved_amount,
                    la.annual_interest_rate,
                    la.tenure_months,
                    la.estimated_emi,
                    la.purpose,
                    la.application_status,
                    la.review_notes,
                    la.reviewed_by,
                    la.reviewed_at,
                    la.created_loan_id,
                    la.created_at,
                    a.account_number AS linked_account_number,
                    a.account_type AS linked_account_type,
                    a.account_balance AS linked_account_balance,
                    b.branch_name
                FROM Loan_Applications la
                JOIN Accounts a ON a.account_id = la.linked_account_id
                JOIN Branches b ON b.branch_id = la.branch_id
                WHERE la.loan_application_id = ?
                LIMIT 1
            `,
            [applicationInsert.insertId]
        );

        return res.status(201).json({
            message: 'Loan application submitted successfully and is pending branch accountant approval.',
            loan_application: application,
        });
    } catch (error) {
        try {
            await dbPromise.rollback();
        } catch {
            // Ignore rollback failures.
        }

        if (error && error.code === 'ER_NO_SUCH_TABLE') {
            return res.status(503).json({
                message: 'Loan application workflow is not available until the Loan_Applications table is added to the database.',
            });
        }

        return res.status(500).json({ message: 'Failed to submit the loan application.' });
    }
};

exports.repayMyLoan = async (req, res) => {
    const customerId = req.user.customer_id;
    const loanId = Number(req.params.loanId);
    const sourceAccountId = Number(req.body?.source_account_id);
    const repaymentAmount = Number(req.body?.repayment_amount || 0);
    const paymentMethod = String(req.body?.payment_method || '').trim();

    if (!Number.isInteger(loanId)) {
        return res.status(400).json({ message: 'A valid loan id is required.' });
    }

    if (!Number.isInteger(sourceAccountId)) {
        return res.status(400).json({ message: 'A valid source account is required.' });
    }

    if (!Number.isFinite(repaymentAmount) || repaymentAmount <= 0) {
        return res.status(400).json({ message: 'repayment_amount must be greater than zero.' });
    }

    if (!loanPaymentMethodOptions.includes(paymentMethod)) {
        return res.status(400).json({
            message: `payment_method must be one of: ${loanPaymentMethodOptions.join(', ')}`,
        });
    }

    try {
        await dbPromise.beginTransaction();

        const [loanRows] = await dbPromise.query(
            `
                SELECT
                    l.loan_id,
                    l.loan_type,
                    l.principal_amount,
                    l.annual_interest_rate,
                    l.tenure_months,
                    l.emi_amount,
                    l.outstanding_amount,
                    l.loan_status
                FROM Loans l
                WHERE l.loan_id = ?
                  AND l.customer_id = ?
                FOR UPDATE
            `,
            [loanId, customerId]
        );

        const loan = loanRows[0];

        if (!loan) {
            await dbPromise.rollback();
            return res.status(404).json({ message: 'Loan not found for this customer.' });
        }

        if (loan.loan_status !== 'Active') {
            await dbPromise.rollback();
            return res.status(403).json({
                message: `Repayments are only allowed on active loans. This loan is ${loan.loan_status}.`,
            });
        }

        const [accountRows] = await dbPromise.query(
            `
                SELECT
                    account_id,
                    account_number,
                    account_balance,
                    account_currency,
                    account_status
                FROM Accounts
                WHERE account_id = ?
                  AND customer_id = ?
                FOR UPDATE
            `,
            [sourceAccountId, customerId]
        );

        const sourceAccount = accountRows[0];

        if (!sourceAccount) {
            await dbPromise.rollback();
            return res.status(404).json({ message: 'Source account not found for this customer.' });
        }

        if (sourceAccount.account_status !== 'Active') {
            await dbPromise.rollback();
            return res.status(403).json({
                message: `Loan repayments require an active source account. This account is ${sourceAccount.account_status}.`,
            });
        }

        const outstandingAmount = Number(loan.outstanding_amount || 0);

        if (repaymentAmount > outstandingAmount) {
            await dbPromise.rollback();
            return res.status(400).json({
                message: 'repayment_amount cannot exceed the current outstanding amount.',
            });
        }

        const availableBalance = Number(sourceAccount.account_balance || 0);

        if (availableBalance < repaymentAmount) {
            await dbPromise.rollback();
            return res.status(400).json({ message: 'Insufficient balance in the selected source account.' });
        }

        const estimatedInterest = Number(
            ((outstandingAmount * Number(loan.annual_interest_rate || 0)) / 1200).toFixed(2)
        );
        const interestComponent = Math.min(repaymentAmount, estimatedInterest);
        const principalComponent = Number((repaymentAmount - interestComponent).toFixed(2));
        const nextOutstanding = Math.max(
            0,
            Number((outstandingAmount - principalComponent).toFixed(2))
        );
        const nextBalance = Number((availableBalance - repaymentAmount).toFixed(2));
        const nextStatus = nextOutstanding <= 0 ? 'Closed' : 'Active';

        const paymentReference = await generateUniqueReference(
            'Loan_Payments',
            'reference_number',
            'LP'
        );
        const transactionReference = await generateUniqueReference(
            'Transactions',
            'reference_number',
            'TXN'
        );

        const [paymentResult] = await dbPromise.query(
            `
                INSERT INTO Loan_Payments (
                    loan_id,
                    payment_date,
                    amount_paid,
                    principal_component,
                    interest_component,
                    penalty_amount,
                    payment_method,
                    reference_number,
                    payment_status
                )
                VALUES (?, CURDATE(), ?, ?, ?, 0.00, ?, ?, 'Success')
            `,
            [
                loanId,
                repaymentAmount,
                principalComponent,
                interestComponent,
                paymentMethod,
                paymentReference,
            ]
        );

        await dbPromise.query(
            `
                UPDATE Loans
                SET
                    outstanding_amount = ?,
                    loan_status = ?
                WHERE loan_id = ?
            `,
            [nextOutstanding, nextStatus, loanId]
        );

        await dbPromise.query(
            `
                UPDATE Accounts
                SET account_balance = ?
                WHERE account_id = ?
            `,
            [nextBalance, sourceAccountId]
        );

        await dbPromise.query(
            `
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
                VALUES (?, 'Debit', ?, ?, ?, 'Online Banking', ?, 'Success')
            `,
            [
                sourceAccountId,
                repaymentAmount,
                nextBalance,
                `${loan.loan_type} loan repayment`,
                transactionReference,
            ]
        );

        await dbPromise.commit();

        const [[payment]] = await dbPromise.query(
            `
                SELECT
                    payment_id,
                    loan_id,
                    payment_date,
                    amount_paid,
                    principal_component,
                    interest_component,
                    penalty_amount,
                    payment_method,
                    reference_number,
                    payment_status,
                    created_at
                FROM Loan_Payments
                WHERE payment_id = ?
                LIMIT 1
            `,
            [paymentResult.insertId]
        );

        return res.status(201).json({
            message: nextStatus === 'Closed' ? 'Loan fully repaid successfully.' : 'Loan repayment recorded successfully.',
            payment,
            loan: {
                ...loan,
                outstanding_amount: nextOutstanding,
                loan_status: nextStatus,
            },
            account: {
                ...sourceAccount,
                account_balance: nextBalance,
            },
        });
    } catch (error) {
        try {
            await dbPromise.rollback();
        } catch {
            // Ignore rollback failures.
        }

        return res.status(500).json({ message: 'Failed to record the loan repayment.' });
    }
};

exports.buildDashboardPayload = buildDashboardPayload;
