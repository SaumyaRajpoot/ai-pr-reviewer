require('dotenv').config();
const express = require('express');
const { Octokit } = require('@octokit/rest');
const axios = require('axios');

const app = express();
app.use(express.json());

// Set up Octokit using the token from .env
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// The main webhook endpoint that GitHub will hit
app.post('/webhook', async (req, res) => {
  console.log("Got a webhook ping from GitHub!");
  
  // just return 200 immediately so GitHub doesn't timeout
  res.status(200).send("Webhook received");

  const payload = req.body;
  const action = payload.action;

  // We only care about PRs being opened or synchronized (updated)
  if (payload.pull_request && (action === "opened" || action === "synchronize")) {
    const repoOwner = payload.repository.owner.login;
    const repoName = payload.repository.name;
    const prNumber = payload.pull_request.number;
    const latestCommit = payload.pull_request.head.sha;

    console.log(`Processing PR #${prNumber} for ${repoOwner}/${repoName}...`);

    try {
      // 1. Fetch the code diff using Octokit
      // lol this took forever to figure out - we have to set the media type to get the diff format
      console.log("Fetching diff using Octokit...");
      const diffResponse = await octokit.rest.pulls.get({
        owner: repoOwner,
        repo: repoName,
        pull_number: prNumber,
        mediaType: {
          format: "diff",
        },
      });

      const diffText = diffResponse.data;
      if (!diffText) {
        console.log("No diff found. Maybe an empty PR?");
        return;
      }

      // 2. Send the diff to our Python FastAPI server for AI analysis
      // Python handles the Gemini API stuff because it's easier
      console.log("Sending diff to Python AI engine...");
      const aiResponse = await axios.post('http://127.0.0.1:8000/analyze', {
        diff: diffText,
        pr_number: prNumber,
        repo: `${repoOwner}/${repoName}`,
        title: payload.pull_request.title
      });

      const comments = aiResponse.data.comments;

      // 3. Post the inline review back to GitHub using Octokit
      if (comments && comments.length > 0) {
        console.log(`Got ${comments.length} issues from AI. Posting to GitHub...`);
        
        await octokit.rest.pulls.createReview({
          owner: repoOwner,
          repo: repoName,
          pull_number: prNumber,
          commit_id: latestCommit,
          event: "COMMENT",
          comments: comments,
          body: "AI Code Review is complete! Check out the inline comments below."
        });

        console.log("Successfully posted the PR review!");
      } else {
        console.log("AI didn't find any issues. Posting a general comment instead.");
        // Just leave a nice comment if no issues
        await octokit.rest.issues.createComment({
          owner: repoOwner,
          repo: repoName,
          issue_number: prNumber,
          body: "AI Code Reviewer checked the code and found no issues. Looks good!"
        });
        console.log("Done! No issues found.");
      }

    } catch (error) {
      // something broke, print it out
      console.error("Error during PR processing:", error.message);
      // console.error(error); // uncomment if you need the full stack trace
    }
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Node.js Webhook Server running on port ${PORT}`);
});
