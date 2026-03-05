# Order Status Tracker

## Current State
- Single admin login: `arpit2127` / `TyGoD@2127`
- After login, admin sees three tabs: Upload Excel, Manual Entry, User Management
- Manual Entry allows creating or updating any order by Order ID + 10 status fields
- All Orders table with delete buttons is shown in Upload Excel and Manual Entry tabs

## Requested Changes (Diff)

### Add
- A second login credential: username `BO`, password `SiYaRaM@802`
- After `BO` logs in, show a restricted "Update Order" panel:
  - A search-by-Order-ID input to look up an existing order
  - If the order exists, pre-fill all 10 status fields and allow editing and saving
  - If the order does not exist, show "Order not found" — BO cannot create new orders
  - No delete buttons, no Excel upload, no User Management tab
- The Admin Panel header should show which user is logged in

### Modify
- `LoginForm`: accept both `arpit2127`/`TyGoD@2127` (full admin) and `BO`/`SiYaRaM@802` (restricted user)
- `AdminUpload` component: pass user role/type downstream so `AdminPanel` renders the correct view
- `AdminPanel`: if logged in as `BO`, render `BOPanel` instead of the full admin tabs

### Remove
- Nothing removed from existing admin functionality

## Implementation Plan
1. Add `BO_USERNAME` and `BO_PASSWORD` constants alongside existing admin constants
2. Update `LoginForm.handleSubmit` to also accept BO credentials; call `onLogin(username)` for both
3. Create a new `BOPanel` component:
   - Order ID search input with a "Find Order" button
   - On find: calls `useGetOrder` (already exists) to fetch the order
   - If found: pre-fills all 10 status fields in editable inputs with current values
   - Save button calls `useUpsertOrder` to update the order
   - If not found: shows "Order not found, only existing orders can be updated"
   - No delete, no upload, no user management UI
4. In `AdminPanel` (or a wrapper), detect if `loggedInUser === BO_USERNAME` and render `BOPanel` instead of the full tabbed admin UI
5. Show logged-in username in the panel header area (e.g. "Logged in as: BO")
