/**
 * runtime.onMessage listener that answers through sendResponse
 * returning a promise from the listener only works in Firefox and recent Chrome;
 * chromium 146 and older silently drop such answers, so we keep the channel open with `return true`
 * @param {(msg: any, sender: any) => Promise<any>} handler
 * @param {(msg: any) => boolean} [accepts]
 */
export function asyncListener(handler, accepts = () => true) {
  return (message, sender, sendResponse) => {
    if (!accepts(message)) return false;

    Promise.resolve()
      .then(() => handler(message, sender))
      .then(sendResponse, (error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));

    return true;
  };
}