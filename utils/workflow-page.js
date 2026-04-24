const workflow = require('./workflow-state')

function applyWorkflowState(page, state) {
  if (!page || !state) {
    return
  }

  if (page.data && page.data.workflowState === state) {
    return
  }

  const updates = { workflowState: state }

  if (typeof page.setDataIfChanged === 'function') {
    page.setDataIfChanged(updates)
    return
  }

  if (typeof page.setData === 'function') {
    page.setData(updates)
  }
}

function syncPageWorkflowState(page, nextState, payload = {}) {
  const result = nextState
    ? workflow.transitionTo(nextState, payload)
    : { state: workflow.getCurrentState() }

  applyWorkflowState(page, result.state)
  return result
}

module.exports = {
  syncPageWorkflowState
}
