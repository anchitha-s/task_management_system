const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const nodemailer = require("nodemailer");
const dotenv = require('dotenv');
dotenv.config();


const firebaseConfig = {
  apiKey: "AIzaSyA8tcMmV84T6YbHoqrOWdkOVA1B_NJiqs0",
  authDomain: "task-management-system-23a4a.firebaseapp.com",
  projectId: "task-management-system-23a4a",
  storageBucket: "task-management-system-23a4a.firebasestorage.app",
  messagingSenderId: "463621960605",
  appId: "1:463621960605:web:1e3efcce9891a547d4b574",
  measurementId: "G-6W33ZXMPRM",
};

let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: 'email', //Use Gmail of the user
    pass: 'password',  //Use password of the gmail account
  },
});

// let transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.GUSER, // Use Gmail user from the environment variable
//     pass: process.env.GPASS, // Use Gmail password from the environment variable
//   },
// });

admin.initializeApp();
const db = admin.firestore();
// Initialize Firebase app
const appFirebase = initializeApp(firebaseConfig);
// Initialize Firebase Authentication
const auth = getAuth(appFirebase);

// Middleware for Role-Based Access Control
const checkAdminRole = async (userId) => {
  try {
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .get();

    if (!userDoc.exists) {
      throw new Error("User not found");
    }

    const userData = userDoc.data();
    return userData.role === "admin"; // Assuming 'role' field in Firestore user document
  } catch (error) {
    console.error("Error verifying admin role:", error);
    throw new functions.https.HttpsError("internal", "Failed to verify role");
  }
};

// User Registration
exports.registerUser = functions.https.onRequest(async (req, res) => {
  const { email, password, name, profilePicture, role } = req.body;

  // Allowed role values
  const allowedRoles = ["admin", "user"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).send({
      error: `Invalid role value. Allowed values are: ${allowedRoles.join(
        ", "
      )}.`,
    });
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      name,
      email,
      profilePicture,
      role,
      createdAt: Date.now(),
    });
    res.status(201).send({ uid: userRecord.uid });
  } catch (error) {
    res.status(400).send(error);
  }
});

// User Login
exports.loginUser = functions.https.onRequest(async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await admin.auth().getUserByEmail(email);

    res.status(200).send({
      message: "Login successful",
      uid: user.uid,
    });
  } catch (error) {
    res.status(400).send(error);
  }
});

// Update User Profile
exports.updateUserProfile = functions.https.onRequest(async (req, res) => {
  const { uid, name, profilePicture } = req.body;
  console.log("uid: ", uid, req.user);
  try {
    await admin.auth().updateUser(uid, { displayName: name });
    await admin
      .firestore()
      .collection("users")
      .doc(uid)
      .update({ name, profilePicture });
    res.send({ message: "Profile updated" });
  } catch (error) {
    res.status(400).send(error);
  }
});

// Create Task
exports.tasks = functions.https.onRequest(async (req, res) => {
  console.log(process.env.GMAIL_USER)
  const { title, description, assignee } = req.body;
  const createdBy = req.body.uid; // Assuming uid is passed in the request
  const createdAt = Date.now();
  const taskData = {
    title,
    description,
    status: "created",
    assignee,
    createdAt,
    createdBy,
  };

  try {
    const taskRef = await admin.firestore().collection("tasks").add(taskData);
    res.status(201).send({ id: taskRef.id, ...taskData });
  } catch (error) {
    res.status(400).send(error);
  }
});

// Get Task
exports.getTasks = functions.https.onRequest(async (req, res) => {
  try {
    const { userId } = req.body;

    // Retrieve user role
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userRole = userDoc.data().role;
    console.log(userRole);

    let tasks = [];

    if (userRole === "admin") {
      // Admin can view all tasks
      const snapshot = await db.collection("tasks").get();
      snapshot.forEach((doc) => {
        const task = doc.data();
        // Ensure that the task has required fields and is not empty
        if (task && task.title && task.description && task.createdBy) {
          tasks.push(task);
        }
      });
    } else {
      // User can view tasks they created or are assigned to
      // Query for tasks created by the user
      const createdByQuery = db
        .collection("tasks")
        .where("createdBy", "==", userId);
      const assigneeQuery = db
        .collection("tasks")
        .where("assignee", "==", userId);

      const createdBySnapshot = await createdByQuery.get();
      const assigneeSnapshot = await assigneeQuery.get();

      // Collect tasks created by the user
      createdBySnapshot.forEach((doc) => {
        const task = doc.data();
        // Ensure that the task has required fields and is not empty
        if (task && task.title && task.description && task.createdBy) {
          tasks.push(task);
        }
      });

      // Collect tasks assigned to the user
      assigneeSnapshot.forEach((doc) => {
        const task = doc.data();
        // Ensure that the task has required fields and is not empty
        if (task && task.title && task.description && task.createdBy) {
          tasks.push(task);
        }
      });
    }

    // Remove duplicate tasks (if any)
    const uniqueTasks = Array.from(
      new Set(tasks.map((task) => task.createdAt))
    ).map((createdAt) => tasks.find((task) => task.createdAt === createdAt));

    // Send tasks to the client
    return res.status(200).json({ tasks: uniqueTasks });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching tasks" });
  }
});

exports.updateTaskStatus = functions.https.onRequest(async (req, res) => {
  const { taskId, status } = req.body;

  // Allowed status values
  const allowedStatuses = ["created", "pending", "completed"];

  // Check if both taskId and status are provided
  if (!taskId || !status) {
    return res.status(400).send({ error: "taskId and status are required." });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).send({
      error: `Invalid status value. Allowed values are: ${allowedStatuses.join(
        ", "
      )}.`,
    });
  }

  try {
    const taskRef = admin.firestore().collection("tasks").doc(taskId);
    const taskSnapshot = await taskRef.get();

    // Check if the task exists
    if (!taskSnapshot.exists) {
      return res.status(404).send({ error: "Task not found." });
    }

    // Update the status field of the task
    await taskRef.update({ status });

    res.status(200).send({ message: "Task status updated successfully." });
  } catch (error) {
    res.status(500).send({
      error: "An error occurred while updating the task.",
      details: error.message,
    });
  }
});

// delete a task (protected route)
exports.deleteTask = functions.https.onRequest(async (req, res) => {
  try {
    const userId = req.body.userId;
    const taskId = req.body.taskId;

    if (!userId || !taskId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "User ID and Task ID are required"
      );
    }

    // Check if the user is an admin
    const isadmin = await checkAdminRole(userId);
    if (!isadmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "No permission to do the Action"
      );
    }

    // Proceed with deleting the task
    const taskRef = admin.firestore().collection("tasks").doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Task not found");
    }

    await taskRef.delete();
    console.log("Task deleted successfully");

    res.status(200).send({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).send({ error: error.message });
  }
});

exports.dailySummary = functions.pubsub
  .schedule("0 0 * * *")
  .onRun(async (context) => {
// exports.dailySummary = functions.https.onRequest(async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0)).getTime(); // Convert to timestamp (milliseconds)
  const endOfDay = new Date(today.setHours(23, 59, 59, 999)).getTime(); // Convert to timestamp (milliseconds)

  const tasksSnapshot = await admin
    .firestore()
    .collection("tasks")
    .where("createdAt", ">=", startOfDay) // Use timestamp comparison
    .where("createdAt", "<=", endOfDay) // Use timestamp comparison
    .get();

  let created = 0,
    completed = 0,
    pending = 0;

  tasksSnapshot.forEach((doc) => {
    const task = doc.data();
    if (task.status === "completed") {
      completed++;
    } else if (task.status === "pending") {
      pending++;
    }
    created++;
  });

  await admin.firestore().collection("dailySummaries").add({
    date: new Date(),
    created,
    completed,
    pending,
  });

  console.log(
    `Daily Summary: Created: ${created}, Completed: ${completed}, Pending: ${pending}`
  );
});

exports.taskNotification = functions.firestore
  .document("tasks/{taskId}")
  .onCreate(async (snap, context) => {
    const task = snap.data();
    const assigneeId = task.assignee;

    // Get user details
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(assigneeId)
      .get();
    const userEmail = userDoc.data().email; // Assuming user document has email field

    // Prepare email content
    const mailOptions = {
      from: "testemail@gmail.com",
      to: userEmail,
      subject: "New Task Assigned to You",
      text: `Hello, you have been assigned a new task: \n\nTitle: ${task.title}\nDescription: ${task.description}\nStatus: ${task.status}`,
    };

    // Send the email (simulated with nodemailer)
    try {
      await transporter.sendMail(mailOptions);
      console.log("Email sent successfully to:", userEmail);
    } catch (error) {
      console.error("Error sending email:", error);
    }
  });
