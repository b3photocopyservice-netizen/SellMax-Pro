const db = require('../config/db');
const fs = require('fs');
const path = require('path');

class NotificationService {
  async generateDailyAlerts(companyId) {
    try {
      // 1. Fetch Low Stock Items
      const lowStockQuery = `
        SELECT ProductID, Name, Stock, LowStockThreshold, UOM
        FROM dbo.Products
        WHERE CompanyID = @CompanyID AND Stock <= LowStockThreshold AND IsActive = 1
      `;
      const lowStockRes = await db.query(lowStockQuery, { CompanyID: companyId });
      const lowStockItems = lowStockRes.recordset;

      // 2. Fetch Expiring/Expired Batches
      const expiringQuery = `
        SELECT pb.*, p.Name AS ProductName, p.UOM,
               DATEDIFF(day, GETDATE(), pb.ExpiryDate) AS DaysRemaining
        FROM dbo.ProductBatches pb
        INNER JOIN dbo.Products p ON pb.ProductID = p.ProductID
        WHERE pb.CompanyID = @CompanyID AND pb.CurrentQty > 0
          AND (DATEDIFF(day, GETDATE(), pb.ExpiryDate) <= 90)
      `;
      const expiringRes = await db.query(expiringQuery, { CompanyID: companyId });
      const expiringBatches = expiringRes.recordset;

      const newAlerts = [];

      // 3. Process Low Stock Alerts
      for (const item of lowStockItems) {
        const msg = `Low Stock Alert: Product '${item.Name}' is at ${Number(item.Stock)} ${item.UOM || 'pcs'} (Threshold: ${Number(item.LowStockThreshold)}).`;
        
        // Avoid duplicate system alerts raised today
        const dupCheck = await db.query(`
          SELECT 1 FROM dbo.SystemNotifications
          WHERE CompanyID = @CompanyID 
            AND Message = @Message 
            AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
        `, { CompanyID: companyId, Message: msg });

        if (dupCheck.recordset.length === 0) {
          await db.query(`
            INSERT INTO dbo.SystemNotifications (CompanyID, Type, Message, IsRead)
            VALUES (@CompanyID, 'LowStock', @Message, 0)
          `, { CompanyID: companyId, Message: msg });
          
          newAlerts.push(msg);
        }
      }

      // 4. Process Expiring/Expired Batches
      for (const batch of expiringBatches) {
        let msg = '';
        const expiryStr = new Date(batch.ExpiryDate).toLocaleDateString();
        if (batch.DaysRemaining <= 0) {
          msg = `EXPIRED: Batch '${batch.BatchNo}' of '${batch.ProductName}' expired on ${expiryStr} (Remaining Stock: ${Number(batch.CurrentQty)} ${batch.UOM}).`;
        } else {
          msg = `EXPIRING SOON: Batch '${batch.BatchNo}' of '${batch.ProductName}' is expiring in ${batch.DaysRemaining} days on ${expiryStr} (Current Stock: ${Number(batch.CurrentQty)} ${batch.UOM}).`;
        }

        const dupCheck = await db.query(`
          SELECT 1 FROM dbo.SystemNotifications
          WHERE CompanyID = @CompanyID 
            AND Message = @Message 
            AND CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
        `, { CompanyID: companyId, Message: msg });

        if (dupCheck.recordset.length === 0) {
          await db.query(`
            INSERT INTO dbo.SystemNotifications (CompanyID, Type, Message, IsRead)
            VALUES (@CompanyID, 'Expiry', @Message, 0)
          `, { CompanyID: companyId, Message: msg });

          newAlerts.push(msg);
        }
      }

      // 5. Send Simulated Emails
      if (newAlerts.length > 0) {
        const logDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        const logPath = path.join(logDir, 'email_notifications.log');
        const logEntries = newAlerts.map(alert => 
          `[${new Date().toISOString()}] Email Sent to Store Admin: ${alert}\n`
        ).join('');
        
        fs.appendFileSync(logPath, logEntries);
        console.log(`Simulated ${newAlerts.length} email alerts in email_notifications.log`);
      }
    } catch (err) {
      console.error('Error generating notification alerts:', err);
    }
  }

  async getNotifications(companyId) {
    // Generate fresh alerts before fetching to make sure it's up to date
    await this.generateDailyAlerts(companyId);

    const sqlQuery = `
      SELECT * FROM dbo.SystemNotifications
      WHERE CompanyID = @CompanyID
      ORDER BY CreatedAt DESC
    `;
    const result = await db.query(sqlQuery, { CompanyID: companyId });
    return result.recordset;
  }

  async markAllAsRead(companyId) {
    const sqlQuery = `
      UPDATE dbo.SystemNotifications
      SET IsRead = 1
      WHERE CompanyID = @CompanyID AND IsRead = 0
    `;
    await db.query(sqlQuery, { CompanyID: companyId });
    return true;
  }
}

module.exports = new NotificationService();
