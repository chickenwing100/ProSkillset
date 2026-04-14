# ProSkillset - Contractor Marketplace Platform

A modern SaaS platform connecting skilled contractors with clients who need their expertise.

## 🚀 Tech Stack

- **Frontend**: React 19 + Vite
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Auth)
- **Routing**: React Router DOM
- **State Management**: React Context API

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── JobPosting.jsx   # Job creation form
│   ├── JobFeed.jsx      # Job listings display
│   └── UserProfile.jsx  # User profile management
├── layouts/            # Layout components
│   ├── Navbar.jsx      # Public navigation
│   ├── Sidebar.jsx     # Dashboard navigation
│   ├── PublicLayout.jsx    # Public pages wrapper
│   └── DashboardLayout.jsx # Dashboard pages wrapper
├── pages/              # Page components
│   ├── Landing.jsx     # Marketing homepage
│   ├── HowItWorks.jsx  # Platform explanation
│   ├── ContractorSignup.jsx # Contractor registration
│   ├── Dashboard.jsx   # User dashboard
│   ├── ProjectFeed.jsx # Available projects
│   ├── Login.jsx       # Authentication
│   ├── Signup.jsx      # Client registration
│   └── Profile.jsx     # User profile page
├── context/            # React Context providers
│   ├── AuthContext.jsx # Authentication state
│   ├── JobsContext.jsx # Job management
│   └── ThemeContext.jsx # UI theming
├── lib/                # External service configurations
│   └── supabase.js     # Supabase client setup
├── hooks/              # Custom React hooks
├── services/           # API service functions
└── styles/             # Global styles
```

## 🛠️ Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd proskillset
npm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Copy `.env.example` to `.env` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Stripe billing and payouts are configured through Supabase Edge Function secrets, not the frontend `.env` file. Set these in your Supabase project before deploying billing:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set STRIPE_SOLO_PRICE_ID=price_xxx
supabase secrets set STRIPE_CREW_PRICE_ID=price_xxx
supabase secrets set STRIPE_BUILDER_PRICE_ID=price_xxx
```

Deploy these Edge Functions for billing:

```bash
supabase functions deploy create-subscription-checkout
supabase functions deploy create-connect-account-link
supabase functions deploy create-invoice-payment-session
supabase functions deploy stripe-webhook
```

### 3. Database Schema

Run the following SQL in your Supabase SQL editor:

```sql
-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'contractor')),
  bio TEXT,
  skills TEXT[],
  experience TEXT,
  portfolio JSONB,
  location TEXT,
  website TEXT,
  hourly_rate DECIMAL,
  company TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  budget DECIMAL NOT NULL,
  category TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create applications table
CREATE TABLE public.applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, contractor_id)
);

-- Set up Row Level Security policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Jobs policies
CREATE POLICY "Anyone can view open jobs" ON public.jobs
  FOR SELECT USING (status = 'open');

CREATE POLICY "Clients can view their own jobs" ON public.jobs
  FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Clients can create jobs" ON public.jobs
  FOR INSERT WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can update their own jobs" ON public.jobs
  FOR UPDATE USING (client_id = auth.uid());

-- Applications policies
CREATE POLICY "Contractors can view applications they created" ON public.applications
  FOR SELECT USING (contractor_id = auth.uid());

CREATE POLICY "Clients can view applications for their jobs" ON public.applications
  FOR SELECT USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "Contractors can create applications" ON public.applications
  FOR INSERT WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "Clients can update applications for their jobs" ON public.applications
  FOR UPDATE USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE client_id = auth.uid()
    )
  );

-- Create function to handle user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'role', 'client'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 4. Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Build for Production

```bash
npm run build
npm run preview
```

## 🎨 Features

### Public Pages
- **Landing Page**: Hero section with call-to-actions
- **How It Works**: Step-by-step platform explanation
- **Authentication**: Separate signup flows for clients and contractors

### Dashboard Features
- **Role-based UI**: Different interfaces for clients vs contractors
- **Job Management**: Post jobs, browse opportunities, apply to projects
- **Profile Management**: Complete user profiles with skills and portfolio
- **Project Feed**: Filterable list of available projects
- **Responsive Design**: Works on desktop and mobile devices

### Technical Features
- **Real-time Updates**: Live data synchronization
- **Secure Authentication**: Supabase Auth integration
- **File Uploads**: Photo attachments for job postings
- **Search & Filtering**: Category-based project filtering
- **Modern UI**: Clean, professional design with Tailwind CSS

## 🔐 Authentication

The app supports two user roles:
- **Clients**: Can post jobs and manage applications
- **Contractors**: Can browse jobs and submit applications

## 📱 Responsive Design

The application is fully responsive and works seamlessly across:
- Desktop computers
- Tablets
- Mobile phones

## 🚀 Deployment

The app can be deployed to any static hosting service like Vercel, Netlify, or Cloudflare Pages.

1. Build the project: `npm run build`
2. Deploy the `dist` folder to your hosting provider
3. Set environment variables in your hosting platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
