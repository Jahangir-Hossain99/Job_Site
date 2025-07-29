// src/components/UserProfile.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/apiClient'; // Your API client
import { jwtDecode } from 'jwt-decode'; // Import jwtDecode for token decoding

// Import Lucide React icons for better visual appeal
import {
    Mail, Phone, MapPin, Briefcase, GraduationCap, Building,
    DollarSign, LayoutGrid, Award, Lightbulb, Save, X, Download,
    PlusCircle,
    Trash2
} from 'lucide-react';

// Helper for deep comparison (simple version for objects/arrays of primitives)
const deepEqual = (a, b) => {
    if (a === b) return true;
    if (a == null || typeof a !== 'object' || b == null || typeof b !== 'object') return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
            return false;
        }
    }
    return true;
};

const UserProfile = () => {
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Removed isEditing state, replaced by editingField for per-field edit
    const [formData, setFormData] = useState({}); // formData will hold the editable values.
    const [updateMessage, setUpdateMessage] = useState(null); // For success/error messages after update
    const [editingField, setEditingField] = useState(null); // Tracks which field is currently being inline edited
    const [hasChanges, setHasChanges] = useState(false); // Tracks if formData differs from userProfile

    // Refs for file inputs to clear them if needed
    const profilePictureInputRef = useRef(null);
    const resumeInputRef = useRef(null);
    const companyLogoInputRef = useRef(null); // Added for company logo

    // Ref for the currently active inline input for programmatic focus
    const activeInlineInputRef = useRef(null); // Re-introduced for focusing the clicked input

    // Helper to format Date objects for input type="date"
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    // Helper to format Date objects for display
    const formatDisplayDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // Define options for checkboxes based on your schema and common practices
    const jobTypesOptions = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary', 'Volunteer'];
    const seniorityLevelOptions = ['Entry-level', 'Mid-level', 'Senior', 'Manager', 'Executive'];
    const companySizeOptions = ['Small (1-50)', 'Medium (51-500)', 'Large (501+)'];
    const workEnvironmentOptions = ['On-site', 'Remote', 'Hybrid', 'Collaborative', 'Independent', 'Fast-paced', 'Relaxed'];

    // Effect to fetch user profile on component mount or user change
    useEffect(() => {
        const fetchUserProfile = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setError("You are not logged in. Please log in to view your profile.");
                    setLoading(false);
                    return;
                }

                let userId = null;
                try {
                    const decodedToken = jwtDecode(token);
                    userId = decodedToken.id;

                    if (!userId) {
                        setError("User ID not found in token. Please log in again.");
                        setLoading(false);
                        return;
                    }
                } catch (decodeError) {
                    console.error("Error decoding token:", decodeError);
                    setError("Invalid or expired token. Please log in again.");
                    setLoading(false);
                    return;
                }

                const response = await api.getUserProfile(userId);
                setUserProfile(response.data);

                // Initialize form data with current user profile data for editing
                setFormData({
                    ...response.data,
                    jobPreferences: { ...response.data.jobPreferences },
                    education: response.data.education?.map(edu => ({
                        ...edu,
                        current: !edu.endDate,
                        startDate: edu.startDate ? formatDate(edu.startDate) : '',
                        endDate: edu.endDate ? formatDate(edu.endDate) : ''
                    })) || [],
                    experience: response.data.experience?.map(exp => ({
                        ...exp,
                        current: !exp.endDate,
                        startDate: exp.startDate ? formatDate(exp.startDate) : '',
                        endDate: exp.endDate ? formatDate(exp.endDate) : ''
                    })) || [],
                    certifications: response.data.certifications?.map(cert => ({
                        ...cert,
                        issueDate: cert.issueDate ? formatDate(cert.issueDate) : '',
                        expirationDate: cert.expirationDate ? formatDate(cert.expirationDate) : ''
                    })) || [],
                    projects: response.data.projects || [],
                    languages: response.data.languages || [],
                    profilePictureFile: null,
                    resumeFile: null,
                    logoFile: null,
                });
            } catch (err) {
                console.error("Error fetching user profile:", err);
                if (err.response && err.response.status === 401) {
                    setError("Your session has expired. Please log in again.");
                } else if (err.response && err.response.data && err.response.data.message) {
                    setError(`Failed to load user profile: ${err.response.data.message}`);
                } else {
                    setError("Failed to load user profile. Please try again later.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, []);

    // Effect to manage success message timeout
    useEffect(() => {
        let timer;
        if (updateMessage) {
            timer = setTimeout(() => {
                setUpdateMessage(null);
            }, 5000);
        }
        return () => clearTimeout(timer);
    }, [updateMessage]);

    // Effect to determine if there are changes for the save button
    useEffect(() => {
        // Deep compare formData with userProfile (excluding file objects)
        const compareData = (data1, data2) => {
            if (!data1 || !data2) return data1 !== data2; // Handle null/undefined cases

            const clonedData1 = { ...data1 };
            const clonedData2 = { ...data2 };

            // Remove file objects from comparison as they are transient
            delete clonedData1.profilePictureFile;
            delete clonedData1.resumeFile;
            delete clonedData1.logoFile;
            delete clonedData2.profilePictureFile;
            delete clonedData2.resumeFile;
            delete clonedData2.logoFile;

            // Convert array strings back to arrays for comparison if they were joined
            if (clonedData1.skills && typeof clonedData1.skills === 'string') {
                clonedData1.skills = clonedData1.skills.split(',').map(s => s.trim()).filter(s => s);
            }
            if (clonedData2.skills && typeof clonedData2.skills === 'string') {
                clonedData2.skills = clonedData2.skills.split(',').map(s => s.trim()).filter(s => s);
            }
            if (clonedData1.languages && typeof clonedData1.languages === 'string') {
                clonedData1.languages = clonedData1.languages.split(',').map(s => s.trim()).filter(s => s);
            }
            if (clonedData2.languages && typeof clonedData2.languages === 'string') {
                clonedData2.languages = clonedData2.languages.split(',').map(s => s.trim()).filter(s => s);
            }

            // For jobPreferences, ensure nested arrays are compared correctly
            if (clonedData1.jobPreferences && clonedData2.jobPreferences) {
                clonedData1.jobPreferences = {
                    ...clonedData1.jobPreferences,
                    locations: Array.isArray(clonedData1.jobPreferences.locations) ? clonedData1.jobPreferences.locations : (clonedData1.jobPreferences.locations?.split(',').map(s => s.trim()).filter(s => s) || []),
                    industries: Array.isArray(clonedData1.jobPreferences.industries) ? clonedData1.jobPreferences.industries : (clonedData1.jobPreferences.industries?.split(',').map(s => s.trim()).filter(s => s) || []),
                };
                clonedData2.jobPreferences = {
                    ...clonedData2.jobPreferences,
                    locations: Array.isArray(clonedData2.jobPreferences.locations) ? clonedData2.jobPreferences.locations : (clonedData2.jobPreferences.locations?.split(',').map(s => s.trim()).filter(s => s) || []),
                    industries: Array.isArray(clonedData2.jobPreferences.industries) ? clonedData2.jobPreferences.industries : (clonedData2.jobPreferences.industries?.split(',').map(s => s.trim()).filter(s => s) || []),
                };
            }

            // Re-format dates in userProfile for comparison with formData
            const formatForComparison = (data) => {
                if (!data) return data;
                const newData = { ...data };
                if (newData.education) {
                    newData.education = newData.education.map(edu => ({
                        ...edu,
                        startDate: edu.startDate ? formatDate(edu.startDate) : '',
                        endDate: edu.endDate ? formatDate(edu.endDate) : ''
                    }));
                }
                if (newData.experience) {
                    newData.experience = newData.experience.map(exp => ({
                        ...exp,
                        startDate: exp.startDate ? formatDate(exp.startDate) : '',
                        endDate: exp.endDate ? formatDate(exp.endDate) : ''
                    }));
                }
                if (newData.certifications) {
                    newData.certifications = newData.certifications.map(cert => ({
                        ...cert,
                        issueDate: cert.issueDate ? formatDate(cert.issueDate) : '',
                        expirationDate: cert.expirationDate ? formatDate(cert.expirationDate) : ''
                    }));
                }
                return newData;
            };

            const profileForComparison = formatForComparison(userProfile);
            const formForComparison = formatForComparison(formData);

            return !deepEqual(formForComparison, profileForComparison);
        };

        // Only compare if userProfile is loaded
        if (userProfile) {
            setHasChanges(compareData(formData, userProfile));
        }
    }, [formData, userProfile]);


    // Handle form input changes for simple string/number fields
    const handleChange = (e) => {
        const { name, value, type } = e.target;
        // Handle nested objects like jobPreferences.min or jobPreferences.max
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: type === 'number' ? Number(value) : value
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
        }
    };

    // Handle checkbox changes for array fields (e.g., job preferences checkboxes)
    const handleCheckboxChange = (e) => {
        const { name, value, checked } = e.target;
        const [parent, child] = name.split('.'); // e.g., 'jobPreferences', 'jobTypes'

        setFormData(prev => {
            const currentArray = prev[parent]?.[child] || [];
            let newArray;

            if (checked) {
                newArray = [...currentArray, value];
            } else {
                newArray = currentArray.filter(item => item !== value);
            }

            return {
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: newArray
                }
            };
        });
    };

    // Handle array input changes for text fields (e.g., skills, locations, industries, languages)
    const handleArrayTextInputChange = (e) => {
        const { name, value } = e.target;
        // Split by comma, trim whitespace, and filter out empty strings
        const arrayValue = value.split(',').map(item => item.trim()).filter(item => item !== '');

        // Handle nested arrays like jobPreferences.locations
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: arrayValue
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: arrayValue }));
        }
    };

    // --- File Upload Handlers ---
    const handleFileChange = (e) => {
        const { name, files } = e.target;
        if (files && files[0]) {
            setFormData(prev => ({ ...prev, [name]: files[0] }));
        } else {
            setFormData(prev => ({ ...prev, [name]: null }));
        }
    };

    // --- Education Specific Handlers ---
    const handleEducationChange = (index, e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => {
            const newEducation = [...prev.education];
            if (name === 'current') {
                newEducation[index] = {
                    ...newEducation[index],
                    current: checked,
                    endDate: checked ? '' : newEducation[index].endDate // Clear endDate if current
                };
            } else {
                newEducation[index] = {
                    ...newEducation[index],
                    [name]: type === 'number' ? Number(value) : value
                };
            }
            return { ...prev, education: newEducation };
        });
    };

    const handleAddEducation = () => {
        setFormData(prev => ({
            ...prev,
            education: [...prev.education, {
                degree: '',
                fieldOfStudy: '',
                institution: '',
                startDate: '',
                endDate: '',
                description: '',
                current: false
            }]
        }));
    };

    const handleRemoveEducation = (index) => {
        setFormData(prev => ({
            ...prev,
            education: prev.education.filter((_, i) => i !== index)
        }));
    };
    // --- End Education Specific Handlers ---

    // --- Experience Specific Handlers ---
    const handleExperienceChange = (index, e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => {
            const newExperience = [...prev.experience];
            if (name === 'current') {
                newExperience[index] = {
                    ...newExperience[index],
                    current: checked,
                    endDate: checked ? '' : newExperience[index].endDate
                };
            } else {
                newExperience[index] = {
                    ...newExperience[index],
                    [name]: type === 'number' ? Number(value) : value
                };
            }
            return { ...prev, experience: newExperience };
        });
    };

    const handleAddExperience = () => {
        setFormData(prev => ({
            ...prev,
            experience: [...prev.experience, {
                title: '',
                company: '',
                location: '',
                startDate: '',
                endDate: '',
                description: '',
                current: false
            }]
        }));
    };

    const handleRemoveExperience = (index) => {
        setFormData(prev => ({
            ...prev,
            experience: prev.experience.filter((_, i) => i !== index)
        }));
    };
    // --- End Experience Specific Handlers ---

    // --- Certifications Specific Handlers ---
    const handleCertificationChange = (index, e) => {
        const { name, value, type } = e.target;
        setFormData(prev => {
            const newCertifications = [...prev.certifications];
            newCertifications[index] = {
                ...newCertifications[index],
                [name]: type === 'number' ? Number(value) : value
            };
            return { ...prev, certifications: newCertifications };
        });
    };

    const handleAddCertification = () => {
        setFormData(prev => ({
            ...prev,
            certifications: [...prev.certifications, {
                name: '',
                issuingOrganization: '',
                issueDate: '',
                expirationDate: '',
                credentialId: '',
                credentialUrl: ''
            }]
        }));
    };

    const handleRemoveCertification = (index) => {
        setFormData(prev => ({
            ...prev,
            certifications: prev.certifications.filter((_, i) => i !== index)
        }));
    };
    // --- End Certifications Specific Handlers ---

    // --- Projects Specific Handlers ---
    const handleProjectChange = (index, e) => {
        const { name, value, type } = e.target;
        setFormData(prev => {
            const newProjects = [...prev.projects];
            if (name === 'technologiesUsed') {
                newProjects[index] = {
                    ...newProjects[index],
                    [name]: value.split(',').map(s => s.trim()).filter(s => s)
                };
            } else {
                newProjects[index] = {
                    ...newProjects[index],
                    [name]: type === 'number' ? Number(value) : value
                };
            }
            return { ...prev, projects: newProjects };
        });
    };

    const handleAddProject = () => {
        setFormData(prev => ({
            ...prev,
            projects: [...prev.projects, {
                title: '',
                description: '',
                technologiesUsed: [],
                projectUrl: ''
            }]
        }));
    };

    const handleRemoveProject = (index) => {
        setFormData(prev => ({
            ...prev,
            projects: prev.projects.filter((_, i) => i !== index)
        }));
    };
    // --- End Projects Specific Handlers ---

    // --- Languages Specific Handlers ---
    const handleLanguageChange = (index, e) => {
        const { name, value, type } = e.target;
        setFormData(prev => {
            const newLanguages = [...prev.languages];
            newLanguages[index] = {
                ...newLanguages[index],
                [name]: type === 'number' ? Number(value) : value
            };
            return { ...prev, languages: newLanguages };
        });
    };

    const handleAddLanguage = () => {
        setFormData(prev => ({
            ...prev,
            languages: [...prev.languages, {
                name: '',
                proficiency: ''
            }]
        }));
    };

    const handleRemoveLanguage = (index) => {
        setFormData(prev => ({
            ...prev,
            languages: prev.languages.filter((_, i) => i !== index)
        }));
    };
    // --- End Languages Specific Handlers ---


    const handleSave = async () => {
        setLoading(true);
        setUpdateMessage(null);
        setError(null);
        setEditingField(null); // Exit any active inline edit field

        try {
            const token = localStorage.getItem('token');
            const decodedToken = jwtDecode(token);
            const userId = decodedToken.id;

            const dataToSend = new FormData();

            // Append all non-file form data
            for (const key in formData) {
                if (key === 'profilePictureFile' || key === 'resumeFile' || key === 'logoFile') {
                    continue;
                }
                if (key === 'jobPreferences' || key === 'education' || key === 'experience' || key === 'certifications' || key === 'projects' || key === 'languages') {
                    // Stringify complex objects and arrays
                    // Special handling for education dates
                    if (key === 'education') {
                        const processedEducation = formData.education.map(edu => {
                            const newEdu = { ...edu };
                            if (newEdu.current) {
                                delete newEdu.endDate;
                            }
                            delete newEdu.current;
                            if (newEdu.startDate) newEdu.startDate = new Date(newEdu.startDate).toISOString();
                            if (newEdu.endDate) newEdu.endDate = new Date(newEdu.endDate).toISOString();
                            return newEdu;
                        });
                        dataToSend.append(key, JSON.stringify(processedEducation));
                    }
                    // Special handling for experience dates
                    else if (key === 'experience') {
                        const processedExperience = formData.experience.map(exp => {
                            const newExp = { ...exp };
                            if (newExp.current) {
                                delete newExp.endDate;
                            }
                            delete newExp.current;
                            if (newExp.startDate) newExp.startDate = new Date(newExp.startDate).toISOString();
                            if (newExp.endDate) newExp.endDate = new Date(newExp.endDate).toISOString();
                            return newExp;
                        });
                        dataToSend.append(key, JSON.stringify(processedExperience));
                    }
                    // Special handling for certifications dates
                    else if (key === 'certifications') {
                        const processedCertifications = formData.certifications.map(cert => {
                            const newCert = { ...cert };
                            if (newCert.issueDate) newCert.issueDate = new Date(newCert.issueDate).toISOString();
                            if (newCert.expirationDate) newCert.expirationDate = new Date(newCert.expirationDate).toISOString();
                            return newCert;
                        });
                        dataToSend.append(key, JSON.stringify(processedCertifications));
                    }
                    // Special handling for projects (technologiesUsed array)
                    else if (key === 'projects') {
                        const processedProjects = formData.projects.map(proj => ({
                            ...proj,
                            // Ensure technologiesUsed is an array of strings
                            technologiesUsed: Array.isArray(proj.technologiesUsed) ? proj.technologiesUsed : (proj.technologiesUsed?.split(',').map(s => s.trim()).filter(s => s) || [])
                        }));
                        dataToSend.append(key, JSON.stringify(processedProjects));
                    }
                    else {
                        dataToSend.append(key, JSON.stringify(formData[key]));
                    }
                }
                else if (typeof formData[key] === 'object' && formData[key] !== null) {
                    dataToSend.append(key, JSON.stringify(formData[key]));
                }
                else {
                    dataToSend.append(key, formData[key]);
                }
            }

            // Append file data if new files are selected
            if (formData.profilePictureFile) {
                dataToSend.append('profilePicture', formData.profilePictureFile);
            }
            if (formData.resumeFile) {
                dataToSend.append('resume', formData.resumeFile);
            }
            if (formData.logoFile) {
                dataToSend.append('logo', formData.logoFile);
            }

            const response = await api.updateUserProfile(userId, dataToSend);
            setUserProfile(response.data);

            // Re-initialize formData from the fresh response data to ensure consistency
            if (profilePictureInputRef.current) profilePictureInputRef.current.value = '';
            if (resumeInputRef.current) resumeInputRef.current.value = '';
            if (companyLogoInputRef.current) companyLogoInputRef.current.value = '';

            setFormData({
                ...response.data,
                jobPreferences: { ...response.data.jobPreferences },
                education: response.data.education?.map(edu => ({
                    ...edu,
                    current: !edu.endDate,
                    startDate: edu.startDate ? formatDate(edu.startDate) : '',
                    endDate: edu.endDate ? formatDate(edu.endDate) : ''
                })) || [],
                experience: response.data.experience?.map(exp => ({
                    ...exp,
                    current: !exp.endDate,
                    startDate: exp.startDate ? formatDate(exp.startDate) : '',
                    endDate: exp.endDate ? formatDate(exp.endDate) : ''
                })) || [],
                certifications: response.data.certifications?.map(cert => ({
                    ...cert,
                    issueDate: cert.issueDate ? formatDate(cert.issueDate) : '',
                    expirationDate: cert.expirationDate ? formatDate(cert.expirationDate) : ''
                })) || [],
                projects: response.data.projects || [],
                languages: response.data.languages || [],
                profilePictureFile: null,
                resumeFile: null,
                logoFile: null,
            });
            // No global isEditing state, so no need to set it to false here.
            setUpdateMessage("Profile updated successfully!");
        } catch (err) {
            console.error("Error updating user profile:", err);
            if (err.response && err.response.data && err.response.data.message) {
                setError(`Failed to update profile: ${err.response.data.message}`);
            } else {
                setError("Failed to update profile. Please try again later.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingField(null); // Clear any active inline edit field
        // Reset formData to the original userProfile data
        setFormData({
            ...userProfile,
            jobPreferences: { ...userProfile.jobPreferences },
            education: userProfile.education?.map(edu => ({
                ...edu,
                current: !edu.endDate,
                startDate: edu.startDate ? formatDate(edu.startDate) : '',
                endDate: edu.endDate ? formatDate(edu.endDate) : ''
            })) || [],
            experience: userProfile.experience?.map(exp => ({
                ...exp,
                current: !exp.endDate,
                startDate: exp.startDate ? formatDate(exp.startDate) : '',
                endDate: exp.endDate ? formatDate(exp.endDate) : ''
            })) || [],
            certifications: userProfile.certifications?.map(cert => ({
                ...cert,
                issueDate: cert.issueDate ? formatDate(cert.issueDate) : '',
                expirationDate: cert.expirationDate ? formatDate(cert.expirationDate) : ''
            })) || [],
            projects: userProfile.projects || [],
            languages: userProfile.languages || [],
            profilePictureFile: null,
            resumeFile: null,
            logoFile: null,
        });
        // Clear file inputs
        if (profilePictureInputRef.current) profilePictureInputRef.current.value = '';
        if (resumeInputRef.current) resumeInputRef.current.value = '';
        if (companyLogoInputRef.current) companyLogoInputRef.current.value = '';
        setError(null);
        setUpdateMessage(null);
    };

    // Callback to focus the input when editingField changes
    useEffect(() => {
        if (editingField && activeInlineInputRef.current) {
            activeInlineInputRef.current.focus();
        }
    }, [editingField]);


    // Helper function to render a field in either display or edit mode
    const renderField = useCallback((label, name, value, type = 'text', icon = null, arrayHandler = null, arrayIndex = null) => {
        const isCurrentlyEditing = editingField === name; // Check if THIS field is being edited

        // Determine the actual value to display/edit based on type
        let displayValue = value;
        if (type === 'date') {
            displayValue = value ? formatDisplayDate(value) : 'N/A';
        } else if (Array.isArray(value)) {
            displayValue = value.join(', ') || 'N/A';
        } else if (value === null || value === undefined || value === '') {
            displayValue = 'N/A';
        }

        // Determine the current value from formData
        let currentFieldValue;
        if (arrayIndex !== null && arrayHandler) {
            const topLevelArrayName = name.split('.')[0];
            const fieldName = name.split('.').pop();
            currentFieldValue = formData[topLevelArrayName]?.[arrayIndex]?.[fieldName] || '';
        } else if (name.includes('.')) { // For nested objects like jobPreferences.min
            const [parent, child] = name.split('.');
            currentFieldValue = formData[parent]?.[child] || '';
        } else {
            currentFieldValue = formData[name] || '';
        }

        return (
            <div className="flex flex-col mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2 flex items-center">
                    {icon && React.createElement(icon, { size: 20, className: "mr-2 text-gray-500" })}
                    {label}:
                </label>
                {isCurrentlyEditing ? (
                    type === 'textarea' ? (
                        <textarea
                            id={name}
                            name={name.split('.').pop()} // Use only the field name for the input's 'name'
                            value={currentFieldValue}
                            onChange={arrayHandler ? (e) => arrayHandler(arrayIndex, e) : handleChange}
                            onBlur={() => setEditingField(null)} // Exit edit mode for this field on blur
                            ref={activeInlineInputRef} // Attach ref for focus
                            rows="3"
                            className="shadow-sm appearance-none border border-blue-300 rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 transition-all duration-200"
                        />
                    ) : (
                        <input
                            type={type}
                            id={name}
                            name={name.split('.').pop()} // Use only the field name for the input's 'name'
                            value={currentFieldValue}
                            onChange={arrayHandler ? (e) => arrayHandler(arrayIndex, e) : handleChange}
                            onBlur={() => setEditingField(null)} // Exit edit mode for this field on blur
                            ref={activeInlineInputRef} // Attach ref for focus
                            className="shadow-sm appearance-none border border-blue-300 rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 transition-all duration-200"
                        />
                    )
                ) : (
                    <span
                        className={`text-gray-800 text-lg font-medium block p-2 rounded-md transition-colors duration-200 cursor-pointer hover:bg-gray-100`}
                        onClick={() => setEditingField(name)} // Set this field as editing on click
                    >
                        {displayValue}
                    </span>
                )}
            </div>
        );
    }, [editingField, formData, handleChange, formatDisplayDate, activeInlineInputRef, setEditingField]); // Dependencies for useCallback

    if (loading) {
        return <div className="text-center p-8 text-xl text-blue-600">Loading profile...</div>;
    }

    if (error && !userProfile) { // Show error if no profile data and not trying to edit
        return <div className="text-center p-8 text-xl text-red-600 border border-red-300 bg-red-50 rounded-lg mx-auto max-w-md">{error}</div>;
    }

    if (!userProfile) {
        return <div className="text-center p-8 text-xl text-gray-600">No profile data found.</div>;
    }

    const isJobSeeker = userProfile.role === 'jobseeker';
    const isCompany = userProfile.role === 'company';

    return (
        <div className="container mx-auto p-8 bg-gray-50 min-h-[calc(100vh-120px)]">
            <div className="bg-white rounded-xl shadow-lg p-10 max-w-6xl mx-auto border border-gray-200">
                <div className="flex justify-between items-center mb-8 border-b pb-4">
                    <h2 className="text-4xl font-extrabold text-gray-900 leading-tight">
                        {isJobSeeker ? "Job Seeker Profile" :
                         isCompany ? "Company Profile" :
                         "User Profile"}
                    </h2>
                    {/* Removed the main Edit Profile button */}
                </div>

                {updateMessage && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4 flex items-center animate-fade-in-down" role="alert">
                        <Lightbulb size={20} className="mr-2" />
                        <span className="block sm:inline">{updateMessage}</span>
                    </div>
                )}
                {error && ( // Show error regardless of edit mode if it's a general error
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 flex items-center animate-fade-in-down" role="alert">
                        <Trash2 size={20} className="mr-2" />
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                {/* Display Mode (which is now always active, with inline editing) */}
                <div className="space-y-8">
                    {/* Basic Information Section */}
                    <div className="pb-4 border-b border-gray-200">
                        <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                            <Award size={24} className="mr-3 text-blue-600" /> Basic Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 text-lg text-gray-700">
                            {/* Email is read-only, so no renderField for it */}
                            <p className="flex items-center"><Mail size={20} className="mr-3 text-gray-500" /> <strong>Email:</strong> {userProfile.email}</p>
                            {isJobSeeker && (
                                <>
                                    {renderField('Full Name', 'fullName', userProfile.fullName, 'text')}
                                    {renderField('Phone Number', 'phoneNumber', userProfile.phoneNumber, 'text')}
                                    {renderField('Location', 'location', userProfile.location, 'text')}
                                    {renderField('Headline', 'headline', userProfile.headline, 'text')}
                                </>
                            )}
                            {isCompany && (
                                <>
                                    {renderField('Company Name', 'companyName', userProfile.companyName, 'text')}
                                    {renderField('Industry', 'industry', userProfile.industry, 'text')}
                                    {renderField('Website', 'website', userProfile.website, 'url')}
                                    {renderField('Headquarters', 'headquarters', userProfile.headquarters, 'text')}
                                    {renderField('Contact Person', 'contactPerson', userProfile.contactPerson, 'text')}
                                    {renderField('Contact Phone', 'contactPhone', userProfile.contactPhone, 'text')}
                                </>
                            )}
                        </div>
                        {/* Profile Picture / Company Logo Display (File inputs are handled separately below) */}
                        {(userProfile.profilePictureUrl && isJobSeeker) && (
                            <div className="mt-6 flex flex-col items-start">
                                <p className="text-gray-600 font-semibold mb-2">Profile Picture:</p>
                                <img src={userProfile.profilePictureUrl} alt="Profile" className="w-24 h-24 object-cover rounded-full border-2 border-blue-400 shadow-md" onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/96x96/cccccc/333333?text=No+Image"; }} />
                                {/* File input for profile picture */}
                                <div className="flex flex-col mt-4 w-full">
                                    <label htmlFor="profilePictureFile" className="block text-gray-700 text-sm font-bold mb-2">Change Picture:</label>
                                    <input
                                        type="file"
                                        id="profilePictureFile"
                                        name="profilePictureFile"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        ref={profilePictureInputRef}
                                        className="block w-full text-sm text-gray-500
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded-md file:border-0
                                            file:text-sm file:font-semibold
                                            file:bg-blue-50 file:text-blue-700
                                            hover:file:bg-blue-100"
                                    />
                                </div>
                            </div>
                        )}
                        {(userProfile.logoUrl && isCompany) && (
                            <div className="mt-6 flex flex-col items-start">
                                <p className="text-gray-600 font-semibold mb-2">Company Logo:</p>
                                <img src={userProfile.logoUrl} alt={`${userProfile.companyName} Logo`} className="w-24 h-24 object-contain rounded-md border-2 border-blue-400 shadow-md" onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/96x96/cccccc/333333?text=No+Logo"; }} />
                                {/* File input for company logo */}
                                <div className="flex flex-col mt-4 w-full">
                                    <label htmlFor="logoFile" className="block text-gray-700 text-sm font-bold mb-2">Change Logo:</label>
                                    <input
                                        type="file"
                                        id="logoFile"
                                        name="logoFile"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        ref={companyLogoInputRef}
                                        className="block w-full text-sm text-gray-500
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded-md file:border-0
                                            file:text-sm file:font-semibold
                                            file:bg-blue-50 file:text-blue-700
                                            hover:file:bg-blue-100"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Job Seeker Specific Sections (Education, Job Preferences, etc.) */}
                    {isJobSeeker && (
                        <>
                            {/* Resume/CV Display & Upload */}
                            {userProfile.resumeUrl && (
                                <div className="pb-4 border-b border-gray-200">
                                    <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                                        <Briefcase size={24} className="mr-3 text-blue-600" /> Resume/CV
                                    </h3>
                                    <p className="text-gray-800 text-lg mb-4"><a href={userProfile.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center"><Download size={20} className="mr-2"/> View Current Resume</a></p>
                                    {/* File input for resume */}
                                    <div className="flex flex-col w-full">
                                        <label htmlFor="resumeFile" className="block text-gray-700 text-sm font-bold mb-2">Upload New Resume:</label>
                                        <input
                                            type="file"
                                            id="resumeFile"
                                            name="resumeFile"
                                            accept=".pdf,.doc,.docx"
                                            onChange={handleFileChange}
                                            ref={resumeInputRef}
                                            className="block w-full text-sm text-gray-500
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-md file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-blue-50 file:text-blue-700
                                                hover:file:bg-blue-100"
                                        />
                                    </div>
                                </div>
                            )}
                            {/* Portfolio Display */}
                            {userProfile.portfolioUrl && (
                                <div className="pb-4 border-b border-gray-200">
                                    <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                                        <LayoutGrid size={24} className="mr-3 text-blue-600" /> Portfolio
                                    </h3>
                                    {renderField('Portfolio URL', 'portfolioUrl', userProfile.portfolioUrl, 'url')}
                                </div>
                            )}
                            {/* Skills Display */}
                            {userProfile.skills && (
                                <div className="pb-4 border-b border-gray-200">
                                    <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                                        <Lightbulb size={24} className="mr-3 text-blue-600" /> Skills
                                    </h3>
                                    {renderField('Skills (comma-separated)', 'skills', userProfile.skills?.join(', ') || '', 'text', null, handleArrayTextInputChange)}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {formData.skills?.map((skill, index) => (
                                            <span key={index} className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">{skill}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Languages Display */}
                            {userProfile.languages && (
                                <div className="pb-4 border-b border-gray-200">
                                    <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                                        <Award size={24} className="mr-3 text-blue-600" /> Languages
                                    </h3>
                                    {/* Languages input needs special handling as it's an array of objects, but we'll simplify for now to a comma-separated string */}
                                    {renderField('Languages (comma-separated, e.g., English, Spanish)', 'languages', formData.languages?.map(lang => lang.name).join(', ') || '', 'text', null, handleArrayTextInputChange)}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {formData.languages?.map((lang, index) => (
                                            <span key={index} className="bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full">{lang.name} ({lang.proficiency})</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Education Section */}
                            <div className="pb-4 border-b border-gray-200">
                                <h4 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                                    <GraduationCap size={20} className="mr-2 text-blue-600" /> Education
                                </h4>
                                {formData.education.map((edu, index) => (
                                    <div key={index} className="mb-4 p-4 border border-gray-300 rounded-lg relative bg-white">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveEducation(index)}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                                            title="Remove Education"
                                        >
                                            <X size={16} />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {renderField('Institution', `education.${index}.institution`, edu.institution, 'text', null, handleEducationChange, index)}
                                            {renderField('Qualification (Degree)', `education.${index}.degree`, edu.degree, 'text', null, handleEducationChange, index)}
                                            {renderField('Field of Study', `education.${index}.fieldOfStudy`, edu.fieldOfStudy, 'text', null, handleEducationChange, index)}
                                            {renderField('Start Date', `education.${index}.startDate`, edu.startDate, 'date', null, handleEducationChange, index)}
                                            <div className="flex flex-col">
                                                <label htmlFor={`edu-endDate-${index}`} className="block text-gray-700 text-sm font-bold mb-2">End Date (or check if currently studying):</label>
                                                {editingField === `education.${index}.endDate` ? (
                                                    <input
                                                        type="date"
                                                        id={`edu-endDate-${index}`}
                                                        name="endDate"
                                                        value={edu.endDate || ''}
                                                        onChange={(e) => handleEducationChange(index, e)}
                                                        onBlur={() => setEditingField(null)}
                                                        ref={activeInlineInputRef}
                                                        className="shadow-sm appearance-none border border-blue-300 rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 transition-all duration-200"
                                                        disabled={edu.current}
                                                    />
                                                ) : (
                                                    <span
                                                        className={`text-gray-800 text-lg font-medium block p-2 rounded-md transition-colors duration-200 cursor-pointer hover:bg-gray-100`}
                                                        onClick={() => setEditingField(`education.${index}.endDate`)}
                                                    >
                                                        {edu.endDate ? formatDisplayDate(edu.endDate) : 'N/A'}
                                                    </span>
                                                )}
                                                <div className="flex items-center mt-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`edu-current-${index}`}
                                                        name="current"
                                                        checked={edu.current || false}
                                                        onChange={(e) => handleEducationChange(index, e)}
                                                        className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                                    />
                                                    <label htmlFor={`edu-current-${index}`} className="ml-2 text-gray-700 text-sm">Currently Studying Here / Appearing</label>
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                {renderField('Description / Achievements', `education.${index}.description`, edu.description, 'textarea', null, handleEducationChange, index)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddEducation}
                                    className="mt-4 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors shadow-md flex items-center"
                                >
                                    {React.createElement(PlusCircle, { size: 18, className: "mr-2" })} Add New Education
                                </button>
                            </div>

                            {/* Experience Section */}
                            <div className="pb-4 border-b border-gray-200">
                                <h4 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                                    <Briefcase size={20} className="mr-2 text-blue-600" /> Experience
                                </h4>
                                {formData.experience.map((exp, index) => (
                                    <div key={index} className="mb-4 p-4 border border-gray-300 rounded-lg relative bg-white">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveExperience(index)}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                                            title="Remove Experience"
                                        >
                                            <X size={16} />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {renderField('Job Title', `experience.${index}.title`, exp.title, 'text', null, handleExperienceChange, index)}
                                            {renderField('Company Name', `experience.${index}.company`, exp.company, 'text', null, handleExperienceChange, index)}
                                            {renderField('Location', `experience.${index}.location`, exp.location, 'text', null, handleExperienceChange, index)}
                                            {renderField('Start Date', `experience.${index}.startDate`, exp.startDate, 'date', null, handleExperienceChange, index)}
                                            <div className="flex flex-col">
                                                <label htmlFor={`exp-endDate-${index}`} className="block text-gray-700 text-sm font-bold mb-2">End Date (or check if currently working):</label>
                                                {editingField === `experience.${index}.endDate` ? (
                                                    <input
                                                        type="date"
                                                        id={`exp-endDate-${index}`}
                                                        name="endDate"
                                                        value={exp.endDate || ''}
                                                        onChange={(e) => handleExperienceChange(index, e)}
                                                        onBlur={() => setEditingField(null)}
                                                        ref={activeInlineInputRef}
                                                        className="shadow-sm appearance-none border border-blue-300 rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 transition-all duration-200"
                                                        disabled={exp.current}
                                                    />
                                                ) : (
                                                    <span
                                                        className={`text-gray-800 text-lg font-medium block p-2 rounded-md transition-colors duration-200 cursor-pointer hover:bg-gray-100`}
                                                        onClick={() => setEditingField(`experience.${index}.endDate`)}
                                                    >
                                                        {exp.endDate ? formatDisplayDate(exp.endDate) : 'N/A'}
                                                    </span>
                                                )}
                                                <div className="flex items-center mt-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`exp-current-${index}`}
                                                        name="current"
                                                        checked={exp.current || false}
                                                        onChange={(e) => handleExperienceChange(index, e)}
                                                        className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                                    />
                                                    <label htmlFor={`exp-current-${index}`} className="ml-2 text-gray-700 text-sm">Currently Working Here</label>
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                {renderField('Description / Responsibilities', `experience.${index}.description`, exp.description, 'textarea', null, handleExperienceChange, index)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddExperience}
                                    className="mt-4 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors shadow-md flex items-center"
                                >
                                    {React.createElement(PlusCircle, { size: 18, className: "mr-2" })} Add New Experience
                                </button>
                            </div>

                            {/* Certifications Section */}
                            <div className="pb-4 border-b border-gray-200">
                                <h4 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                                    <Award size={20} className="mr-2 text-blue-600" /> Certifications
                                </h4>
                                {formData.certifications.map((cert, index) => (
                                    <div key={index} className="mb-4 p-4 border border-gray-300 rounded-lg relative bg-white">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveCertification(index)}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                                            title="Remove Certification"
                                        >
                                            <X size={16} />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {renderField('Name', `certifications.${index}.name`, cert.name, 'text', null, handleCertificationChange, index)}
                                            {renderField('Issuing Organization', `certifications.${index}.issuingOrganization`, cert.issuingOrganization, 'text', null, handleCertificationChange, index)}
                                            {renderField('Issue Date', `certifications.${index}.issueDate`, cert.issueDate, 'date', null, handleCertificationChange, index)}
                                            {renderField('Expiration Date', `certifications.${index}.expirationDate`, cert.expirationDate, 'date', null, handleCertificationChange, index)}
                                            {renderField('Credential ID', `certifications.${index}.credentialId`, cert.credentialId, 'text', null, handleCertificationChange, index)}
                                            {renderField('Credential URL', `certifications.${index}.credentialUrl`, cert.credentialUrl, 'url', null, handleCertificationChange, index)}
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddCertification}
                                    className="mt-4 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors shadow-md flex items-center"
                                >
                                    {React.createElement(PlusCircle, { size: 18, className: "mr-2" })} Add New Certification
                                </button>
                            </div>

                            {/* Projects Section */}
                            <div className="pb-4 border-b border-gray-200">
                                <h4 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                                    <LayoutGrid size={20} className="mr-2 text-blue-600" /> Projects
                                </h4>
                                {formData.projects.map((proj, index) => (
                                    <div key={index} className="mb-4 p-4 border border-gray-300 rounded-lg relative bg-white">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveProject(index)}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                                            title="Remove Project"
                                        >
                                            <X size={16} />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {renderField('Title', `projects.${index}.title`, proj.title, 'text', null, handleProjectChange, index)}
                                            {renderField('Description', `projects.${index}.description`, proj.description, 'textarea', null, handleProjectChange, index)}
                                            {renderField('Technologies Used (comma-separated)', `projects.${index}.technologiesUsed`, proj.technologiesUsed?.join(', ') || '', 'text', null, handleProjectChange, index)}
                                            {renderField('Project URL', `projects.${index}.projectUrl`, proj.projectUrl, 'url', null, handleProjectChange, index)}
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddProject}
                                    className="mt-4 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors shadow-md flex items-center"
                                >
                                    {React.createElement(PlusCircle, { size: 18, className: "mr-2" })} Add New Project
                                </button>
                            </div>

                            {/* Job Preferences Section */}
                            <div className="border-b border-gray-200 pb-4">
                                <h4 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                                    <Lightbulb size={20} className="mr-2 text-blue-600" /> Job Preferences
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                    {/* Preferred Locations - Text Input */}
                                    <div className="flex flex-col">
                                        <label htmlFor="jobPreferences.locations" className="block text-gray-700 text-sm font-bold mb-2">Preferred Locations (comma-separated):</label>
                                        {editingField === 'jobPreferences.locations' ? (
                                            <input
                                                type="text"
                                                id="jobPreferences.locations"
                                                name="jobPreferences.locations"
                                                value={formData.jobPreferences?.locations?.join(', ') || ''}
                                                onChange={handleArrayTextInputChange}
                                                onBlur={() => setEditingField(null)}
                                                ref={activeInlineInputRef}
                                                className="shadow-sm appearance-none border border-blue-300 rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 transition-all duration-200"
                                            />
                                        ) : (
                                            <span
                                                className={`text-gray-800 text-lg font-medium block p-2 rounded-md transition-colors duration-200 cursor-pointer hover:bg-gray-100`}
                                                onClick={() => setEditingField('jobPreferences.locations')}
                                            >
                                                {formData.jobPreferences?.locations?.join(', ') || 'N/A'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Preferred Industries - Text Input */}
                                    <div className="flex flex-col">
                                        <label htmlFor="jobPreferences.industries" className="block text-gray-700 text-sm font-bold mb-2">Preferred Industries (comma-separated):</label>
                                        {editingField === 'jobPreferences.industries' ? (
                                            <input
                                                type="text"
                                                id="jobPreferences.industries"
                                                name="jobPreferences.industries"
                                                value={formData.jobPreferences?.industries?.join(', ') || ''}
                                                onChange={handleArrayTextInputChange}
                                                onBlur={() => setEditingField(null)}
                                                ref={activeInlineInputRef}
                                                className="shadow-sm appearance-none border border-blue-300 rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 transition-all duration-200"
                                            />
                                        ) : (
                                            <span
                                                className={`text-gray-800 text-lg font-medium block p-2 rounded-md transition-colors duration-200 cursor-pointer hover:bg-gray-100`}
                                                onClick={() => setEditingField('jobPreferences.industries')}
                                            >
                                                {formData.jobPreferences?.industries?.join(', ') || 'N/A'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Salary Expectation */}
                                    <div className="flex flex-col">
                                        <label htmlFor="jobPreferences.salaryExpectation.min" className="block text-gray-700 text-sm font-bold mb-2">Min Salary Expectation:</label>
                                        {editingField === 'jobPreferences.salaryExpectation.min' ? (
                                            <input
                                                type="number"
                                                id="jobPreferences.salaryExpectation.min"
                                                name="jobPreferences.salaryExpectation.min"
                                                value={formData.jobPreferences?.salaryExpectation?.min || ''}
                                                onChange={handleChange}
                                                onBlur={() => setEditingField(null)}
                                                ref={activeInlineInputRef}
                                                className="shadow-sm appearance-none border border-blue-300 rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 transition-all duration-200"
                                            />
                                        ) : (
                                            <span
                                                className={`text-gray-800 text-lg font-medium block p-2 rounded-md transition-colors duration-200 cursor-pointer hover:bg-gray-100`}
                                                onClick={() => setEditingField('jobPreferences.salaryExpectation.min')}
                                            >
                                                {formData.jobPreferences?.salaryExpectation?.min || 'N/A'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <label htmlFor="jobPreferences.salaryExpectation.max" className="block text-gray-700 text-sm font-bold mb-2">Max Salary Expectation:</label>
                                        {editingField === 'jobPreferences.salaryExpectation.max' ? (
                                            <input
                                                type="number"
                                                id="jobPreferences.salaryExpectation.max"
                                                name="jobPreferences.salaryExpectation.max"
                                                value={formData.jobPreferences?.salaryExpectation?.max || ''}
                                                onChange={handleChange}
                                                onBlur={() => setEditingField(null)}
                                                ref={activeInlineInputRef}
                                                className="shadow-sm appearance-none border border-blue-300 rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 transition-all duration-200"
                                            />
                                        ) : (
                                            <span
                                                className={`text-gray-800 text-lg font-medium block p-2 rounded-md transition-colors duration-200 cursor-pointer hover:bg-gray-100`}
                                                onClick={() => setEditingField('jobPreferences.salaryExpectation.max')}
                                            >
                                                {formData.jobPreferences?.salaryExpectation?.max || 'N/A'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Preferred Job Types - Checkboxes (These will always be checkboxes, not inline editable text) */}
                                    <div className="flex flex-col md:col-span-2">
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Preferred Job Types:</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {jobTypesOptions.map(option => (
                                                <div key={option} className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        id={`jobType-${option}`}
                                                        name="jobPreferences.jobTypes"
                                                        value={option}
                                                        checked={formData.jobPreferences?.jobTypes?.includes(option) || false}
                                                        onChange={handleCheckboxChange}
                                                        className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                                    />
                                                    <label htmlFor={`jobType-${option}`} className="ml-2 text-gray-700 text-sm">{option}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Seniority Level Preference - Checkboxes */}
                                    <div className="flex flex-col md:col-span-2">
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Seniority Level Preference:</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {seniorityLevelOptions.map(option => (
                                                <div key={option} className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        id={`seniority-${option}`}
                                                        name="jobPreferences.seniorityLevelPreference"
                                                        value={option}
                                                        checked={formData.jobPreferences?.seniorityLevelPreference?.includes(option) || false}
                                                        onChange={handleCheckboxChange}
                                                        className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                                    />
                                                    <label htmlFor={`seniority-${option}`} className="ml-2 text-gray-700 text-sm">{option}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Company Size Preference - Checkboxes */}
                                    <div className="flex flex-col md:col-span-2">
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Company Size Preference:</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {companySizeOptions.map(option => (
                                                <div key={option} className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        id={`companySize-${option}`}
                                                        name="jobPreferences.companySizePreference"
                                                        value={option}
                                                        checked={formData.jobPreferences?.companySizePreference?.includes(option) || false}
                                                        onChange={handleCheckboxChange}
                                                        className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                                    />
                                                    <label htmlFor={`companySize-${option}`} className="ml-2 text-gray-700 text-sm">{option}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Work Environment Preference - Checkboxes */}
                                    <div className="flex flex-col md:col-span-2">
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Work Environment Preference:</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {workEnvironmentOptions.map(option => (
                                                <div key={option} className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        id={`workEnv-${option}`}
                                                        name="jobPreferences.workEnvironmentPreference"
                                                        value={option}
                                                        checked={formData.jobPreferences?.workEnvironmentPreference?.includes(option) || false}
                                                        onChange={handleCheckboxChange}
                                                        className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                                    />
                                                    <label htmlFor={`workEnv-${option}`} className="ml-2 text-gray-700 text-sm">{option}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    {/* Company Specific Info Display */}
                    {isCompany && (
                        <div className="pb-4 border-b border-gray-200">
                            <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                                <Building size={24} className="mr-3 text-blue-600" /> Company Description
                            </h3>
                            {renderField('Description', 'description', userProfile.description, 'textarea')}
                        </div>
                    )}
                </div>

                {/* Save and Cancel Buttons - Appear only when there are changes */}
                {hasChanges && (
                    <div className="mt-8 flex justify-center space-x-4">
                        <button
                            type="button" // Changed to type="button" as it's not part of a form submission
                            onClick={handleSave}
                            className="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700 transition-colors shadow-md flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading} // Disable if saving is in progress
                        >
                            <Save size={20} className="mr-2" /> Save Changes
                        </button>
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="bg-gray-400 text-white py-2 px-6 rounded-md hover:bg-gray-500 transition-colors shadow-md flex items-center"
                        >
                            <X size={20} className="mr-2" /> Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProfile;
