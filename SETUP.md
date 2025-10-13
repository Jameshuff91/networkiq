# SynkUp Beta Landing Page Setup Guide

## Overview
This is a landing page for SynkUp beta testing program that collects user emails and provides information about Android and iOS testing programs.

## Features
- ✅ Beautiful landing page with SynkUp branding
- ✅ Email signup form that sends submissions to your Gmail
- ✅ Information cards about Android Internal Test and iOS TestFlight
- ✅ WhatsApp group join button
- ✅ Visitor counter and signup tracking
- ✅ Admin view to see statistics
- ✅ Fully responsive design

## Quick Setup (5 minutes)

### Step 1: Set up Formspree for Email Collection

1. Go to [Formspree.io](https://formspree.io)
2. Sign up/login with your email: jamesdanielhuff@gmail.com
3. Click "New Form"
4. Name your form "SynkUp Beta Signups"
5. Copy your form endpoint (looks like: `https://formspree.io/f/YOUR_FORM_ID`)

### Step 2: Configure the Landing Page

Edit `index.html` and replace the following:

1. **Formspree Endpoint** (Line ~365):
   ```javascript
   const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID';
   ```
   Replace `YOUR_FORM_ID` with your actual Formspree form ID

2. **WhatsApp Group Link** (Line ~366):
   ```javascript
   const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/YOUR_GROUP_INVITE_LINK';
   ```
   Replace with your actual WhatsApp group invite link

### Step 3: Deploy to GitHub Pages

1. Create a new GitHub repository named `synkup-beta` (or any name you prefer)

2. Push the docs folder to GitHub:
   ```bash
   cd /Users/jimhuff/synkup
   git init (if not already a git repo)
   git add docs/
   git commit -m "Add SynkUp beta landing page"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/synkup-beta.git
   git push -u origin main
   ```

3. Enable GitHub Pages:
   - Go to your repository Settings
   - Scroll to "Pages" section
   - Source: "Deploy from a branch"
   - Branch: "main"
   - Folder: "/docs"
   - Click "Save"

4. Your site will be available at:
   `https://YOUR_USERNAME.github.io/synkup-beta/`

### Step 4: Test Everything

1. **Visit your site**: Check that the page loads correctly
2. **Test signup**: Submit a test email to ensure you receive it
3. **Check admin view**: Add `?admin=true` to your URL to see visitor stats
4. **Test WhatsApp link**: Ensure it opens your group correctly

## Admin Features

### View Statistics
Access admin stats by adding `?admin=true` to your URL:
```
https://YOUR_USERNAME.github.io/synkup-beta/?admin=true
```

This shows:
- Total page views
- Total signups

## Email Management

All form submissions will be sent to jamesdanielhuff@gmail.com through Formspree. You'll receive:
- User's full name
- User's email address
- Timestamp of submission

### Formspree Features:
- Spam protection built-in
- Email notifications for each submission
- CSV export of all submissions
- No server-side code needed

## Alternative: Using EmailJS (Optional)

If you prefer EmailJS over Formspree:

1. Go to [EmailJS.com](https://emailjs.com)
2. Create account and set up Gmail service
3. Create an email template
4. Replace the form submission code with EmailJS integration

## Customization Options

### Change Colors
The site uses a purple gradient theme. To change colors, modify the CSS variables in the `<style>` section:
- Primary gradient: `#667eea` to `#764ba2`
- Background: `#0a0e27` to `#1a1f3a`

### Add More Information
You can add more cards in the `.info-cards` section to provide additional information about your app.

### Modify Form Fields
Add more fields to the form by adding new `.form-group` divs with appropriate inputs.

## Tracking & Analytics

The page uses CountAPI for basic tracking:
- Automatically tracks page views
- Tracks successful signups
- Data persists across sessions
- No authentication required

## Troubleshooting

### Emails not being received:
1. Check Formspree dashboard for submissions
2. Check spam folder
3. Verify form endpoint is correct
4. Test with different email addresses

### WhatsApp link not working:
1. Ensure you've created a WhatsApp group
2. Generate a proper invite link from WhatsApp
3. Make sure the link hasn't expired

### Counter not working:
- CountAPI might be down temporarily
- The counters will still work but may show 0 initially

## File Structure
```
docs/
├── index.html           # Main landing page
├── synkup-hero.png     # Marketing image
└── SETUP.md            # This setup guide
```

## Next Steps

After setup:
1. Share your landing page URL with potential beta testers
2. Monitor signups through Formspree dashboard
3. Send TestFlight/Play Store invites to registered users
4. Engage with users in the WhatsApp group
5. Collect feedback and iterate

## Support

For any issues with the landing page, check:
- Browser console for JavaScript errors
- Network tab for failed requests
- Formspree documentation for email issues

---

Good luck with your SynkUp beta testing program! 🚀