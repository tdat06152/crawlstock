# Stock Monitor - Internal Team Webapp

A comprehensive internal stock monitoring application with 15-minute price updates, alerts, and watchlist management.

## Features

- ✅ **Authentication**: Email/password login with Supabase Auth
- ✅ **Watchlist Management**: CRUD operations for stock symbols with buy zones
- ✅ **15-Minute Price Updates**: Automated polling via Vercel Cron
- ✅ **Smart Alerts**: Edge-triggered alerts with cooldown periods
- ✅ **Browser Notifications**: Real-time in-app notifications
- ✅ **Electronic Board UI**: Compact, premium table design
- ✅ **Row Level Security**: User-isolated data with Supabase RLS
- ✅ **Free Data Source**: Alpha Vantage API (5 calls/min free tier)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Database**: Supabase (Postgres + Auth + RLS)
- **API**: Alpha Vantage (15-min intraday data)
- **Deployment**: Vercel
- **Cron Jobs**: Vercel Cron

## Prerequisites

1. **Node.js** 18+ and npm
2. **Supabase Account**: [https://supabase.com](https://supabase.com)
3. **Alpha Vantage API Key**: [https://www.alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key)
4. **Vercel Account** (for deployment): [https://vercel.com](https://vercel.com)

## Local Setup

### 1. Clone and Install

```bash
cd stock-monitor
npm install
```

### 2. Supabase Setup

1. Create a new Supabase project at [https://supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration file:
   ```
   supabase/migrations/20260202_initial_schema.sql
   ```
3. Get your credentials from **Project Settings > API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (from Service Role section)

### 3. Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Alpha Vantage
ALPHAVANTAGE_API_KEY=your_alpha_vantage_api_key

# Cron Secret (generate a random string)
CRON_SECRET=your_random_secret_string_here
```

**Generate a secure CRON_SECRET**:
```bash
openssl rand -base64 32
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Create Your First User

1. Navigate to [http://localhost:3000/login](http://localhost:3000/login)
2. Click **Sign Up** and create an account
3. Check your email for confirmation (Supabase sends a confirmation email)
4. After confirming, sign in

## Testing

Run the unit tests:

```bash
npm test
```

Tests cover:
- ✅ In-zone logic (buy min/max bounds)
- ✅ Edge-trigger logic (only alert on zone entry)
- ✅ Cooldown logic (prevent alert spam)

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-github-repo-url
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [https://vercel.com](https://vercel.com)
2. Click **Import Project**
3. Select your GitHub repository
4. Add all environment variables from `.env.local`
5. Click **Deploy**

### 3. Configure Cron Job

The `vercel.json` file already configures the cron job to run every 15 minutes:

```json
{
  "crons": [
    {
      "path": "/api/cron/poll-prices",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

**Important**: After deployment, you need to add the `CRON_SECRET` to Vercel's environment variables:

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add `CRON_SECRET` with the same value from your `.env.local`

### 4. Test the Cron Endpoint

You can manually trigger the cron job to test:

```bash
curl -X GET https://your-app.vercel.app/api/cron/poll-prices \
  -H "x-cron-secret: your_cron_secret"
```

Expected response:
```json
{
  "success": true,
  "symbols_processed": 5,
  "watchlists_checked": 10,
  "alerts_created": 2
}
```

## Alternative: Supabase Scheduled Function

If you prefer to use Supabase instead of Vercel Cron:

1. Create a Supabase Edge Function:
```bash
supabase functions new poll-prices
```

2. Deploy the function with your cron logic

3. Set up a Supabase cron job using `pg_cron`:
```sql
SELECT cron.schedule(
  'poll-stock-prices',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/poll-prices',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

## Usage Guide

### Adding a Watchlist Item

1. Click **+ Add Symbol**
2. Enter the stock symbol (e.g., `AAPL`)
3. Set buy zone:
   - **Buy Min**: Minimum price to trigger alert
   - **Buy Max**: Maximum price to trigger alert
   - Leave either blank for open-ended range
4. Set **Cooldown** (minutes between alerts for same symbol)
5. Click **Add**

### Managing Watchlist

- **Enable/Disable**: Toggle the switch to pause/resume monitoring
- **Edit**: Modify buy zone or cooldown
- **Delete**: Remove from watchlist
- **Sort**: Click column headers to sort
- **Search**: Filter symbols by name

### Viewing Alerts

1. Click **View Alerts** in the header
2. See last 50 alerts with:
   - Symbol and price
   - Alert reason
   - Timestamp

### Browser Notifications

The app will request notification permission on first load. Grant permission to receive desktop notifications when new alerts are triggered.

## API Endpoints

### Watchlist API

- `GET /api/watchlist` - Get user's watchlists
- `POST /api/watchlist` - Create new watchlist item
- `PUT /api/watchlist` - Update watchlist item
- `DELETE /api/watchlist?id={id}` - Delete watchlist item

### Alerts API

- `GET /api/alerts` - Get user's last 50 alerts

### Cron API

- `GET /api/cron/poll-prices` - Trigger price polling (requires `x-cron-secret` header)

## Database Schema

### Tables

1. **watchlists**: User watchlist items
2. **latest_prices**: Latest price for each symbol
3. **watchlist_state**: State tracking for edge-trigger logic
4. **alerts**: Alert history

See `supabase/migrations/20260202_initial_schema.sql` for full schema and RLS policies.

## Alert Logic

### Zone Detection

A price is "in zone" when:
- `price >= buy_min AND price <= buy_max` (both bounds set)
- `price >= buy_min` (only min set)
- `price <= buy_max` (only max set)

### Edge Triggering

Alerts only trigger when:
1. Price enters the buy zone (was out, now in)
2. Cooldown period has expired since last alert

Alerts do NOT trigger when:
- Price is already in zone (prevents spam)
- Price exits the zone
- Cooldown is active

### Cooldown

Prevents alert spam by enforcing a minimum time between alerts for the same watchlist item.

## Rate Limits

### Alpha Vantage Free Tier

- **5 API calls per minute**
- **500 API calls per day**

The app implements:
- 12-second throttling between requests
- Request caching per cron run
- Graceful handling of rate limit errors

## Troubleshooting

### Prices Not Updating

1. Check Vercel Cron is configured correctly
2. Verify `CRON_SECRET` is set in Vercel environment variables
3. Check Vercel Function logs for errors
4. Manually trigger cron endpoint to test

### Alerts Not Triggering

1. Verify watchlist item is **enabled**
2. Check buy zone is configured correctly
3. Ensure price is entering zone (not already in zone)
4. Check cooldown hasn't expired
5. Review alert logic tests: `npm test`

### Authentication Issues

1. Verify Supabase credentials in `.env.local`
2. Check Supabase Auth is enabled
3. Confirm email confirmation (check spam folder)
4. Review Supabase Auth logs

### Database Errors

1. Verify migration was run successfully
2. Check RLS policies are enabled
3. Review Supabase logs for errors

## Development Tips

### Testing Cron Locally

You can test the cron endpoint locally:

```bash
# Start dev server
npm run dev

# In another terminal, trigger cron
curl -X GET http://localhost:3000/api/cron/poll-prices \
  -H "x-cron-secret: your_cron_secret"
```

### Debugging Alpha Vantage

Check the console logs in the cron function for Alpha Vantage responses:

```typescript
console.log('Alpha Vantage response:', data);
```

### Database Queries

Use Supabase SQL Editor to query data:

```sql
-- Check latest prices
SELECT * FROM latest_prices ORDER BY updated_at DESC;

-- Check watchlist state
SELECT * FROM watchlist_state;

-- Check recent alerts
SELECT * FROM alerts ORDER BY triggered_at DESC LIMIT 10;
```

## Security Notes

1. **Never commit `.env.local`** - It's in `.gitignore`
2. **Protect CRON_SECRET** - Only share with Vercel
3. **Use SERVICE_ROLE_KEY carefully** - Only in server-side code
4. **RLS is enforced** - Users can only see their own data
5. **Cron endpoint is protected** - Requires secret header

## License

Internal use only.

## Support

For issues or questions, contact your team lead.
