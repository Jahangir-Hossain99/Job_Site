// backend/services/chatService.js
import Message from '../models/Message.js'; // Import the new Message model
import jwt from 'jsonwebtoken'; // For authenticating WebSocket connections
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Initializes Socket.IO event listeners for chat functionality.
 * @param {object} io - The Socket.IO server instance.
 */
const initializeChat = (io) => {

    // Middleware for Socket.IO authentication
    // This runs before the 'connection' event for each new socket
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token; // Client sends token in handshake.auth
        if (!token) {
            console.log(`Socket.IO Auth: No token provided for socket ID: ${socket.id}`);
            return next(new Error('Authentication error: No token provided.'));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            // Attach user info to the socket instance
            socket.user = decoded;
            console.log(`Socket.IO Auth: User ${socket.user.id} (${socket.user.role}) authenticated for socket ID: ${socket.id}`);
            next();
        } catch (err) {
            console.error(`Socket.IO Auth: Invalid token for socket ID: ${socket.id}`, err.message);
            return next(new Error('Authentication error: Invalid token.'));
        }
    });

    // Main Socket.IO connection handling
    io.on('connection', (socket) => {
        console.log(`Socket.IO: User ${socket.user.id} (${socket.user.role}) connected with socket ID: ${socket.id}`);

        // Join a personal room for direct messaging
        // Each user/company joins a room named after their ID
        const personalRoom = socket.user.id;
        socket.join(personalRoom);
        console.log(`Socket.IO: User ${socket.user.id} joined personal room: ${personalRoom}`);

        // Event for sending a message
        // Data should contain { receiverId, receiverModel, content }
        socket.on('sendMessage', async (data) => {
            const { receiverId, receiverModel, content } = data;
            const senderId = socket.user.id;
            const senderModel = socket.user.role === 'jobseeker' ? 'User' : 'Company'; // Map role to model name

            if (!receiverId || !receiverModel || !content) {
                console.warn(`Socket.IO: Invalid message data from ${senderId}:`, data);
                socket.emit('messageError', { message: 'Invalid message data. Receiver ID, receiver model, and content are required.' });
                return;
            }

            try {
                // 1. Save message to database
                const newMessage = new Message({
                    sender: senderId,
                    senderModel: senderModel,
                    receiver: receiverId,
                    receiverModel: receiverModel,
                    content: content
                });
                await newMessage.save();
                console.log(`Socket.IO: Message saved to DB: ${newMessage._id}`);

                // 2. Prepare message for clients (add sender info, timestamp)
                const messageToSend = {
                    _id: newMessage._id,
                    sender: {
                        _id: senderId,
                        role: socket.user.role,
                        fullName: socket.user.fullName || socket.user.companyName // Assuming these are in JWT payload
                    },
                    receiver: receiverId,
                    receiverModel: receiverModel,
                    content: content,
                    createdAt: newMessage.createdAt
                };

                // 3. Emit message to the receiver's personal room
                // This ensures only the intended recipient receives the message
                io.to(receiverId).emit('receiveMessage', messageToSend);

                // 4. Also emit to sender's personal room so they see their own message instantly
                if (receiverId !== senderId) { // Avoid double sending if sending to self
                    io.to(senderId).emit('receiveMessage', messageToSend);
                }

                console.log(`Socket.IO: Message emitted from ${senderId} to ${receiverId}`);

            } catch (error) {
                console.error(`Socket.IO: Error sending/saving message from ${senderId}:`, error);
                socket.emit('messageError', { message: 'Failed to send message.', error: error.message });
            }
        });

        // Event for fetching chat history between two parties
        // Data should contain { otherPartyId, otherPartyModel }
        socket.on('fetchChatHistory', async (data) => {
            const { otherPartyId, otherPartyModel } = data;
            const currentUserId = socket.user.id;
            const currentUserModel = socket.user.role === 'jobseeker' ? 'User' : 'Company';

            if (!otherPartyId || !otherPartyModel) {
                socket.emit('chatHistoryError', { message: 'Invalid request for chat history. Other party ID and model are required.' });
                return;
            }

            try {
                // Find messages where current user is sender AND other party is receiver
                // OR current user is receiver AND other party is sender
                const history = await Message.find({
                    $or: [
                        { sender: currentUserId, receiver: otherPartyId },
                        { sender: otherPartyId, receiver: currentUserId }
                    ]
                })
                .sort({ createdAt: 1 }) // Sort by time ascending
                .populate('sender', 'fullName companyName role') // Populate sender details
                .populate('receiver', 'fullName companyName role') // Populate receiver details
                .lean(); // Get plain JavaScript objects

                // Transform populated data to include correct name based on role
                const transformedHistory = history.map(msg => ({
                    ...msg,
                    sender: {
                        _id: msg.sender._id,
                        role: msg.sender.role,
                        name: msg.sender.role === 'jobseeker' ? msg.sender.fullName : msg.sender.companyName
                    },
                    receiver: {
                        _id: msg.receiver._id,
                        role: msg.receiver.role,
                        name: msg.receiver.role === 'jobseeker' ? msg.receiver.fullName : msg.receiver.companyName
                    }
                }));

                socket.emit('chatHistory', transformedHistory);
                console.log(`Socket.IO: Chat history fetched for ${currentUserId} with ${otherPartyId}`);

            } catch (error) {
                console.error(`Socket.IO: Error fetching chat history for ${currentUserId}:`, error);
                socket.emit('chatHistoryError', { message: 'Failed to fetch chat history.', error: error.message });
            }
        });

        socket.on('disconnect', () => {
            console.log(`Socket.IO: User ${socket.user.id} disconnected with socket ID: ${socket.id}`);
        });
    });
};

export default initializeChat;
