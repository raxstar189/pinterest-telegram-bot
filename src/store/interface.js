/**
 * Interface definition and helper default factory for Store state.
 */
function createInitialState() {
  return {
    known_urls: [],
    recipes: {},
    pending_messages: {}
  };
}

module.exports = {
  createInitialState
};
