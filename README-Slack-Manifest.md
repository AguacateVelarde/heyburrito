# HeyBurrito Slack App Manifest

This document explains how to use the Slack app manifest to easily install and configure the HeyBurrito app in your Slack workspace.

## What is a Slack App Manifest?

A Slack app manifest is a JSON or YAML configuration file that contains all the settings needed to create and configure a Slack app <mcreference link="https://api.slack.com/reference/manifests" index="1">1</mcreference>. It allows you to quickly set up the app with predefined permissions, slash commands, and event subscriptions.

## Quick Installation

### Method 1: Using the Slack App Directory

1. **Copy the manifest content** from `manifest.json` in this repository
2. **Go to [Slack API Portal](https://api.slack.com/apps)** <mcreference link="https://api.slack.com/reference/manifests" index="1">1</mcreference>
3. **Click "Create New App"**
4. **Select "From an app manifest"**
5. **Choose your development workspace**
6. **Paste the manifest JSON** in the input field
7. **Click "Next" and then "Create"**

### Method 2: Direct Installation Link

You can also use this direct installation link (replace `YOUR_ENCODED_MANIFEST` with the URL-encoded version of the manifest):

```
https://api.slack.com/apps?new_app=1&manifest_json=YOUR_ENCODED_MANIFEST
```

## Required Configuration

After creating the app from the manifest, you'll need to:

### 1. Update Request URLs

Replace `https://your-domain.com` in the manifest with your actual domain:

- **Event Subscriptions URL**: `https://your-domain.com/slack/events`
- **Slash Commands URL**: `https://your-domain.com/slack/commands`
- **OAuth Redirect URL**: `https://your-domain.com/slack/auth`

### 2. Install the App

1. Go to **"OAuth & Permissions"** in your app settings
2. Click **"Install to Workspace"**
3. Authorize the requested permissions
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### 3. Configure Environment Variables

Add these to your `.env` file:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_DEFAULT_CHANNEL=general

# Birthdays module (see README-Birthdays.md)
ENABLE_BIRTHDAYS=true
BIRTHDAY_CHANNEL=general
BIRTHDAY_CRON=0 9 * * *
BIRTHDAY_TIMEZONE=America/Mexico_City
```

You can find the signing secret in **"Basic Information" > "App Credentials"**.

## App Features Configured

The manifest configures the following features <mcreference link="https://api.slack.com/concepts/manifests" index="2">2</mcreference>:

### Slash Commands
- **`/burrito @username [message]`** - Give a burrito to a team member
- **`/leaderboard`** - View the burrito leaderboard
- **`/cumpleanos`** (alias **`/birthday`**) - Manage team birthdays and greet whoever is celebrating. See [the birthdays guide](./README-Birthdays.md).

### Event Subscriptions
- **Message events** - Listen for burrito-related messages
- **Reaction events** - Track emoji reactions for burrito giving
- **App Home events** - Handle app home interactions

### Bot Permissions
- Read and write messages in channels, groups, and DMs
- Read user information and email addresses
- Add and read reactions
- Execute slash commands

### App Home
- **Home tab enabled** - Custom app home experience
- **Messages tab enabled** - Direct messaging with the bot

## Development vs Production

### Development Setup
- Use ngrok or similar tool to expose your local server
- Update manifest URLs to point to your ngrok URL
- Set `NODE_ENV=development` in your environment

### Production Setup
- Deploy your app to a production server
- Update manifest URLs to point to your production domain
- Ensure HTTPS is enabled for all endpoints
- Set `NODE_ENV=production` in your environment

## Troubleshooting

### Common Issues

1. **"Invalid manifest" error** <mcreference link="https://api.slack.com/methods/apps.manifest.create" index="4">4</mcreference>
   - Check JSON syntax and formatting
   - Ensure all required fields are present
   - Verify URLs are properly formatted

2. **"Request URL verification failed"**
   - Ensure your server is running and accessible
   - Check that the `/slack/events` endpoint responds correctly
   - Verify your signing secret is correct

3. **"Slash commands not working"**
   - Confirm the `/slack/commands` endpoint is accessible
   - Check that your app has the `commands` scope
   - Verify the command URLs in the manifest

### Validation

You can validate your manifest using the Slack API <mcreference link="https://api.slack.com/methods/apps.manifest.create" index="4">4</mcreference>:

```bash
curl -X POST https://slack.com/api/apps.manifest.validate \
  -H "Authorization: Bearer YOUR_CONFIG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"manifest": YOUR_MANIFEST_JSON}'
```

## Security Considerations

- **Never commit your tokens** to version control
- **Use environment variables** for all sensitive configuration
- **Enable token rotation** in production environments
- **Regularly review and update permissions** as needed

## Additional Resources

- [Slack App Manifest Documentation](https://api.slack.com/reference/manifests) <mcreference link="https://api.slack.com/reference/manifests" index="1">1</mcreference>
- [App Manifest Reference](https://api.slack.com/concepts/manifests) <mcreference link="https://api.slack.com/concepts/manifests" index="2">2</mcreference>
- [Slack API Tutorials](https://api.slack.com/tutorials) <mcreference link="https://api.slack.com/tutorials" index="1">1</mcreference>
- [HeyBurrito Main README](./README.md)
- [Birthdays Module Guide](./README-Birthdays.md)
- [Docker Setup Guide](./README-Docker.md)

## Support

If you encounter issues with the manifest or app installation, please check the main project documentation or create an issue in the repository.