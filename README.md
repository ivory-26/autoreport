# AutoReport

**Zero-Click Documentation** for engineering students and developers. AutoReport listens to your Git commits and autonomously updates your project documentation in the background using AI.

![AutoReport Banner](/frontend/public/banner.jpeg)

## 🚀 Overview

AutoReport eliminates "Documentation Debt" by integrating directly with your development workflow. When you push code to GitHub, AutoReport analyzes the changes and intelligently updates your live report based on a pre-defined or custom template.

**The result?** Your project report writes itself while you code, maintained by intelligent agents that understand your architecture.

## ✨ Key Features

### 🤖 Autonomous Automation
- **Zero-Click Updates**: No manual entry required. Just push code.
- **Smart Context Analysis**: AI agents (Analyzer & Writer) understand the nature of changes (e.g., Schema vs. UI) and target specific report sections.
- **Resilient Webhooks**: Built-in delivery tracking and automatic replay ensure no commit is ever missed, even during downtime.

### 🛡️ Secure & Scalable
- **Enterprise-Grade Security**: Implements rate limiting, strict Zod input validation, and secure header verification.
- **Fair Job Queueing**: Intelligent generic queue system ensures fair resource allocation across multiple projects and users.
- **Secure Deletion**: Comprehensive cleanup protocols that abort active AI jobs and remove all associated data/webhooks upon project deletion.

### 📊 Rich Reporting
- **Live Preview**: Real-time read-write interface to refine generated content.
- **Rich Formatting**: Generates tables, charts, code blocks, and complex lists using standard Markdown.
- **Export Options**: One-click export to PDF, DOCX, and raw Markdown.
- **Audit Log**: Transparent changelog tracking every decision made by the AI.

### 🤝 Collaboration
- **Team Management**: Invite collaborators with specific role-based access.
- **Returning User Flow**: Seamless authentication that remembers your repository access preferences.

## 🛠️ Tech Stack

### Frontend (UI)
- **Framework**: Next.js 16.1.1 (App Router)
- **Styling**: Tailwind CSS 4.0 & Shadcn UI
- **Animations**: Framer Motion
- **Authentication**: NextAuth.js (GitHub OAuth)
- **Deployment**: Vercel

### Backend (Worker)
- **Runtime**: Node.js / Express 5.2.1
- **Database**: MongoDB Atlas
- **Queueing**: Custom MongoDB Job Queue
- **AI Engine**: Groq (Qwen3-32b, GPT-OSS-120b) with failover strategies
- **Deployment**: Render

## 📂 Project Structure

```
/autoreport
├── /frontend               # Next.js Application (Admin, Dashboard, Report Viewer)
├── /backend                # Express Worker (Webhooks, Agents, Queue Processors)
└── README.md
```

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas URI
- Groq API Key
- GitHub OAuth Client ID & Secret

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ivory-26/autoreport.git
   cd autoreport
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   # Create .env file with NEXT_PUBLIC_API_URL, NEXTAUTH_SECRET, etc.
   npm run dev
   ```

3. **Backend Setup**
   ```bash
   cd backend
   npm install
   # Create .env file with MONGODB_URI, RELAY_URL, etc.
   npm run dev
   ```

## 📝 License

Copyright &copy; 2026 ivory-26.
