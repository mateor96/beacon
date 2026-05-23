export { LANGUAGE_PACK } from "./locales/index.js";
export type { LocalePack } from "./locales/index.js";

export {
	TEMPLATE_PLACEHOLDER_RE,
	UnresolvedPlaceholdersError,
	buildLocaleVariables,
	findUnresolvedPlaceholders,
	renderAndValidate,
	renderLocalePromptTemplate,
	renderTemplate,
	resolveLocalePromptTemplate,
} from "./locale-templates.js";
export type {
	ResolveTemplateOptions,
	ResolvedPromptTemplate,
	TemplateVariables,
} from "./locale-templates.js";
