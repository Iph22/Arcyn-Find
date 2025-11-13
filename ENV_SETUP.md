# Environment Variables Setup

To enable pulling data from external sources, you need to set up API keys.

## Required Steps

1. **Create a `.env.local` file** in the root of your project

2. **Add the following environment variables** (all are optional, but recommended):

```bash
# Hugging Face API Key (optional but recommended)
# Get one at: https://huggingface.co/settings/tokens
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# GitHub Personal Access Token (optional but recommended)
# Get one at: https://github.com/settings/tokens
# Needs: public_repo scope
GITHUB_TOKEN=your_github_token_here

# Cron Secret (optional, for securing the cron endpoint)
# Generate a random string for this
CRON_SECRET=your_random_secret_here
```

## How to Get API Keys

### Hugging Face API Key
1. Go to https://huggingface.co/settings/tokens
2. Click "New token"
3. Give it a name (e.g., "arcyn-find")
4. Select "Read" permissions
5. Copy the token and add it to `.env.local`

### GitHub Token
1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name (e.g., "arcyn-find")
4. Select the `public_repo` scope
5. Click "Generate token"
6. Copy the token and add it to `.env.local`

### Cron Secret
Generate any random string, for example:
```bash
# Using openssl
openssl rand -hex 32

# Or just use a long random string
CRON_SECRET=my-super-secret-random-string-12345
```

## Notes

- **Without API keys**: The system will still work but will only fetch from sources that don't require authentication (Papers with Code, ArXiv)
- **With API keys**: You'll get more data and higher rate limits
- **Never commit `.env.local`**: It's already in `.gitignore`

## Testing

After setting up your `.env.local` file:
1. Restart your development server (`npm run dev`)
2. Visit `/api/ai-models` to see the fetched data
3. Check the browser console for any errors

