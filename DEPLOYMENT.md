# Arcyn Find - Deployment Guide

## 🚀 Pre-Deployment Checklist

### Environment Variables
Ensure all required environment variables are set:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Optional
NEXT_PUBLIC_GOOGLE_VERIFICATION=your_google_verification_code
CRON_SECRET=your_cron_secret
```

### Build & Deploy

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Generate AI Tool Images** (Optional but recommended)
   ```bash
   npm run generate-images
   ```
   Note: Requires `canvas` package. Install with:
   ```bash
   npm install canvas --save-dev
   ```

3. **Build for Production**
   ```bash
   npm run build
   ```

4. **Test Production Build Locally**
   ```bash
   npm start
   ```

5. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

## 📱 Mobile App Deployment

### iOS (App Store)

1. **Prepare Assets**
   - App icon: 1024x1024px PNG
   - Screenshots for iPhone and iPad
   - See `app-store-config.json` for details

2. **Build with Expo** (if using Expo)
   ```bash
   npx expo build:ios
   ```

3. **Submit to App Store**
   - Use App Store Connect
   - Follow `app-store-config.json` for metadata

### Android (Play Store)

1. **Prepare Assets**
   - App icon: 512x512px PNG
   - Feature graphic: 1024x500px PNG
   - Screenshots for phone and tablet
   - See `play-store-config.json` for details

2. **Build APK/AAB**
   ```bash
   npx expo build:android
   ```

3. **Submit to Play Store**
   - Use Google Play Console
   - Follow `play-store-config.json` for metadata

## 🔧 PWA Configuration

The app is configured as a Progressive Web App (PWA):

- **Service Worker**: `public/sw.js` (auto-registered)
- **Manifest**: `app/manifest.ts` (auto-generated)
- **Offline Support**: Enabled via service worker
- **Install Prompt**: Automatic on supported browsers

## 📊 Analytics & Monitoring

- **Vercel Analytics**: Automatically enabled
- **Error Tracking**: Configure in `app/error.tsx`
- **Performance**: Monitor via Vercel dashboard

## 🔍 SEO Optimization

- **Sitemap**: Auto-generated at `/sitemap.xml`
- **Robots.txt**: Located at `public/robots.txt`
- **Meta Tags**: Configured in `app/layout.tsx`
- **Open Graph**: Enabled for social sharing

## 🎨 Image Generation

To generate images for AI tools:

```bash
npm run generate-images
```

This will:
- Fetch AI tools from Supabase
- Generate OG images (1200x630px) for each tool
- Save to `public/ai-tools/` directory

**Requirements:**
- Node.js with Canvas support
- Supabase connection configured

## 📝 Post-Deployment

1. **Verify Service Worker**
   - Check browser DevTools > Application > Service Workers
   - Should show "activated and running"

2. **Test PWA Installation**
   - Visit site on mobile device
   - Look for "Add to Home Screen" prompt

3. **Verify Analytics**
   - Check Vercel Analytics dashboard
   - Ensure events are being tracked

4. **Test Authentication**
   - Test email/password sign-in
   - Test OAuth (Google/GitHub)
   - Verify callback redirects

5. **Check Mobile Responsiveness**
   - Test on various devices
   - Verify touch interactions
   - Check safe area insets (iOS)

## 🐛 Troubleshooting

### Service Worker Not Registering
- Check browser console for errors
- Verify `sw.js` is accessible at `/sw.js`
- Clear browser cache and retry

### Images Not Loading
- Verify image generation script ran successfully
- Check `public/ai-tools/` directory exists
- Ensure images are committed to repository

### Authentication Issues
- Verify Supabase environment variables
- Check OAuth redirect URLs in Supabase dashboard
- Ensure callback route is accessible

### Build Errors
- Clear `.next` directory: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run lint`

## 📚 Additional Resources

- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Play Store Policies](https://play.google.com/about/developer-content-policy/)

