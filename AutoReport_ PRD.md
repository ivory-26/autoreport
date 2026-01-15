# **Product Requirements Document (PRD)**

Project Name: AutoReport  
Version: 3.2 (Collaboration Update)  
Status: Approved for Development  
Last Updated: 2026-01-15  
Author: Alpha

## **1\. Executive Summary**

**AutoReport** is a "Zero-Click" documentation tool for engineering students. It eliminates "Documentation Debt" by autonomously writing the project report in the background.

Unlike collaborative editors that require manual input, AutoReport listens to Git commits. When code is pushed, the system uses an LLM to analyze the changes and **immediately updates the live report** based on a pre-defined or custom template. Users do not need to approve changes; they simply configure the template once, and the report writes itself. The user's role is limited to final review and minor editing.

## **2\. User Personas**

| Persona | Description | Key Pain Point |
| :---- | :---- | :---- |
| **The Coder (Student)** | Wants to code, not write. | "I want the report to just *exist* when I'm done coding." |
| **The Reviewer** | Checks the report periodically. | "I want to see the report growing daily without nagging the team to write it." |
| **The Collaborator** | Team member invited to view/edit reports. | "I want to access shared project reports without managing webhooks." |

## **3\. Core Features & Functional Requirements**

### **3.1 Authentication & Project Setup**

* **FR-01:** Users sign in via **GitHub OAuth** (Managed by NextAuth on Vercel).  
* **FR-02:** Project creation involves linking a GitHub Repository.  
* **FR-03 (Template Engine):** Users must select a **Report Template** (e.g., "IEEE Standard", "Agile Log", "Custom").  
  * *Refined:* The system automatically generates a **Table of Contents (ToC)** from the template. The AI uses this ToC to decide where to place new content. Manual mapping is no longer required.

### **3.2 Team Collaboration**

* **FR-03.1 (Invitation System):** Project owners can invite team members by GitHub username.
  * Invitations are sent with a role (Viewer, Editor, Admin).
  * Invitees receive a pending invitation banner on their dashboard.
  * Invitations expire after 7 days if not accepted.
* **FR-03.2 (Collaborator Access):** Collaborators can:
  * View all project reports they are invited to.
  * Edit reports based on their assigned role.
  * See shared projects in a "Shared with You" section on the dashboard.
* **FR-03.3 (Collaborator Management):** Project owners can:
  * View all collaborators on a project.
  * Remove collaborators at any time.
  * The project owner retains full control over webhook configuration.
* **FR-03.4 (Webhook Ownership):** Only the repository owner (who has admin access) can create webhooks. Team members who are repository collaborators should be invited to the AutoReport project rather than creating their own projects for the same repo.

### **3.3 The "Auto-Write" Pipeline (USP)**

* **FR-04 (Ingest):** Webhook receives push events.  
* **FR-05 (Smart Filtering):** System ignores noise (assets, lockfiles) to prevent report clutter.  
* **FR-06 (Contextual Analysis):** The AI analyzes the diff to determine the context (e.g., "Database Schema Update").  
* **FR-07 (Semantic Routing & Injection):** The system passes the **Code Diff** and the **Report Structure** to the LLM. The LLM determines the most relevant section ID.  
  * *Example:* The LLM detects a change in jwt\_utils.js. It sees sections "3. Backend" and "6. Security". It intelligently routes the update to "Section 6\. Security".

### **3.4 The Editor & History**

* **FR-08 (Live Viewer):** A read-write interface displaying the generated report (Next.js).  
* **FR-09 (Change Highlighting):** Newly added AI text should be highlighted (e.g., in green) until viewed/dismissed.  
* **FR-10 (Regeneration):** Users can select a specific AI-generated paragraph and click "Regenerate" to rewrite it.  
* **FR-11 (Audit Log):** A history log showing "AutoReport added 3 paragraphs to Methodology at 10:00 AM".

### **3.5 Export**

* **FR-12:** Export to **PDF** and **Markdown**.

## **4\. Technical Architecture**

### **4.1 Tech Stack (Hybrid)**

* **Frontend (UI):** Next.js 14/15 (App Router).  
  * **Hosting:** **Vercel** (For edge caching, image optimization, and instant UI loading).  
* **Backend (Worker):** Node.js / Express (or a separate Next.js API instance).  
  * **Hosting:** **Render** (For long-running processes, webhooks, and AI interaction without 10s timeouts).  
* **Database:** MongoDB (Atlas).  
* **AI:** Gemini API (High context window).

### **4.2 High-Level Data Flow**

1. **Commit:** Developer pushes code to GitHub.  
2. **Webhook:** GitHub sends payload to **Render Backend** (https://backend.onrender.com/webhooks/github).  
   * *Reason:* Render prevents timeouts during long AI processing.  
3. **Processing (Render):**  
   * Backend authenticates the request.  
   * Backend fetches the Project & Template config from MongoDB.  
   * Backend calls Gemini API (Routing \+ Generation).  
   * Backend updates MongoDB $push to specific Section array.  
4. **View (Vercel):**  
   * User visits Dashboard on Vercel (https://myapp.vercel.app).  
   * Next.js fetches data from MongoDB (Server Component).  
   * User sees the updated report instantly.

## **5\. Database Schema (MongoDB)**

### **5.1 Collection: Projects**

Includes the template configuration and collaboration settings.

{  
  \_id: ObjectId,  
  repoUrl: String,  
  owner: ObjectId,  
  ownerUsername: String, // GitHub username of project creator  
  activeTemplateId: String, // e.g., "IEEE\_V1"  
  collaborators: \[  
    {  
      userId: String,  
      username: String, // GitHub username  
      email: String,  
      role: String, // "viewer" | "editor" | "admin"  
      addedAt: Date  
    }  
  \],  
  createdAt: Date  
}

### **5.2 Collection: Invitations**

Pending collaboration invitations.

{  
  \_id: ObjectId,  
  projectId: ObjectId,  
  projectName: String,  
  invitedBy: {  
    userId: String,  
    username: String  
  },  
  inviteeUsername: String, // GitHub username of invitee  
  role: String, // "viewer" | "editor" | "admin"  
  message: String, // Optional personal message  
  status: String, // "pending" | "accepted" | "declined" | "expired"  
  expiresAt: Date, // Default: 7 days from creation  
  respondedAt: Date,  
  createdAt: Date  
}

### **5.3 Collection: Reports**

The live document.

{  
  \_id: ObjectId,  
  projectId: ObjectId,  
  sections: \[  
    {  
      id: String, // UUID  
      title: String, // "3. Implementation"  
      content: String, // The full HTML/Markdown text  
      lastUpdated: Date,  
      aiLastTouched: Boolean // Used for highlighting  
    }  
  \]  
}

### **5.4 Collection: AutoLogs (Audit Trail)**

{  
  \_id: ObjectId,  
  projectId: ObjectId,  
  commitHash: String,  
  addedToSection: String, // "3. Implementation"  
  contentPreview: String,  
  timestamp: Date,  
  reverted: Boolean // If user deleted it later  
}

## **6\. API Specifications**

To ensure the Frontend (Vercel) and Backend (Render) communicate correctly via the Database.

### **6.1 Render Endpoints (The Worker)**

* POST /webhooks/github  
  * **Payload:** Standard GitHub JSON.  
  * **Action:** Triggers the AI pipeline.  
* POST /ai/regenerate  
  * **Payload:** { sectionId, currentText, instruction }  
  * **Action:** Re-runs the LLM on specific text.

### **6.2 Vercel Internal APIs (The Interface)**

* GET /api/projects (Fetches from MongoDB)  
* GET /api/reports/:id (Fetches from MongoDB)  
* POST /api/auth/... (NextAuth GitHub handling)

## **7\. UI/UX Wireframes**

### **7.1 Setup Wizard (Simplified)**

* **Step 1:** Connect Repo.  
* **Step 2:** Choose Template (IEEE / Custom).  
* **Step 3:** **Review Structure (Optional).**  
  * UI shows the generated Table of Contents.  
  * User can rename sections.  
  * *No manual file mapping required.*

### **7.2 Main View**

* **Single Column Document:** Looks like a standard PDF/Doc view.  
* **Highlights:** New text has a subtle green background.  
* **Hover Menu:** Hovering over an AI paragraph shows: \[Source: Commit a4f22\] \[Regenerate\] \[Delete\].

## **8\. Roadmap**

### **Phase 1: The Engine (Weeks 1-3)**

* Setup MongoDB Atlas.  
* **Render:** Build Node.js Webhook receiver.  
* **Vercel:** Build Next.js Dashboard.  
* **LLM Routing Logic:** Implement semantic routing prompt.

### **Phase 2: The Intelligence (Weeks 4-5)**

* Improved LLM prompts (Chain-of-Thought) to write academic-style text.  
* Context awareness (reading the *previous* paragraph to ensure flow).

### **Phase 3: Control (Weeks 6-8)**

* "Regenerate" button (Vercel calling Render API).  
* PDF Export (using puppeteer or jspdf).

## **9\. Non-Functional Requirements**

* **NFR-01 (Latency):** Webhook processing must complete within 60 seconds (handled by Render). UI load time must be under 1.5 seconds (handled by Vercel).  
* **NFR-02 (Security):** Webhook endpoint must verify the X-Hub-Signature-256 to prevent spoofing.  
* **NFR-03 (Availability):** Render backend must use a "Ping" strategy (CRON) to prevent sleeping during demo/usage hours.  
* **NFR-04 (Data Integrity):** Simultaneous commits must be queued to prevent race conditions in report generation.

## **10\. Project Structure**

This project uses a **Monorepo** structure to separate the UI (Vercel) from the Worker (Render).

### **10.1 Root Directory**

/auto-report  
├── /frontend               \# Next.js Application (Vercel)  
├── /backend                \# Express/Node.js Worker (Render)  
├── package.json            \# Root scripts (optional)  
└── README.md

### **10.2 Frontend Structure (Next.js App Router)**

Located in /frontend.

/frontend  
├── /app  
│   ├── /api                \# Internal APIs (Auth, DB Fetching)  
│   ├── /dashboard          \# Main Project View  
│   ├── /project  
│   │   └── \[id\]            \# Dynamic Project Page  
│   ├── layout.jsx          \# Root Layout (Navbar, Providers)  
│   └── page.jsx            \# Landing Page  
├── /components  
│   ├── /editor             \# The Report Viewer Component  
│   ├── /ui                 \# Shared UI (Buttons, Modals)  
│   └── /wizard             \# Setup Steps Components  
├── /lib  
│   ├── db.js               \# MongoDB Connection (Mongoose)  
│   ├── auth.js             \# NextAuth Configuration  
│   └── models              \# Shared Mongoose Schemas (Project, Report)  
└── next.config.js

### **10.3 Backend Structure (Node.js Worker)**

Located in /backend.

/backend  
├── /src  
│   ├── /config             \# Env variables & Constants  
│   ├── /controllers        \# Logic for Webhooks & AI  
│   │   ├── webhookController.js  
│   │   └── aiController.js  
│   ├── /models             \# Mongoose Schemas (Copy of Frontend models)  
│   ├── /services  
│   │   ├── gemini.js       \# AI API Wrapper  
│   │   └── gitParser.js    \# Diff Cleaning Logic  
│   ├── /routes             \# API Route Definitions  
│   └── app.js              \# Express App Setup  
├── server.js               \# Entry Point  
└── package.json  
