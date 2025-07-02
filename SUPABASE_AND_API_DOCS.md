# Supabase Setup & API Documentation

## Supabase Setup

1. **Create a Supabase Project**
   - Go to [https://app.supabase.com/](https://app.supabase.com/) and create a new project.
   - Note your **Project URL** and **Anon/Public API Key**.

2. **Configure Environment Variables**
   - Copy the example env file:
     ```bash
     cp .env.example .env.local
     ```
   - Edit `.env.local` and set:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     NEXT_PUBLIC_SPOONACULAR_API_KEY=your-spoonacular-api-key
     ```
   - Get your Spoonacular API key from [https://spoonacular.com/food-api](https://spoonacular.com/food-api)

3. **Create Required Tables in Supabase**
   - In the Supabase dashboard, go to **Table Editor** and add the following tables with the listed columns:

   | Table Name              | Key Columns & Types                                                                                                                                                                                                                  |
   |-------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
   | `profiles`              | `id` (uuid, PK), `user_id` (uuid), `username` (text), `full_name` (text), `avatar_url` (text), `bio` (text), `show_email` (bool), `is_admin` (bool), `warnings` (int), `banned` (bool), `ban_type` (text), `ban_reason` (text), `ban_expiry` (timestamp), `last_ban_date` (timestamp), `ban_count` (int), `created_at` (timestamp), `updated_at` (timestamp), `email` (text), `dietary_restrictions` (text[]), `cooking_skill_level` (text) |
   | `recipes`               | `id` (uuid, PK), `created_at` (timestamp), `title` (text), `description` (text), `ingredients` (text[]), `instructions` (text[]), `nutrition` (jsonb), `cuisine_type` (text), `diet_type` (text), `cooking_time` (text), `cooking_time_value` (int), `recipe_type` (text), `user_id` (uuid, FK), `is_starred` (bool), `spoonacular_id` (text), `image_url` (text) |
   | `comments`              | `id` (uuid, PK), `recipe_id` (uuid, FK), `user_id` (uuid, FK), `content` (text), `created_at` (timestamp)                                                                                                                           |
   | `shopping_items`        | `id` (uuid, PK), `user_id` (uuid, FK), `name` (text), `quantity` (text), `category` (text), `notes` (text), `completed` (bool), `created_at` (timestamp)                                                                            |
   | `cooking_notes`         | `id` (uuid, PK), `user_id` (uuid, FK), `title` (text), `content` (text), `recipe_id` (uuid, FK, nullable), `created_at` (timestamp), `updated_at` (timestamp)                                                                       |
   | `reports`               | `id` (uuid, PK), `recipe_id` (uuid, FK), `recipe_type` (text), `user_id` (uuid, FK), `reason` (text), `status` (text), `created_at` (timestamp), `updated_at` (timestamp)                                                           |
   | `starred_recipes`       | `id` (uuid, PK), `created_at` (timestamp), `user_id` (uuid, FK), `recipe_id` (uuid, FK), `recipe_type` (text)                                                                                |
   | `spoonacular_mappings`  | `recipe_id` (uuid, FK), `spoonacular_id` (text), `created_at` (timestamp)                                                                                                                     |
   | `follows`               | `follower_id` (uuid, FK), `following_id` (uuid, FK), `created_at` (timestamp)                                                                                                                 |
   | `blocked_users`         | `blocker_id` (uuid, FK), `blocked_id` (uuid, FK), `created_at` (timestamp)                                                                                                                    |
   | `conversations`         | `id` (uuid, PK), `user1_id` (uuid, FK), `user2_id` (uuid, FK), `created_at` (timestamp), `updated_at` (timestamp), `last_message_at` (timestamp)                                              |
   | `messages`              | `id` (uuid, PK), `conversation_id` (uuid, FK), `sender_id` (uuid, FK), `content` (text), `created_at` (timestamp), `updated_at` (timestamp)                                                   |
   | `message_notifications` | `id` (uuid, PK), `user_id` (uuid, FK), `conversation_id` (uuid, FK), `message_id` (uuid, FK), `read` (bool), `created_at` (timestamp)                                                        |
   | `shared_recipes`        | `id` (uuid, PK), `recipe_id` (uuid, FK), `shared_by` (uuid, FK), `shared_with` (uuid, FK), `created_at` (timestamp)                                                                          |
   | `warnings`              | `id` (uuid, PK), `user_id` (uuid, FK), `admin_id` (uuid, FK), `reason` (text), `created_at` (timestamp), `updated_at` (timestamp)                                                            |
   | `admin_audit_log`       | `id` (uuid, PK), `admin_id` (uuid, FK), `action` (text), `target_type` (text), `target_id` (uuid), `details` (jsonb), `created_at` (timestamp)                                               |
   | `avatars`               | `id` (uuid, PK), `user_id` (uuid, FK), `file_path` (text), `created_at` (timestamp)                                                                                                           |

   **Views (Optional but Recommended):**
   - `comments_with_profile` - Join comments with user profiles
   - `reports_with_profiles` - Join reports with user profiles
   - `spoonacular_recipes` - View for Spoonacular recipes

4. **Storage Setup**
   - Create a storage bucket in Supabase called `recipe-images` for recipe image uploads.
   - Configure storage policies to allow authenticated users to upload and read images.

5. **RLS (Row Level Security)**
   - Ensure RLS is enabled on all tables.
   - Policies should allow:
     - Users to read public data.
     - Users to insert/update/delete their own data.
     - Admins to bypass RLS for moderation.

6. **Service Role Key (Optional)**
   - For admin scripts or server-side operations, use the Supabase Service Role key (never expose this to the client).

---

## API Documentation

### Authentication
- Uses Supabase Auth (email/password, OAuth, etc.).
- Endpoints require a valid JWT in the `Authorization` header for protected routes.

---

### Recipes

#### `GET /api/recipes`
- **Description:** List all recipes (with optional filters).
- **Query Params:** `search`, `cuisine`, `diet`, `maxReadyTime`
- **Returns:** Array of recipe objects.

#### `GET /api/recipes/[id]`
- **Description:** Get a single recipe by ID.
- **Returns:** Recipe object.

#### `POST /api/recipes`
- **Description:** Create a new recipe.
- **Body:** `{ title, description, ... }`
- **Auth:** Required.

#### `PUT /api/recipes/[id]`
- **Description:** Update a recipe (owner or admin only).
- **Body:** `{ title?, description?, ... }`
- **Auth:** Required.

#### `DELETE /api/recipes/[id]`
- **Description:** Delete a recipe (owner or admin only).
- **Auth:** Required.

---

### Comments

#### `GET /api/comments?recipeId=...`
- **Description:** List comments for a recipe.

#### `POST /api/comments`
- **Description:** Add a comment to a recipe.
- **Body:** `{ recipe_id, content }`
- **Auth:** Required.

#### `DELETE /api/comments/[id]`
- **Description:** Delete a comment (owner or admin only).
- **Auth:** Required.

---

### Profiles

#### `GET /api/profiles/[id]`
- **Description:** Get a user profile.

#### `PUT /api/profiles/[id]`
- **Description:** Update your profile.
- **Auth:** Required.

---

### Admin Endpoints
- Some endpoints (e.g., warnings, reports, admin actions) require the user to have `is_admin` set to `true` in the `profiles` table.
- Admin endpoints are protected by RLS and/or server-side checks.

---

### Notes
- All endpoints return JSON.
- For authenticated requests, include the Supabase JWT in the `Authorization: Bearer <token>` header.
- For more details, see the code in `/pages/api/` and `/lib/`. 