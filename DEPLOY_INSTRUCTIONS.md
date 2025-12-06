## Railway Deployment Checklist

Set these environment variables in the Railway dashboard for the project and services:

- `ENVIRONMENT=production`
- `DATABASE_URL` (from Railway Postgres plugin)
- `REDIS_URL` (from Railway Redis plugin)
- `PADDLE_API_KEY` (placeholder)
- `PADDLE_VENDOR_ID` (placeholder)
- `PADDLE_PUBLIC_KEY` (placeholder)
- `PADDLE_WEBHOOK_SECRET` (placeholder)

Notes:
- Gateway service uses `PORT` provided by Railway automatically (default to 8000 locally).
- Worker service needs `REDIS_URL` and any other shared vars you use (e.g., Paddle, ENVIRONMENT) if required by business logic.
