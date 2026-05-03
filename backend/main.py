import os
import json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI-Powered PR Reviewer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# simple in-memory database to store reviews for the React frontend
reviews_db = []

def get_valid_lines_from_diff(patch_text):
    # This function looks at the GitHub diff and finds the exact line numbers
    # of the code that was added or modified. We need this so the AI doesn't 
    # try to comment on lines that didn't change!
    
    if not patch_text:
        return "", []
        
    lines = patch_text.split('\n')
    current_line = 0
    formatted_patch = ""
    valid_lines = []
    
    for line in lines:
        if line.startswith('@@'):
            # The diff header looks like @@ -25,6 +25,41 @@
            # We want to find the starting line number for the new code (after the +)
            parts = line.split(" ")
            for p in parts:
                if p.startswith('+'):
                    # get rid of the '+'
                    number_part = p[1:]
                    # split by ',' to just get the start line
                    start_line_str = number_part.split(',')[0]
                    current_line = int(start_line_str)
                    
            formatted_patch += line + "\n"
            
        elif line.startswith('+++') or line.startswith('---'):
            # file headers
            formatted_patch += line + "\n"
            
        elif line.startswith('+'):
            # This is a new or modified line! Let's save its line number
            formatted_patch += str(current_line) + ": " + line + "\n"
            valid_lines.append(current_line)
            current_line += 1
            
        elif line.startswith('-'):
            # deleted line
            formatted_patch += "del: " + line + "\n"
            
        elif line.startswith('\\'):
            # git thing for "No newline at end of file"
            formatted_patch += line + "\n"
            
        else:
            # unchanged context code
            formatted_patch += str(current_line) + ": " + line + "\n"
            current_line += 1
            
    return formatted_patch, valid_lines


@app.post("/analyze")
async def analyze_code(request: Request):
    # Node.js sends the diff here so Python can do the AI part
    try:
        data = await request.json()
        diff_text_raw = data.get("diff", "")
        pr_number = data.get("pr_number", "Unknown")
        repo_name = data.get("repo", "Unknown Repo")
        pr_title = data.get("title", "Unknown Title")

        print(f"Received diff from Node.js for PR #{pr_number}")
        
        if not diff_text_raw:
            print("No diff text provided.")
            return {"comments": []}

        # Format the diff so Gemini knows the line numbers
        formatted_patch, valid_lines = get_valid_lines_from_diff(diff_text_raw)
        
        print("Setting up Gemini AI...")
        model = genai.GenerativeModel('gemini-flash-lite-latest')
        
        prompt = (
            "You are a picky code reviewer. If you find an issue, return the file path and the exact line number from the provided diff. "
            "If no issues are found, return an empty list [].\n\n"
            "Your output MUST be a JSON List of objects. Each object must have:\n"
            '{"file_path": "string", "line_number": integer, "comment": "string"}\n\n'
            "Only comment on lines that were actually added or modified in the PR. "
            "These are the lines prefixed with their line number and a '+'.\n\n"
            f"Code Diff:\n{formatted_patch}"
        )
        
        print("Sending code diff to Gemini...")
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                max_output_tokens=800,
                temperature=0.2,
                response_mime_type="application/json"
            )
        )
        
        print("Got response from Gemini!")
        
        try:
            # Parse the JSON string into a Python list
            issues_list = json.loads(response.text)
        except Exception:
            print("Oops, Gemini didn't return proper JSON. Defaulting to empty list.")
            issues_list = []
            
        final_comments = []
        
        # Check each issue Gemini found
        for issue in issues_list:
            file_path = issue.get("file_path", "")
            line_num = issue.get("line_number")
            comment_text = issue.get("comment")
            
            # Make sure the line number actually exists in the diff
            if line_num in valid_lines:
                final_comments.append({
                    "path": file_path,
                    "line": line_num,
                    "body": comment_text
                })
                print(f"Added comment for line {line_num}")
            else:
                print(f"Skipping invalid comment: Line {line_num} wasn't modified.")
                
        # Save to database for the React frontend
        reviews_db.insert(0, {
            "repo": repo_name,
            "pr_number": pr_number,
            "title": pr_title,
            "review": f"Provided {len(final_comments)} inline comments."
        })

        # send it back to Node.js!
        return {"comments": final_comments}
            
    except Exception as e:
        print(f"Something went wrong in Python AI engine: {str(e)}")
        # return empty list so node.js doesn't crash
        return {"comments": []}


@app.get("/api/reviews")
async def get_reviews():
    # React frontend calls this to show the history
    return {"reviews": reviews_db}
