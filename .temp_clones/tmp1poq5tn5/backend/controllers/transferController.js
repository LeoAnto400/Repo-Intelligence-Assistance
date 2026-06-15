const db = require('../config/db');

const dbPromise = db.promise();

const TRANSFER_MODE = 'Internal';
const MAX_SELF_SERVICE_TRANSFER_AMOUNT = 50000;

const validateTransferInput = ({
    senderAccountId,
    destinationAccountNumber,
    transferRemarks,
    password,
    transferAmount,
}) => {
    if (!Number.isInteger(senderAccountId)) {
        return 'A valid sender_account_id is required.';
    }

    if (!destinationAccountNumber) {
        return 'destination_account_number is required.';
    }

    if (!transferRemarks) {
        return 'transfer_remarks is required.';
    }

    if (!password) {
        return 'Password confirmation is required.';
    }

    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
        return 'transfer_amount must be a valid number greater than zero.';
    }

    if (transferAmount > MAX_SELF_SERVICE_TRANSFER_AMOUNT) {
        return `Transfers above INR ${MAX_SELF_SERVICE_TRANSFER_AMOUNT.toLocaleString('en-IN')} are blocked in one go. Please contact your branch.`;
    }

    return null;
};

const loadTransferContext = async ({
    connection,
    customerId,
    senderAccountId,
    destinationAccountNumber,
    password,
}) => {
    const [loginRows] = await connection.query(
        `
            SELECT customer_login_id
            FROM Customer_Login
            WHERE customer_id = ?
              AND password_hash = SHA2(?, 256)
              AND is_active = 1
            LIMIT 1
        `,
        [customerId, password]
    );

    if (!loginRows[0]) {
        return { status: 401, message: 'Password verification failed.' };
    }

    const [senderRows] = await connection.query(
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
            LIMIT 1
        `,
        [senderAccountId, customerId]
    );

    const senderAccount = senderRows[0];

    if (!senderAccount) {
        return {
            status: 404,
            message: 'Sender account was not found for this customer.',
        };
    }

    const [receiverRows] = await connection.query(
        `
            SELECT
                account_id,
                account_number,
                account_balance,
                account_currency,
                account_status
            FROM Accounts
            WHERE account_number = ?
            LIMIT 1
        `,
        [destinationAccountNumber]
    );

    const receiverAccount = receiverRows[0];

    if (!receiverAccount) {
        return {
            status: 404,
            message: 'Destination account number was not found.',
        };
    }

    if (senderAccount.account_id === receiverAccount.account_id) {
        return {
            status: 400,
            message: 'You cannot transfer money to the same account.',
        };
    }

    if (senderAccount.account_status !== 'Active') {
        return {
            status: 403,
            message: `Transfers are not allowed while the sender account is ${senderAccount.account_status}.`,
        };
    }

    if (receiverAccount.account_status !== 'Active') {
        return {
            status: 403,
            message: `Transfers are not allowed to an account that is ${receiverAccount.account_status}.`,
        };
    }

    return {
        status: 200,
        senderAccount,
        receiverAccount,
    };
};

const callTransferProcedure = async ({
    senderAccountId,
    receiverAccountId,
    transferAmount,
    transferRemarks,
}) => {
    // Stored procedure used by the customer transfers page to execute an atomic transfer.
    await dbPromise.query(
        `
            CALL sp_transfer_money(
                ?, ?, ?, ?, ?,
                @p_transfer_id,
                @p_transfer_reference,
                @p_debit_reference,
                @p_credit_reference
            )
        `,
        [
            senderAccountId,
            receiverAccountId,
            transferAmount,
            TRANSFER_MODE,
            transferRemarks,
        ]
    );

    const [[procedureOutput]] = await dbPromise.query(
        `
            SELECT
                @p_transfer_id AS transfer_id,
                @p_transfer_reference AS reference_number,
                @p_debit_reference AS debit_transaction_reference,
                @p_credit_reference AS credit_transaction_reference
        `
    );

    return procedureOutput;
};

exports.createMyTransfer = async (req, res) => {
    const customerId = req.user.customer_id;
    const senderAccountId = Number(req.body?.sender_account_id);
    const destinationAccountNumber = String(req.body?.destination_account_number || '').trim();
    const transferRemarks = String(req.body?.transfer_remarks || '').trim();
    const password = req.body?.password || '';
    const transferAmount = Number(req.body?.transfer_amount || 0);

    const validationMessage = validateTransferInput({
        senderAccountId,
        destinationAccountNumber,
        transferRemarks,
        password,
        transferAmount,
    });

    if (validationMessage) {
        return res.status(validationMessage.startsWith('Transfers above INR') ? 403 : 400).json({
            message: validationMessage,
        });
    }

    try {
        const transferContext = await loadTransferContext({
            connection: dbPromise,
            customerId,
            senderAccountId,
            destinationAccountNumber,
            password,
        });

        if (transferContext.status !== 200) {
            return res.status(transferContext.status).json({
                message: transferContext.message,
            });
        }

        if (Number(transferContext.senderAccount.account_balance || 0) < transferAmount) {
            return res.status(400).json({
                message: 'Insufficient balance for this transfer.',
            });
        }

        await dbPromise.beginTransaction();

        const procedureOutput = await callTransferProcedure({
            senderAccountId: transferContext.senderAccount.account_id,
            receiverAccountId: transferContext.receiverAccount.account_id,
            transferAmount,
            transferRemarks,
        });

        await dbPromise.commit();

        return res.status(201).json({
            message: 'Transfer successful.',
            transfer: {
                transfer_id: procedureOutput?.transfer_id || null,
                reference_number: procedureOutput?.reference_number || null,
                debit_transaction_reference:
                    procedureOutput?.debit_transaction_reference || null,
                credit_transaction_reference:
                    procedureOutput?.credit_transaction_reference || null,
                sender_account_number: transferContext.senderAccount.account_number,
                receiver_account_number: transferContext.receiverAccount.account_number,
                transfer_amount: transferAmount,
            },
        });
    } catch (error) {
        try {
            await dbPromise.rollback();
        } catch {
            // Ignore rollback failures and return the original request error response.
        }

        if (error?.sqlState === '45000' && error?.sqlMessage) {
            return res.status(400).json({
                message: error.sqlMessage,
            });
        }

        if (error?.sqlMessage) {
            return res.status(500).json({
                message: error.sqlMessage,
            });
        }

        if (error?.message) {
            return res.status(500).json({
                message: error.message,
            });
        }

        return res.status(500).json({
            message: 'Failed to complete transfer.',
        });
    }
};
