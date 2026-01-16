# Backend API Specification

This document outlines the backend API endpoints required for the Money Trap Analyzer Chrome Extension authentication and subscription system.

**Base URL**: `https://api.useshield.net`

---

## Authentication Endpoints

### 1. Register User
**POST** `/api/auth/register`

Creates a new user account.

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "user": {
    "id": "user_abc123",
    "email": "john@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors**:
- `400`: Email already exists
- `400`: Invalid email format
- `400`: Password too weak (min 8 chars required)

---

### 2. Login
**POST** `/api/auth/login`

Authenticates user and returns JWT token.

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "user_abc123",
    "email": "john@example.com",
    "name": "John Doe",
    "emailVerified": true,
    "subscription": {
      "tier": "pro",
      "status": "active",
      "expiresAt": "2024-02-15T10:30:00Z"
    }
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors**:
- `401`: Invalid email or password
- `403`: Email not verified

---

### 3. Get Current User
**GET** `/api/auth/me`

Returns authenticated user's profile.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "id": "user_abc123",
    "email": "john@example.com",
    "name": "John Doe",
    "emailVerified": true,
    "subscription": {
      "tier": "pro",
      "status": "active",
      "expiresAt": "2024-02-15T10:30:00Z"
    },
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Errors**:
- `401`: Invalid or expired token

---

### 4. Verify Email
**POST** `/api/auth/verify-email`

Verifies user's email with token sent via email.

**Request Body**:
```json
{
  "token": "verification_token_here"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

**Errors**:
- `400`: Invalid or expired token

---

### 5. Request Password Reset
**POST** `/api/auth/forgot-password`

Sends password reset email.

**Request Body**:
```json
{
  "email": "john@example.com"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

### 6. Reset Password
**POST** `/api/auth/reset-password`

Resets password with token from email.

**Request Body**:
```json
{
  "token": "reset_token_here",
  "newPassword": "newsecurepassword123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

**Errors**:
- `400`: Invalid or expired token
- `400`: Password too weak

---

### 7. Update Profile
**PUT** `/api/auth/profile`

Updates user profile information.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Request Body**:
```json
{
  "name": "John Smith",
  "email": "john.smith@example.com"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": "user_abc123",
    "email": "john.smith@example.com",
    "name": "John Smith",
    "emailVerified": true
  }
}
```

---

### 8. Change Password
**POST** `/api/auth/change-password`

Changes user's password.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Request Body**:
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newsecurepassword123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Errors**:
- `401`: Current password incorrect
- `400`: New password too weak

---

## Subscription Endpoints

### 1. Create Purchase
**POST** `/api/subscriptions/purchase`

Initiates subscription purchase with Lemon Squeezy.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Request Body**:
```json
{
  "tier": "pro",
  "email": "john@example.com"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "checkoutUrl": "https://yourstore.lemonsqueezy.com/checkout/buy/abc123...",
  "orderId": "order_xyz789"
}
```

**Errors**:
- `400`: Invalid tier
- `401`: Unauthorized

---

### 2. Activate Subscription
**POST** `/api/subscriptions/activate`

Activates subscription after successful Lemon Squeezy payment.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Request Body**:
```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "orderId": "order_xyz789"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Subscription activated successfully",
  "subscription": {
    "id": "sub_abc123",
    "userId": "user_abc123",
    "tier": "pro",
    "status": "active",
    "licenseKey": "XXXX-XXXX-XXXX-XXXX",
    "lemonSqueezyOrderId": "order_xyz789",
    "startDate": "2024-01-15T10:30:00Z",
    "expiresAt": "2024-02-15T10:30:00Z",
    "autoRenew": true
  }
}
```

**Errors**:
- `400`: Invalid license key
- `400`: License already activated
- `401`: Unauthorized

---

### 3. Get Subscription
**GET** `/api/subscriptions/current`

Retrieves current user's subscription.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "subscription": {
    "id": "sub_abc123",
    "tier": "pro",
    "status": "active",
    "licenseKey": "XXXX-XXXX-XXXX-XXXX",
    "startDate": "2024-01-15T10:30:00Z",
    "expiresAt": "2024-02-15T10:30:00Z",
    "autoRenew": true,
    "scansUsed": 45,
    "scansLimit": 80
  }
}
```

---

### 4. Sync Subscription
**POST** `/api/subscriptions/sync`

Syncs subscription status from Lemon Squeezy.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Subscription synced successfully",
  "subscription": {
    "id": "sub_abc123",
    "tier": "pro",
    "status": "active",
    "expiresAt": "2024-02-15T10:30:00Z",
    "autoRenew": true
  }
}
```

---

### 5. Cancel Subscription
**POST** `/api/subscriptions/cancel`

Cancels active subscription (keeps access until expiry).

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Subscription cancelled. Access continues until 2024-02-15",
  "subscription": {
    "status": "cancelled",
    "expiresAt": "2024-02-15T10:30:00Z",
    "autoRenew": false
  }
}
```

---

## Lemon Squeezy Webhook

### Webhook Endpoint
**POST** `/api/webhooks/lemonsqueezy`

Receives webhooks from Lemon Squeezy for order updates.

**Headers**:
```
X-Signature: <lemon_squeezy_signature>
```

**Events to Handle**:
- `order_created`: Order initiated
- `order_paid`: Payment successful → Activate subscription
- `subscription_created`: Subscription created
- `subscription_updated`: Subscription details changed
- `subscription_cancelled`: Subscription cancelled
- `subscription_resumed`: Subscription resumed
- `subscription_expired`: Subscription expired

**Webhook Verification**:
```javascript
const crypto = require('crypto');
const signature = req.headers['x-signature'];
const payload = JSON.stringify(req.body);
const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

const hash = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

if (hash !== signature) {
  return res.status(401).send('Invalid signature');
}
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Subscriptions Table
```sql
CREATE TABLE subscriptions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tier VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL, -- active, cancelled, expired
  license_key VARCHAR(255) UNIQUE,
  lemon_squeezy_order_id VARCHAR(255),
  lemon_squeezy_subscription_id VARCHAR(255),
  start_date TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  auto_renew BOOLEAN DEFAULT TRUE,
  scans_used INT DEFAULT 0,
  scans_limit INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_license_key (license_key),
  INDEX idx_status (status)
);
```

---

## Environment Variables

Required environment variables for backend:

```env
# Server
PORT=3000
NODE_ENV=production
API_BASE_URL=https://api.useshield.net

# Database
DATABASE_URL=mysql://user:password@host:3306/database

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Lemon Squeezy
LEMONSQUEEZY_API_KEY=your-lemon-squeezy-api-key
LEMONSQUEEZY_STORE_ID=your-store-id
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret

# Email Service (SendGrid, Mailgun, etc.)
EMAIL_FROM=noreply@useshield.net
SENDGRID_API_KEY=your-sendgrid-api-key

# CORS
CORS_ORIGIN=chrome-extension://your-extension-id
```

---

## Implementation Notes

1. **JWT Tokens**: Use 7-day expiration, include user ID and email in payload
2. **Password Hashing**: Use bcrypt with 10 rounds minimum
3. **Email Verification**: Send verification token on registration, require verification before full access
4. **Rate Limiting**: Implement rate limiting on auth endpoints (5 login attempts per 15 minutes)
5. **CORS**: Allow requests from Chrome extension ID
6. **Error Handling**: Always return consistent error format:
```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## Recommended Tech Stack

- **Framework**: Express.js (Node.js) or Fastify
- **Database**: MySQL or PostgreSQL
- **ORM**: Prisma or Sequelize
- **Validation**: Joi or Zod
- **Email**: SendGrid or AWS SES
- **Deployment**: Railway, Render, or DigitalOcean App Platform

---

## Testing Checklist

- [ ] User registration flow
- [ ] Email verification
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Password reset flow
- [ ] Profile updates
- [ ] Purchase subscription flow
- [ ] License activation
- [ ] Subscription sync
- [ ] Subscription cancellation
- [ ] Webhook handling (order_paid)
- [ ] JWT token expiration
- [ ] Rate limiting
- [ ] CORS headers
