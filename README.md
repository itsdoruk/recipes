# <center>[recipes]</center>

[![Vercel](https://img.shields.io/badge/deployed%20on-vercel-000?logo=vercel)](https://vercel.com/)
[![License: WTFPL](https://img.shields.io/badge/license-WTFPL-green.svg)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/itsdoruk/recipes?label=last%20commit)](https://github.com/itsdoruk/recipes/commits/main)
[![Stack](https://img.shields.io/badge/stack-Next.js%20%7C%20Supabase%20%7C%20Tailwind%20CSS%20%7C%20Spoonacular%20%7C%20LLaMA-blueviolet?logo=next.js)](https://nextjs.org/)

**Discover, share, and love recipes.**  
A modern, community-driven recipe app built with Next.js, Supabase, and Vercel.

---

## ✨ Features

- **Explore & Search:**  
  Browse thousands of recipes from your community, AI, and Spoonacular API.
- **Share Your Creations:**  
  Upload your own recipes with images, nutrition, and step-by-step instructions.
- **AI-Powered Suggestions:**  
  Get personalized recipe recommendations.
- **Nutrition Transparency:**  
  Every recipe displays calories, protein, fat, and carbs.
- **Modern UI/UX:**  
  Consistent, beautiful, and interactive design across all pages.
- **Community:**  
  Follow users, star recipes, and connect with food lovers worldwide.
- **Admin Tools:**  
  Manage users, moderate content, and keep the community safe.

---

## 🖥️ Tech Stack

- [Next.js](https://nextjs.org/) (App Router)
- [Supabase](https://supabase.com/) (Postgres, Auth, Storage)
- [Vercel](https://vercel.com/) (Deployment)
- [Tailwind CSS](https://tailwindcss.com/) (Styling)
- [Spoonacular API](https://spoonacular.com/food-api) (External recipes)
- [Hack Club AI](https://ai.hackclub.com/) (AI recipe suggestions)

---

## 🚀 Getting Started

1. **Clone the repo:**
   ```bash
   git clone https://github.com/your-username/your-recipe-app.git
   cd your-recipe-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables:**
   - Copy `.env.example` to `.env.local` and fill in your Supabase and API keys.

4. **Run locally:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Deploy to Vercel:**  
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/your-username/your-recipe-app)

---

## 🖌️ UI Consistency

All buttons, inputs, and cards use a unified, modern style with:
- Rounded corners
- Pronounced hover effects (scale, shadow, color)
- Accessible color palette (dark/light mode)
- Responsive layouts

---

## 🛡️ Data Integrity

- All nutrition fields are required and validated.
- Recipes from Spoonacular and AI are deduplicated and always display accurate nutrition.
- User input is sanitized and validated on both client and server.

---

## 📝 Contributing

Contributions are welcome!  
Please open an issue or pull request for features, bug fixes, or suggestions.

---

## 📄 License

[WTFPL](LICENSE)

---

> Made with ❤️ by food lovers, for food lovers.
