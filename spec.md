# Order Status Tracker

## Current State

- Admin panel with tabs: Upload Excel, Manual Entry, User Management
- Upload Excel: drag/drop xlsx/csv, preview, bulk upsert, download sample template
- Manual Entry: enter order ID + 11 statuses, save
- User Management: assign roles by principal ID
- BO user: search existing order, update statuses with checkbox (auto-date) or manual input
- AllOrdersTable: shows all orders, delete button per row
- Backend: `upsertOrder`, `bulkUpsertOrders`, `deleteOrder`, `getOrder`, `getAllOrders` — all open, no auth required
- 11 status fields: status1–status11, labeled Name, Date of Order ID, Payment, Material Dispatched, Installation, File Submission, Meter, Internet, Subsidy, Warranty File, Any Pendency

## Requested Changes (Diff)

### Add
1. **Download All Data as Excel** button in the admin panel (visible in the Upload Excel tab and/or AllOrdersTable section). Clicking it exports ALL current orders to a .xlsx file using SheetJS, with column headers: OrderID, Name, Date of Order ID, Payment, Material Dispatched, Installation, File Submission, Meter, Internet, Subsidy, Warranty File, Any Pendency.
2. **Partial-column upload (status update only)**: Allow admin to upload an Excel file that contains only `OrderID` plus ONE or MORE status columns (not all 11). For each matching existing Order ID, only the columns present in the uploaded file with non-blank values should be updated. Status fields NOT present in the uploaded Excel (or present but blank) must NOT be overwritten — existing values must be preserved.
3. **Blank-skip logic**: When uploading any Excel (full or partial), if a status column is present but its cell value is empty/blank for a given row, that specific status should NOT be updated — the existing value in the backend must be kept.

### Modify
- `mapRowsToOrders`: Must differentiate between "column present but blank" vs "column not present at all". For blank-skip logic, track which columns were present in the uploaded file.
- `handleSubmit` in `UploadInterface`: Before calling `bulkUpsertOrders`, for each parsed row, fetch the existing order from backend (or use cached getAllOrders data), then merge: keep existing values for columns that are blank or absent in the upload, override only non-blank present columns.
- The upload hint text and sample template can note that partial uploads (OrderID + selected columns) are supported.

### Remove
- Nothing removed.

## Implementation Plan

1. Add `downloadAllDataAsExcel` function: fetch all orders via `getAllOrders` query data (already loaded in AllOrdersTable via `useGetAllOrders`), format as array-of-arrays with full header row, use SheetJS `aoa_to_sheet` + `book_new` + `book_append_sheet` + `writeFile` to export as `all_orders.xlsx`.
2. Add "Download All Data" button in `AllOrdersTable` card header (next to the expand/collapse button), only shown when orders exist, triggers `downloadAllDataAsExcel`.
3. Modify `mapRowsToOrders` to also return which columns were actually present in the file (by inspecting the header row keys). Return `{ orders: OrderStatus[], presentColumns: Set<string> }` or embed presence info per row.
4. Modify `UploadInterface.handleSubmit`: 
   - Get existing orders map from `useGetAllOrders` data (already fetched).
   - For each order in `parsedOrders`, find the existing record (if any).
   - For each status field: if the uploaded value is non-blank → use it; if blank or absent (not in uploaded columns) → use the existing backend value (or "" for new orders).
   - Then call `bulkUpsertOrders` with the merged records.
5. Update the upload hint to clarify partial uploads are supported.
6. Apply `data-ocid` markers to the new download button.
