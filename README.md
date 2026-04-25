# Red Jitsu Training — Complete Training Tracker (Next.js + Supabase)

**Live app:** https://redjitsu.vercel.app/

A comprehensive training companion for both strength training and Brazilian Jiu-Jitsu. Features a sleek mobile-first design with a black/red theme, workout programs, progress tracking, and goal management. Built as a Progressive Web App (PWA) with offline capabilities.

## Features

### 🏋️ Strength Training
- **Quick Workout Logging**: Fast set recording with weight, reps, and set type (warmup/working)
- **Workout Programs**: Create and manage structured workout programs with scheduled days
- **Exercise Library**: Comprehensive database of exercises with custom exercise creation
- **Progress Tracking**: Weekly consistency goals and streak tracking
- **Templates**: Auto-load today's program or manually select from saved templates

### 🥋 Brazilian Jiu-Jitsu
- **Session Tracking**: Log training sessions with type (Class, Drilling, Open Mat)
- **Detailed Logging**: Track duration, intensity, and detailed notes
- **Goal Management**: Set and track weekly BJJ session goals
- **Mat Time Tracking**: Monitor total weekly training time

### 📊 Dashboard & Analytics  
- **Weekly Consistency**: Track progress toward weekly training goals
- **Streak Counter**: Visualize consecutive weeks meeting your goals
- **Progress Indicators**: On-track status and catch-up reminders
- **Recent Activity**: Quick access to recent workouts and sessions

### ⚙️ Additional Features
- **User Profiles**: Customizable units (lbs/kg) and goal settings
- **Password Management**: Secure password change functionality
- **Offline Support**: Full PWA capabilities with offline sync
- **Responsive Design**: Optimized for mobile and desktop use
- **Data Management**: Export capabilities and data deletion options

## Setup
1) Create Supabase project → run `supabase/schema.sql` in SQL Editor.
2) Copy `.env.local.example` → `.env.local` and paste your project URL & anon key.
3) `npm install` → `npm run dev` → http://localhost:3000
4) Sign in with your email (magic link).

## Deploy
1. Import your repository into Vercel
2. Add the same environment variables from your `.env.local`
3. Deploy the application
4. Access the app on your phone and use "Add to Home Screen" for the full PWA experience

## Tech Stack
- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Supabase (PostgreSQL database with real-time subscriptions)
- **Authentication**: Supabase Auth with email/password
- **Styling**: Custom design system with branded red accents
- **PWA**: Service Worker with offline caching and auto-updates
- **Deployment**: Optimized for Vercel deployment

## Browser Compatibility
- Modern browsers with JavaScript enabled
- Progressive Web App support recommended
- Mobile Safari and Chrome tested extensively
