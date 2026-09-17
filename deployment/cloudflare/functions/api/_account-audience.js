// Keep editorial accounts out of ordinary-user summaries, including delegated editors.
export const ordinaryAccountSql = "a.role='user' AND NOT EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND c.editorial=1)"
export const administrativeAccountSql = "(a.role IN ('super-admin','admin','editor') OR EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND c.editorial=1))"
