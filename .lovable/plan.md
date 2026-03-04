
## Plan: LCSC Auto-Import for Product Creation

### What the user wants
When adding a product in the admin panel, admin can enter an LCSC Part Number (e.g. `C93216`), click a button, and the form auto-fills with the component's name, description, specifications, datasheet URL, and manufacturer — scraped from LCSC. Admin then sets the price and stock quantity manually before saving.

### How LCSC data can be fetched
LCSC has a public product API endpoint:
```
https://wmsc.lcsc.com/ftps/wanna/search/part?searchContent=C93216
```
This returns structured JSON with product details. We'll call this from a Supabase Edge Function (to avoid CORS issues), and return the cleaned data to the frontend.

### Architecture

```text
Admin clicks "Fetch from LCSC"
        ↓
Frontend calls Edge Function: lcsc-import
        ↓
Edge Function calls LCSC API with part number
        ↓
Returns: name, description, specs, datasheet URL, images, manufacturer
        ↓
Frontend pre-fills product form fields
        ↓
Admin reviews, sets price/stock, saves product
```

### Changes Required

**1. New Edge Function** — `supabase/functions/lcsc-import/index.ts`
- Accepts `{ partNumber: "C93216" }` in POST body
- Calls LCSC's product detail API
- Returns structured data: name, description, specifications (as key/value pairs), datasheet URL, manufacturer, package, images

**2. Admin Dashboard UI** — `src/pages/admin/AdminDashboard.tsx`
- Add an "LCSC Part Number" input field at the top of the Add Product dialog
- Add a "Fetch from LCSC" button next to it
- On click: call the edge function, auto-populate the form fields (name, SKU = part number, description, datasheet_url, specifications)
- Show a loading spinner while fetching
- Show success/error toast
- Admin still manually sets: **Price**, **Stock Quantity**, **Category** (required business decisions)
- A clear note: "Data auto-filled from LCSC — please set price & stock"

### What gets auto-filled from LCSC
| Field | Source |
|---|---|
| Product Name | `productModel` from LCSC |
| SKU | LCSC Part Number |
| Description | Category path + package + key attributes |
| Datasheet URL | PDF link from LCSC |
| Specifications | All technical attributes as key/value |
| Images | Product image URLs from LCSC |

### What admin sets manually
- **Price (Rs.)** — admin decides markup
- **Stock Quantity** — how many they have in hand
- **Category** — map to their store categories
- **Selling price / discount price** — business decision

### Files to create/edit
1. `supabase/functions/lcsc-import/index.ts` — new edge function
2. `src/pages/admin/AdminDashboard.tsx` — add LCSC import UI to product dialog (~20 lines added near top of dialog)
