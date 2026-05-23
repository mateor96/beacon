export { REFERRAL_TERMS_VERSION, REFERRAL_TERMS_PATH } from "./terms.js";
export { generateUniqueReferralCode } from "./link-codes.js";
export {
	enrollAffiliate,
	approveAffiliate,
	rejectAffiliate,
	type EnrollAffiliateParams,
	type EnrollAffiliateResult,
	type ApproveAffiliateResult,
} from "./enrollment.js";
export {
	attributeSignup,
	markConversionPaid,
	type AttributeSignupParams,
	type AttributeSignupResult,
} from "./attribution.js";

export const REFERRAL_ATTRIBUTION_COOKIE = "awr_ref";

export {
	computeCommission,
	getCommissionRule,
	type CommissionRule,
	type CommissionTier,
	type ComputeCommissionParams,
	type ComputeCommissionResult,
} from "./commissions.js";
export {
	recordInvoiceCommission,
	type RecordInvoiceCommissionParams,
	type RecordInvoiceCommissionResult,
} from "./recurring.js";
export {
	requestPayout,
	transitionPayout,
	MIN_PAYOUT_CENTS,
	type RequestPayoutParams,
	type RequestPayoutResult,
	type TransitionPayoutResult,
} from "./payouts.js";
export { sendReferralEmail, type ReferralEmailPayload } from "./notify.js";

// Commission clawback (#299)
export {
	clawbackCommissionsByInvoice,
	type ClawbackParams,
	type ClawbackReason,
	type ClawbackResult,
} from "./clawback.js";

// Fraud detection (#287)
export {
	FRAUD_THRESHOLDS,
	checkSelfReferral,
	checkCookieStuffing,
	checkFakeSignup,
	checkVelocity,
	shouldAutoSuspend,
	type FraudFlag,
	type FraudRuleId,
	type SelfReferralCheckInput,
	type CookieStuffingCheckInput,
	type FakeSignupCheckInput,
	type VelocityCheckInput,
} from "./fraud.js";
