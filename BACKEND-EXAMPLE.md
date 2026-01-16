# Money Trap Analyzer - Backend Server (Example)

This is a minimal example backend implementation for the Money Trap Analyzer Chrome Extension. It demonstrates the core authentication and subscription endpoints.

**⚠️ WARNING**: This is a basic example for development. For production, add:
- Proper error handling
- Request validation (Joi/Zod)
- Rate limiting
- Email verification
- Comprehensive logging
- Security hardening

---

## Quick Start

### 1. Setup

```bash
# Create project directory
mkdir mta-backend && cd mta-backend

# Initialize npm
npm init -y

# Install dependencies
npm install express cors bcrypt jsonwebtoken mysql2 dotenv
npm install --save-dev nodemon

# Create files
touch server.js
touch .env
touch schema.sql
```

### 2. Configure Environment

Create `.env`:
```env
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=mta_production

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# Lemon Squeezy
LEMONSQUEEZY_API_KEY=your-lemon-squeezy-api-key
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret

# CORS
CORS_ORIGIN=chrome-extension://your-extension-id
```

### 3. Create Database Schema

Run `schema.sql`:
```sql
CREATE DATABASE IF NOT EXISTS mta_production;
USE mta_production;

CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
);

CREATE TABLE subscriptions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tier VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  license_key VARCHAR(255) UNIQUE,
  lemon_squeezy_order_id VARCHAR(255),
  start_date TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  auto_renew BOOLEAN DEFAULT TRUE,
  scans_used INT DEFAULT 0,
  scans_limit INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_license_key (license_key)
);
```

### 4. Create Server

Create `server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Helper function to generate user ID
const generateId = () => `user_${crypto.randomBytes(16).toString('hex')}`;
const generateSubId = () => `sub_${crypto.randomBytes(16).toString('hex')}`;

// ===== AUTH ENDPOINTS =====

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'All fields required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userId = generateId();
    await pool.query(
      'INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)',
      [userId, email, name, passwordHash]
    );

    // Generate JWT
    const token = jwt.sign(
      { id: userId, email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: userId,
        email,
        name,
        emailVerified: false,
        createdAt: new Date().toISOString()
      },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    // Get user
    const [users] = await pool.query(
      'SELECT id, email, name, password_hash, email_verified FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Get subscription
    const [subs] = await pool.query(
      'SELECT tier, status, expires_at FROM subscriptions WHERE user_id = ? AND status = "active" ORDER BY created_at DESC LIMIT 1',
      [user.id]
    );

    let subscription = null;
    if (subs.length > 0) {
      subscription = {
        tier: subs[0].tier,
        status: subs[0].status,
        expiresAt: subs[0].expires_at
      };
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.email_verified,
        subscription
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, email, name, email_verified, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = users[0];

    // Get subscription
    const [subs] = await pool.query(
      'SELECT tier, status, expires_at FROM subscriptions WHERE user_id = ? AND status = "active" ORDER BY created_at DESC LIMIT 1',
      [user.id]
    );

    let subscription = null;
    if (subs.length > 0) {
      subscription = {
        tier: subs[0].tier,
        status: subs[0].status,
        expiresAt: subs[0].expires_at
      };
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.email_verified,
        subscription,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

// ===== SUBSCRIPTION ENDPOINTS =====

// Tier configurations
const TIER_CONFIG = {
  starter: { scansLimit: 15, price: 9.99 },
  pro: { scansLimit: 80, price: 29 },
  pro_plus: { scansLimit: 200, price: 60 },
  agency: { scansLimit: 300, price: 100 }
};

// Purchase plan
app.post('/api/subscriptions/purchase', authenticateToken, async (req, res) => {
  try {
    const { tier, email } = req.body;

    if (!tier || !TIER_CONFIG[tier]) {
      return res.status(400).json({ success: false, error: 'Invalid tier' });
    }

    // In production, create actual Lemon Squeezy checkout
    // For now, return a demo checkout URL
    const checkoutUrl = `https://demo.lemonsqueezy.com/checkout?tier=${tier}&email=${email}`;
    const orderId = `order_${crypto.randomBytes(8).toString('hex')}`;

    res.json({
      success: true,
      checkoutUrl,
      orderId
    });
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ success: false, error: 'Purchase failed' });
  }
});

// Activate subscription
app.post('/api/subscriptions/activate', authenticateToken, async (req, res) => {
  try {
    const { licenseKey, orderId } = req.body;

    if (!licenseKey) {
      return res.status(400).json({ success: false, error: 'License key required' });
    }

    // In production, verify license with Lemon Squeezy API
    // For now, simulate activation

    // Extract tier from license (demo: first part of license)
    const tier = 'pro'; // In production, get from Lemon Squeezy

    const config = TIER_CONFIG[tier];
    const subId = generateSubId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await pool.query(
      `INSERT INTO subscriptions 
       (id, user_id, tier, status, license_key, lemon_squeezy_order_id, start_date, expires_at, scans_limit, scans_used)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, 0)`,
      [subId, req.user.id, tier, licenseKey, orderId, now, expiresAt, config.scansLimit]
    );

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: {
        id: subId,
        userId: req.user.id,
        tier,
        status: 'active',
        licenseKey,
        startDate: now,
        expiresAt,
        autoRenew: true
      }
    });
  } catch (error) {
    console.error('Activate error:', error);
    res.status(500).json({ success: false, error: 'Activation failed' });
  }
});

// Get subscription
app.get('/api/subscriptions/current', authenticateToken, async (req, res) => {
  try {
    const [subs] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND status = "active" ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );

    if (subs.length === 0) {
      return res.json({
        success: true,
        subscription: null
      });
    }

    const sub = subs[0];

    res.json({
      success: true,
      subscription: {
        id: sub.id,
        tier: sub.tier,
        status: sub.status,
        licenseKey: sub.license_key,
        startDate: sub.start_date,
        expiresAt: sub.expires_at,
        autoRenew: sub.auto_renew,
        scansUsed: sub.scans_used,
        scansLimit: sub.scans_limit
      }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ success: false, error: 'Failed to get subscription' });
  }
});

// Sync subscription
app.post('/api/subscriptions/sync', authenticateToken, async (req, res) => {
  try {
    // In production, verify with Lemon Squeezy API
    // For now, just return current subscription
    const [subs] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND status = "active" ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );

    if (subs.length === 0) {
      return res.json({
        success: true,
        message: 'No active subscription',
        subscription: null
      });
    }

    const sub = subs[0];

    res.json({
      success: true,
      message: 'Subscription synced',
      subscription: {
        tier: sub.tier,
        status: sub.status,
        expiresAt: sub.expires_at,
        autoRenew: sub.auto_renew
      }
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ success: false, error: 'Sync failed' });
  }
});

// Cancel subscription
app.post('/api/subscriptions/cancel', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE subscriptions SET auto_renew = FALSE WHERE user_id = ? AND status = "active"',
      [req.user.id]
    );

    const [subs] = await pool.query(
      'SELECT expires_at FROM subscriptions WHERE user_id = ? AND status = "active" LIMIT 1',
      [req.user.id]
    );

    const expiresAt = subs.length > 0 ? subs[0].expires_at : null;

    res.json({
      success: true,
      message: `Subscription cancelled. Access continues until ${expiresAt}`,
      subscription: {
        status: 'cancelled',
        expiresAt,
        autoRenew: false
      }
    });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ success: false, error: 'Cancel failed' });
  }
});

// ===== WEBHOOK ENDPOINT =====

app.post('/api/webhooks/lemonsqueezy', async (req, res) => {
  try {
    // Verify signature (simplified - in production, verify properly)
    const signature = req.headers['x-signature'];
    
    const event = req.body;
    console.log('Webhook received:', event.meta.event_name);

    // Handle different events
    if (event.meta.event_name === 'order_created') {
      console.log('Order created:', event.data.id);
      // Store order reference
    } else if (event.meta.event_name === 'subscription_created') {
      console.log('Subscription created:', event.data.id);
      // Activate subscription in database
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 CORS origin: ${process.env.CORS_ORIGIN}`);
});
```

### 5. Update package.json

Add scripts:
```json
{
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  }
}
```

### 6. Run Server

```bash
# Development
npm run dev

# Production
npm start
```

---

## Testing with cURL

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'

# Get user (replace TOKEN)
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Purchase subscription (replace TOKEN)
curl -X POST http://localhost:3000/api/subscriptions/purchase \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"tier":"pro","email":"john@example.com"}'
```

---

## Production Deployment

### Recommended Platforms

1. **Railway** (easiest): https://railway.app
   - Click "Deploy"
   - Connect GitHub repo
   - Add environment variables
   - Done!

2. **Render**: https://render.com
   - Free tier available
   - Auto-deploy from Git

3. **DigitalOcean App Platform**
   - $5/month
   - Easy scaling

### Deployment Checklist

- [ ] Set strong JWT_SECRET
- [ ] Configure production database
- [ ] Set CORS_ORIGIN to extension ID
- [ ] Enable HTTPS/TLS
- [ ] Add rate limiting (express-rate-limit)
- [ ] Add request validation (Joi)
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Configure backups
- [ ] Test webhook with Lemon Squeezy

---

## Next Steps

1. **Add Email Verification**
   - Integrate SendGrid/Mailgun
   - Implement verification flow

2. **Add Password Reset**
   - Email reset link
   - Token-based reset

3. **Improve Security**
   - Rate limiting
   - Input validation
   - SQL injection prevention (use parameterized queries)

4. **Add Logging**
   - Winston or Pino
   - Log all auth attempts
   - Monitor errors

5. **Real Lemon Squeezy Integration**
   - Replace demo checkout with real API
   - Implement license verification
   - Handle webhooks properly

---

**This is a starting point!** Customize based on your needs.
