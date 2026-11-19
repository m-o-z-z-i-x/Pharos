/** insertion-ordered map of drivers; a later registration with the same id replaces the earlier one */
export function createRegistry() {
  const map = new Map();

  return {
    register(driver) { map.set(driver.id, driver); },
    get(id) { return map.get(id); },
    list() { return [...map.values()]; },
  };
}