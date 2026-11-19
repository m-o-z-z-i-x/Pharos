export const REPO_URL = "https://github.com/m-o-z-z-i-x/Pharos";

/** a new issue prefilled with what is needed to fix a rule, and nothing personal */
export function reportUrl({ service, account, version }) {
  const title = `${service.name}: ${account.error?.kind ?? "problem"}`;

  const body = [
    `Service: ${service.id}${service.version ? ` (rule v${service.version})` : ""}`,
    `State: ${account.state}, error: ${account.error?.kind ?? "-"} ${account.error?.detail ?? ""}`,
    `Extension: ${version}`,
    `Browser: ${navigator.userAgent.match(/(Firefox|Chrome)[/][0-9.]+/)?.[0] ?? "unknown"}`,
  ].join("\n");

  return `${REPO_URL}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}