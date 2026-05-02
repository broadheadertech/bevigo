/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit_helpers from "../audit/helpers.js";
import type * as audit_queries from "../audit/queries.js";
import type * as auth_google from "../auth/google.js";
import type * as auth_helpers from "../auth/helpers.js";
import type * as auth_login from "../auth/login.js";
import type * as auth_loginHelpers from "../auth/loginHelpers.js";
import type * as auth_pinFailures from "../auth/pinFailures.js";
import type * as auth_pinSet from "../auth/pinSet.js";
import type * as auth_pinSwitch from "../auth/pinSwitch.js";
import type * as auth_session from "../auth/session.js";
import type * as auth_sessionCleanup from "../auth/sessionCleanup.js";
import type * as backfillCustomerNumbers from "../backfillCustomerNumbers.js";
import type * as billing_mutations from "../billing/mutations.js";
import type * as billing_queries from "../billing/queries.js";
import type * as billing_seedPlans from "../billing/seedPlans.js";
import type * as crons from "../crons.js";
import type * as customers_mutations from "../customers/mutations.js";
import type * as customers_queries from "../customers/queries.js";
import type * as discounts_mutations from "../discounts/mutations.js";
import type * as discounts_queries from "../discounts/queries.js";
import type * as exports from "../exports.js";
import type * as floors_mutations from "../floors/mutations.js";
import type * as floors_queries from "../floors/queries.js";
import type * as http from "../http.js";
import type * as insights from "../insights.js";
import type * as inventory_adjustmentMutations from "../inventory/adjustmentMutations.js";
import type * as inventory_adjustmentQueries from "../inventory/adjustmentQueries.js";
import type * as inventory_mutations from "../inventory/mutations.js";
import type * as inventory_purchaseOrderMutations from "../inventory/purchaseOrderMutations.js";
import type * as inventory_purchaseOrderQueries from "../inventory/purchaseOrderQueries.js";
import type * as inventory_queries from "../inventory/queries.js";
import type * as inventory_recipeMutations from "../inventory/recipeMutations.js";
import type * as inventory_recipeQueries from "../inventory/recipeQueries.js";
import type * as lib_auth from "../lib/auth.js";
import type * as locations_cloneMutations from "../locations/cloneMutations.js";
import type * as locations_mutations from "../locations/mutations.js";
import type * as locations_queries from "../locations/queries.js";
import type * as menu_bulkMutations from "../menu/bulkMutations.js";
import type * as menu_cloneMutations from "../menu/cloneMutations.js";
import type * as menu_imageMutations from "../menu/imageMutations.js";
import type * as menu_modifierMutations from "../menu/modifierMutations.js";
import type * as menu_modifierQueries from "../menu/modifierQueries.js";
import type * as menu_modifierRecipeMutations from "../menu/modifierRecipeMutations.js";
import type * as menu_mutations from "../menu/mutations.js";
import type * as menu_priceMutations from "../menu/priceMutations.js";
import type * as menu_priceQueries from "../menu/priceQueries.js";
import type * as menu_publicQueries from "../menu/publicQueries.js";
import type * as menu_queries from "../menu/queries.js";
import type * as menu_skuHelpers from "../menu/skuHelpers.js";
import type * as orders_historyQueries from "../orders/historyQueries.js";
import type * as orders_internals from "../orders/internals.js";
import type * as orders_mutations from "../orders/mutations.js";
import type * as orders_queries from "../orders/queries.js";
import type * as orders_voidAction from "../orders/voidAction.js";
import type * as payroll_mutations from "../payroll/mutations.js";
import type * as payroll_queries from "../payroll/queries.js";
import type * as platform_auth from "../platform/auth.js";
import type * as platform_helpers from "../platform/helpers.js";
import type * as platform_session from "../platform/session.js";
import type * as points_mutations from "../points/mutations.js";
import type * as points_queries from "../points/queries.js";
import type * as reports_cron from "../reports/cron.js";
import type * as reports_dailyDigest from "../reports/dailyDigest.js";
import type * as reports_dashboardQueries from "../reports/dashboardQueries.js";
import type * as reports_email from "../reports/email.js";
import type * as reports_queries from "../reports/queries.js";
import type * as reports_scheduled from "../reports/scheduled.js";
import type * as reports_scheduledHelpers from "../reports/scheduledHelpers.js";
import type * as rewards_mutations from "../rewards/mutations.js";
import type * as rewards_queries from "../rewards/queries.js";
import type * as search_queries from "../search/queries.js";
import type * as seed from "../seed.js";
import type * as seedDiscountPresets from "../seedDiscountPresets.js";
import type * as seedFullData from "../seedFullData.js";
import type * as seedHelpers from "../seedHelpers.js";
import type * as seedModifierAssignments from "../seedModifierAssignments.js";
import type * as seedProduction from "../seedProduction.js";
import type * as seedRecipes from "../seedRecipes.js";
import type * as seedRewards from "../seedRewards.js";
import type * as settings_mutations from "../settings/mutations.js";
import type * as settings_queries from "../settings/queries.js";
import type * as shifts_mutations from "../shifts/mutations.js";
import type * as shifts_queries from "../shifts/queries.js";
import type * as skuBackfill from "../skuBackfill.js";
import type * as staffFinance_mutations from "../staffFinance/mutations.js";
import type * as staffFinance_queries from "../staffFinance/queries.js";
import type * as staffLocations_mutations from "../staffLocations/mutations.js";
import type * as staffLocations_queries from "../staffLocations/queries.js";
import type * as staff_internals from "../staff/internals.js";
import type * as staff_mutations from "../staff/mutations.js";
import type * as staff_photoMutations from "../staff/photoMutations.js";
import type * as staff_queries from "../staff/queries.js";
import type * as suppliers_mutations from "../suppliers/mutations.js";
import type * as suppliers_queries from "../suppliers/queries.js";
import type * as tables_mutations from "../tables/mutations.js";
import type * as tables_queries from "../tables/queries.js";
import type * as tables_seed from "../tables/seed.js";
import type * as timesheets_cron from "../timesheets/cron.js";
import type * as timesheets_mutations from "../timesheets/mutations.js";
import type * as timesheets_photoMutations from "../timesheets/photoMutations.js";
import type * as timesheets_pinClockAction from "../timesheets/pinClockAction.js";
import type * as timesheets_pinClockHelpers from "../timesheets/pinClockHelpers.js";
import type * as timesheets_queries from "../timesheets/queries.js";
import type * as wipeProduction from "../wipeProduction.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "audit/helpers": typeof audit_helpers;
  "audit/queries": typeof audit_queries;
  "auth/google": typeof auth_google;
  "auth/helpers": typeof auth_helpers;
  "auth/login": typeof auth_login;
  "auth/loginHelpers": typeof auth_loginHelpers;
  "auth/pinFailures": typeof auth_pinFailures;
  "auth/pinSet": typeof auth_pinSet;
  "auth/pinSwitch": typeof auth_pinSwitch;
  "auth/session": typeof auth_session;
  "auth/sessionCleanup": typeof auth_sessionCleanup;
  backfillCustomerNumbers: typeof backfillCustomerNumbers;
  "billing/mutations": typeof billing_mutations;
  "billing/queries": typeof billing_queries;
  "billing/seedPlans": typeof billing_seedPlans;
  crons: typeof crons;
  "customers/mutations": typeof customers_mutations;
  "customers/queries": typeof customers_queries;
  "discounts/mutations": typeof discounts_mutations;
  "discounts/queries": typeof discounts_queries;
  exports: typeof exports;
  "floors/mutations": typeof floors_mutations;
  "floors/queries": typeof floors_queries;
  http: typeof http;
  insights: typeof insights;
  "inventory/adjustmentMutations": typeof inventory_adjustmentMutations;
  "inventory/adjustmentQueries": typeof inventory_adjustmentQueries;
  "inventory/mutations": typeof inventory_mutations;
  "inventory/purchaseOrderMutations": typeof inventory_purchaseOrderMutations;
  "inventory/purchaseOrderQueries": typeof inventory_purchaseOrderQueries;
  "inventory/queries": typeof inventory_queries;
  "inventory/recipeMutations": typeof inventory_recipeMutations;
  "inventory/recipeQueries": typeof inventory_recipeQueries;
  "lib/auth": typeof lib_auth;
  "locations/cloneMutations": typeof locations_cloneMutations;
  "locations/mutations": typeof locations_mutations;
  "locations/queries": typeof locations_queries;
  "menu/bulkMutations": typeof menu_bulkMutations;
  "menu/cloneMutations": typeof menu_cloneMutations;
  "menu/imageMutations": typeof menu_imageMutations;
  "menu/modifierMutations": typeof menu_modifierMutations;
  "menu/modifierQueries": typeof menu_modifierQueries;
  "menu/modifierRecipeMutations": typeof menu_modifierRecipeMutations;
  "menu/mutations": typeof menu_mutations;
  "menu/priceMutations": typeof menu_priceMutations;
  "menu/priceQueries": typeof menu_priceQueries;
  "menu/publicQueries": typeof menu_publicQueries;
  "menu/queries": typeof menu_queries;
  "menu/skuHelpers": typeof menu_skuHelpers;
  "orders/historyQueries": typeof orders_historyQueries;
  "orders/internals": typeof orders_internals;
  "orders/mutations": typeof orders_mutations;
  "orders/queries": typeof orders_queries;
  "orders/voidAction": typeof orders_voidAction;
  "payroll/mutations": typeof payroll_mutations;
  "payroll/queries": typeof payroll_queries;
  "platform/auth": typeof platform_auth;
  "platform/helpers": typeof platform_helpers;
  "platform/session": typeof platform_session;
  "points/mutations": typeof points_mutations;
  "points/queries": typeof points_queries;
  "reports/cron": typeof reports_cron;
  "reports/dailyDigest": typeof reports_dailyDigest;
  "reports/dashboardQueries": typeof reports_dashboardQueries;
  "reports/email": typeof reports_email;
  "reports/queries": typeof reports_queries;
  "reports/scheduled": typeof reports_scheduled;
  "reports/scheduledHelpers": typeof reports_scheduledHelpers;
  "rewards/mutations": typeof rewards_mutations;
  "rewards/queries": typeof rewards_queries;
  "search/queries": typeof search_queries;
  seed: typeof seed;
  seedDiscountPresets: typeof seedDiscountPresets;
  seedFullData: typeof seedFullData;
  seedHelpers: typeof seedHelpers;
  seedModifierAssignments: typeof seedModifierAssignments;
  seedProduction: typeof seedProduction;
  seedRecipes: typeof seedRecipes;
  seedRewards: typeof seedRewards;
  "settings/mutations": typeof settings_mutations;
  "settings/queries": typeof settings_queries;
  "shifts/mutations": typeof shifts_mutations;
  "shifts/queries": typeof shifts_queries;
  skuBackfill: typeof skuBackfill;
  "staffFinance/mutations": typeof staffFinance_mutations;
  "staffFinance/queries": typeof staffFinance_queries;
  "staffLocations/mutations": typeof staffLocations_mutations;
  "staffLocations/queries": typeof staffLocations_queries;
  "staff/internals": typeof staff_internals;
  "staff/mutations": typeof staff_mutations;
  "staff/photoMutations": typeof staff_photoMutations;
  "staff/queries": typeof staff_queries;
  "suppliers/mutations": typeof suppliers_mutations;
  "suppliers/queries": typeof suppliers_queries;
  "tables/mutations": typeof tables_mutations;
  "tables/queries": typeof tables_queries;
  "tables/seed": typeof tables_seed;
  "timesheets/cron": typeof timesheets_cron;
  "timesheets/mutations": typeof timesheets_mutations;
  "timesheets/photoMutations": typeof timesheets_photoMutations;
  "timesheets/pinClockAction": typeof timesheets_pinClockAction;
  "timesheets/pinClockHelpers": typeof timesheets_pinClockHelpers;
  "timesheets/queries": typeof timesheets_queries;
  wipeProduction: typeof wipeProduction;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
