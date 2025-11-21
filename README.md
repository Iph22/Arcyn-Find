# Arcyn Find - AI Tools Discovery Platform

> **Discover, search, and explore AI tools, models, platforms, and research worldwide.**

A modern web application built with [Next.js](https://nextjs.org), [React](https://react.dev), [Supabase](https://supabase.com), and [Tailwind CSS](https://tailwindcss.com) that helps users find and learn about AI tools across different categories, regions, and access types.

## 🌟 Features

### Core Features
- **🔍 Advanced AI Tool Search** - Search by name, tags, keywords with fuzzy matching and typo tolerance
- **🏷️ Advanced Filtering** - Filter by category, region, access type (Free/Freemium/Paid)
- **📊 Trending Section** - Real-time trending AI tools from multiple sources
- **📱 Detailed Tool Information** - Comprehensive details about each AI tool
- **⭐ Similar Tools** - AI-powered recommendations for similar tools
- **💚 Favorites System** - Save and manage favorite tools
- **🔗 Tool Comparison** - Side-by-side comparison of up to 3 tools
- **📤 Export Functionality** - Export favorites and comparisons (CSV, JSON, PDF)

### Search Features
- **Fuzzy Search** - Handles typos and misspellings (70% similarity threshold)
- **Search Suggestions** - Real-time autocomplete with keyboard navigation
- **Text Highlighting** - Highlights matching text in results
- **Search History** - Stores last 10 searches in localStorage
- **Advanced Operators** - Support for `tag:`, `category:`, `region:`, `access:`, `AND`, `OR`, `NOT`
- **Relevance-Based Sorting** - Results sorted by relevance score
- **Voice Search** - Web Speech API integration
- **Image Search** - OCR-based image search

### User Features
- **👤 User Authentication** - Email, Google OAuth, GitHub OAuth
- **⭐ Reviews & Ratings** - 1-5 star ratings with helpfulness voting
- **📚 Collections/Playlists** - Create and manage tool collections
- **💰 Pricing History** - Track pricing changes over time
- **🔔 Price Alerts** - Get notified when prices change
- **👥 Community Features** - Follow users, activity feed, leaderboards
- **📈 User Statistics** - Track views, reviews, collections

### Data & Analytics
- **🔄 Real-Time Data Fetching** - Automatically pulls from multiple sources:
  - Hugging Face (models, downloads, popularity)
  - Papers with Code (research papers and implementations)
  - ArXiv (latest research papers)
  - GitHub (open-source AI models)
  - RSS Feeds (tech news, AI blogs)
  - Aggregators (There's An AI For That, Futurepedia)
  - Web Scrapers (AI tool directories)
  - Community Sources (Reddit, Hacker News)
- **📊 Trending Algorithm** - Combines local views (40%) with online trending (60%)
- **🏥 Tool Health Monitoring** - Check platform availability and response times
- **📈 View Tracking** - Track tool views for trending calculations

### UI/UX
- **🌓 Light/Dark Theme** - Toggle between themes with system preference detection
- **📱 Responsive Design** - Fully responsive across all devices
- **♿ Accessible** - WCAG 2.1 AA compliant with proper ARIA labels
- **🎨 Smooth Animations** - Framer Motion animations for enhanced UX
- **⌨️ Keyboard Shortcuts** - `/` to focus search, `Esc` to unfocus
- **📜 Infinite Scroll** - Option for infinite scroll or pagination
- **🔄 Loading States** - Skeleton loaders and loading indicators
- **🔔 Toast Notifications** - User-friendly feedback messages

### SEO & Performance
- **🔍 SEO Optimized** - Proper metadata, sitemap, robots.txt, structured data
- **⚡ Performance Optimized** - Static generation, image optimization, code splitting
- **📱 PWA Support** - Progressive Web App with offline support
- **🌐 Dynamic Sitemap** - Automatically generated sitemap for all tools
- **📊 Rich Snippets** - JSON-LD structured data for better search results

## 🚀 Quick Start

### Prerequisites

- Node.js 18.x or higher
- npm, yarn, or pnpm
- Supabase account (for full functionality)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Iph22/Arcyn-Find.git
cd arcyn-find
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional: External API Keys
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
GITHUB_TOKEN=your_github_token_here
CRON_SECRET=your_random_secret_here

# Site URL (for OAuth redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

4. **Set up Supabase Database**

   a. Go to your Supabase project dashboard
   
   b. Navigate to **SQL Editor**
   
   c. Run the base schema:
      - Copy and paste contents of `supabase/schema.sql`
      - Click **Run**
   
   d. Run the complete schema (for all features):
      - Copy and paste contents of `supabase/complete-schema.sql`
      - Click **Run**

5. **Migrate data (optional)**

If you have existing data in `public/ai-data.json`:

```bash
npm run migrate:supabase
```

6. **Run the development server**
```bash
npm run dev
```

7. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
.
├── app/
│   ├── layout.tsx              # Root layout with theme provider
│   ├── page.tsx                # Main page with search and filtering
│   ├── ai/[id]/                # AI tool detail pages
│   ├── api/                    # API routes
│   │   ├── ai-models/          # Main API endpoint
│   │   ├── trending/           # Trending tools API
│   │   ├── reviews/            # Reviews API
│   │   └── cron/               # Cron jobs for data fetching
│   ├── collections/            # Collections pages
│   ├── profile/                # User profile pages
│   └── auth/                   # Authentication pages
├── components/
│   ├── ai-card.tsx             # Individual AI tool card
│   ├── enhanced-search-bar.tsx # Advanced search bar
│   ├── reviews-section.tsx     # Reviews UI
│   ├── collections-section.tsx # Collections UI
│   ├── pricing-history.tsx     # Pricing history UI
│   └── ...                     # Other components
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── ai-data.ts              # AI tools data types
│   ├── search-utils.ts         # Search utilities
│   ├── reviews.ts              # Review management
│   ├── collections.ts          # Collection management
│   ├── pricing.ts              # Pricing tracking
│   ├── auth.ts                 # Authentication
│   ├── community.ts            # Community features
│   └── ...                     # Other utilities
├── scripts/
│   ├── fetch-from-all-sources.ts  # Fetch from all sources
│   ├── migrate-to-supabase.ts     # Data migration
│   └── sources/                    # Data source scripts
├── supabase/
│   ├── schema.sql              # Base database schema
│   └── complete-schema.sql     # Complete schema with all features
├── public/
│   ├── robots.txt              # SEO robots configuration
│   ├── manifest.json           # PWA manifest
│   └── ...                     # Static assets
└── package.json
```

## 🛠️ Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Run production build locally

# Code Quality
npm run lint             # Lint code with ESLint
npm run format           # Format code with Prettier

# Data Management
npm run migrate:supabase # Migrate JSON data to Supabase
npm run fetch:all-sources # Fetch from all external sources
npm run add:new-models   # Add new AI models manually
```

## 🔧 Configuration

### Environment Variables

See `.env.local` setup above. All variables are optional except Supabase credentials for full functionality.

### OAuth Setup

1. **Google OAuth**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
   - Add Client ID and Secret to Supabase Dashboard → Authentication → Providers → Google

2. **GitHub OAuth**
   - Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
   - Create new OAuth App
   - Set callback URL: `https://your-project.supabase.co/auth/v1/callback`
   - Add Client ID and Secret to Supabase Dashboard → Authentication → Providers → GitHub

3. **Set Redirect URLs in Supabase**
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/auth/callback`

See `OAUTH_SETUP.md` for detailed instructions.

### Database Schema

The database uses two schema files:

1. **`supabase/schema.sql`** - Base schema with `ai_tools` table
2. **`supabase/complete-schema.sql`** - Complete schema with all features:
   - User profiles
   - Reviews & ratings
   - Collections
   - Pricing history
   - Price alerts
   - User follows
   - Activity feed
   - User statistics

Both schemas are idempotent and safe to run multiple times.

## 📊 API Endpoints

### Main API

```
GET /api/ai-models
```

Query parameters:
- `id` - Get specific tool by ID
- `category` - Filter by category
- `region` - Filter by region
- `accessType` - Filter by access type (Free/Freemium/Paid)
- `search` - Full-text search
- `limit` - Number of results (default: 500, max: 1000)
- `offset` - Pagination offset (default: 0)

Examples:
```
GET /api/ai-models?category=Generative AI&limit=25
GET /api/ai-models?search=gpt&limit=50
GET /api/ai-models?id=tool-id-123
```

### Trending API

```
GET /api/trending
```

Returns real-time trending tools from multiple sources (Product Hunt, Hacker News, Reddit, GitHub, etc.)

### Reviews API

```
GET /api/reviews?toolId=xxx
POST /api/reviews
PUT /api/reviews/:id
DELETE /api/reviews/:id
```

### Cron Jobs

```
GET /api/cron/fetch-tools?secret=xxx
```

Automatically fetches from all sources. Configured in `vercel.json` to run daily.

## 🎨 Customization

### Adding New AI Tools

1. **Via Script** (Recommended):
```bash
npm run add:new-models
```

2. **Via API**:
   - Use Supabase dashboard
   - Or create a script using `lib/supabase.ts`

3. **Via External Sources**:
```bash
npm run fetch:all-sources
```

### Styling

The project uses Tailwind CSS with a custom design system. Global styles are in `app/globals.css`.

Color scheme:
- **Light Mode**: Clean whites and light grays
- **Dark Mode**: Deep darks with accent colors
- **Accent**: Primary brand color for CTAs

### Adding New Data Sources

1. Create a new function in `scripts/sources/` (e.g., `scripts/sources/my-source.ts`)
2. Add it to `scripts/fetch-from-all-sources.ts`
3. Transform results to `AIEntry` format
4. Run `npm run fetch:all-sources`

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**
```bash
git push origin main
```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Add environment variables
   - Deploy automatically

3. **Configure Cron Jobs**

The `vercel.json` file includes cron job configuration for automatic data fetching.

### Manual Deployment

```bash
npm run build
npm start
```

### App Store Deployment

See `APP_STORE_DEPLOYMENT.md` for instructions on deploying to Google Play Store and Apple App Store as a PWA.

## 🔄 CI/CD Pipeline

GitHub Actions workflow automatically:
- Runs on push to `main` and `develop` branches
- Tests with Node.js 18.x and 20.x
- Lints code with ESLint
- Type checks with TypeScript
- Builds the application
- Deploys to Vercel (on main branch)

See `.github/workflows/ci-cd.yml` for details.

## 📊 Performance

- **Lighthouse Score**: Aiming for 90+ across all metrics
- **Core Web Vitals**: Optimized for speed and interactivity
- **Static Generation**: Pages pre-rendered at build time
- **Image Optimization**: Next.js Image component for optimal loading
- **Code Splitting**: Lazy loading for better initial load
- **Caching**: API responses cached for optimal performance

## 🐛 Troubleshooting

### Database Issues

**Migration fails?**
- Check that the `ai_tools` table exists
- Verify your service role key is correct
- Check Supabase logs for errors

**API returns empty?**
- Verify Row Level Security policy allows SELECT
- Check that data was migrated successfully
- Look at browser console and server logs

**Slow queries?**
- Ensure indexes were created (check in Supabase dashboard)
- Use `limit` parameter to reduce result size
- Check query performance in Supabase dashboard

### Authentication Issues

**OAuth not working?**
- Check OAuth credentials in Supabase dashboard
- Verify redirect URL is set correctly
- Check browser console for errors

**Users not being created?**
- Check that the `user_profiles` table exists
- Verify RLS policies allow profile creation
- Check browser console for errors

### Search Issues

**No results?**
- Check search query syntax
- Verify data exists in database
- Check browser console for errors

**Slow search?**
- Normal for large datasets
- Consider adding more indexes
- Use `limit` parameter

### General Issues

**Build errors?**
- Run `npm install` to ensure dependencies are installed
- Check Node.js version (18.x or higher)
- Clear `.next` folder and rebuild

**TypeScript errors?**
- Run `npm run lint` to see all errors
- Check that all types are properly imported
- Verify `tsconfig.json` configuration

## 📝 Features Status

### ✅ Fully Working
- Search functionality
- Filtering (category, region, access type)
- Sorting and popularity filters
- Similar tools algorithm
- Tool health monitoring
- Voice search
- Image search
- Export favorites (CSV & JSON)
- Export comparison (CSV, JSON, PDF)
- Trending section
- Favorites system
- Comparison tools
- Reviews & Ratings (requires database setup)
- Collections (requires database setup)
- Pricing History (requires database setup)
- User Authentication (requires Supabase Auth setup)

### ⚠️ Requires Setup
- Reviews & Ratings (needs `tool_reviews` table)
- Collections (needs `collections` table)
- Pricing History (needs `pricing_history` table)
- User Authentication (needs Supabase Auth configured)
- User Profiles (needs `user_profiles` table)
- Activity Feed (needs `user_activities` table)
- Following Users (needs `user_follows` table)

## 📚 Documentation

- **Quick Start**: See installation steps above
- **OAuth Setup**: See OAuth Setup section above
- **Database Schema**: See `supabase/` directory
- **API Documentation**: See API Endpoints section above
- **Scripts Documentation**: See `scripts/README.md`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👤 Author

**Iph22**
- GitHub: [@Iph22](https://github.com/Iph22)

## 📧 Support

If you have any questions or need support, please open an issue on GitHub.

---

**Built with ❤️ using Next.js, React, Supabase, and Tailwind CSS**
