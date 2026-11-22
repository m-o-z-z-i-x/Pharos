export const REPO_URL = "https://github.com/m-o-z-z-i-x/Pharos";

const browserName = () => navigator.userAgent.match(/(Firefox|Chrome)[/][0-9.]+/)?.[0] ?? "unknown";

/**
 * a new issue of the repository with its title and text already filled in
 * @return the address of the issue form
 */
export const issueUrl = (title, lines) => `${REPO_URL}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(lines.join("\n"))}`;

/** a request for a service missing from the catalog: what the rule author needs first */
export const suggestUrl = (version) => issueUrl("Service request: ", ["Service:", "Site address:", "Where it shows the notification count:", "", `Extension: ${version}`, `Browser: ${browserName()}`]);

/** a breakage of a rule when no account is at hand: the versions are filled in, the service is up to the person */
export const breakageUrl = (version) => issueUrl("Broken rule: ", ["Service:", "What happens:", "", `Extension: ${version}`, `Browser: ${browserName()}`]);

/** a new issue prefilled with what is needed to fix a rule, and nothing personal */
export function reportUrl({ service, account, version }) {
  const title = `${service.name}: ${account.error?.kind ?? "problem"}`;

  return issueUrl(title, [
    `Service: ${service.id}${service.version ? ` (rule v${service.version})` : ""}`,
    `State: ${account.state}, error: ${account.error?.kind ?? "-"} ${account.error?.detail ?? ""}`,
    `Extension: ${version}`,
    `Browser: ${browserName()}`,
  ]);
}