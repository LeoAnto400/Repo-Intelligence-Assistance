const db = require('../config/db');
const dbPromise = db.promise();

exports.getDashboardStats = async (req, res) => {
    const query = `
        SELECT
            (SELECT COUNT(*) FROM Customers) AS total_customers,
            (SELECT COUNT(*) FROM Accounts) AS total_accounts,
            (SELECT COUNT(*) FROM Transactions) AS total_transactions,
            (SELECT SUM(transaction_amount) FROM Transactions) AS total_money_flow
    `;

    try {
        const [results] = await dbPromise.query(query);
        let highRiskFrauds = 0;

        try {
            // Stored procedure used by the public/admin summary widget for fraud monitoring.
            const [fraudProcedureResult] = await dbPromise.query(
                'CALL sp_get_open_fraud_cases(?)',
                [70]
            );
            const fraudRows =
                Array.isArray(fraudProcedureResult) && Array.isArray(fraudProcedureResult[0])
                    ? fraudProcedureResult[0]
                    : [];
            highRiskFrauds = fraudRows.length;
        } catch (error) {
            if (
                error &&
                error.code !== 'ER_SP_DOES_NOT_EXIST' &&
                error.code !== 'ER_NO_SUCH_TABLE'
            ) {
                throw error;
            }

            const [[fallback]] = await dbPromise.query(
                'SELECT COUNT(*) AS high_risk_frauds FROM fraud_logs WHERE risk_score >= 70'
            );
            highRiskFrauds = Number(fallback?.high_risk_frauds) || 0;
        }

        return res.json({
            ...results[0],
            high_risk_frauds: highRiskFrauds,
        });
    } catch (error) {
        return res.status(500).send(error);
    }
};
