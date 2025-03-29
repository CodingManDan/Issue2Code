#!/usr/bin/env node

const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const dotenv = require('dotenv');
const crypto = require('crypto');
const open = require('open');
const express = require('express');
const qrcode = require('qrcode-terminal');
const ora = require('ora');

// Load existing environment variables if present
dotenv.config();

console.log(chalk.cyan('=============================================='));
console.log(chalk.bold.cyan('AI Coding Assistant - Installation Wizard'));
console.log(chalk.cyan('=============================================='));
console.log('');
console.log(chalk.yellow('This wizard will help you set up the AI Coding Assistant'));
console.log(chalk.yellow('by configuring a GitHub App and necessary webhooks.'));
console.log('');

const APP_NAME_PREFIX = 'AI-Coding-Assistant';
const DEFAULT_PORT = 3000;
const ENV_FILE_PATH = path.join(process.cwd(), '.env');
const MANIFEST_FILE_PATH = path.join(process.cwd(), 'github-app-manifest.json');

/**
 * Generate a secure random string for secrets
 */
function generateRandomSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate GitHub App manifest based on user input
 */
function generateGitHubAppManifest(config) {
  const webhookSecret = generateRandomSecret(16);
  
  const manifest = {
    name: `${APP_NAME_PREFIX}-${config.appNameSuffix || crypto.randomBytes(4).toString('hex')}`,
    url: config.appUrl || 'https://github.com/your-username/ai-coding-assistant',
    hook_attributes: {
      url: config.webhookUrl,
      active: true,
      secret: webhookSecret
    },
    redirect_url: config.redirectUrl || config.webhookUrl,
    public: false,
    default_permissions: {
      issues: 'write',
      pull_requests: 'write',
      contents: 'write',
      metadata: 'read'
    },
    default_events: [
      'issues',
      'issue_comment',
      'pull_request',
      'pull_request_review',
      'pull_request_review_comment'
    ],
    description: 'AI-powered assistant that automates software development workflow from GitHub issue to implementation.'
  };
  
  return { manifest, webhookSecret };
}

/**
 * Save the environment variables to .env file
 */
function saveEnvironmentVariables(config) {
  const envContent = Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  fs.writeFileSync(ENV_FILE_PATH, envContent);
  console.log(chalk.green(`\n✓ Environment variables saved to ${ENV_FILE_PATH}`));
}

/**
 * Save GitHub App manifest to a file
 */
function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_FILE_PATH, JSON.stringify(manifest, null, 2));
  console.log(chalk.green(`\n✓ GitHub App manifest saved to ${MANIFEST_FILE_PATH}`));
}

/**
 * Generate webhook URL based on configuration
 */
function getWebhookUrl(config) {
  const baseUrl = config.baseUrl || config.host || 'http://localhost';
  const port = config.port || DEFAULT_PORT;
  return `${baseUrl}:${port}/api/webhook`;
}

/**
 * Validate GitHub API token
 */
async function validateGitHubToken(token) {
  try {
    const octokit = new Octokit({
      auth: token
    });
    
    const { data } = await octokit.users.getAuthenticated();
    return { valid: true, username: data.login };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Validate Claude API key
 */
async function validateClaudeApiKey(apiKey) {
  // In a real implementation, we would make a test call to Claude API
  // For now, we'll just check if it looks like a valid key format
  if (apiKey && apiKey.startsWith('sk-') && apiKey.length > 20) {
    return { valid: true };
  }
  return { 
    valid: false, 
    error: 'Invalid Claude API key format. Should start with "sk-" and be longer than 20 characters.'
  };
}

/**
 * Create a local server to handle GitHub App creation callback
 */
function startLocalServer(port) {
  return new Promise((resolve) => {
    const app = express();
    
    app.get('/github/callback', (req, res) => {
      const { code, installation_id } = req.query;
      
      res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>GitHub App Successfully Created!</h2>
            <p>You can now close this window and return to the installer.</p>
            <div>
              <strong>Installation ID:</strong> ${installation_id}<br>
              <strong>Code:</strong> ${code}
            </div>
          </body>
        </html>
      `);
      
      resolve({ code, installationId: installation_id });
    });
    
    const server = app.listen(port, () => {
      console.log(chalk.cyan(`\n✓ Local server started on port ${port}`));
    });
    
    // Store server instance so we can close it later
    return server;
  });
}

/**
 * Main installation flow
 */
async function runInstallation() {
  // Step 1: Determine installation method
  const { installMethod } = await inquirer.prompt([
    {
      type: 'list',
      name: 'installMethod',
      message: 'Choose an installation method:',
      choices: [
        { name: 'Interactive setup (recommended)', value: 'interactive' },
        { name: 'GitHub App Manifest flow', value: 'manifest' },
        { name: 'Configure for Docker deployment', value: 'docker' }
      ]
    }
  ]);
  
  let config = {};
  
  if (installMethod === 'interactive') {
    // Step 2: Get basic configuration
    config = await inquirer.prompt([
      {
        type: 'input',
        name: 'appNameSuffix',
        message: 'Enter a suffix for your GitHub App name (optional):',
        default: ''
      },
      {
        type: 'input',
        name: 'host',
        message: 'Enter the host where your app will run:',
        default: 'http://localhost'
      },
      {
        type: 'input',
        name: 'port',
        message: 'Enter the port:',
        default: DEFAULT_PORT.toString()
      },
      {
        type: 'password',
        name: 'CLAUDE_API_KEY',
        message: 'Enter your Claude API key:',
        validate: async (input) => {
          const validation = await validateClaudeApiKey(input);
          return validation.valid ? true : validation.error;
        }
      }
    ]);
    
    // Generate webhook URL
    config.webhookUrl = getWebhookUrl(config);
    
    console.log(chalk.cyan('\n=== GitHub Authentication ==='));
    console.log(chalk.yellow('Now we need to set up GitHub authentication.'));
    
    const { authMethod } = await inquirer.prompt([
      {
        type: 'list',
        name: 'authMethod',
        message: 'Choose a GitHub authentication method:',
        choices: [
          { name: 'Create a new GitHub App (recommended)', value: 'app' },
          { name: 'Use existing GitHub PAT', value: 'pat' }
        ]
      }
    ]);
    
    if (authMethod === 'pat') {
      const tokenAnswers = await inquirer.prompt([
        {
          type: 'password',
          name: 'GITHUB_TOKEN',
          message: 'Enter your GitHub Personal Access Token:',
          validate: async (input) => {
            const validation = await validateGitHubToken(input);
            return validation.valid ? true : validation.error;
          }
        }
      ]);
      
      config.GITHUB_TOKEN = tokenAnswers.GITHUB_TOKEN;
      
      // Generate a webhook secret
      config.WEBHOOK_SECRET = generateRandomSecret(16);
      
      console.log(chalk.green('\n✓ GitHub token validated successfully'));
    } else {
      // Generate GitHub App manifest
      const { manifest, webhookSecret } = generateGitHubAppManifest(config);
      saveManifest(manifest);
      
      config.WEBHOOK_SECRET = webhookSecret;
      
      // Start local server to handle callback
      const callbackServer = startLocalServer(config.port || DEFAULT_PORT);
      
      // Generate GitHub App creation URL
      const manifestUrl = encodeURIComponent(JSON.stringify(manifest));
      const githubAppUrl = `https://github.com/settings/apps/new?manifest=${manifestUrl}`;
      
      console.log(chalk.cyan('\n=== GitHub App Creation ==='));
      console.log(chalk.yellow('Opening GitHub App creation page in your browser...'));
      console.log(chalk.yellow('Follow the steps on GitHub to create your app.'));
      
      await open(githubAppUrl);
      
      const spinner = ora('Waiting for GitHub App creation to complete...').start();
      
      // Wait for callback from GitHub
      const { code, installationId } = await callbackServer;
      
      spinner.succeed('GitHub App created successfully!');
      
      console.log(chalk.green(`\n✓ GitHub App Installation ID: ${installationId}`));
      console.log(chalk.green(`✓ Authorization Code: ${code}`));
      
      // TODO: Exchange authorization code for an installation token
      // This part requires a proper implementation of the GitHub App authentication flow
      
      config.GITHUB_APP_ID = 'GET_FROM_GITHUB_APP_SETTINGS';
      config.GITHUB_APP_INSTALLATION_ID = installationId;
      config.GITHUB_PRIVATE_KEY = 'DOWNLOAD_FROM_GITHUB_APP_SETTINGS';
      
      console.log(chalk.yellow('\nIMPORTANT: You need to manually perform these steps:'));
      console.log('1. In your GitHub App settings, download the private key');
      console.log('2. Copy the App ID from the GitHub App settings');
      console.log('3. Update the .env file with these values');
    }
    
    // Save configuration to .env file
    saveEnvironmentVariables(config);
    
  } else if (installMethod === 'manifest') {
    // Step 2: Configure the manifest
    config = await inquirer.prompt([
      {
        type: 'input',
        name: 'appNameSuffix',
        message: 'Enter a suffix for your GitHub App name (optional):',
        default: ''
      },
      {
        type: 'input',
        name: 'appUrl',
        message: 'Enter the URL for your app:',
        default: 'https://github.com/your-username/ai-coding-assistant'
      },
      {
        type: 'input',
        name: 'webhookUrl',
        message: 'Enter the webhook URL:',
        default: 'http://localhost:3000/api/webhook'
      }
    ]);
    
    // Generate GitHub App manifest
    const { manifest, webhookSecret } = generateGitHubAppManifest(config);
    saveManifest(manifest);
    
    config.WEBHOOK_SECRET = webhookSecret;
    config.CLAUDE_API_KEY = 'ENTER_YOUR_CLAUDE_API_KEY_HERE';
    config.GITHUB_APP_ID = 'GET_FROM_GITHUB_APP_SETTINGS';
    config.GITHUB_APP_INSTALLATION_ID = 'GET_FROM_GITHUB_APP_SETTINGS';
    config.GITHUB_PRIVATE_KEY = 'DOWNLOAD_FROM_GITHUB_APP_SETTINGS';
    
    // Save configuration to .env file
    saveEnvironmentVariables(config);
    
    console.log(chalk.yellow('\nFollow these steps to create your GitHub App:'));
    console.log('1. Go to https://github.com/settings/apps/new');
    console.log(`2. Upload the manifest file from: ${MANIFEST_FILE_PATH}`);
    console.log('3. Complete the GitHub App creation');
    console.log('4. Download the private key and update the .env file');
    console.log('5. Copy the App ID and Installation ID to the .env file');
    
  } else if (installMethod === 'docker') {
    // Generate a sample docker-compose.yml
    const dockerComposePath = path.join(process.cwd(), 'docker-compose.yml');
    const dockerComposeContent = `version: '3'
services:
  ai-coding-assistant:
    build: .
    ports:
      - "3000:3000"
    environment:
      - GITHUB_APP_ID=YOUR_GITHUB_APP_ID
      - GITHUB_APP_INSTALLATION_ID=YOUR_GITHUB_APP_INSTALLATION_ID
      - GITHUB_PRIVATE_KEY=YOUR_GITHUB_PRIVATE_KEY
      - WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
      - CLAUDE_API_KEY=YOUR_CLAUDE_API_KEY
    volumes:
      - ./:/app
`;
    
    fs.writeFileSync(dockerComposePath, dockerComposeContent);
    
    // Generate a sample Dockerfile
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
    const dockerfileContent = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
`;
    
    fs.writeFileSync(dockerfilePath, dockerfileContent);
    
    console.log(chalk.green(`\n✓ Docker files created:`));
    console.log(`  - ${dockerComposePath}`);
    console.log(`  - ${dockerfilePath}`);
    
    console.log(chalk.yellow('\nFollow these steps to deploy with Docker:'));
    console.log('1. Create your GitHub App manually or using the manifest flow');
    console.log('2. Update the environment variables in docker-compose.yml');
    console.log('3. Run `docker-compose up -d` to start the application');
  }
  
  // Generate a README with deployment instructions
  const readmePath = path.join(process.cwd(), 'INSTALL.md');
  const readmeContent = `# AI Coding Assistant - Installation Guide

## Prerequisites
- Node.js v14+ or Docker
- GitHub account with permissions to create GitHub Apps
- Claude API key

## Installation Methods

### Method 1: Interactive Setup
1. Run \`npm install\` to install dependencies
2. Run \`node install.js\` to start the installation wizard
3. Follow the prompts to complete the setup

### Method 2: GitHub App Manifest Flow
1. Create a GitHub App using the provided manifest file (\`github-app-manifest.json\`)
2. Update the \`.env\` file with your GitHub App details and Claude API key
3. Run \`npm install\` and \`npm start\` to start the application

### Method 3: Docker Deployment
1. Update the environment variables in \`docker-compose.yml\`
2. Run \`docker-compose up -d\` to start the application

## Configuration Options

### Environment Variables
- \`GITHUB_APP_ID\`: Your GitHub App ID
- \`GITHUB_APP_INSTALLATION_ID\`: Installation ID for your GitHub App
- \`GITHUB_PRIVATE_KEY\`: Private key for your GitHub App (or path to key file)
- \`GITHUB_TOKEN\`: Alternative to GitHub App for personal repos (not recommended for production)
- \`WEBHOOK_SECRET\`: Secret for webhook validation
- \`CLAUDE_API_KEY\`: Your Claude API key

### GitHub App Permissions
- Issues: Read & Write
- Pull Requests: Read & Write
- Repository Contents: Read & Write
- Metadata: Read

### Webhook Events
- Issues
- Issue Comments
- Pull Requests
- Pull Request Reviews
- Pull Request Review Comments

## Troubleshooting

### Common Issues
1. **Webhook not receiving events**: Check your firewall settings and ensure your app is publicly accessible
2. **Authentication errors**: Verify your GitHub App credentials and permissions
3. **API rate limits**: Implement retry logic with exponential backoff

### Logs
Check the logs for detailed error information:
- Production: \`docker logs ai-coding-assistant\`
- Development: Check console output

## Updating the Installation
To update your installation:
1. Pull the latest code: \`git pull\`
2. Run \`npm install\` to update dependencies
3. Restart the application

## Support
For issues or questions, please open an issue on the GitHub repository.
`;
  
  fs.writeFileSync(readmePath, readmeContent);
  console.log(chalk.green(`\n✓ Installation guide created at ${readmePath}`));
  
  console.log(chalk.cyan('\n=============================================='));
  console.log(chalk.bold.green('Installation process completed!'));
  console.log(chalk.cyan('=============================================='));
  console.log(chalk.yellow('\nNext steps:'));
  console.log('1. Review the generated files');
  console.log('2. Complete any manual steps mentioned above');
  console.log('3. Start the AI Coding Assistant application');
  console.log('\nRefer to the INSTALL.md file for detailed instructions.');
}

// Run the installation
runInstallation().catch(error => {
  console.error(chalk.red('Error during installation:'), error);
  process.exit(1);
});
