export async function openDatabaseAsync(_name: string) {
  return {
    getFirstAsync: async () => null,
    getAllAsync: async () => [],
    closeAsync: async () => {},
  };
}
