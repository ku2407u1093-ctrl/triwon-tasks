# Triwon Work v2

Daily task manager for Bhavya, Dhruv and Parth, with an admin, logins, routines, time tracking, proof uploads and a weekly race.

## Upgrade steps (about 15 minutes)

### 1. Database
Supabase → **SQL Editor → New query** → paste all of `supabase-v2.sql` → **Run**.
(This replaces the v1 test table. You should see "Success".)

### 2. Stop strangers from signing up
Supabase → **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up" → Save.

### 3. Create the 4 logins
Supabase → **Authentication → Users → Add user → Create new user**. Tick **Auto Confirm User** each time.

| Username | Email to enter        |
|----------|-----------------------|
| admin    | admin@triwon.app      |
| bhavya   | bhavya@triwon.app     |
| dhruv    | dhruv@triwon.app      |
| parth    | parth@triwon.app      |

Choose a password for each (8+ characters). These emails never receive mail; they are just login IDs.

### 4. Set roles and names
Open `setup-team.sql`, change `'Your Name'` to your name, paste it into the SQL Editor → **Run**.
The last line shows 4 rows with one admin.

### 5. Config
Copy your existing **config.js** (with your URL and anon key) into this folder.

### 6. Deploy
```bash
cd triwon-work-v2
vercel --prod
```
It updates the same Vercel link if you pick the same project name (`triwon-tasks`) when asked to link.

### 7. Hand out logins
Each person signs in with their **username** (e.g. `dhruv`) and password, then can change the password from the key icon.

## Who can do what

| Action                                   | Admin | Member |
|------------------------------------------|:-----:|:------:|
| See everyone's tasks, due times, progress | ✓ | ✓ |
| Assign tasks to anyone                   | ✓ | – |
| Add tasks / routines for themselves      | ✓ | ✓ |
| Update progress, timer, proof on a task  | any | own only |
| Edit / delete a task someone assigned     | ✓ | – |
| Remove a proof file                      | any | own only |
| Reports + CSV export                     | ✓ | – |

These rules are enforced by the database, so they hold even outside the app.
Members must attach a proof file or write a proof note before a task can be marked done.
Files: 2 MB max (enforced by storage), images / PDF / ZIP / Office files.
