I want you to redesign my existing Feature Flag Management application with a professional, modern SaaS UI AND verify that every existing feature works correctly.

IMPORTANT:
This is NOT a UI-only task.

You must:
1. Improve the UI/UX.
2. Preserve all existing functionality.
3. Connect every UI control to the real backend.
4. Test every feature after implementation.
5. Fix any broken functionality you find.
6. Do not use mock data.
7. Do not create fake success messages.
8. Do not mark a feature as complete unless it actually works.

==================================================
1. FIRST INSPECT THE ENTIRE PROJECT
==================================================

Before changing code, inspect:

Frontend:
- All pages
- All routes
- Components
- Forms
- Tables
- Buttons
- Modals
- API services
- State management
- Loading states
- Error states

Backend:
- All routes
- Controllers
- Services
- Database models
- Authentication
- Authorization
- Feature flag APIs
- Targeting APIs
- Environment APIs
- Evaluation API
- Redis/cache

Understand how the existing application works before making changes.

DO NOT rebuild the project from scratch.

==================================================
2. UI DESIGN
==================================================

Make the application look like a professional developer SaaS platform.

Use:

- Dark navy sidebar
- Clean light main content area
- White cards
- Subtle borders
- Very subtle shadows
- Blue primary actions
- Green success states
- Red danger states
- Clean typography
- Consistent spacing
- Modern tables
- Professional badges
- Responsive layout

Avoid:

- Excessive gradients
- Excessive animations
- Too many colors
- Huge cards
- Huge buttons
- Glassmorphism everywhere
- Unnecessary decoration

The application should look production-ready, not like a basic CRUD/college project.

==================================================
3. GLOBAL NAVIGATION
==================================================

Sidebar:

Dashboard
Feature Flags
Environments
Users / Groups
Audit Logs
Analytics
Settings

The active page must be highlighted.

Top header:

Search
Notifications
User Profile

Use consistent navigation throughout the application.

==================================================
4. DASHBOARD
==================================================

Dashboard must show real backend data.

Display:

Total Flags
Active Flags
Disabled Flags
Environments

Feature flag activity/recent flags.

Every statistic must come from the backend.

Test:

[ ] Dashboard loads
[ ] Statistics are correct
[ ] Navigation works
[ ] Feature flag links work
[ ] No console errors

==================================================
5. FEATURE FLAGS PAGE
==================================================

Create a clean professional table.

Columns:

Flag Name
Status
Environment
Type
Rollout
Updated
Actions

Controls:

[ Search ]
[ Environment Filter ]
[ Status Filter ]
[ Type Filter ]
[ Filters ]

Actions:

[ Create Flag ]

Every action must work.

Test:

[ ] Search
[ ] Filters
[ ] Create Flag
[ ] Open flag
[ ] Edit flag
[ ] Delete/archive if existing
[ ] Status changes
[ ] Environment selection
[ ] Pagination

Do not use hard-coded table data.

==================================================
6. CREATE FEATURE FLAG
==================================================

The Create Flag form must actually create a database record.

Fields should use the existing backend model.

Validate:

- Required fields
- Flag key
- Duplicate flag key
- Invalid values

After successful creation:

- Show success toast
- Update the list
- Do not require unnecessary page refresh

Test:

[ ] Create valid flag
[ ] Duplicate flag
[ ] Invalid input
[ ] Cancel
[ ] Save
[ ] Database record created

==================================================
7. FLAG DETAIL PAGE
==================================================

Create a clean professional layout.

Show:

Flag name
Flag key
Description
Status
Environment
Created date
Updated date

Rollout Summary:

Total Users
Enabled Users
Disabled Users
Rollout %
Targeted Users
Targeted Groups

Button:

[ Manage Rollout ]

Clicking it must open:

/flags/{flagId}/rollout

All displayed information must come from the backend.

==================================================
8. MANAGE ROLLOUT PAGE
==================================================

This is the main rollout management page.

Sections:

1. Targeting Summary
2. Metadata
3. Environment-wise Configuration
4. Evaluation Test Panel
5. Targeting Rules

All sections must work.

==================================================
9. TARGETING SUMMARY
==================================================

Display:

Total Users
Enabled Users
Disabled Users
Rollout %
Targeted Users
Targeted Groups

Do NOT calculate fake values in the frontend.

The backend must provide the real values.

Enabled/disabled users must use the SAME evaluation logic as /evaluate.

==================================================
10. PERCENTAGE ROLLOUT
==================================================

Implement:

Slider: 0–100%

Manual input: 0–100%

They must stay synchronized.

Example:

Slider → 75%
Input → 75

Input → 25
Slider → 25%

Validate:

- Minimum 0
- Maximum 100
- Numeric only

Save button must actually update the backend.

After saving:

Database
→ Cache invalidation
→ Refresh UI
→ Updated statistics

Test:

[ ] 0%
[ ] 25%
[ ] 50%
[ ] 75%
[ ] 100%
[ ] Invalid negative
[ ] Invalid >100
[ ] Manual input
[ ] Slider
[ ] Save
[ ] Refresh persistence

==================================================
11. ENABLE ALL
==================================================

Button:

[ Enable All ]

Show confirmation.

After confirmation:

rollout = 100%

Update backend.

Invalidate cache.

Refresh UI.

Test by evaluating users after enabling.

==================================================
12. DISABLE ALL
==================================================

Button:

[ Disable All ]

Show confirmation.

After confirmation:

rollout = 0%

Update backend.

Invalidate cache.

Refresh UI.

Test by evaluating users after disabling.

==================================================
13. USER TARGETING
==================================================

Allow adding specific users.

Example:

user-001
user-002
user-003

Support:

- Enter individual IDs
- Multiple IDs
- Multi-line paste
- Comma-separated IDs

Normalize:

- Whitespace
- Empty values
- Duplicates

Do not create duplicate target records.

After adding users:
- Save to backend
- Refresh targeting summary
- Refresh evaluation
- Invalidate cache

Test:

[ ] Add one user
[ ] Add multiple users
[ ] Paste multiple users
[ ] Duplicate users
[ ] Invalid users
[ ] Remove user
[ ] Refresh page
[ ] Verify persistence

==================================================
14. GROUP TARGETING
==================================================

Allow selecting multiple groups.

Example:

beta-users
premium-users
developers

Save selected groups to backend.

Test:

[ ] Select group
[ ] Select multiple groups
[ ] Remove group
[ ] Save
[ ] Refresh
[ ] Evaluate group user
[ ] Verify result

==================================================
15. ENVIRONMENTS
==================================================

Support existing environments:

Development
Staging
Production

Do not hard-code them if the project already has a dynamic environment system.

Changing environment must load the correct configuration.

Test:

[ ] Development
[ ] Staging
[ ] Production
[ ] Different rollout per environment
[ ] Environment override
[ ] Evaluation per environment

Ensure Production data never appears under Staging accidentally.

==================================================
16. EVALUATION TEST PANEL
==================================================

The Evaluation Test Panel must call the REAL:

POST /evaluate

Inputs:

User ID
Groups
Environment

Button:

[ Evaluate ]

Display:

Result:
ENABLED / DISABLED

Reason:
User Targeting / Group Targeting / Percentage Rollout / Environment Override / Default

Environment

Cache:
LIVE / CACHED

DO NOT implement evaluation logic in React.

The backend evaluation service is the single source of truth.

Test:

[ ] User targeting
[ ] Group targeting
[ ] Percentage rollout
[ ] Environment override
[ ] Default
[ ] Different users
[ ] Different environments
[ ] Cache hit
[ ] Cache invalidation

==================================================
17. EVALUATION PRIORITY
==================================================

The evaluation order must remain:

1. User Targeting
2. Group Targeting
3. Percentage Rollout
4. Environment Override
5. Default

Do not change this order.

Create tests specifically for priority conflicts.

Example:

User is explicitly targeted OFF/ON while percentage says something different.

Verify user targeting wins.

==================================================
18. DETERMINISTIC PERCENTAGE ROLLOUT
==================================================

Percentage rollout must use the existing deterministic hashing implementation.

The same:

user_id + flag_key

must always produce the same bucket.

Test:

User A evaluated 10 times
→ same result

User B evaluated 10 times
→ same result

Changing unrelated users must not change User A's result.

==================================================
19. ENABLED USERS
==================================================

Clicking:

Enabled Users

must open the actual enabled-user list.

Display:

User ID
Source
Environment
Evaluation

Source examples:

User Targeting
Group Targeting
Percentage Rollout
Environment Override

Search must work.

Pagination must work.

The list must reflect the same evaluation engine used by /evaluate.

Test:

[ ] User appears when enabled
[ ] User disappears when disabled
[ ] Search
[ ] Pagination
[ ] Environment
[ ] Source/reason

==================================================
20. DISABLED USERS
==================================================

Same functionality.

Display:

User ID
Reason
Environment
Evaluation

Test:

[ ] Correct disabled users
[ ] Search
[ ] Pagination
[ ] Environment
[ ] Reason

==================================================
21. REDIS CACHE
==================================================

If Redis is implemented:

Evaluation:

First request
→ database/evaluation
→ cache result

Second request
→ Redis

The create call succeeded and file created. Now need to commit and push. Let's do git add and commit. We'll run git commit and push. Initially create tool created file; confirm created earlier. Now run powershell to run git commands. We'll commit with message and co-author trailer per guidelines.