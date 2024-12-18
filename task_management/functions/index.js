const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const nodemailer = require("nodemailer");

const firebaseConfig = {
  apiKey: "AIzaSyA8tcMmV84T6YbHoqrOWdkOVA1B_NJiqs0",
  authDomain: "task-management-system-23a4a.firebaseapp.com",
  projectId: "task-management-system-23a4a",
  storageBucket: "task-management-system-23a4a.firebasestorage.app",
  messagingSenderId: "463621960605",
  appId: "1:463621960605:web:1e3efcce9891a547d4b574",
  measurementId: "G-6W33ZXMPRM",
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "test@gmail.com",
    pass: "testPassword@",
  },
});

admin.initializeApp();
const db = admin.firestore();
// Initialize Firebase app
const appFirebase = initializeApp(firebaseConfig);
// Initialize Firebase Authentication
const auth = getAuth(appFirebase);

// User Registration
exports.registerUser = functions.https.onRequest(async (req, res) => {
  const { email, password, name, profilePicture, role } = req.body;
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

// Middleware for Role-Based Access Control
const isAdmin = async (uid) => {
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  return userDoc.exists && userDoc.data().role === "admin";
};

exports.adminFunction = functions.https.onRequest(async (req, res) => {
  const uid = req.body.uid; // Assume uid is sent in the request body

  if (await isAdmin(uid)) {
    return true;
    // res.status(200).send({ message: "Admin access granted" });
  } else {
    // res.status(403).send({ error: "Access denied" });
    return false;
  }
});

// Create Task
exports.tasks = functions.https.onRequest(async (req, res) => {
  const { title, description, assignee } = req.body;
  const createdBy = req.body.uid; // Assuming uid is passed in the request
  const createdAt = Date.now();
  const taskData = {
    title,
    description,
    status: "pending",
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

// delete a task (protected route)
exports.deleteTask = functions.https.onRequest(async (data) => {
  console.log(data);
  // Check if the user is an admin
  const admin = await isAdmin(data.userId);
  console.log(admin);

  // Proceed with deleting the task
  const taskId = data.taskId;

  try {
    const taskRef = admin.firestore().collection("tasks").doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new Error("Task not found");
    }

    await taskRef.delete();

    return { message: "Task deleted successfully" };
  } catch (error) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// exports.taskNotification = functions.firestore
//   .document("tasks/{taskId}")
//   .onCreate(async (snap, context) => {
//     const task = snap.data();
//     const assigneeId = task.assignee;

//     // Get user details
//     const userDoc = await admin
//       .firestore()
//       .collection("users")
//       .doc(assigneeId)
//       .get();
//     const userEmail = userDoc.data().email; // Assuming user document has email field

//     // Prepare email content
//     const mailOptions = {
//       from: "testemail@gmail.com",
//       to: userEmail,
//       subject: "New Task Assigned to You",
//       text: `Hello, you have been assigned a new task: \n\nTitle: ${task.title}\nDescription: ${task.description}\nStatus: ${task.status}`,
//     };

//     // Send the email (simulated with nodemailer)
//     try {
//       await transporter.sendMail(mailOptions);
//       console.log("Email sent successfully to:", userEmail);
//     } catch (error) {
//       console.error("Error sending email:", error);
//     }
//   });

