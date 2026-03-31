# E2E Testing with Playwright

## Setup

1. Install Playwright:
   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

2. Create `playwright.config.ts` in the project root:
   ```typescript
   import { defineConfig } from "@playwright/test";

   export default defineConfig({
     testDir: "./tests/e2e",
     baseURL: "http://localhost:3000",
     use: {
       trace: "on-first-retry",
     },
     webServer: {
       command: "npm run dev",
       port: 3000,
       reuseExistingServer: !process.env.CI,
     },
   });
   ```

3. Add script to `package.json`:
   ```json
   {
     "scripts": {
       "test:e2e": "playwright test"
     }
   }
   ```

## Critical Flows to Test

### 1. Login to Dashboard
- Navigate to `/login`
- Enter valid email and password
- Submit form
- Verify redirect to dashboard
- Verify greeting message appears

### 2. Register to Add Items to Complete Order to Receipt
- Open register (`/order`)
- Enter staff PIN
- Browse menu categories
- Add items to cart (with modifiers)
- Complete the order (cash payment)
- Verify receipt is generated with correct totals

### 3. Menu Management: Create Category then Create Item
- Navigate to `/menu`
- Click "Add Category"
- Fill in category name and display order
- Save category
- Click "Add Item" within the new category
- Fill in item name, price, and description
- Save item
- Verify item appears in the category list

### 4. Inventory: Add Ingredient then Set Stock
- Navigate to `/inventory`
- Click "Add Ingredient"
- Fill in ingredient name, unit, and reorder threshold
- Save ingredient
- Set initial stock level for a location
- Verify stock level is reflected in the inventory table
