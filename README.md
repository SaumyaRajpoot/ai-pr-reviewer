# AI PR Reviewer

This is my prefinal-year B.Tech CSE project! It's a tool that automatically reviews GitHub Pull Requests using Google Gemini AI. Instead of just leaving one big comment, it actually finds the exact lines of code that have issues and leaves inline comments on the PR. It also has a simple React dashboard to track the review history.

## Tech Stack
- **Node.js (Express)**: Handles the GitHub webhooks and uses Octokit to post the inline comments.
- **Python (FastAPI)**: The AI engine that takes the code diff and asks Gemini to find bugs or performance issues.
- **React**: A simple dashboard to see what the AI has reviewed.
- **Google Gemini API**: Does the actual code analysis.

## How it Works
1. Someone opens or updates a Pull Request on GitHub.
2. GitHub sends a webhook to my Node.js server.
3. Node.js uses Octokit to download the code diff and sends it to the Python server.
4. Python formats the diff and asks Gemini to act like a picky code reviewer.
5. Python gets a JSON list of issues back and sends it to Node.js.
6. Node.js uses Octokit to post those exact issues directly on the lines of code in GitHub!
7. The React dashboard updates with a summary of the review.

## How to Run it Locally

You need three terminal tabs open to run the whole project.

### 1. Run the Python AI Engine
First, make sure you have your `.env` file with `GEMINI_API_KEY`.
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --port 8000 --reload
```

### 2. Run the Node.js Webhook Server
Make sure you have your `.env` file with your `GITHUB_TOKEN`.
```bash
cd backend
npm install
node server.js
```
*(Note: It runs on port 3000. You will need to use something like ngrok or localtunnel to expose port 3000 to the internet so GitHub can send webhooks to it).*

### 3. Run the React Dashboard
```bash
cd frontend
npm install
npm run dev
```

## Notes
- Sometimes the AI hallucinates line numbers, so I added code to double-check and skip lines that weren't actually modified in the PR. This stops the GitHub API from crashing.
- I built this project to show how AI can help automate software engineering tasks. 
