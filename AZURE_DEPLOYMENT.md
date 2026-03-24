# Azure Static Web App Deployment Guide

This guide will help you deploy your Financial Dashboard to Azure as a static website.

## Prerequisites

1. An Azure account (create one at https://azure.microsoft.com/free/)
2. Azure CLI installed (https://docs.microsoft.com/cli/azure/install-azure-cli)
3. Node.js and npm/pnpm installed locally

## Deployment Methods

### Method 1: Deploy via Azure Portal (Recommended for Beginners)

1. **Build your application locally:**
   ```bash
   npm run build
   # or
   pnpm build
   ```

2. **Login to Azure Portal:**
   - Go to https://portal.azure.com
   - Sign in with your Azure account

3. **Create a Static Web App:**
   - Click "Create a resource"
   - Search for "Static Web App"
   - Click "Create"

4. **Configure your Static Web App:**
   - **Subscription:** Select your subscription
   - **Resource Group:** Create new or select existing
   - **Name:** Choose a unique name (e.g., `financial-dashboard`)
   - **Region:** Choose closest to you
   - **Deployment source:** Choose "Other" (for manual deployment)
   - Click "Review + Create" then "Create"

5. **Get deployment token:**
   - After creation, go to your Static Web App resource
   - Click on "Manage deployment token"
   - Copy the deployment token

6. **Deploy using Azure CLI:**
   ```bash
   # Install the Static Web Apps CLI
   npm install -g @azure/static-web-apps-cli

   # Deploy your built application
   swa deploy ./dist --deployment-token <YOUR_DEPLOYMENT_TOKEN>
   ```

### Method 2: Deploy via GitHub Actions (Automatic CI/CD)

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <YOUR_GITHUB_REPO_URL>
   git push -u origin main
   ```

2. **Create Static Web App with GitHub integration:**
   - In Azure Portal, create a Static Web App
   - Choose "GitHub" as deployment source
   - Sign in to GitHub and authorize Azure
   - Select your repository and branch
   - **Build Presets:** Select "Custom"
   - **App location:** `/`
   - **Api location:** (leave empty)
   - **Output location:** `dist`

3. **GitHub Actions will automatically:**
   - Build your application on every push
   - Deploy to Azure Static Web Apps
   - The workflow file will be added to `.github/workflows/`

### Method 3: Manual Upload via Azure CLI

1. **Login to Azure:**
   ```bash
   az login
   ```

2. **Create a resource group:**
   ```bash
   az group create --name financial-dashboard-rg --location eastus
   ```

3. **Create Static Web App:**
   ```bash
   az staticwebapp create \
     --name financial-dashboard \
     --resource-group financial-dashboard-rg \
     --location eastus
   ```

4. **Build and deploy:**
   ```bash
   # Build the application
   npm run build

   # Get deployment token
   az staticwebapp secrets list \
     --name financial-dashboard \
     --resource-group financial-dashboard-rg

   # Deploy
   swa deploy ./dist --deployment-token <TOKEN>
   ```

## Configuration Files

The following files are already configured for Azure deployment:

### `staticwebapp.config.json`
This file configures:
- SPA routing fallback (all routes redirect to index.html)
- CORS and security headers
- MIME types
- 404 handling for client-side routing

## Login Credentials

The application is password-protected:
- **Password:** `Henk&Elandri`
- No username required

**Important:** This is client-side authentication suitable for personal use. For production environments with sensitive data, implement server-side authentication.

## Post-Deployment

1. **Access your application:**
   - Your app will be available at: `https://<app-name>.azurestaticapps.net`

2. **Configure custom domain (optional):**
   - In Azure Portal, go to your Static Web App
   - Click "Custom domains"
   - Follow the instructions to add your domain

3. **Environment Variables:**
   - If you need to update Supabase credentials:
   - Go to Static Web App → Configuration
   - Add application settings (but note: for static sites, env vars must be embedded at build time)

## Updating Your Application

### Via GitHub Actions:
Simply push changes to your GitHub repository:
```bash
git add .
git commit -m "Update dashboard"
git push
```

### Manual deployment:
```bash
npm run build
swa deploy ./dist --deployment-token <YOUR_TOKEN>
```

## Troubleshooting

1. **404 errors on refresh:**
   - Ensure `staticwebapp.config.json` is in your build output
   - Check that `navigationFallback` is properly configured

2. **Build fails:**
   - Verify Node.js version matches your local environment
   - Check build logs in GitHub Actions or CLI output

3. **Supabase connection issues:**
   - Verify Supabase URL and API keys are correct
   - Check CORS settings in Supabase dashboard
   - Ensure API keys are embedded during build (not as runtime env vars)

## Security Notes

1. **Client-side authentication:** The password check happens in the browser. This is suitable for personal use but not for production apps with sensitive data.

2. **Supabase keys:** Make sure to use the "anon" public key, not the service role key, in your frontend code.

3. **HTTPS:** Azure Static Web Apps automatically provides HTTPS.

## Cost Estimation

- **Free tier:** Includes 100 GB bandwidth/month, suitable for personal use
- **Standard tier:** $9/month + bandwidth costs
- Details: https://azure.microsoft.com/pricing/details/app-service/static/

## Support

For issues with:
- **Azure deployment:** https://docs.microsoft.com/azure/static-web-apps/
- **Static Web Apps CLI:** https://github.com/Azure/static-web-apps-cli
- **This application:** Check application logs in browser console

## Quick Reference Commands

```bash
# Build application
npm run build

# Test locally before deploying
npx serve dist

# Deploy to Azure
swa deploy ./dist --deployment-token <TOKEN>

# Check deployment status
az staticwebapp show --name financial-dashboard --resource-group financial-dashboard-rg
```
