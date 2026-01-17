# AutoReport

**Zero-Click Documentation** for engineering students and developers. AutoReport listens to your Git commits and autonomously updates your project documentation in the background using AI.

![AutoReport Banner](/frontend/public/banner.jpeg)

## 🚀 Overview

AutoReport eliminates "Documentation Debt" by integrating directly with your development workflow. When you push code to GitHub, AutoReport analyzes the changes and intelligently updates your live report based on a pre-defined or custom template.

**The result?** Your project report writes itself while you code.

## ✨ Key Features

- **Zero-Click Updates**: No manual entry required. Just push code.
- **Smart Context Analysis**: AI understands the context of your changes (e.g., Database Schema Update vs. UI Tweak) and updates the relevant section.
- **Live Preview**: Read-write interface to view and refine the generated report.
- **Team Collaboration**: Invite team members to view or edit reports.
- **Audit Log**: Track every change made by the AI.
- **Export**: Export reports to PDF or Markdown.

## 🛠️ Tech Stack

### Frontend (UI)
- **Framework**: Next.js 16.1.1 (App Router)
- **Styling**: Tailwind CSS 4.0
- **React**: React 19.2.3
- **Authentication**: NextAuth.js (GitHub OAuth)
- **Deployment**: Vercel

### Backend (Worker)
- **Runtime**: Node.js / Express 5.2.1
- **Database**: MongoDB Atlas
- **AI Engine**: Groq (Qwen3-32b, GPT-OSS-120b) with backups (Llama4-Scout-17b-16e)
- **Deployment**: Render

## 📂 Project Structure

Verified Monorepo structure:
```
/autoreport
├── /frontend               # Next.js Application
├── /backend                # Express/Node.js Worker
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
   # Create .env file with MONGODB_URI, etc.
   npm run dev
   ```

## 📝 License

Copyright &copy; 2026 ivory-26.
