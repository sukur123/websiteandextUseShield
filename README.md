# 🛡️ Money Trap Analyzer (Chrome Extension)

Analyzes Terms of Service, Privacy Policies, and legal pages for potential "money traps" (auto-renewals, cancellation/refund restrictions, surprise fees, arbitration clauses, data selling, etc.) using OpenAI.

## ✨ Features

### Core Analysis
- **AI-Powered Detection**: Uses GPT-4o-mini (or GPT-4o) to identify concerning clauses
- **Risk Scoring**: 0-100 risk score with severity-weighted calculation
- **Categorization**: 14 categories including billing, refunds, arbitration, data sharing, etc.
- **Plain Language Summaries**: Explains findings in simple terms with actionable recommendations

### User Interface
- **Risk Gauge**: Visual SVG gauge showing risk level
- **Findings Cards**: Severity-colored cards with quotes and recommendations
- **Stats Bar**: Quick view of critical/high/medium/low issues
- **Cache Indicator**: Shows when results are loaded from cache

### Advanced Features
- **📋 Watchlist**: Save sites to monitor for ToS changes
  - Daily automatic checks for changes
  - Desktop notifications when ToS updates
- **⚖️ Compare**: Side-by-side comparison of two services' terms
  - Automatic winner/loser highlighting
- **📄 Export**: Download markdown reports for documentation
- **⚡ Smart Caching**: 24-hour cache to avoid redundant API calls

### Privacy & Performance
- **PII Redaction**: Automatically removes emails, phones, SSNs, credit cards before sending to API
- **Boilerplate Removal**: Strips navigation, footer, ads for cleaner analysis
- **Page Type Detection**: Identifies ToS, Privacy Policy, Refund pages
- **Content Extraction**: Smart extraction from main content areas

### Usage Management
- **Tiered Limits**: Free (3/day), Pro (100/day), Teams (unlimited)
- **Usage Tracking**: Shows remaining analyses in popup
- **Retry Logic**: Automatic retry with exponential backoff on rate limits

## 🔒 Security Note

This extension stores your OpenAI API key in `chrome.storage.local` on your machine. This is safe for personal use but **not** recommended for public distribution.

For production, implement a backend proxy so the browser never handles API keys directly.

## 📦 Installation

### Load as Unpacked Extension
1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this folder: `chrome-extension/`

## ⚙️ Configuration

1. Click the extension icon → **⚙️ Options**
2. **API Settings**:
   - Enter your OpenAI API key
   - Choose model (gpt-4o-mini recommended)
   - Set max characters to send (default: 20,000)
3. **Privacy Settings**:
   - Toggle PII redaction (on by default)
   - Toggle result caching
4. **Usage Tier**: Select your tier (Free/Pro/Teams)
5. **Notifications**: Enable/disable watchlist change alerts

## 🚀 Usage

### Basic Analysis
1. Navigate to any Terms/Privacy page
2. Click the extension icon
3. Click **🔍 Analyze this page**
4. Review findings, risk score, and recommendations

### Compare Services
1. Click the **⚖️** button in the popup
2. Enter URLs for two services' ToS pages
3. Click Analyze for each
4. Click **Compare Results** to see the winner

### Watchlist
1. After analyzing a page, click **➕ Add to Watchlist**
2. Access watchlist via the **📋** button
3. Extension checks daily for ToS changes

### Export Report
1. After analysis, click **📄 Export Report**
2. Markdown file downloads with full findings

## 🗂️ File Structure

```
chrome-extension/
├── manifest.json          # Extension manifest (MV3)
├── popup.html/css/js      # Main extension popup
├── options.html/js        # Settings page
├── watchlist.html/js      # Watchlist management
├── compare.html/js        # Service comparison
└── src/
    ├── background.js      # Service worker (API calls, caching, alarms)
    ├── content.js         # Page text extraction
    ├── types.js           # Shared constants
    ├── riskScore.js       # Risk calculation logic
    ├── usage.js           # Usage tracking
    └── cache.js           # Result caching
```

## 🔍 Troubleshooting

- **"Receiving end does not exist"**: Refresh the page and try again
- **"No text found"**: The page may be dynamically loaded; wait for it to load fully
- **API errors**: Verify your API key and OpenAI account status
- **Rate limited**: Wait a moment; the extension will auto-retry

## 📝 Categories Detected

| Category | Description |
|----------|-------------|
| `auto_renewal` | Automatic subscription renewal |
| `cancellation` | Cancellation policies |
| `refund` | Refund limitations |
| `trial` | Free trial conversion |
| `fees` | Hidden or unexpected fees |
| `price_change` | Ability to change prices |
| `data_sharing` | Third-party data sharing |
| `data_selling` | Selling user data |
| `arbitration` | Forced arbitration |
| `class_action_waiver` | Class action waiver |
| `termination` | Account termination rights |
| `liability` | Limitation of liability |
| `dark_pattern` | Deceptive UI/UX patterns |
| `other` | Other concerning clauses |

## 🎯 Severity Levels

| Level | Weight | Description |
|-------|--------|-------------|
| Critical | 40 | Forced arbitration, data selling, hidden fees |
| High | 25 | No refunds, price changes without notice |
| Medium | 10 | Limited refund window, auto-renewal with notice |
| Low | 3 | Standard liability limitations |

---

Built for [useShield.net](https://useshield.net) 🛡️
