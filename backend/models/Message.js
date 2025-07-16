// models/Message.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    // Sender of the message (could be a User or a Company)
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'senderModel' // Dynamic reference based on senderModel field
    },
    // To identify if the sender is a User or a Company
    senderModel: {
        type: String,
        required: true,
        enum: ['User', 'Company'] // 'User' for job seekers, 'Company' for companies
    },
    // Recipient of the message (could be a User or a Company)
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'receiverModel' // Dynamic reference based on receiverModel field
    },
    // To identify if the receiver is a User or a Company
    receiverModel: {
        type: String,
        required: true,
        enum: ['User', 'Company'] // 'User' for job seekers, 'Company' for companies
    },
    // Content of the message
    content: {
        type: String,
        required: [true, 'Message content cannot be empty'],
        trim: true,
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    // Timestamp of when the message was sent (handled by timestamps: true)
    // readBy: [{ // Optional: To track read receipts
    //     user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    //     company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    //     readAt: { type: Date, default: Date.now }
    // }],
    // conversationId: { // Optional: If you want to group messages into explicit conversations
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Conversation' // Requires a separate Conversation model
    // }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

// Add indexes for efficient querying of messages between two parties
messageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });
messageSchema.index({ receiver: 1, sender: 1, createdAt: 1 }); // For reverse lookup

const Message = mongoose.model('Message', messageSchema);
export default Message;