# 🖍️ Napkin 
**Draw it on a napkin. Ship it to production.**

[![Open Source](https://img.shields.io/badge/Open%20Source-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Hacktoberfest 2026](https://img.shields.io/badge/Hacktoberfest-Kumasi_2026-orange.svg)](https://hacktoberfest.com/)
[![Built with Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Powered by Gemma 4](https://img.shields.io/badge/AI-Gemma_4-4285F4)](https://ai.google.dev/)

Napkin AI is an open-source, GenZ-aesthetic developer tool that converts hand-drawn UI sketches into fully functional, production-ready React/Tailwind code in seconds. Built entirely on free-tier services, this project was created by **Felix & Nonydev** for the **Hacktoberfest Hack Day Kumasi 2026**.

## ✨ Features
- **Sketch-to-UI Engine:** Powered by Google's Gemma 4 (Gemini API) multimodal vision capabilities.
- **Glassmorphism & Parallax:** A visually stunning, scroll-linked GenZ landing page using Framer Motion.
- **Live Code Editor:** Tweak the generated UI in real-time with an embedded Monaco editor.
- **Device Targeting:** Select custom dimensions (Mobile, Tablet, Desktop) before generating.
- **Onboarding Tour Guide:** Interactive, plug-and-play walkthrough for first-time users.
- **Auth & Cloud Saves:** Free-tier Supabase integration. Anyone can generate, but logging in unlocks code exporting and project history.

## 🛠️ Tech Stack
- **Frontend:** Next.js (App Router), React, Tailwind CSS
- **Animations:** Framer Motion
- **Backend & Auth:** Supabase (PostgreSQL, Auth, Storage)
- **AI / LLM:** Gemma 4 Vision via Google Gemini API
- **Live Editor:** `@monaco-editor/react`

## 🚀 Quick Start (Local Development)

**1. Clone the repository**
\`\`\`bash
git clone https://github.com/yourusername/napkin-ai.git
cd napkin-ai
\`\`\`

**2. Install dependencies**
\`\`\`bash
npm install
\`\`\`

**3. Set up Environment Variables**
Create a `.env.local` file in the root directory and add your free-tier API keys:
\`\`\`env
# Google AI Studio (Gemma 4)
GEMINI_API_KEY=your_gemini_api_key

# Supabase (Auth & DB)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

**4. Run the development server**
\`\`\`bash
npm run dev
\`\`\`
Open [http://localhost:3000](http://localhost:3000) to see the magic happen! ✨

## 🤝 Contributing
This project is open-source and Hacktoberfest-friendly! Whether it's squashing a bug, adding a new UI export format (like Vue or Svelte), or improving the prompt engineering, PRs are welcome.
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🏆 Credits
Developed with ❤️ by **Felix & Nonydev**.
Created for **Hacktoberfest Hack Day Kumasi x Wikitech Student Community 2026**.

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
