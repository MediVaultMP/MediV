import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcrypt';

// Database connection using your .env values
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'securehain'  // Your database name
});

async function createAdmin() {
    const client = await pool.connect();
    try {
        // Check if admin already exists
        const checkResult = await client.query(
            'SELECT * FROM users WHERE email = $1',
            ['admin@medivault.com']
        );
        
        if (checkResult.rows.length > 0) {
            console.log('✅ Admin already exists!');
            console.log('Email: admin@medivault.com');
            console.log('Password: AdminPass123!');
            console.log('Admin ID:', checkResult.rows[0].id);
            process.exit(0);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash('AdminPass123!', 10);
        
        // Create admin user
        const result = await client.query(
            `INSERT INTO users (wallet_address, email, password, role, name, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
             RETURNING id, email, role, name, status`,
            [
                '0xAdmin123456789',
                'admin@medivault.com',
                hashedPassword,
                'admin',
                'System Admin',
                'active'
            ]
        );

        console.log('✅ Admin created successfully!');
        console.log('Email: admin@medivault.com');
        console.log('Password: AdminPass123!');
        console.log('Admin ID:', result.rows[0].id);
        
    } catch (error) {
        console.error('❌ Error creating admin:', error.message);
        console.error('Details:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

createAdmin();