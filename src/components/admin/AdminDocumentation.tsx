import { useState } from "react";
import {
  BookOpen, Package, ShoppingBag, Users, CreditCard, Settings, Globe, Send,
  TrendingUp, Shield, Database, ChevronDown, ChevronRight, ExternalLink,
  Truck, Building2, Tag, Megaphone, MessageSquare, Navigation, LayoutDashboard,
  FileText, Star, Smartphone, QrCode, Layers, Activity, Wallet, Search,
  AlertTriangle, CheckCircle, Info, Lightbulb, Copy
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DocSection {
  id: string;
  title: string;
  icon: any;
  color: string;
  articles: DocArticle[];
}

interface DocArticle {
  title: string;
  content: string;
  tips?: string[];
  warnings?: string[];
}

const DOCS: DocSection[] = [
  {
    id: "getting_started",
    title: "Getting Started",
    icon: BookOpen,
    color: "text-blue-500",
    articles: [
      {
        title: "Admin Dashboard Overview",
        content: `The Admin Dashboard is your central control panel for managing all aspects of the store. It is organized into sidebar groups:

**Catalog** — Manage products, categories, combos and daily deals.
**Orders & Fulfillment** — Process orders and update delivery status.
**Customer Support** — View messages, pre-orders, PCB orders.
**Customers** — Manage users and reviews.
**Marketing** — Banners, coupons, referral codes, SEO.
**Payments & Finance** — Configure payment methods, view wallets.
**Content & Site** — Navbar, homepage layout, pages, company info.
**SMS Center** — SMS templates and delivery logs.
**Analytics & Reports** — Revenue, stock and order analytics.
**System Tools** — Moderator permissions, database backup, activity logs.`,
        tips: [
          "Sidebar groups can be collapsed/expanded by clicking their header.",
          "The active tab is highlighted in the sidebar for easy navigation.",
          "Moderators only see sections granted to them by an admin.",
        ],
      },
      {
        title: "First-Time Setup Checklist",
        content: `Follow these steps after deploying the store for the first time:

1. **Company Info** — Set your store name, logo, address, email, phone and social links. This appears on invoices and throughout the site.
2. **Bank Details** — Add your bank account information for direct bank transfer payments.
3. **Payment Methods** — Enable/disable Stripe, Bank Transfer, and/or PayHere.
4. **Shipping Charges** — Set local shipping fee, overseas shipping fee, and free-shipping threshold.
5. **Categories** — Create product categories before adding products.
6. **Products** — Add your first products with images, prices, and stock.
7. **Hero Banners** — Upload at least one banner to show on the homepage.
8. **Navbar Manager** — Adjust your announcement bar text and configure navigation links.
9. **SEO Settings** — Set meta title, description and keywords for search engines.
10. **SMS Templates** — Configure templates for order notifications (requires TEXTLK_API_KEY).`,
        tips: [
          "Complete Company Info first — it powers the invoice PDF header.",
          "You can always return to refine settings; changes are saved to the database and go live immediately.",
        ],
      },
    ],
  },
  {
    id: "catalog",
    title: "Catalog Management",
    icon: Package,
    color: "text-orange-500",
    articles: [
      {
        title: "Managing Products",
        content: `Navigate to **Catalog → All Products** to view, add, edit, or delete products.

**Adding a product:**
- Click **"Add Product"** button.
- Fill in Name, Slug (auto-generated), Category, Price, and Stock Quantity.
- Optional: Discount Price (shows as crossed-out original price), Cost Price (used for profit reporting), SKU.
- Upload images (multiple supported). First image is used as the thumbnail.
- Add a Video URL (YouTube/Vimeo embed) and Datasheet PDF URL.
- Set **Shipping Type** (Local vs. Overseas) — this affects which shipping fee is applied at checkout.
- Toggle **Active** (visible to customers) and **Featured** (shown in Featured Products section).

**Editing a product:**
- Click the pencil icon on any product row.
- You can also manage **External Links** (e.g., datasheet, purchase link) and **Similar Products** from the edit dialog.

**Bulk delete:**
- Use the checkboxes on the left of each row to select multiple products, then click "Delete Selected".`,
        tips: [
          "Slug must be unique — it forms the product URL e.g. /product/my-product-slug.",
          "Cost Price is never shown to customers; it's used only for profit margin reports.",
          "Set stock to 0 to show 'Out of Stock' badge on the product page.",
        ],
        warnings: [
          "Deleting a product that has been ordered will not affect existing orders, but order detail pages may lose product name references.",
        ],
      },
      {
        title: "Micro Electronics & LCSC Import",
        content: `The **Micro Electronics** tab is a filtered view of products in the "Micro Electronics" category. It also features automatic LCSC component import.

**LCSC Auto-Import:**
1. Click **Add Product**, select the Micro Electronics category.
2. An LCSC import field appears — enter a part number (e.g. C93216) or paste a full LCSC URL.
3. Click **"Fetch from LCSC"** — name, SKU, description, datasheet, and images will be auto-filled.
4. Set price, stock quantity, and save.

**QR Stock Scan:**
- Use **Catalog → QR Stock Scan** to scan LCSC QR codes on component reels.
- The scanner extracts the C-number and MPN and auto-opens the Add Product dialog pre-filled.`,
        tips: [
          "LCSC part numbers start with 'C' followed by digits (e.g. C17932).",
          "If LCSC fetch fails, a manual fallback form appears so you can still enter details yourself.",
        ],
      },
      {
        title: "Categories",
        content: `Categories organise your products and drive the shop navigation.

- **Parent Categories** appear in the navbar and Category Grid on the homepage.
- **Sub-categories** (set Parent ID) appear inside their parent's listing page.
- **Sort Order** controls the display order (lower = first).
- **Image URL** is shown in the category grid on the homepage.
- Toggle **Active** to hide a category and all its products from the storefront.`,
        tips: [
          "Slug must be lowercase with hyphens only (auto-generated from name).",
          "Use Navbar Manager to hide specific categories from the navigation bar.",
        ],
      },
      {
        title: "Combo Packs",
        content: `Combo packs bundle multiple products at a discounted price.

- Set **Combo Price** (what customers pay) and **Original Price** (shown as crossed-out).
- Add 2+ products to the bundle by selecting them and setting quantities.
- Upload combo images separately from product images.
- Toggle **Featured** to show the combo in the Combo Packs homepage section.`,
      },
      {
        title: "Daily Deals",
        content: `Daily deals apply a time-limited discount to a specific product.

- Select the product, set **Discount %** or a fixed **Deal Price**.
- Set start and end datetime — the countdown timer shows on the Deals page.
- Toggle **Active** to manually enable/disable regardless of time.`,
        tips: ["The Deals page (/deals) shows all currently active deals with countdowns."],
      },
    ],
  },
  {
    id: "orders",
    title: "Orders & Fulfillment",
    icon: ShoppingBag,
    color: "text-green-500",
    articles: [
      {
        title: "Processing Orders",
        content: `Navigate to **Orders & Fulfillment → Orders** to view all customer orders.

**Order statuses:**
- **pending** — Just placed, awaiting action.
- **confirmed** — Payment confirmed, being prepared.
- **processing** — Order is being packed.
- **packed** — Ready to dispatch.
- **shipped** — In transit.
- **delivered** — Delivered to customer.
- **cancelled** — Order was cancelled.

**Payment statuses:**
- **pending** — Awaiting payment.
- **paid** — Payment received.
- **failed** — Payment failed.

Click on any order row to open the **Order Detail Dialog** which shows full item breakdown, customer shipping address, payment info, referral/coupon codes, and a complete status history timeline.`,
        tips: [
          "Use the search bar to find orders by Order ID, customer name, phone, or tracking number.",
          "Filter by status using the dropdown to focus on specific order stages.",
          "You can bulk-update order status using checkboxes and the 'Update Status' button.",
        ],
      },
      {
        title: "Delivery Updates",
        content: `**Delivery Updates** is a focused view for orders that need shipping action (confirmed, paid, processing, packed, shipped).

For each order you can:
- Update **status** (e.g. from packed → shipped).
- Set **Tracking Number**, **Courier Name**, **Tracking Link**.
- Set **Expected Delivery** date.
- Add a **Delivery Note** visible to the customer on their tracking page.

**Status history** is recorded automatically — customers can view their full timeline on the Track Order page (/track-order).`,
        tips: [
          "Always add a tracking number when marking as 'shipped' — customers see it on their profile and tracking page.",
          "An SMS notification is sent automatically when order status changes (if SMS templates are configured).",
        ],
      },
      {
        title: "Pre-Orders",
        content: `Pre-orders allow customers to request items not currently in stock (e.g. sourced from overseas).

**Workflow:**
1. Customer submits a pre-order request with product name/URL and quantity.
2. Admin reviews the request — status moves from **pending → quoted** once a price is set.
3. Customer pays the advance (uploads slip) — status becomes **partially_paid**.
4. Goods arrive — admin sets arrival fees and updates arrival payment status.
5. Final payment made — **completed**.

Each pre-order has its own **conversation thread** for customer communication. Click "Open Conversation" to message the customer.`,
      },
      {
        title: "PCB Orders",
        content: `PCB orders are custom printed circuit board fabrication requests.

**Specifications tracked:**
- Layer count (1–4+), board thickness, PCB color, surface finish, quantity.
- Gerber file uploaded by the customer.

**Workflow:**
1. Customer submits PCB specs + gerber file.
2. Admin reviews and quotes a price (unit cost, shipping, tax).
3. Customer pays (uploads slip) — payment_status → paid.
4. Order fabricated and shipped.
5. Arrival payment handled separately if there are import duties.`,
      },
    ],
  },
  {
    id: "customers",
    title: "Customers",
    icon: Users,
    color: "text-purple-500",
    articles: [
      {
        title: "User Management",
        content: `View all registered customers under **Customers → Users**.

**Actions available:**
- **View Profile** — See order history, wallet balance, profile details.
- **Edit** — Update name, phone, city, address.
- **Change Role** — Promote to Moderator or Admin (use with caution).
- **Suspend** — Block the user from placing new orders (with reason).
- **Unsuspend** — Reinstate access.
- **Delete** — Permanently remove the user (this deletes all their data).

**Filters:**
- Filter by role (user / moderator / admin) or status (active / suspended).`,
        warnings: [
          "Admin role grants full access to this dashboard — only assign to trusted team members.",
          "Deleting a user is irreversible and removes all their orders, profile, and messages.",
        ],
      },
      {
        title: "Reviews",
        content: `Product reviews submitted by customers appear under **Customers → Reviews**.

- Toggle **Visibility** per review to show/hide it on the product page.
- Bulk-hide reviews using checkboxes.
- Search by product name or review content.`,
        tips: ["New reviews are visible by default. Use this section to moderate inappropriate content."],
      },
      {
        title: "Moderator Permissions",
        content: `Moderators are staff members with limited admin access. Under **System Tools → Moderator Permissions**, you can grant each moderator:

- **Manage Orders** — Access the Orders and Delivery Updates tabs.
- **Manage Pre-Orders** — Access the Pre-Orders tab.
- **Manage PCB Orders** — Access the PCB Orders tab.
- **View Contacts** — Access the Messages / Customer Support tab.

Moderators never see Catalog, Marketing, Payment, SEO, or System settings.`,
        warnings: ["Always review permissions after promoting a user to moderator."],
      },
    ],
  },
  {
    id: "marketing",
    title: "Marketing",
    icon: Megaphone,
    color: "text-pink-500",
    articles: [
      {
        title: "Hero Banners",
        content: `Hero banners appear in the rotating slider at the top of the homepage.

- Upload an image (recommended: 1920×600px).
- Set a Title, Subtitle, Link URL (click destination), and Sort Order.
- Toggle **Active** to show/hide without deleting.`,
        tips: ["Keep banner images under 500KB for fast loading. Use WebP format where possible."],
      },
      {
        title: "Promo Banners",
        content: `Promo banners are smaller promotional cards displayed in a grid below the hero banner.

- Set Title, Badge Text (e.g. "⚡ Flash Sale"), Description, Image, and Link URL.
- Choose a **Gradient Color** theme (Primary, Secondary, Destructive, Accent).
- Sort Order controls the display sequence.`,
      },
      {
        title: "Coupons",
        content: `Coupons give customers a discount at checkout.

**Coupon types:**
- **Public** — Any customer can use it if they know the code.
- **Private** — Assigned to specific phone numbers (visible only to those users).

**Discount types:**
- **Percentage** — e.g. 10% off the order total.
- **Fixed** — e.g. Rs. 500 off.

**Key settings:**
- **Min Order Amount** — Only valid above this cart total.
- **Max Uses** — Total redemption limit across all users.
- **Per User Limit** — How many times one user can use it.
- **Max Discount Cap** — Maximum Rs. discount for percentage coupons.
- **Category Scope** — Restrict to all / specific / excluded categories.
- **Starts At / Expires At** — Active date range.

**Private coupons** — click "Assign Users" to map the coupon to specific phone numbers.`,
        tips: [
          "Leave Max Uses blank for unlimited usage.",
          "Use percentage coupons with a cap to prevent abuse (e.g. 20% off, max Rs. 1,000).",
        ],
      },
      {
        title: "Referral Codes",
        content: `Referral codes are similar to coupons but tracked separately for attribution purposes.

- **Code Purpose** field helps categorize (e.g. 'influencer', 'affiliate', 'staff').
- Usage is tracked in the Referral Code Usage table, visible in order details and invoices.
- Supports percentage or fixed discounts with the same cap/limit options as coupons.`,
        tips: [
          "Use referral codes for influencer partnerships where you need to track who referred customers.",
          "Referral code discounts appear as a separate line in order invoices.",
        ],
      },
      {
        title: "SEO Settings",
        content: `Configure search engine metadata under **Marketing → SEO**.

- **Meta Title / Store Name** — Appears in browser tab and Google search results.
- **Tagline** — Subtitle shown in the default page title.
- **Meta Description** — 150–160 characters describing your store for search snippets.
- **Meta Keywords** — Comma-separated keywords (limited SEO value today but still used).
- **OG Image** — Open Graph image for social sharing previews (1200×630px recommended).
- **Favicon URL** — Small icon shown in browser tabs.`,
        tips: [
          "Individual product pages automatically generate their own meta tags from product data.",
          "A sitemap.xml is auto-generated at /sitemap.xml for search engine indexing.",
        ],
      },
    ],
  },
  {
    id: "payments",
    title: "Payments & Finance",
    icon: CreditCard,
    color: "text-yellow-500",
    articles: [
      {
        title: "Payment Methods",
        content: `Enable or disable payment methods from **Payments & Finance → Payment Methods**.

**Stripe (Card Payments):**
- Requires a Stripe account and secret key (stored as STRIPE_SECRET_KEY secret).
- Customers are redirected to Stripe Checkout and returned after payment.

**Direct Bank Transfer:**
- Customer uploads a payment receipt (slip) after placing an order.
- Admin manually confirms payment in the Order Detail dialog.
- Bank account details shown on the checkout page come from **Bank Details** settings.

**PayHere (Sri Lanka):**
- Supports Visa, MasterCard, eZ Cash, mCash, GENIE, FriMi, and more.
- Requires PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET (already configured as secrets).
- **Sandbox Mode** — Enable for testing. Must be disabled in production.
- The PayHere popup opens directly on the checkout page (no redirect).
- Payment notifications are handled by the payhere-notify backend function.`,
        warnings: [
          "Always disable Sandbox Mode before going live with PayHere.",
          "At least one payment method must remain enabled.",
          "Never expose Stripe secret key or PayHere merchant secret in frontend code.",
        ],
        tips: [
          "You can enable all three payment methods simultaneously — customers choose at checkout.",
          "PayHere requires your domain to be approved in your PayHere merchant account settings.",
        ],
      },
      {
        title: "Shipping Charges",
        content: `Configure shipping fees under **Payments & Finance → Shipping Charges**.

- **Local Shipping Fee (Rs.)** — Applied when all cart items ship from Sri Lanka.
- **Overseas Shipping Fee (Rs.)** — Applied when any cart item ships from overseas (e.g. sourced from China).
- **Free Shipping Threshold (Rs.)** — Orders above this amount get free local shipping.

The shipping type per product is set in the product form (Local 🇱🇰 vs. Overseas 🌍).`,
        tips: [
          "If a cart contains even one overseas product, the overseas shipping fee applies to the entire cart.",
          "Set threshold to 0 to disable free shipping completely.",
        ],
      },
      {
        title: "Bank Details",
        content: `Add your bank account information under **Payments & Finance → Bank Details**.

Multiple accounts can be added (e.g. one for each bank). Each account shows:
- Bank Name, Account Name, Account Number, Branch, SWIFT Code (optional), Additional Info.

This information appears on the checkout page when "Bank Transfer" is selected and in invoice PDFs.`,
      },
      {
        title: "User Wallets",
        content: `The Wallet system allows admins to credit customer accounts (e.g. for refunds or promotions).

- Search for a user and view their current wallet balance.
- Add credit or debit with a reason note.
- Transaction history is maintained.
- Customers can apply wallet credit at checkout to reduce their order total.`,
      },
    ],
  },
  {
    id: "content",
    title: "Content & Site",
    icon: Globe,
    color: "text-cyan-500",
    articles: [
      {
        title: "Homepage Sections Manager",
        content: `Control which sections appear on the homepage and in what order.

- **Drag** sections up/down to reorder them.
- Use the **↑↓ arrows** for precise ordering.
- Toggle the **switch** on each section to show/hide it.
- Changes go live immediately after saving.

**Available sections:**
Hero Banner → Trust Banner → Daily Deals → Promo Banners → Category Grid → Featured Products → Combo Packs → 3D Printing CTA → New Arrivals → Testimonials → Newsletter`,
        tips: ["Always keep Hero Banner near the top for the best first impression."],
      },
      {
        title: "Navbar Manager",
        content: `Customize the navigation bar from **Content & Site → Navbar Manager**.

- **Announcement Bar** — Toggle visibility and update the text shown above the navbar (e.g. free delivery offers).
- **Category Links** — Show/hide individual categories from the navigation dropdown. The top 6 visible categories are shown.
- **Daily Deals Link** — Toggle the 🔥 Daily Deals shortcut in the navbar.
- **Custom Links** — Add external service links (e.g. 3D Print, PCB Design) with labels, URLs, and open-in-new-tab option.`,
        tips: [
          "Announcement bar text supports emojis — use them to make promotions stand out.",
          "Custom links appear at the right end of the navbar on desktop.",
        ],
      },
      {
        title: "Pages (Static Content)",
        content: `Create and manage static content pages (e.g. Terms & Conditions, Privacy Policy, About Us).

- Set a **Title**, **Slug** (URL path e.g. 'privacy-policy' → /page/privacy-policy), and **Content**.
- Content supports basic markdown-like formatting:
  - **Bold text** using \`**text**\`
  - Bullet lists using \`- item\`
  - Numbered lists using \`1. item\`
- Toggle **Published** to control visibility.

The **Contact Us** page (slug: contact-us) automatically includes a contact form.`,
      },
      {
        title: "Company Info",
        content: `Set your business identity under **Content & Site → Company Info**.

- **Store Name** — Appears in the navbar, footer, invoices, and browser tabs.
- **Logo URL** — Upload your logo image. Supports display modes: Logo & Text, Logo Only, Text Only.
- **Logo Height** — Adjustable from 24px to 72px.
- **Address, Phone, Email** — Shown on invoices and the contact page.
- **Social Links** — Facebook, Instagram, YouTube, WhatsApp, TikTok links in the footer.
- **Invoice Note** — Custom text printed at the bottom of every invoice PDF.`,
        tips: [
          "Logo images look best on a transparent background (PNG format).",
          "Social links left blank are hidden automatically in the footer.",
        ],
      },
      {
        title: "Invoice Template",
        content: `Customize the layout and branding of customer invoice PDFs from **Content & Site → Invoice Template**.

- Preview the invoice layout in real time.
- Settings override defaults for font sizes, header/footer text, and column visibility.
- Referral code discounts and coupon codes are automatically included in the itemized breakdown.`,
      },
    ],
  },
  {
    id: "sms",
    title: "SMS Center",
    icon: Send,
    color: "text-indigo-500",
    articles: [
      {
        title: "SMS Setup (text.lk)",
        content: `The store uses the **text.lk** API to send SMS notifications. Setup requires:

1. Create an account at text.lk.
2. Add your **TEXTLK_API_KEY** and **TEXTLK_SENDER_ID** as project secrets (already done if configured).
3. Ensure your sender ID is approved by text.lk.

**Automatic SMS triggers:**
- Order placed (order_placed template)
- Order status updated (order_status_update template)
- OTP verification (otp template)
- PCB order notification
- Pre-order notification`,
        tips: [
          "SMS is sent to the phone number on the customer's profile and shipping address.",
          "You can test templates by sending a manual SMS from the SMS Templates section.",
        ],
        warnings: [
          "Without TEXTLK_API_KEY configured, SMS notifications will silently fail — check SMS Logs if customers aren't receiving messages.",
        ],
      },
      {
        title: "SMS Templates",
        content: `Create and manage message templates under **SMS Center → SMS Templates**.

**Template variables (placeholders):**
- \`{{customer_name}}\` — Customer's full name
- \`{{order_id}}\` — Short order ID
- \`{{total}}\` — Order total (e.g. 4,500)
- \`{{status}}\` — Order status
- \`{{tracking_info}}\` — Tracking number and link
- \`{{eta}}\` — Expected delivery date

**Template Keys (do not change these):**
- \`order_placed\` — Sent when a new order is created
- \`order_status_update\` — Sent when order status changes
- \`otp\` — Phone verification OTP`,
        tips: [
          "SMS messages have a 160-character limit per SMS — keep templates concise.",
          "Preview your template with sample data in the template editor before saving.",
        ],
      },
      {
        title: "SMS Logs",
        content: `View all sent messages under **SMS Center → SMS Logs**.

Each log entry shows:
- Timestamp, Phone number, Template key used, Delivery status (sent/failed), Message text.

Use this to debug delivery failures or confirm that notifications were sent.`,
        tips: ["Failed messages show 'failed' status — check your TEXTLK_API_KEY if all messages are failing."],
      },
    ],
  },
  {
    id: "system",
    title: "System Tools",
    icon: Shield,
    color: "text-red-500",
    articles: [
      {
        title: "Database Backup & Restore",
        content: `Under **System Tools → Backup & Restore** you can:

- **Create a manual backup** — Exports all database table data to a JSON file stored in the db-backups storage bucket.
- **Schedule automatic backups** — Configure a cron schedule (e.g. daily at midnight).
- **Download a backup** — Get the JSON file to your computer.
- **Restore from backup** — Re-import table data from a previously created backup file.

Backup logs are maintained with file name, size, timestamp, and creator.`,
        warnings: [
          "Restore operations overwrite existing data — only use in emergencies.",
          "Backup files contain sensitive customer data — keep them secure.",
        ],
      },
      {
        title: "Activity Logs",
        content: `The **Activity Logs** tab records all significant admin actions:

- Who performed the action (admin email)
- What action was taken (e.g. 'update_order_status', 'delete_product')
- Which record was affected (target_id and target_type)
- Timestamp and IP address

Use this to audit changes and investigate any unexpected data modifications.`,
        tips: ["Logs are read-only and cannot be edited. They can only be deleted by a superadmin."],
      },
      {
        title: "Security Best Practices",
        content: `Keep your store and customer data safe:

- **Never share your admin credentials** with anyone who doesn't need full access — create moderator accounts instead.
- **Secrets (API keys)** are stored server-side and never exposed in frontend code.
- **Supabase RLS policies** ensure users can only access their own data.
- **PayHere hash generation** is done server-side to protect the merchant secret.
- **Stripe webhooks** verify payment signatures before updating order status.
- **Regularly download backups** and store them off-site.
- **Review Activity Logs** periodically to detect unauthorized changes.`,
        warnings: [
          "If you suspect a security breach, immediately reset your admin password and rotate all API keys.",
        ],
      },
    ],
  },
  {
    id: "self_hosting",
    title: "Self-Hosting Guide",
    icon: Building2,
    color: "text-teal-500",
    articles: [
      {
        title: "Docker Compose Setup",
        content: "This guide explains how to run the full shop stack on your own VPS using Docker.\n\n**Prerequisites:**\n- A Linux VPS (Ubuntu 22.04 recommended) with at least 2GB RAM\n- Docker and Docker Compose installed\n- A domain name pointed at your server IP\n- Port 80 and 443 open in your firewall\n\n**Step 1 — Clone the repo:**\n  git clone <YOUR_GIT_URL> shop\n  cd shop\n\n**Step 2 — Create a .env file in the project root:**\n  VITE_SUPABASE_URL=https://your-domain.com\n  VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>\n  VITE_SUPABASE_PROJECT_ID=<project_ref>\n  PUBLIC_SUPABASE_URL=https://your-domain.com\n\n**Step 3 — Build and start:**\n  docker compose up -d --build\n\n**Step 4 — Verify containers are running:**\n  docker compose ps\n\nAll services (kong, db, storage, auth, edge-runtime) should show **Up**.\n\n**Step 5 — Apply database migrations:**\n  docker compose exec db psql -U postgres -d postgres -f /migrations/init.sql",
        tips: [
          "Use `docker compose logs -f edge-runtime` to tail edge function logs in real time.",
          "Run `docker compose pull` periodically to update base images.",
          "Back up your Docker volumes before any major upgrade.",
        ],
        warnings: [
          "Never expose the Postgres or Kong admin ports (5432, 8001) directly to the internet — use a firewall.",
        ],
      },
      {
        title: "Self-Hosted Supabase Configuration",
        content: "When running Supabase self-hosted (via Docker), configure these extra environment variables so the shop functions work correctly.\n\n**Required secrets to set in Admin → Secrets panel:**\n- `PUBLIC_SUPABASE_URL` — The externally-reachable URL of your Supabase instance (e.g. https://supabase.your-domain.com). Critical for backup/restore signed URLs.\n- `SUPABASE_DB_URL` — The internal Postgres connection string: postgresql://postgres:PASSWORD@db:5432/postgres. Used for scheduled backups and FK bypass during restore.\n\n**Kong / API gateway config:**\nBy default Supabase routes API calls through Kong on port 8000. Your `PUBLIC_SUPABASE_URL` should point to Kong via an Nginx reverse proxy.\n\n**Nginx reverse proxy example:**\n  server {\n      listen 443 ssl;\n      server_name supabase.your-domain.com;\n      location / {\n          proxy_pass http://localhost:8000;\n          proxy_set_header Host $http_host;\n      }\n  }\n\n**Redeploying Edge Functions after code changes:**\n  docker compose restart edge-runtime\n\n**Storage:**\nFiles are stored inside the `storage` container volume. Back up this volume separately from the database.",
        tips: [
          "After setting PUBLIC_SUPABASE_URL, test by downloading a backup file to verify the URL resolves correctly.",
          "If backup ZIP downloads fail with hostname errors, PUBLIC_SUPABASE_URL is likely pointing to an internal host.",
        ],
        warnings: [
          "Do NOT use http://kong:8000 as PUBLIC_SUPABASE_URL — that is an internal Docker hostname unreachable from browsers.",
        ],
      },
      {
        title: "Migrating Auth Users to VPS",
        content: "Auth users (email, phone, passwords) are stored in the auth.users table managed by Supabase internally. The standard backup/restore does NOT include auth users — migrate them separately.\n\n**Option A — pg_dump the auth schema (recommended):**\n\nOn your source Supabase instance (replace DB_URL with your database URL):\n  pg_dump --schema=auth -t auth.users -t auth.identities -t auth.sessions DB_URL > auth_users.sql\n\nOn your target VPS (inside Docker):\n  docker compose exec db psql -U postgres -d postgres < auth_users.sql\n\n**Option B — Export from Dashboard:**\n- Go to your source project → Table Editor → auth.users\n- Export as CSV\n- Import into your target instance via psql COPY command\n\n**After migration:**\n1. Restore the main database backup via Admin → Backup & Restore → Restore.\n2. The restore skips `profiles` and `user_roles` FK errors automatically using `session_replication_role = replica`.\n3. Verify user logins work by testing a known account.",
        tips: [
          "You need direct database access (DATABASE_URL) to run pg_dump — get it from your Supabase project settings under Database.",
          "Always restore auth users BEFORE restoring the main backup to avoid FK constraint issues.",
        ],
        warnings: [
          "Auth user passwords are stored as bcrypt hashes — they work correctly after migration without password resets.",
        ],
      },
      {
        title: "Restore from Backup on VPS",
        content: "After deploying to your VPS, restore your data using Admin → Backup & Restore.\n\n**Full site restore workflow:**\n1. **Upload a ZIP backup** — Use 'Upload & Restore Full Site ZIP' to upload a full-backup-*.zip from your computer.\n2. The system automatically:\n   - Phase 1: Restores all database tables (FK checks disabled to handle profiles/user_roles)\n   - Phase 2: Restores all storage images in batches of 15 files\n3. **Watch the progress bar** — each batch is shown. Total time depends on the number of images.\n4. After completion, reload the storefront to verify products and images appear.\n\n**Troubleshooting FK errors during restore:**\nIf you see FK constraint errors in the edge function logs:\n- Ensure `SUPABASE_DB_URL` secret is correctly set (needed for the pg bypass)\n- Check that Postgres port 5432 is accessible from within the edge-runtime container\n- Verify the secret uses the internal Docker hostname `db` not `localhost`\n\n**Restoring only the database (no images):**\nUse the JSON-only restore option — upload a backup-*.json file. Faster and suitable when you only need to restore table data.",
        tips: [
          "After a full restore, clear your browser cache — some images may be served from old CDN cache.",
          "Storage restore batches can be rerun if they time out — the system uses upsert so re-running is safe.",
        ],
      },
      {
        title: "SSL & Domain Setup",
        content: "Secure your VPS deployment with HTTPS using Certbot (Let's Encrypt).\n\n**Step 1 — Install Certbot:**\n  sudo apt install certbot python3-certbot-nginx -y\n\n**Step 2 — Obtain a certificate:**\n  sudo certbot --nginx -d shop.your-domain.com -d supabase.your-domain.com\n\n**Step 3 — Auto-renewal:**\n  sudo systemctl enable certbot.timer\n  sudo systemctl start certbot.timer\n\n**Building the frontend for production:**\n  npm install && npm run build\n  # Copy dist/ folder to /var/www/shop/dist on your server\n\n**Nginx config for the shop frontend:**\n  server {\n      listen 443 ssl;\n      server_name shop.your-domain.com;\n      root /var/www/shop/dist;\n      index index.html;\n      location / { try_files PATH PATH/ /index.html; }\n      ssl_certificate /etc/letsencrypt/live/shop.your-domain.com/fullchain.pem;\n      ssl_certificate_key /etc/letsencrypt/live/shop.your-domain.com/privkey.pem;\n  }",
        tips: [
          "Set VITE_SUPABASE_URL to your public domain before running `npm run build` — this is baked into the frontend bundle.",
          "Use `npm run build` locally and SCP the dist/ folder to your server, or set up a CI/CD pipeline.",
        ],
        warnings: [
          "Never serve the shop over plain HTTP in production — customer data and session tokens must be encrypted.",
        ],
      },
    ],
  },
];

const CopyableCode = ({ code }: { code: string }) => {
  const copy = () => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied to clipboard" });
  };
  return (
    <span
      onClick={copy}
      className="inline-flex items-center gap-1 font-mono text-xs bg-muted/70 text-secondary border border-border rounded px-1.5 py-0.5 cursor-pointer hover:bg-muted transition-colors"
    >
      {code}
      <Copy className="w-2.5 h-2.5 opacity-50" />
    </span>
  );
};

const renderContent = (text: string) => {
  return text.split("\n\n").map((block, i) => {
    if (block.startsWith("- ")) {
      const items = block.split("\n").filter(l => l.startsWith("- "));
      return (
        <ul key={i} className="list-none space-y-1.5 my-2">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-2 flex-shrink-0" />
              {renderInline(item.slice(2))}
            </li>
          ))}
        </ul>
      );
    }
    if (/^\d+\./.test(block)) {
      const items = block.split("\n").filter(l => /^\d+\./.test(l));
      return (
        <ol key={i} className="space-y-1.5 my-2">
          {items.map((item, j) => {
            const [num, ...rest] = item.split(". ");
            return (
              <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="w-5 h-5 rounded-full bg-secondary/10 text-secondary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{num}</span>
                <span>{renderInline(rest.join(". "))}</span>
              </li>
            );
          })}
        </ol>
      );
    }
    return (
      <p key={i} className="text-sm text-muted-foreground leading-relaxed">
        {renderInline(block)}
      </p>
    );
  });
};

const renderInline = (text: string) => {
  // Handle **bold**, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <CopyableCode key={i} code={part.slice(1, -1)} />;
    }
    return <span key={i}>{part}</span>;
  });
};

const AdminDocumentation = () => {
  const [activeSection, setActiveSection] = useState<string>("getting_started");
  const [activeArticle, setActiveArticle] = useState<number>(0);
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({
    getting_started: true,
  });

  const currentSection = DOCS.find(s => s.id === activeSection);
  const currentArticle = currentSection?.articles[activeArticle];

  const toggleSection = (id: string) => {
    setSectionOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-0 rounded-xl overflow-hidden border border-border bg-card">
      {/* Left sidebar nav */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-muted/20 overflow-y-auto">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-secondary" />
            <h2 className="text-sm font-bold text-foreground">Documentation</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Admin Setup & Configuration Guide</p>
        </div>

        <nav className="p-2 space-y-0.5">
          {DOCS.map(section => {
            const Icon = section.icon;
            const isOpen = sectionOpen[section.id];
            const isActiveSection = activeSection === section.id;
            return (
              <div key={section.id}>
                <button
                  onClick={() => {
                    toggleSection(section.id);
                    if (!isActiveSection) {
                      setActiveSection(section.id);
                      setActiveArticle(0);
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActiveSection
                      ? "bg-secondary/10 text-secondary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${isActiveSection ? "text-secondary" : section.color}`} />
                    {section.title}
                  </div>
                  {isOpen ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="ml-5 mt-0.5 space-y-0.5 pl-2 border-l border-border">
                    {section.articles.map((article, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setActiveSection(section.id); setActiveArticle(idx); }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                          isActiveSection && activeArticle === idx
                            ? "bg-secondary/10 text-secondary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        {article.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {currentSection && currentArticle && (
          <div className="max-w-2xl space-y-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="w-3 h-3" />
              <span>{currentSection.title}</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-medium">{currentArticle.title}</span>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-xl font-bold font-display text-foreground">{currentArticle.title}</h1>
              <div className="flex items-center gap-2 mt-2">
                {(() => { const Icon = currentSection.icon; return <Icon className={`w-3.5 h-3.5 ${currentSection.color}`} />; })()}
                <span className="text-xs text-muted-foreground">{currentSection.title}</span>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-3 pb-1">
              {renderContent(currentArticle.content)}
            </div>

            {/* Tips */}
            {currentArticle.tips && currentArticle.tips.length > 0 && (
              <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-secondary">
                  <Lightbulb className="w-4 h-4" />
                  <span className="text-sm font-semibold">Tips</span>
                </div>
                <ul className="space-y-1.5">
                  {currentArticle.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-3.5 h-3.5 text-secondary mt-0.5 flex-shrink-0" />
                      {renderInline(tip)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {currentArticle.warnings && currentArticle.warnings.length > 0 && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-semibold">Important Warnings</span>
                </div>
                <ul className="space-y-1.5">
                  {currentArticle.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                      {renderInline(w)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Article navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                onClick={() => {
                  if (activeArticle > 0) {
                    setActiveArticle(activeArticle - 1);
                  } else {
                    const idx = DOCS.findIndex(s => s.id === activeSection);
                    if (idx > 0) {
                      const prev = DOCS[idx - 1];
                      setActiveSection(prev.id);
                      setActiveArticle(prev.articles.length - 1);
                      setSectionOpen(p => ({ ...p, [prev.id]: true }));
                    }
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              >
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                {activeArticle + 1} / {currentSection.articles.length}
              </span>
              <button
                onClick={() => {
                  if (activeArticle < currentSection.articles.length - 1) {
                    setActiveArticle(activeArticle + 1);
                  } else {
                    const idx = DOCS.findIndex(s => s.id === activeSection);
                    if (idx < DOCS.length - 1) {
                      const next = DOCS[idx + 1];
                      setActiveSection(next.id);
                      setActiveArticle(0);
                      setSectionOpen(p => ({ ...p, [next.id]: true }));
                    }
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDocumentation;
