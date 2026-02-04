# CloudedDeals Documentation

## Project Overview

CloudedDeals is a deal-tracking platform consisting of:

- **Scraper** — Python Playwright-based web scraper that collects deal data and stores it in Supabase
- **Frontend** — Next.js 14 React application with TypeScript and Tailwind CSS
- **Supabase** — PostgreSQL database with migrations managed via Supabase CLI

## Getting Started

### Scraper

```bash
cd clouded-deals/scraper
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install
cp .env.example .env  # fill in your Supabase credentials
python main.py
```

### Frontend

```bash
cd clouded-deals/frontend
npm install
cp .env.example .env.local  # fill in your Supabase credentials
npm run dev
```

### Supabase

Migrations live in `clouded-deals/supabase/migrations/`. Apply them using the Supabase CLI:

```bash
supabase db push
```
