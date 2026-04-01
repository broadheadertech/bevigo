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
import type * as billing_mutations from "../billing/mutations.js";
import type * as billing_queries from "../billing/queries.js";
import type * as billing_seedPlans from "../billing/seedPlans.js";
import type * as crons from "../crons.js";
import type * as customers_mutations from "../customers/mutations.js";
import type * as customers_queries from "../customers/queries.js";
import type * as http from "../http.js";
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
import type * as menu_mutations from "../menu/mutations.js";
import type * as menu_priceMutations from "../menu/priceMutations.js";
import type * as menu_priceQueries from "../menu/priceQueries.js";
import type * as menu_publicQueries from "../menu/publicQueries.js";
import type * as menu_queries from "../menu/queries.js";
import type * as orders_historyQueries from "../orders/historyQueries.js";
import type * as orders_internals from "../orders/internals.js";
import type * as orders_mutations from "../orders/mutations.js";
import type * as orders_queries from "../orders/queries.js";
import type * as orders_voidAction from "../orders/voidAction.js";
import type * as reports_dashboardQueries from "../reports/dashboardQueries.js";
import type * as reports_queries from "../reports/queries.js";
import type * as search_queries from "../search/queries.js";
import type * as seed from "../seed.js";
import type * as seedFullData from "../seedFullData.js";
import type * as seedHelpers from "../seedHelpers.js";
import type * as seedModifierAssignments from "../seedModifierAssignments.js";
import type * as seedRecipes from "../seedRecipes.js";
import type * as seedTables from "../seedTables.js";
import type * as settings_mutations from "../settings/mutations.js";
import type * as settings_queries from "../settings/queries.js";
import type * as shifts_mutations from "../shifts/mutations.js";
import type * as shifts_queries from "../shifts/queries.js";
import type * as staffLocations_mutations from "../staffLocations/mutations.js";
import type * as staffLocations_queries from "../staffLocations/queries.js";
import type * as staff_internals from "../staff/internals.js";
import type * as staff_mutations from "../staff/mutations.js";
import type * as staff_queries from "../staff/queries.js";
import type * as tables_mutations from "../tables/mutations.js";
import type * as tables_queries from "../tables/queries.js";
import type * as tables_seed from "../tables/seed.js";

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
  "billing/mutations": typeof billing_mutations;
  "billing/queries": typeof billing_queries;
  "billing/seedPlans": typeof billing_seedPlans;
  crons: typeof crons;
  "customers/mutations": typeof customers_mutations;
  "customers/queries": typeof customers_queries;
  http: typeof http;
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
  "menu/mutations": typeof menu_mutations;
  "menu/priceMutations": typeof menu_priceMutations;
  "menu/priceQueries": typeof menu_priceQueries;
  "menu/publicQueries": typeof menu_publicQueries;
  "menu/queries": typeof menu_queries;
  "orders/historyQueries": typeof orders_historyQueries;
  "orders/internals": typeof orders_internals;
  "orders/mutations": typeof orders_mutations;
  "orders/queries": typeof orders_queries;
  "orders/voidAction": typeof orders_voidAction;
  "reports/dashboardQueries": typeof reports_dashboardQueries;
  "reports/queries": typeof reports_queries;
  "search/queries": typeof search_queries;
  seed: typeof seed;
  seedFullData: typeof seedFullData;
  seedHelpers: typeof seedHelpers;
  seedModifierAssignments: typeof seedModifierAssignments;
  seedRecipes: typeof seedRecipes;
  seedTables: typeof seedTables;
  "settings/mutations": typeof settings_mutations;
  "settings/queries": typeof settings_queries;
  "shifts/mutations": typeof shifts_mutations;
  "shifts/queries": typeof shifts_queries;
  "staffLocations/mutations": typeof staffLocations_mutations;
  "staffLocations/queries": typeof staffLocations_queries;
  "staff/internals": typeof staff_internals;
  "staff/mutations": typeof staff_mutations;
  "staff/queries": typeof staff_queries;
  "tables/mutations": typeof tables_mutations;
  "tables/queries": typeof tables_queries;
  "tables/seed": typeof tables_seed;
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
