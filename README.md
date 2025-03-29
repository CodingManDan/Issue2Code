# AI Coding Assistant

An AI-powered assistant that automates the software development workflow from GitHub issue to implementation, using Claude to handle investigation, test creation, and code implementation while maintaining human oversight.

## 🚀 Features

- **Issue Analysis**: Automatically analyzes GitHub issues and performs code investigation
- **Test-Driven Development**: Creates unit tests first for human approval
- **Automated Implementation**: Implements code that passes approved tests
- **Human Oversight**: Maintains human control at key checkpoints
- **GitHub Integration**: Seamless integration with GitHub issues and pull requests

## 📋 Prerequisites

- GitHub account with permissions to create GitHub Apps
- Node.js v14+ (or Docker for containerized deployment)
- Claude API key

## 💻 Installation

Choose one of the following installation methods:

### Method 1: Interactive Setup (Recommended)

The interactive setup guides you through the process step-by-step:

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/ai-coding-assistant.git
   cd ai-coding-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the installation script:
   ```bash
   node install.js
   ```

4. Follow the prompts to:
   - Create a GitHub App
   - Configure permissions & webhook events
   - Set up authentication
   - Save environment variables

### Method 2: Manual GitHub App Setup

1. Clone the repository and install dependencies as above.

2. Create a new GitHub App:
   - Go to GitHub Settings > Developer settings > GitHub Apps > New GitHub App
   - Configure the following permissions:
     - Issues: Read & Write
     - Pull Requests: Read & Write
     - Repository Contents: Read & Write
   - Subscribe to events:
     - Issues, Issue Comment
     - Pull Request, Pull Request Review, Pull Request Review Comment
   - Generate and download a private key

3. Create a `.env` file with:
   ```
   GITHUB_APP_ID=your_app_id
   GITHUB_APP_INSTALLATION_ID=your_installation_id
   GITHUB_PRIVATE_KEY=path/to/private-key.pem
   WEBHOOK_SECRET=your_webhook_secret
   CLAUDE_API_KEY=your_claude_api_key
   ```

### Method 3: Docker Deployment

For containerized deployment:

1. Clone the repository as above.

2. Edit the `.env` file with your configuration.

3. Start the services:
   ```bash
   docker-compose up -d
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_APP_ID` | GitHub App ID | Yes* |
| `GITHUB_APP_INSTALLATION_ID` | GitHub App Installation ID | Yes* |
| `GITHUB_PRIVATE_KEY` | GitHub App Private Key | Yes* |
| `WEBHOOK_SECRET` | Secret for webhook validation | Yes |
| `CLAUDE_API_KEY` | Claude API Key | Yes |
| `PORT` | Server port (default: 3000) | No |

*Either GitHub App credentials or a personal access token is required.

## 📘 Usage

### Assigning Issues to the AI Assistant

Assign an issue to the AI by one of these methods:
- Add the label `ai-assist` to the issue
- Assign the issue to the AI bot user
- Mention the bot in a comment: `@ai-coding-assistant help`

### Workflow

1. AI analyzes the issue and performs investigation
2. AI creates a draft Pull Request with tests
3. Human reviews and approves tests
4. AI implements code that passes the tests
5. AI changes PR from draft to ready for review
6. Human reviews and merges the final PR

## 🔒 Security

- Store your GitHub App private key securely
- Never commit API keys to version control
- Use a strong random webhook secret

## 🛠️ Troubleshooting

### Common Issues

#### Webhook Not Receiving Events
- Ensure your server is publicly accessible
- Check webhook URL configuration
- Verify webhook secret

#### Authentication Errors
- Verify GitHub App credentials
- Check that private key format is correct
- Ensure the app is installed on your repositories
