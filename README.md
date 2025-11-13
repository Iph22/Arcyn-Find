# Arcyn Find - AI Tools Discovery Platform

> **Discover, search, and explore AI tools, models, platforms, and research worldwide.**

A modern web application built with [Next.js](https://nextjs.org), [React](https://react.dev), and [Tailwind CSS](https://tailwindcss.com) that helps users find and learn about AI tools across different categories, regions, and access types.

## 🌟 Features

- **AI Tool Search & Discovery** - Search by name, tags, and keywords
- **Advanced Filtering** - Filter by category, region, access type (Free/Freemium/Paid)
- **Trending Section** - Discover popular and trending AI tools
- **Detailed Tool Information** - View comprehensive details about each AI tool
- **Light/Dark Theme** - Toggle between light and dark themes
- **Responsive Design** - Fully responsive across all devices
- **Accessible UI** - WCAG compliant with proper ARIA labels
- **Smooth Animations** - Framer Motion animations for enhanced UX
- **SEO Optimized** - Proper metadata, sitemap, and robots.txt
- **Performance Optimized** - Static generation and image optimization

## 🚀 Quick Start

### Prerequisites

- Node.js 18.x or higher
- npm, yarn, or pnpm

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

3. **Run the development server**
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
.
├── app/
│   ├── layout.tsx          # Root layout with theme provider
│   ├── page.tsx            # Main page with search and filtering logic
│   ├── loading.tsx         # Loading UI component
│   ├── error.tsx           # Error boundary
│   ├── globals.css         # Global styles
│   └── sitemap.xml/        # Dynamic sitemap generation
├── components/
│   ├── ai-card.tsx         # Individual AI tool card
│   ├── ai-modal.tsx        # Detailed tool information modal
│   ├── filter-bar.tsx      # Filter controls
│   ├── hero-section.tsx    # Hero section with background
│   ├── search-bar.tsx      # Search input
│   ├── theme-toggle.tsx    # Theme switcher
│   ├── trending-section.tsx # Trending tools section
│   └── typeout-background.tsx # Animated background
├── lib/
│   ├── ai-data.ts          # AI tools database
│   ├── sitemap.ts          # Sitemap generation utilities
│   └── utils.ts            # Utility functions
├── public/
│   ├── robots.txt          # SEO robots configuration
│   └── [icons & assets]
├── .github/
│   └── workflows/
│       └── ci-cd.yml       # GitHub Actions CI/CD pipeline
├── .prettierrc             # Code formatting configuration
├── tsconfig.json           # TypeScript configuration
├── next.config.ts          # Next.js configuration
└── package.json            # Dependencies and scripts
```

## 🛠️ Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Run production build locally
npm start

# Lint code
npm run lint

# Format code with Prettier
npm run format
```

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file if needed:
```bash
# .env.local
# Add your environment variables here
```

### Theme Configuration

The app uses `next-themes` for theme management. The theme persists in localStorage and respects system preferences.

### Metadata & SEO

- **Site Title**: Arcyn Find - Discover AI Tools Worldwide
- **Sitemap**: `/sitemap.xml` (dynamically generated)
- **Robots.txt**: `/robots.txt` (configured for optimal crawling)

## 🎨 Customization

### Adding New AI Tools

Edit `lib/ai-data.ts` and add entries to the `aiEntries` array:

```typescript
{
  id: "your-id",
  name: "AI Tool Name",
  category: "Category",
  description: "Description",
  platform: "https://example.com",
  region: "USA",
  accessType: "Free" | "Freemium" | "Paid",
  pricing: "Free / $XX/month",
  tags: ["tag1", "tag2"],
  popularity: 85,
  lastUpdated: "2025-11-13",
  isTrending: false,
}
```

### Styling

The project uses Tailwind CSS with a custom design system. Global styles are in `app/globals.css`.

Color scheme:
- **Light Mode**: Clean whites and light grays
- **Dark Mode**: Deep darks with accent colors
- **Accent**: Primary brand color for CTAs

## 📱 Responsive Design

The app is fully responsive with breakpoints:
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

## ♿ Accessibility

The project follows WCAG 2.1 AA standards:
- Semantic HTML
- ARIA labels and descriptions
- Keyboard navigation support
- Focus management
- Color contrast compliance
- Alternative text for images

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**
```bash
git push origin main
```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Deploy automatically

### Manual Deployment

```bash
npm run build
npm start
```

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

## 🐛 Known Issues & Roadmap

- [ ] Add advanced search with filters
- [ ] Implement pagination for large datasets
- [ ] Add user authentication
- [ ] Create admin dashboard for tool management
- [ ] Add tool reviews and ratings
- [ ] Implement API endpoints for tool data
- [ ] Add analytics dashboard

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👤 Author

**Iph22**
- GitHub: [@Iph22](https://github.com/Iph22)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Support

If you have any questions or need support, please open an issue on GitHub.

---

**Built with ❤️ using Next.js, React, and Tailwind CSS**

