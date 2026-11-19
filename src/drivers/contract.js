/**
 * driver contract
 * @typedef {Object} Driver
 * @property {string} id
 * @property {string} name
 * @property {string} mono         two-letter monogram for the UI
 * @property {'messengers'|'social'|'mail'|'dev'|'other'} group
 * @property {'browser'|'server'|'apppassword'|'code'} method
 * @property {boolean} api         official API (stable) or a rule over the user's login
 * @property {boolean} multi       several accounts allowed
 * @property {import('../core/model.js').NoticeType[]} types
 * @property {{key: string, kind: 'text'|'password'|'url'|'tel', required?: boolean}[]} fields
 * @property {(input: Object) => string[]} hosts                 origins to request, e.g. "https://x.com/*"
 * @property {(ctx: Object, input: Object) => Promise<{auth: Object, label: string}>} connect
 * @property {(account: Object, ctx: Object) => Promise<{counts: Object, sender?: string, auth?: Object}>} check
 * @property {(account: Object) => string} openUrl
 * @property {(input: Object) => string} [loginUrl]
 * @property {(ctx: Object) => Promise<{value: string, label: string|null}[]>} [listAccounts]  accounts of the site signed in to in the browser
 * @property {string|null} [addAccountUrl]  the page of the site that adds one more signed-in account
 */

export class DriverError extends Error {
  /**
   * @param {'login'|'rule'|'network'|'no-oauth'} kind
   * @param {string} [detail]
   */
  constructor(kind, detail = "") {
    super(`${kind}${detail ? `: ${detail}` : ""}`);

    this.name = "DriverError";
    this.kind = kind;
    this.detail = detail;
  }
}