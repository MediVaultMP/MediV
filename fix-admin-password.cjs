const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'securechain'
});

async function fixAdmin() {
    const client = await pool.connect();
    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash('AdminPass123!', 10);
        console.log('Generated hash:', hashedPassword);
        
        // Update admin password
        const result = await client.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email, role, status',
            [hashedPassword, 'admin@medivault.com']
        );
        
        if (result.rows.length > 0) {
            console.log('✅ Admin password updated successfully!');
            console.log('Email: admin@medivault.com');
            console.log('Password: AdminPass123!');
            console.log('Admin ID:', result.rows[0].id);
        } else {
            console.log('❌ Admin user not found!');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

fixAdmin();