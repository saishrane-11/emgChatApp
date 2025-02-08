const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const path = require("path");
require('dotenv').config();
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false, // Bypass TLS verification (for debugging)
    },
});

const sendVerificationEmail = async (email) => {
    const token = crypto.randomBytes(32).toString("hex"); // Generate a random token
    const verificationLink = `https://emgchatapp.onrender.com/verify-email?token=${token}`;

    const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: "Email Verification",
        html: `<p>Click the link below to verify your email:</p>
               <a href="${verificationLink}">Verify Email</a>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("Verification Email Sent");
        return token; // Store this in the database
    } catch (error) {
        console.error("Error sending email:", error);
    }
};



const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
mongoose.connect("mongodb+srv://saish:1234@cluster0.bwcqz.mongodb.net/emgChatApp?retryWrites=true&w=majority&appName=Cluster0", { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.error("MongoDB Connection Error:", err));

// Schema for User
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: {
        type: String,
        default: "user",
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    phone:{type:Number,required:true},
    email:{type:String,required:true},
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
});
const User = mongoose.model("User", userSchema);

// Schema for Messages
const messageSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", messageSchema);

// Store online users
let onlineUsers = {};

// Register endpoint
app.post("/register", async (req, res) => {
    const { username, password,  latitude, longitude,phone,email } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = await sendVerificationEmail(email);
        console.log(verificationToken)
        const newUser = new User({ username, password: hashedPassword, latitude, longitude,phone,email,verificationToken });
        
         // Send verification email
    
        await newUser.save();
        res.json({ message: "Registration successful || Click on verify the mail" ,user:newUser});
    } catch (error) {
        res.status(400).json({ message: "Username already taken" });
    }
});

// Login endpoint
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
       
        if (user && await bcrypt.compare(password, user.password)) {
             
        console.log("it")
        if (!user.isVerified) {
            console.log("in")
            const verificationToken = await sendVerificationEmail(user.email);
            console.log("verifia",verificationToken)
            user.verificationToken=verificationToken;
            await user.save()
            console.log(user)
            return res.status(400).json({ message: "Please verify your email before logging in. || we have send you an email" });
        }
    
            res.json({ message: "Login successful",user:user });
        } else {
            res.status(400).json({ message: "Invalid username or password" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});


// Email verification route
app.get("/verify-email", async (req, res) => {
    const { token } = req.query;
    console.log("token",token)
    const user = await User.findOne({ verificationToken: token });

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    user.isVerified = true;
    user.verificationToken = null; // Remove token after verification
    await user.save();

    res.send("Email verified successfully!");
});
// Fetch all users (for displaying user list)
app.get("/get-users", async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Error fetching users" });
    }
});

// Fetch chat history
app.post("/get-messages", async (req, res) => {
    const { user1, user2 } = req.body;
    try {
        const messages = await Message.find({
            $or: [
                { sender: user1, receiver: user2 },
                { sender: user2, receiver: user1 }
            ]
        }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: "Error fetching messages" });
    }
});

// Socket.IO handling
io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("user-online", (username) => {
        onlineUsers[username] = socket.id;
        io.emit("update-online-users", Object.keys(onlineUsers));
    });

    socket.on("send-message", async ({ sender, receiver, message }) => {
        const newMessage = new Message({ sender, receiver, message });
        await newMessage.save();
        io.emit("receive-message", { sender, receiver, message });
    });

    socket.on("disconnect", () => {
        for (let user in onlineUsers) {
            if (onlineUsers[user] === socket.id) {
                delete onlineUsers[user];
                break;
            }
        }
        io.emit("update-online-users", Object.keys(onlineUsers));
    });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
