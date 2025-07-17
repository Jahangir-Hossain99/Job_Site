# ai-microservice/app.py
import os
import sys
from flask import Flask, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv
from bson.objectid import ObjectId # Needed for querying by MongoDB _id
from datetime import datetime # Example: for timestamping logs
import nltk # For NLP tasks like tokenization, stopwords
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import re # For regular expressions, e.g., cleaning text

# Ensure NLTK data is downloaded (this block handles initial download if missing)
try:
    nltk.data.find('corpora/stopwords')
    nltk.data.find('tokenizers/punkt')
except LookupError:
    print(f"[{datetime.now()}] NLTK data (stopwords, punkt) not found, attempting download...", file=sys.stderr)
    try:
        nltk.download('stopwords', quiet=True)
        nltk.download('punkt', quiet=True)
        print(f"[{datetime.now()}] NLTK data download complete.")
    except Exception as e:
        print(f"[{datetime.now()}] ERROR: Failed to download NLTK data. Please check your network or try running 'python -c \"import nltk; nltk.download(\'stopwords\'); nltk.download(\'punkt\')\"' manually. Error: {e}", file=sys.stderr)
        sys.exit(1) # Exit if NLTK data cannot be downloaded
except Exception as e:
    print(f"[{datetime.now()}] Unexpected error during NLTK data check/download: {e}", file=sys.stderr)
    sys.exit(1) # Exit if NLTK setup fails unexpectedly


# Load environment variables from .env file
load_dotenv()

# --- CRITICAL LINE: Initialize the Flask application instance ---
app = Flask(__name__)
# --- END CRITICAL LINE ---

# --- MongoDB Connection ---
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('DB_NAME', 'job_board_db') # Default DB name if not specified

if not MONGO_URI:
    print(f"[{datetime.now()}] ERROR: MONGO_URI environment variable not set in ai-microservice/.env. Exiting.", file=sys.stderr)
    sys.exit(1) # Exit if critical config is missing

try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME] # Connect to the specified database

    # Get references to your collections (matching Node.js collection names)
    users_collection = db.users
    jobs_collection = db.jobs
    applications_collection = db.applications
    companies_collection = db.companies

    print(f"[{datetime.now()}] Successfully connected to MongoDB: {DB_NAME}")

except Exception as e:
    print(f"[{datetime.now()}] ERROR: Could not connect to MongoDB at {MONGO_URI}. Error: {e}", file=sys.stderr)
    sys.exit(1) # Exit if MongoDB connection fails


# --- Utility Functions for fetching real data from MongoDB ---

def get_user_profile_from_db(user_id_str):
    """Fetches a user's detailed profile from MongoDB, matching Mongoose schema."""
    try:
        object_user_id = ObjectId(user_id_str)
    except Exception:
        print(f"[{datetime.now()}] Invalid user ID format provided: {user_id_str}", file=sys.stderr)
        return None

    user_doc = users_collection.find_one({"_id": object_user_id})
    if user_doc:
        return {
            "userId": str(user_doc["_id"]), # Explicitly convert _id to string
            "email": user_doc.get("email"),
            "fullName": user_doc.get("fullName"),
            "role": user_doc.get("role"),
            "skills": user_doc.get("skills", []),
            "experience": user_doc.get("experience", []),
            "education": user_doc.get("education", []),
            "projects": user_doc.get("projects", []),
            "certifications": user_doc.get("certifications", []),
            "languages": user_doc.get("languages", []),
            "jobPreferences": user_doc.get("jobPreferences", {})
        }
    print(f"[{datetime.now()}] User profile not found for ID: {user_id_str}")
    return None

def get_job_details_from_db(job_id_str):
    """
    Fetches detailed job information from MongoDB.
    Includes robust check for ObjectId conversion.
    """
    if not isinstance(job_id_str, str):
        print(f"[{datetime.now()}] get_job_details_from_db: Input job_id_str is not a string: {type(job_id_str)} value: {job_id_str}", file=sys.stderr)
        return None
    
    if not ObjectId.is_valid(job_id_str):
        print(f"[{datetime.now()}] get_job_details_from_db: Provided job_id_str is not a valid ObjectId format: {job_id_str}", file=sys.stderr)
        return None

    try:
        object_job_id = ObjectId(job_id_str)
    except Exception as e:
        print(f"[{datetime.now()}] get_job_details_from_db: Error converting job_id_str '{job_id_str}' to ObjectId: {e}", file=sys.stderr)
        return None

    job_doc = jobs_collection.find_one({"_id": object_job_id})
    if job_doc:
        company_name = ""
        if "company" in job_doc and job_doc["company"]:
            try:
                company_id_obj = job_doc["company"] if isinstance(job_doc["company"], ObjectId) else ObjectId(job_doc["company"])
                company_doc = companies_collection.find_one({"_id": company_id_obj})
                if company_doc:
                    company_name = company_doc.get("companyName", "")
            except Exception as e:
                print(f"[{datetime.now()}] Error fetching company name for job {job_id_str}: {e}")

        return {
            "jobId": str(job_doc["_id"]), # Explicitly convert _id to string
            "title": job_doc.get("title", ""),
            "description": job_doc.get("description", ""),
            "location": job_doc.get("location", ""),
            "jobType": job_doc.get("jobType", ""),
            "salaryRange": job_doc.get("salaryRange", {}),
            "requiredSkills": job_doc.get("requiredSkills", []),
            "preferredSkills": job_doc.get("preferredSkills", []),
            "technologiesUsed": job_doc.get("technologiesUsed", []),
            "seniorityLevel": job_doc.get("seniorityLevel", ""),
            "industry": job_doc.get("industry", ""),
            "companySize": job_doc.get("companySize", ""),
            "workEnvironment": job_doc.get("workEnvironment", []),
            "companyId": str(job_doc["company"]) if job_doc.get("company") else None, # Explicitly convert
            "companyName": company_name,
            "status": job_doc.get("status", "pending_review"),
            "createdAt": job_doc.get("createdAt").isoformat() if job_doc.get("createdAt") else None # Convert datetime object to ISO string
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
        all_jobs_cursor = jobs_collection.find({"status": "active"})
        general_jobs = []
        # --- START OF CHANGE: Added debugging print for job count (fallback) ---
        jobs_found_fallback = list(all_jobs_cursor)
        print(f"[{datetime.now()}] /recommend-jobs: Fallback - Number of active jobs found in DB: {len(jobs_found_fallback)}")
        # --- END OF CHANGE ---
        for job in jobs_found_fallback[:5]: # Iterate over the list
            job_id_str = str(job["_id"]) # Ensure _id is string here
            print(f"[{datetime.now()}] /recommend-jobs: Processing general job ID: {job_id_str}") # Debugging line
            job_full_details = get_job_details_from_db(job_id_str)
            if job_full_details:
                general_jobs.append({
                    "jobId": job_id_str, # Use the string ID
                    "score": 0.5,
                    "title": job_full_details.get("title"),
                    "company": {"companyName": job_full_details.get("companyName", "N/A")},
                    "location": job_full_details.get("location"),
                    "jobType": job_full_details.get("jobType"),
                    "description": job_full_details.get("description"),
                    "createdAt": job_full_details.get("createdAt")
                })
        return jsonify(general_jobs), 200

    user_skills_lower = set(s.lower() for s in user_profile.get('skills', []))

    all_jobs_cursor = jobs_collection.find({"status": "active"})
    all_jobs = list(all_jobs_cursor)
    # --- START OF CHANGE: Added debugging print for job count (personalized) ---
    print(f"[{datetime.now()}] /recommend-jobs: Personalized - Number of active jobs found in DB: {len(all_jobs)}")
    # --- END OF CHANGE ---
    
    personalized_recommendations = []

    if user_skills_lower:
        for job in all_jobs:
            job_skills_lower = set(s.lower() for s in job.get('requiredSkills', []) + job.get('preferredSkills', []))
            
            common_skills = user_skills_lower.intersection(job_skills_lower)
            
            score = 0.0
            reasons = []

            if common_skills:
                required_matched_count = len(user_skills_lower.intersection(set(s.lower() for s in job.get('requiredSkills', []))))
                preferred_matched_count = len(user_skills_lower.intersection(set(s.lower() for s in job.get('preferredSkills', []))))

                total_job_required_skills = len(job.get('requiredSkills', []))
                total_job_preferred_skills = len(job.get('preferredSkills', []))

                if total_job_required_skills > 0:
                    score += (required_matched_count / total_job_required_skills) * 0.7
                if total_job_preferred_skills > 0:
                    score += (preferred_matched_count / total_job_preferred_skills) * 0.3

                score = min(max(0, score), 1.0)

                reasons.append(f"Matched skills: {', '.join(list(common_skills))}")
            
            user_prefs = user_profile.get('jobPreferences', {})
            job_location = job.get('location', '').lower()
            job_type = job.get('jobType', '').lower()
            job_seniority = job.get('seniorityLevel', '').lower()
            job_industry = job.get('industry', '').lower()

            if user_prefs.get('locations') and job_location in [loc.lower() for loc in user_prefs['locations']]:
                score += 0.1
                reasons.append("Location preference matched.")
            
            if user_prefs.get('jobTypes') and job_type in [jt.lower() for jt in user_prefs['jobTypes']]:
                score += 0.05

            if user_prefs.get('seniorityLevelPreference') and job_seniority in [sl.lower() for sl in user_prefs['seniorityLevelPreference']]:
                score += 0.1

            if user_prefs.get('industries') and job_industry in [ind.lower() for ind in user_prefs['industries']]:
                score += 0.1

            score = min(max(0, score), 1.0)

            if score > 0:
                job_id_str = str(job["_id"]) # Ensure _id is string here
                print(f"[{datetime.now()}] /recommend-jobs: Processing personalized job ID: {job_id_str}") # Debugging line
                job_full_details = get_job_details_from_db(job_id_str)
                if job_full_details:
                    personalized_recommendations.append({
                        "jobId": job_id_str, # Use the string ID
                        "score": round(score, 4),
                        "reasons": reasons,
                        "title": job_full_details.get("title"),
                        "company": {"companyName": job_full_details.get("companyName", "N/A")},
                        "location": job_full_details.get("location"),
                        "jobType": job_full_details.get("jobType"),
                        "description": job_full_details.get("description"),
                        "createdAt": job_full_details.get("createdAt")
                    })
        
        personalized_recommendations.sort(key=lambda x: x['score'], reverse=True)
        
        if personalized_recommendations:
            print(f"[{datetime.now()}] /recommend-jobs: Found {len(personalized_recommendations)} personalized recommendations for {user_id}.")
            return jsonify(personalized_recommendations)

    print(f"[{datetime.now()}] /recommend-jobs: No personalized recommendations based on skills/preferences for {user_id}. Showing general jobs.")
    all_jobs_cursor = jobs_collection.find({"status": "active"})
    general_jobs = []
    # --- START OF CHANGE: Added debugging print for job count (general) ---
    jobs_found_general = list(all_jobs_cursor)
    print(f"[{datetime.now()}] /recommend-jobs: General - Number of active jobs found in DB: {len(jobs_found_general)}")
    # --- END OF CHANGE ---
    for job in jobs_found_general[:5]: # Iterate over the list
        job_id_str = str(job["_id"]) # Ensure _id is string here
        print(f"[{datetime.now()}] /recommend-jobs: Processing general job ID (fallback): {job_id_str}") # Debugging line
        job_full_details = get_job_details_from_db(job_id_str)
        if job_full_details:
            general_jobs.append({
                "jobId": job_id_str, # Use the string ID
                "score": 0.5,
                "title": job_full_details.get("title"),
                "company": {"companyName": job_full_details.get("companyName", "N/A")},
                "location": job_full_details.get("location"),
                "jobType": job_full_details.get("jobType"),
                "description": job_full_details.get("description"),
                "createdAt": job_full_details.get("createdAt")
            })
    return jsonify(general_jobs)


@app.route('/api/v1/ai/detect-scam', methods=['POST'])
def detect_scam():
    """
    Detects if a job posting is potentially a scam.
    Expects JSON: {"jobTitle": "...", "jobDescription": "...", "companyName": "..."}
    """
    job_data = request.json
    # --- START OF CHANGE: Corrected key names to match incoming JSON ---
    title = job_data.get('jobTitle', '').lower()
    description = job_data.get('jobDescription', '').lower()
    # --- END OF CHANGE ---
    company_name = job_data.get('companyName', '').lower()

    if not title and not description:
        print(f"[{datetime.now()}] /detect-scam: Missing job title and description.")
        return jsonify({"message": "Job title or description is required for scam detection."}), 400

    is_suspicious = False
    score = 0.0 # Score from 0 to 1, higher = more suspicious
    flags = []

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
            score += 0.1

    if ("no experience" in description or "entry level" in title) and \
       (any(s in description for s in ["100k", "150k", "200k", "high salary", "six figure"])) :
        is_suspicious = True
        flags.append("Suspicious: High pay for little or no experience mentioned.")
        score += 0.2

    if "urgent hiring" in combined_text and "immediate start" in combined_text and \
       not (re.search(r'experience|qualifications|skills', description)):
        is_suspicious = True
        flags.append("Suspicious: Urgent hiring without clear qualifications mentioned in description.")
        score += 0.1

    if company_name and company_name in ["confidential", "anonymous", "private employer"]:
        is_suspicious = True
        flags.append(f"Vague company name: '{company_name}'.")
        score += 0.05

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
    Expects JSON: {"jobId": "...", "applicantIds": ["...", "..."]}
    (AI service will fetch full user profiles and job details from DB)
    """
    data = request.json
    job_id = data.get('jobId')
    applicant_ids = data.get('applicantIds', [])
    
    if not job_id or not applicant_ids:
        print(f"[{datetime.now()}] /screen-candidates: Missing jobId or applicantIds.")
        return jsonify({"message": "jobId and applicantIds are required."}), 400

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

        applicant_skills_lower = set(s.lower() for s in applicant_profile.get('skills', []))
        
        score = 0.0
        reasons = []

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
        else:
            score += 60
            reasons.append("No specific required skills for this job.")

        matched_preferred_skills = preferred_skills_lower.intersection(applicant_skills_lower)
        if preferred_skills_lower:
            preferred_skill_match_percentage = (len(matched_preferred_skills) / len(preferred_skills_lower))
            score += preferred_skill_match_percentage * 30
            if matched_preferred_skills:
                reasons.append(f"Matched preferred skills: {', '.join(list(matched_preferred_skills))}.")
        
        job_seniority = job_details.get("seniorityLevel", "").lower()
        applicant_experience_titles = [exp.get("title", "").lower() for exp in applicant_profile.get('experience', [])]
        
        if "senior" in job_seniority and not any("senior" in title for title in applicant_experience_titles):
            score = max(0, score - 10)
            reasons.append("Job is 'Senior' level, but applicant lacks explicit senior experience.")
        elif "entry-level" in job_seniority and any("senior" in title for title in applicant_experience_titles):
            score = max(0, score - 5)
            reasons.append("Job is 'Entry-level', applicant appears overqualified.")
        else:
            score += 10

        score = min(max(0, score), 100)

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
    Expects JSON: {"userId": "...", "jobId": "..."}
    (AI service will fetch full userProfile and jobDetails from DB)
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

    user_skills_lower = set(s.lower() for s in user_profile.get('skills', []))
    job_required_skills_lower = set(s.lower() for s in job_details.get('requiredSkills', []))
    job_preferred_skills_lower = set(s.lower() for s in job_details.get('preferredSkills', []))

    missing_required_skills = job_required_skills_lower - user_skills_lower
    if missing_required_skills:
        suggestions.append(f"Consider adding the following required skills to your profile: {', '.join(list(missing_required_skills))}.")
        tailored_resume_preview += f"**Skills (tailored):** {', '.join(list(user_skills_lower.union(missing_required_skills)))}\n"
    else:
        tailored_resume_preview += f"**Skills:** {', '.join(list(user_skills_lower))}\n"


    missing_preferred_skills = job_preferred_skills_lower - user_skills_lower
    if missing_preferred_skills:
        suggestions.append(f"Highlight any experience or projects related to these preferred skills: {', '.join(list(missing_preferred_skills))}.")
    
    job_description_lower = job_details.get('description', '').lower()
    
    stop_words = set(stopwords.words('english'))
    words = word_tokenize(job_description_lower)
    filtered_words = [w for w in words if w.isalnum() and w not in stop_words]
    
    relevant_keywords = set()
    for word in filtered_words:
        if len(word) > 2 and word not in ['the', 'and', 'for', 'with', 'you', 'your', 'this', 'that']:
            relevant_keywords.add(word)

    experience_text = " ".join([exp.get("description", "").lower() for exp in user_profile.get('experience', [])])
    projects_text = " ".join([proj.get("description", "").lower() for proj in user_profile.get('projects', [])])

    for keyword in relevant_keywords:
        if keyword in job_description_lower and keyword not in experience_text and keyword not in projects_text:
            suggestions.append(f"The job description mentions '{keyword}'. If you have experience with this, elaborate on it in your experience or projects section to improve relevance.")

    user_prefs = user_profile.get('jobPreferences', {})
    job_location = job_details.get('location', '').lower()
    job_type = job_details.get('jobType', '').lower()
    job_seniority = job_details.get('seniorityLevel', '').lower()
    job_industry = job_details.get('industry', '').lower()

    if user_prefs.get('locations') and job_location not in [loc.lower() for loc in user_prefs['locations']]:
        suggestions.append(f"The job is in '{job_details.get('location')}'. If you are open to this location, consider mentioning your flexibility or willingness to relocate.")
    
    if user_prefs.get('jobTypes') and job_type not in [jt.lower() for jt in user_prefs['jobTypes']]:
        suggestions.append(f"The job type is '{job_details.get('jobType')}'. If this aligns with your current goals, ensure your profile reflects this preference.")

    if user_prefs.get('seniorityLevelPreference') and job_seniority not in [sl.lower() for sl in user_prefs['seniorityLevelPreference']]:
        suggestions.append(f"The job is '{job_details.get('seniorityLevel')}' level. If your experience matches, emphasize relevant achievements for this level.")

    if user_prefs.get('industries') and job_industry not in [ind.lower() for ind in user_prefs['industries']]:
        suggestions.append(f"The job is in the '{job_details.get('industry')}' industry. If you have any experience or interest in this sector, highlight it.")


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
    interaction_type = data.get('type')

    if not user_id or not job_id or not interaction_type:
        return jsonify({"message": "userId, jobId, and type are required."}), 400

    print(f"[{datetime.now()}] /notify-job-interaction: User {user_id} interacted with job {job_id} (Type: {interaction_type}).")
    return jsonify({"message": "Job interaction notification received by AI service."})


if __name__ == '__main__':
    # --- START OF CHANGE: Disabled reloader to prevent WinError 10038 on some Windows setups ---
    app.run(host='0.0.0.0', port=os.getenv('AI_SERVICE_PORT', 5000), debug=True, use_reloader=False)
    # --- END OF CHANGE ---
