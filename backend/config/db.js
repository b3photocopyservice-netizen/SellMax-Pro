require('dotenv').config();

// msnodesqlv8 is Windows-only. On Linux cloud servers it won't be available.
// Gracefully fall back to cross-platform 'mssql' (tedious) driver.
let msnodesqlv8Available = false;
try { require('msnodesqlv8'); msnodesqlv8Available = true; } catch (e) { /* Linux/cloud - not available */ }

const useMsnodesqlv8 = msnodesqlv8Available && (process.env.DB_DRIVER === 'msnodesqlv8' || !process.env.DB_PORT);
const sql = useMsnodesqlv8 ? require('mssql/msnodesqlv8') : require('mssql');

const dbConfig = useMsnodesqlv8 ? {
  connectionString: process.env.DB_CONNECTION_STRING || 'Driver={ODBC Driver 18 for SQL Server};Server=localhost\\SQLEXPRESS;Database=SellMaxPro;Trusted_Connection=yes;TrustServerCertificate=yes;',
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
} : {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'your_strong_password',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'SellMaxPro',
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true', // true for azure, false for local
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false', // true for local self-signed
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log(`Connected to MS SQL Server successfully (using ${useMsnodesqlv8 ? 'msnodesqlv8' : 'tedious'}).`);
    return pool;
  })
  .catch(err => {
    console.error('Database connection failed: ', err);
    process.exit(1);
  });

/**
 * Execute a query with params
 * @param {string} queryStr SQL query string
 * @param {object} params Object containing parameter values (key-value)
 * @returns {Promise<object>} SQL request result
 */
async function query(queryStr, params = {}) {
  const pool = await poolPromise;
  const request = pool.request();
  
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  
  return request.query(queryStr);
}

/**
 * Execute a stored procedure
 * @param {string} procedureName Name of the stored procedure
 * @param {object} params Object containing input parameter values
 * @returns {Promise<object>} SQL request result
 */
async function executeProcedure(procedureName, params = {}) {
  const pool = await poolPromise;
  const request = pool.request();
  
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  
  return request.execute(procedureName);
}

module.exports = {
  sql,
  query,
  executeProcedure,
  poolPromise
};
