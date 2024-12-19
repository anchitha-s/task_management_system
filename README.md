# Task Management System

This project is a serverless Task Management System using Firebase services. It supports user authentication, task creation, role-based access control, and notifications. The system provides admins access to all tasks and restricts users to viewing tasks created by or assigned to them.

---

## Setup Instructions

### Prerequisites
- Node.js (version 18.x or later)
- Firebase CLI installed globally (`npm install -g firebase-tools`)
- A Firebase project set up with Firestore, Authentication, and Cloud Functions enabled
- Firebase Emulator Suite for local testing

### Installation

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd task_management
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   cd functions && npm install
   ```

3. **Firebase Project Initialization**:
   Run the following commands and configure Firebase settings:
   ```bash
   firebase login
   firebase init
   ```
   - Enable Firestore, Functions, and optionally, Emulators.
   - Set up Firestore rules and indexes.

4. **Start the Firebase Emulator:
   ```bash
   firebase emulators:start
   ```



---

## Project Architecture

### Firebase Services
- **Firestore**: NoSQL database for storing tasks and user data.
- **Authentication**: Handles user registration and role management.
- **Cloud Functions**: Backend logic for notifications, scheduled summaries, and role-based middleware.

### Key Endpoints

| Method | Route         | Description                                      |
|--------|---------------|--------------------------------------------------|
| POST   | `/registerUser`      | Create a new user                         |
| POST   | `/loginUser`      | Login a user                                 |
| PUT   | `/updateUserProfile`      | Update user profile                               |
| POST   | `/tasks`      | Create a new task                               |
| GET    | `/getTasks`      | Retrieve tasks for a user or admin              |
| DELETE | `/tasks/:id`  | Delete a task (admin-only functionality)        |

### File Structure
```
project-root
├── functions
│   ├── index.js            # Main entry point for Cloud Functions
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexing configuration

```

---

## Design Decisions

1. **Firestore Database Design**:
   - **Users Collection**:
     Stores user information including roles (`admin`, `user`).
   - **Tasks Collection**:
     Includes fields such as `title`, `description`, `status`, `assignee`, and timestamps.

2. **Role-Based Access Control**:
   - Middleware ensures non-admin users can only access tasks they created or are assigned.
   - Admins have unrestricted access.


3. **Serverless Architecture**:
   - Leveraged Firebase’s scalability and built-in services to minimize operational overhead.
   - Used Cloud Functions for backend logic.



