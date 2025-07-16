// backend/routes/messages.js
import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';

import Message from '../models/Message.js'; // Corrected import to Message model
import User from '../models/User.js';       // To populate User details
import Company from '../models/Company.js'; // To populate Company details

import { verifyToken, authorizeRoles } from '../utils/auth.js';

const handleMongooseError = (res, err) => {
    if (err.name === 'ValidationError') {
        let errors = {};
        for (let field in err.errors) {
            errors[field] = err.errors[field].message;
        }
        return res.status(400).json({ message: 'Validation failed', errors });
    }
    res.status(500).json({ message: err.message });
};

// --- ROUTES ---

// Helper function to get other party's details (name based on role)
const getOtherPartyDetails = (party) => {
    if (!party) return null;
    return {
        _id: party._id,
        role: party.role,
        name: party.role === 'jobseeker' ? party.fullName : party.companyName,
        email: party.email // Add email for identification
    };
};

// GET /messages/conversations
// Purpose: To fetch a list of unique users/companies that the authenticated user
//          has exchanged messages with, along with the last message of that conversation.
router.get('/conversations', verifyToken, authorizeRoles('jobseeker', 'company'), async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const userModel = req.user.role === 'jobseeker' ? 'User' : 'Company';

        // Find distinct other parties (users/companies) that the current user has messaged
        // This aggregation pipeline finds the last message in each distinct conversation
        // and identifies the 'other party' involved.
        const conversations = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender: userId, senderModel: userModel },
                        { receiver: userId, receiverModel: userModel }
                    ]
                }
            },
            {
                // Group messages by a unique conversation identifier
                // A conversation is identified by the two participants involved, regardless of sender/receiver order.
                $group: {
                    _id: {
                        $cond: {
                            if: { $lt: ["$sender", "$receiver"] }, // Sort IDs to create a consistent conversation ID
                            then: { sender: "$sender", receiver: "$receiver" },
                            else: { sender: "$receiver", receiver: "$sender" }
                        }
                    },
                    lastMessage: { $last: "$$ROOT" } // Get the last message in this conversation
                }
            },
            {
                $replaceRoot: { newRoot: "$lastMessage" } // Promote lastMessage to the root
            },
            {
                $sort: { createdAt: -1 } // Sort conversations by the latest message
            },
            // Now, populate sender and receiver details (polymorphic lookup)
            {
                $lookup: {
                    from: 'users', // Collection name for User model
                    localField: 'sender',
                    foreignField: '_id',
                    as: 'senderUser'
                }
            },
            {
                $lookup: {
                    from: 'companies', // Collection name for Company model
                    localField: 'sender',
                    foreignField: '_id',
                    as: 'senderCompany'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'receiver',
                    foreignField: '_id',
                    as: 'receiverUser'
                }
            },
            {
                $lookup: {
                    from: 'companies',
                    localField: 'receiver',
                    foreignField: '_id',
                    as: 'receiverCompany'
                }
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    createdAt: 1,
                    sender: {
                        _id: '$sender',
                        model: '$senderModel',
                        // Conditionally pick details based on senderModel
                        details: {
                            $cond: {
                                if: { $eq: ['$senderModel', 'User'] },
                                then: { $arrayElemAt: ['$senderUser', 0] },
                                else: { $arrayElemAt: ['$senderCompany', 0] }
                            }
                        }
                    },
                    receiver: {
                        _id: '$receiver',
                        model: '$receiverModel',
                        // Conditionally pick details based on receiverModel
                        details: {
                            $cond: {
                                if: { $eq: ['$receiverModel', 'User'] },
                                then: { $arrayElemAt: ['$receiverUser', 0] },
                                else: { $arrayElemAt: ['$receiverCompany', 0] }
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    createdAt: 1,
                    // Identify the 'otherParty' relative to the current user
                    otherParty: {
                        $cond: {
                            if: { $eq: ['$sender._id', userId] },
                            then: '$receiver', // If current user is sender, receiver is other party
                            else: '$sender'    // If current user is receiver, sender is other party
                        }
                    },
                    lastMessageSender: '$sender', // Keep original sender info for display
                }
            },
            {
                 $project: { // Refine otherParty details based on its model
                    _id: 1,
                    content: 1,
                    createdAt: 1,
                    lastMessageSender: 1,
                    otherParty: {
                        _id: '$otherParty._id',
                        model: '$otherParty.model',
                        name: {
                            $cond: {
                                if: { $eq: ['$otherParty.model', 'User'] },
                                then: '$otherParty.details.fullName',
                                else: '$otherParty.details.companyName'
                            }
                        },
                        email: '$otherParty.details.email' // assuming email exists on both
                    }
                 }
            }
        ]);

        res.json(conversations);

    } catch (err) {
        console.error('Error fetching conversations:', err);
        handleMongooseError(res, err);
    }
});


// GET /messages/history/:otherPartyId
// Purpose: To fetch the full message history between the authenticated user and a specific otherPartyId.
router.get('/history/:otherPartyId', verifyToken, authorizeRoles('jobseeker', 'company'), async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const otherPartyId = new mongoose.Types.ObjectId(req.params.otherPartyId);

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(otherPartyId)) {
            return res.status(400).json({ message: 'Invalid user ID format.' });
        }

        // Authorization check (optional but recommended):
        // Ensure that the 'otherPartyId' is indeed a user or company that the current user *could* chat with.
        // For simplicity, we'll allow fetching history if messages exist between them.
        // A more robust check might verify if otherPartyId is a valid User/Company in the system.

        const messages = await Message.find({
            $or: [
                { sender: userId, receiver: otherPartyId },
                { sender: otherPartyId, receiver: userId }
            ]
        })
        .sort({ createdAt: 1 }) // Sort by time ascending
        .populate({
            path: 'sender',
            model: 'User', // Default to User model
            select: 'fullName email role companyName', // Select fields common or specific to User
            // Adjust to populate based on senderModel
            options: { populate: { path: 'senderModel', select: 'fullName companyName' } } // This is pseudo code for polymorphic population logic
        })
        .populate({
            path: 'receiver',
            model: 'User', // Default to User model
            select: 'fullName email role companyName',
            options: { populate: { path: 'receiverModel', select: 'fullName companyName' } }
        })
        .lean(); // Convert to plain JavaScript objects

        // Manual polymorphic population based on senderModel/receiverModel
        const populatedMessages = await Promise.all(messages.map(async (msg) => {
            const senderModel = msg.senderModel === 'User' ? User : Company;
            const receiverModel = msg.receiverModel === 'User' ? User : Company;

            const senderDetails = await senderModel.findById(msg.sender).select('fullName companyName email role').lean();
            const receiverDetails = await receiverModel.findById(msg.receiver).select('fullName companyName email role').lean();

            return {
                ...msg,
                sender: {
                    _id: msg.sender,
                    role: senderDetails ? senderDetails.role : undefined,
                    name: senderDetails ? (senderDetails.role === 'jobseeker' ? senderDetails.fullName : senderDetails.companyName) : 'Unknown',
                    email: senderDetails ? senderDetails.email : 'Unknown'
                },
                receiver: {
                    _id: msg.receiver,
                    role: receiverDetails ? receiverDetails.role : undefined,
                    name: receiverDetails ? (receiverDetails.role === 'jobseeker' ? receiverDetails.fullName : receiverDetails.companyName) : 'Unknown',
                    email: receiverDetails ? receiverDetails.email : 'Unknown'
                },
            };
        }));


        res.json(populatedMessages);

    } catch (err) {
        console.error('Error fetching chat history:', err);
        handleMongooseError(res, err);
    }
});


export default router;