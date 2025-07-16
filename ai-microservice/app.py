# ai-microservice/app.py
import os
import sys
from flask import Flask, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv
from bson.objectid import ObjectId # Needed for querying by MongoDB _id
from datetime import datetime # Example: for timestamping logs

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# --- MongoDB Connection ---
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('DB_NAME', 'job_board_db') # Default DB name if not specified

if not MONGO_URI:
    print(f"[{datetime.now()}] ERROR: MONGO_URI environment variable not set in ai-microservice/.env. Exiting.", file=sys.stderr)
    sys.exit(1) # Exit if critical config is missing

try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME] # Connect to the specified database

    # Get references to your collections
    users_collection = db.users
    jobs_collection = db.jobs
    applications_collection = db.applications
    companies_collection = db.companies # Assuming you have a companies collection

    # Optional: Test connection by listing collections
    # print(f"[{datetime.now()}] Connected to MongoDB: {DB_NAME}. Collections: {db.list_collection_names()}")
    print(f"[{datetime.now()}] Successfully connected to MongoDB: {DB_NAME}")

except Exception as e:
    print(f"[{datetime.now()}] ERROR: Could not connect to MongoDB at {MONGO_URI}. Error: {e}", file=sys.stderr)
    sys.exit(1) # Exit if MongoDB connection fails


# --- Utility Functions for fetching real data from MongoDB ---

def get_user_profile_from_db(user_id_str):
    """Fetches a user's detailed profile from MongoDB."""
    try:
        object_user_id = ObjectId(user_id_str)
    except Exception:
        print(f"[{datetime.now()}] Invalid user ID format provided: {user_id_str}", file=sys.stderr)
        return None

    user_doc = users_collection.find_one({"_id": object_user_id})
    if user_doc:
        # Return fields relevant for AI processing.
        # Ensure your Mongoose models save these fields.
        return {
            "userId": str(user_doc["_id"]),
            "email": user_doc.get("email"), # For logging/identification
            "role": user_doc.get("role"),
            "profile": {
                "skills": user_doc.get("profile", {}).get("skills", []),
                "experience": user_doc.get("profile", {}).get("experience", []),
                "education": user_doc.get("profile", {}).get("education", []),
                "projects": user_doc.get("profile", {}).get("projects", []),
                "certifications": user_doc.get("profile", {}).get("certifications", []),
                "preferences": user_doc.get("profile", {}).get("preferences", {})
            }
        }
    print(f"[{datetime.now()}] User profile not found for ID: {user_id_str}")
    return None

def get_job_details_from_db(job_id_str):
    """Fetches detailed job information from MongoDB."""
    try:
        object_job_id = ObjectId(job_id_str)
    except Exception:
        print(f"[{datetime.now()}] Invalid job ID format provided: {job_id_str}", file=sys.stderr)
        return None

    job_doc = jobs_collection.find_one({"_id": object_job_id})
    if job_doc:
        company_name = ""
        # Assuming job_doc['company'] stores the ObjectId of the company
        if "company" in job_doc and job_doc["company"]:
            try:
                company_doc = companies_collection.find_one({"_id": ObjectId(job_doc["company"])})
                if company_doc:
                    company_name = company_doc.get("name", "")
            except Exception as e:
                print(f"[{datetime.now()}] Error fetching company name for job {job_id_str}: {e}")

        return {
            "jobId": str(job_doc["_id"]),
            "title": job_doc.get("title", ""),
            "description": job_doc.get("description", ""),
            "location": job_doc.get("location", ""),
            "salaryRange": job_doc.get("salaryRange", {}),
            "requiredSkills": job_doc.get("requiredSkills", []),
            "preferredSkills": job_doc.get("preferredSkills", []),
            "technologiesUsed": job_doc.get("technologiesUsed", []),
            "companyId": str(job_doc["company"]) if job_doc.get("company") else None,
            "companyName": company_name,
            "isApproved": job_doc.get("isApproved", False) # Example field for approval status
        }
    print(f"[{datetime.now()}] Job details not found for ID: {job_id_str}")
    return None

# --- AI Microservice Routes ---

@app.route('/api/v1/ai/recommend-jobs', methods=['POST'])
def recommend_jobs():
    """
    Provides job recommendations based on user profile.
    Expects JSON: {"userId": "...", "userProfile": {...}}
    """
    data = request.json
    user_id = data.get('userId')

    if not user_id:
        print(f"[{datetime.now()}] /recommend-jobs: Missing userId in request.")
        return jsonify({"message": "userId is required."}), 400

    user_profile = get_user_profile_from_db(user_id)
    if not user_profile:
        print(f"[{datetime.now()}] /recommend-jobs: User profile not found for ID: {user_id}")
        # Optionally, return general recommendations if profile is not found
        all_jobs_cursor = jobs_collection.find({})
        general_jobs = [{"jobId": str(job["_id"]), "score": 0.5, "reason": "General match"} for job in list(all_jobs_cursor)[:5]]
        return jsonify({
            "message": "User profile not found. Showing general jobs.",
            "recommendations": general_jobs
        }), 200

    # Extract user skills for simple matching
    user_skills_lower = set(s.lower() for s in user_profile['profile'].get('skills', []))

    all_jobs_cursor = jobs_collection.find({"isApproved": True}) # Only recommend approved jobs
    all_jobs = list(all_jobs_cursor)
    
    personalized_recommendations = []

    if user_skills_lower:
        for job in all_jobs:
            job_skills_lower = set(s.lower() for s in job.get('requiredSkills', []) + job.get('preferredSkills', []))
            
            # Calculate intersection of skills
            common_skills = user_skills_lower.intersection(job_skills_lower)
            
            score = 0.0
            reasons = []

            if common_skills:
                # Basic score based on common skills
                # Higher weight for required skills matched
                required_matched_count = len(user_skills_lower.intersection(set(s.lower() for s in job.get('requiredSkills', []))))
                preferred_matched_count = len(user_skills_lower.intersection(set(s.lower() for s in job.get('preferredSkills', []))))

                total_job_required_skills = len(job.get('requiredSkills', []))
                total_job_preferred_skills = len(job.get('preferredSkills', []))

                if total_job_required_skills > 0:
                    score += (required_matched_count / total_job_required_skills) * 0.7 # 70% weight
                if total_job_preferred_skills > 0:
                    score += (preferred_matched_count / total_job_preferred_skills) * 0.3 # 30% weight

                score = min(max(0, score), 1.0) # Cap score between 0 and 1

                reasons.append(f"Matched skills: {', '.join(list(common_skills))}")

                personalized_recommendations.append({
                    "jobId": str(job["_id"]),
                    "score": round(score, 4), # Score from 0 to 1
                    "reasons": reasons
                })
        
        # Sort recommendations by score in descending order
        personalized_recommendations.sort(key=lambda x: x['score'], reverse=True)
        
        if personalized_recommendations:
            print(f"[{datetime.now()}] /recommend-jobs: Found {len(personalized_recommendations)} personalized recommendations for {user_id}.")
            return jsonify(personalized_recommendations)

    print(f"[{datetime.now()}] /recommend-jobs: No personalized recommendations based on skills for {user_id}. Showing general jobs.")
    # Fallback: Return some general jobs if no personalized ones
    general_jobs = [{"jobId": str(job["_id"]), "score": 0.5, "reason": "General match"} for job in all_jobs[:5]]
    return jsonify(general_jobs)


@app.route('/api/v1/ai/detect-scam', methods=['POST'])
def detect_scam():
    """
    Detects if a job posting is potentially a scam.
    Expects JSON: {"jobTitle": "...", "jobDescription": "...", "companyName": "..."}
    """
    job_data = request.json
    title = job_data.get('title', '').lower()
    description = job_data.get('description', '').lower()
    company_name = job_data.get('companyName', '').lower()

    if not title and not description:
        print(f"[{datetime.now()}] /detect-scam: Missing job title and description.")
        return jsonify({"message": "Job title or description is required for scam detection."}), 400

    is_suspicious = False
    score = 0.0 # Score from 0 to 1, higher = more suspicious
    flags = []

    # Basic keyword-based detection
    scam_keywords = [
        "upfront fee", "telegram only", "investment opportunity", "crypto payment",
        "send money", "work-from-home kit", "high commission", "get rich quick",
        "no experience required", "easy money", "passive income", "recruitment fee",
        "pyramid scheme", "multi-level marketing", "MLM", "fast cash", "instant profit",
        "secret method", "guaranteed income"
    ]
    
    combined_text = title + " " + description

    for keyword in scam_keywords:
        if keyword in combined_text:
            is_suspicious = True
            flags.append(f"Contains suspicious keyword: '{keyword}'")
            score += 0.1 # Increment score for each flag

    # Heuristic: Very high salary for no experience/simple role
    if ("no experience" in description or "entry level" in title) and \
       ("salary" in description or "pay" in description) and \
       (any(s in description for s in ["100k", "150k", "200k", "high salary", "six figure"])) : # More sophisticated check needed here
        is_suspicious = True
        flags.append("Suspicious: High pay for little or no experience mentioned.")
        score += 0.2

    # Heuristic: Urgent hiring without clear requirements
    if "urgent hiring" in combined_text and "immediate start" in combined_text and not (job_data.get('requiredSkills') or job_data.get('experience')):
        is_suspicious = True
        flags.append("Suspicious: Urgent hiring without clear qualifications.")
        score += 0.1

    # Check for generic/vague company name if not found in DB or looks suspicious
    if company_name and company_name in ["confidential", "anonymous", "private employer"]:
        is_suspicious = True
        flags.append(f"Vague company name: '{company_name}'.")
        score += 0.05

    # Normalize score to be between 0 and 1
    score = min(score, 1.0)

    print(f"[{datetime.now()}] /detect-scam: Job '{title}' - Suspicious={is_suspicious}, Score={round(score, 2)}, Flags={flags}")

    return jsonify({
        "isSuspicious": is_suspicious,
        "score": round(score, 2),
        "flags": flags
    })


@app.route('/api/v1/ai/screen-candidates', methods=['POST'])
def screen_candidates():
    """
    Screens candidates for a given job based on skills and profile data.
    Expects JSON: {"jobId": "...", "applicantIds": ["...", "..."], "jobDetails": {...}}
    (jobDetails can be sent or fetched from DB)
    """
    data = request.json
    job_id = data.get('jobId')
    applicant_ids = data.get('applicantIds', [])
    
    if not job_id or not applicant_ids:
        print(f"[{datetime.now()}] /screen-candidates: Missing jobId or applicantIds.")
        return jsonify({"message": "jobId and applicantIds are required."}), 400

    # Fetch job details from DB (always prefer fresh data)
    job_details = get_job_details_from_db(job_id)
    if not job_details:
        print(f"[{datetime.now()}] /screen-candidates: Job details not found for ID: {job_id}")
        return jsonify({"message": "Job details not found.", "results": []}), 404

    required_skills_lower = set(s.lower() for s in job_details.get('requiredSkills', []))
    preferred_skills_lower = set(s.lower() for s in job_details.get('preferredSkills', []))

    screening_results = []

    for applicant_id_str in applicant_ids:
        applicant_profile = get_user_profile_from_db(applicant_id_str)
        if not applicant_profile:
            screening_results.append({
                "applicantId": applicant_id_str,
                "score": 0,
                "reasons": ["Applicant profile not found in DB or invalid ID."]
            })
            continue

        applicant_skills_lower = set(s.lower() for s in applicant_profile['profile'].get('skills', []))
        
        score = 0.0 # Score from 0 to 100
        reasons = []

        # 1. Required Skill Matching (e.g., 60% of score)
        matched_required_skills = required_skills_lower.intersection(applicant_skills_lower)
        if required_skills_lower:
            required_skill_match_percentage = (len(matched_required_skills) / len(required_skills_lower))
            score += required_skill_match_percentage * 60
            if len(matched_required_skills) == len(required_skills_lower):
                reasons.append("All required skills matched.")
            elif matched_required_skills:
                reasons.append(f"Matched required skills: {', '.join(list(matched_required_skills))}.")
            else:
                reasons.append("No required skills matched.")
        else: # If no required skills, give full score for this part
            score += 60
            reasons.append("No specific required skills for this job.")

        # 2. Preferred Skill Matching (e.g., 30% of score)
        matched_preferred_skills = preferred_skills_lower.intersection(applicant_skills_lower)
        if preferred_skills_lower:
            preferred_skill_match_percentage = (len(matched_preferred_skills) / len(preferred_skills_lower))
            score += preferred_skill_match_percentage * 30
            if matched_preferred_skills:
                reasons.append(f"Matched preferred skills: {', '.join(list(matched_preferred_skills))}.")
        
        # 3. Basic Experience Check (e.g., 10% of score)
        # This would be more complex with NLP on experience descriptions
        job_title_lower = job_details.get("title", "").lower()
        if "senior" in job_title_lower and not any("senior" in exp.get("title", "").lower() for exp in applicant_profile['profile'].get('experience', [])):
             # Deduct points if senior role but no senior experience explicitly
            score = max(0, score - 10) # Ensure score doesn't go below 0
            reasons.append("Job is 'Senior' level, but applicant lacks explicit senior experience.")
        elif "junior" in job_title_lower and any(exp.get("years", 0) > 5 for exp in applicant_profile['profile'].get('experience', [])):
            # Deduct points if junior role but overqualified
            score = max(0, score - 5)
            reasons.append("Job is 'Junior' level, applicant appears overqualified.")
        else:
            score += 10 # Default small bonus if no specific issue

        score = min(max(0, score), 100) # Ensure score is between 0 and 100

        screening_results.append({
            "applicantId": str(applicant_profile["userId"]),
            "score": round(score, 2),
            "reasons": reasons if reasons else ["General fit."]
        })
    
    print(f"[{datetime.now()}] /screen-candidates: Screening complete for job {job_id}. Processed {len(screening_results)} applicants.")
    return jsonify(screening_results)


@app.route('/api/v1/ai/profile-tailoring-suggestions', methods=['POST'])
def profile_tailoring_suggestions():
    """
    Generates suggestions for tailoring a user's profile/resume for a specific job.
    Expects JSON: {"userId": "...", "jobId": "...", "userProfile": {...}, "jobDetails": {...}}
    """
    data = request.json
    user_id = data.get('userId')
    job_id = data.get('jobId')

    if not user_id or not job_id:
        print(f"[{datetime.now()}] /profile-tailoring-suggestions: Missing userId or jobId.")
        return jsonify({"message": "userId and jobId are required."}), 400

    user_profile = get_user_profile_from_db(user_id)
    job_details = get_job_details_from_db(job_id)

    if not user_profile or not job_details:
        print(f"[{datetime.now()}] /profile-tailoring-suggestions: User or job details not found.")
        return jsonify({"message": "User profile or job details not found."}), 404

    suggestions = []
    tailored_resume_preview = "Your current profile + tailoring suggestions:\n\n"

    user_skills_lower = set(s.lower() for s in user_profile['profile'].get('skills', []))
    job_required_skills_lower = set(s.lower() for s in job_details.get('requiredSkills', []))
    job_preferred_skills_lower = set(s.lower() for s in job_details.get('preferredSkills', []))

    # Identify missing required skills
    missing_required_skills = job_required_skills_lower - user_skills_lower
    if missing_required_skills:
        suggestions.append(f"Consider adding the following required skills to your profile: {', '.join(list(missing_required_skills))}.")
        tailored_resume_preview += f"**Skills (tailored):** {', '.join(list(user_skills_lower.union(missing_required_skills)))}\n"

    # Identify missing preferred skills
    missing_preferred_skills = job_preferred_skills_lower - user_skills_lower
    if missing_preferred_skills:
        suggestions.append(f"Highlight any experience or projects related to these preferred skills: {', '.join(list(missing_preferred_skills))}.")
        # No direct addition to preview, but prompts user to emphasize
    
    # Suggest tailoring experience/projects based on keywords
    job_description_lower = job_details.get('description', '').lower()
    relevant_keywords = set()
    # Simple keyword extraction (can be improved with NLP)
    for skill in job_required_skills_lower.union(job_preferred_skills_lower):
        if len(skill) > 2: # Avoid very short common words
            relevant_keywords.add(skill)
    
    # Check if user's experience/projects mention job-relevant keywords
    experience_text = " ".join([exp.get("description", "").lower() for exp in user_profile['profile'].get('experience', [])])
    projects_text = " ".join([proj.get("description", "").lower() for proj in user_profile['profile'].get('projects', [])])

    for keyword in relevant_keywords:
        if keyword in job_description_lower and keyword not in experience_text and keyword not in projects_text:
            suggestions.append(f"The job emphasizes '{keyword}'. If you have experience with this, elaborate on it in your experience or projects section.")

    if not suggestions:
        suggestions.append("Your profile seems well-aligned with this job's requirements. Review the job description for any subtle details to emphasize.")


    tailored_resume_preview += f"\n**Job Title:** {job_details.get('title')}\n"
    tailored_resume_preview += f"**Job Description Snippet:** {job_details.get('description', '')[:200]}...\n"
    tailored_resume_preview += f"\n**Suggestions for improvement:**\n"
    for s in suggestions:
        tailored_resume_preview += f"- {s}\n"


    print(f"[{datetime.now()}] /profile-tailoring-suggestions: Generated suggestions for user {user_id} for job {job_id}.")
    return jsonify({
        "suggestions": suggestions,
        "tailoredResumePreview": tailored_resume_preview
    })


@app.route('/api/v1/ai/update-user-profile', methods=['POST'])
def update_user_profile():
    """
    Notifies the AI microservice about a user profile update.
    This can be used for logging or triggering re-training of recommendation models.
    Expects JSON: {"userId": "...", "updatedProfileData": {...}}
    """
    data = request.json
    user_id = data.get('userId')
    updated_profile_data = data.get('updatedProfileData')

    if not user_id or not updated_profile_data:
        return jsonify({"message": "userId and updatedProfileData are required."}), 400

    print(f"[{datetime.now()}] /update-user-profile: Received profile update notification for user {user_id}.")
    # In a real system, you might:
    # 1. Log this event for future analysis.
    # 2. Trigger an asynchronous process to re-train/update user embeddings.
    # 3. Update a cache of user profiles in the AI service if one exists.

    return jsonify({"message": "User profile update notification received by AI service."})


@app.route('/api/v1/ai/notify-new-application', methods=['POST'])
def notify_new_application():
    """
    Notifies the AI microservice about a new job application.
    This can be used for tracking user interests, job popularity, etc.
    Expects JSON: {"applicationId": "...", "userId": "...", "jobId": "..."}
    """
    data = request.json
    application_id = data.get('applicationId')
    user_id = data.get('userId')
    job_id = data.get('jobId')

    if not application_id or not user_id or not job_id:
        return jsonify({"message": "applicationId, userId, and jobId are required."}), 400

    print(f"[{datetime.now()}] /notify-new-application: New application notification for user {user_id} on job {job_id}.")
    # In a real system, you might:
    # 1. Store this interaction for collaborative filtering (user X applied to job Y).
    # 2. Update job popularity metrics.
    # 3. Trigger immediate re-ranking of recommendations for the user or similar users.

    return jsonify({"message": "New application notification received by AI service."})


@app.route('/api/v1/ai/notify-job-interaction', methods=['POST'])
def notify_job_interaction():
    """
    Notifies the AI microservice about a job interaction (view, click, save).
    Expects JSON: {"userId": "...", "jobId": "...", "type": "view"|"click"|"save"}
    """
    data = request.json
    user_id = data.get('userId')
    job_id = data.get('jobId')
    interaction_type = data.get('type') # e.g., 'view', 'click', 'save', 'apply'

    if not user_id or not job_id or not interaction_type:
        return jsonify({"message": "userId, jobId, and type are required."}), 400

    print(f"[{datetime.now()}] /notify-job-interaction: User {user_id} interacted with job {job_id} (Type: {interaction_type}).")
    # In a real system, you might:
    # 1. Store this interaction in a separate collection for building user preference profiles.
    # 2. Use it for immediate recommendation updates (e.g., 'user just viewed this, show similar jobs next').

    return jsonify({"message": "Job interaction notification received by AI service."})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) # debug=True for development, set to False for production