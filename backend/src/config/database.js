const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

const connectDatabase = async () => {
    try {
        logger.info('Connecting to database...', {
            url: process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@') // Hide password in logs
        });

        // Create connection pool
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20, // max number of clients in the pool
            idleTimeoutMillis: 30000, // close idle clients after 30 seconds
            connectionTimeoutMillis: 10000, // return an error after 10 seconds if connection could not be established
            acquireTimeoutMillis: 10000, // return an error after 10 seconds if acquire takes too long
        });

        // Test the connection
        logger.info('Testing database connection...');
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        client.release();

        logger.info('Database connected successfully', {
            currentTime: result.rows[0].current_time,
            version: result.rows[0].version.split(' ')[0] // Just the version number
        });

        // Create agenda_jobs table if it doesn't exist
        await createAgendaTable();

        return pool;
    } catch (error) {
        logger.error('Database connection failed:', {
            error: error.message,
            code: error.code,
            host: error.address,
            port: error.port
        });

        // Provide helpful error messages
        if (error.code === 'ECONNREFUSED') {
            logger.error('Connection refused - check if PostgreSQL is running and accessible');
        } else if (error.code === 'ETIMEDOUT') {
            logger.error('Connection timeout - check network connectivity and firewall settings');
        } else if (error.code === 'ENOTFOUND') {
            logger.error('Host not found - check the database host address');
        }

        throw error;
    }
};

const createAgendaTable = async () => {
    try {
        const client = await pool.connect();

        // Create agenda_jobs table for AgendaJS
        await client.query(`
            CREATE TABLE IF NOT EXISTS agenda_jobs (
                _id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                data JSONB,
                priority INTEGER DEFAULT 0,
                type VARCHAR(50) DEFAULT 'normal',
                next_run_at TIMESTAMP,
                last_modified_by VARCHAR(255),
                locked_at TIMESTAMP,
                last_ran_at TIMESTAMP,
                last_finished_at TIMESTAMP,
                failed_at TIMESTAMP,
                repeat_interval VARCHAR(255),
                repeat_timezone VARCHAR(255),
                repeat_at VARCHAR(255),
                disabled BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create indexes for better performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_agenda_name ON agenda_jobs(name);
            CREATE INDEX IF NOT EXISTS idx_agenda_next_run ON agenda_jobs(next_run_at);
            CREATE INDEX IF NOT EXISTS idx_agenda_locked ON agenda_jobs(locked_at);
            CREATE INDEX IF NOT EXISTS idx_agenda_priority ON agenda_jobs(priority);
        `);

        // Create jobs tracking table
        await client.query(`
            CREATE TABLE IF NOT EXISTS job_metrics (
                id SERIAL PRIMARY KEY,
                job_id VARCHAR(255) NOT NULL,
                job_type VARCHAR(100) NOT NULL,
                status VARCHAR(50) NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                duration_ms INTEGER,
                cost_usd DECIMAL(10, 4),
                api_calls INTEGER DEFAULT 0,
                tokens_used INTEGER DEFAULT 0,
                error_message TEXT,
                metadata JSONB
            );
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_job_metrics_type ON job_metrics(job_type);
            CREATE INDEX IF NOT EXISTS idx_job_metrics_status ON job_metrics(status);
            CREATE INDEX IF NOT EXISTS idx_job_metrics_started ON job_metrics(started_at);
        `);

        client.release();
        logger.info('Database tables created/verified successfully');
    } catch (error) {
        logger.error('Error creating database tables:', error);
        throw error;
    }
};

const getPool = () => {
    if (!pool) {
        throw new Error('Database not initialized. Call connectDatabase() first.');
    }
    return pool;
};

const closeDatabase = async () => {
    if (pool) {
        await pool.end();
        logger.info('Database connection closed');
    }
};

// Health check function
const checkDatabaseHealth = async () => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT 1 as health_check');
        client.release();
        return { healthy: true, timestamp: new Date() };
    } catch (error) {
        logger.error('Database health check failed:', error);
        return { healthy: false, error: error.message, timestamp: new Date() };
    }
};

module.exports = {
    connectDatabase,
    getPool,
    closeDatabase,
    checkDatabaseHealth
};