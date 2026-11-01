/** Public Source Item methods. The roll must reach the GM negotiation. */
export function sourceItemApi(authority) {
  return Object.freeze({
    createProject: data => authority.createSourceItem(data),
    negotiate: (projectId, roll) => authority.negotiateSourceItem(projectId, roll)
  });
}
