const { readPreState } = require('@changesets/pre');
const { default: readChangesets } = require('@changesets/read');
const { join } = require('path');
const { version } = require(join(__dirname, '../../../package.json'));

module.exports = async ({ github, context, core }) => {
  const state = await getState({ github, context, core });

  function setOutput(key, value) {
    core.info(`State ${key} = ${value}`);
    core.setOutput(key, value);
  }

  // Jobs to trigger
  setOutput('start', shouldRunStart(state));
  setOutput('promote', shouldRunPromote(state));
  setOutput('changesets', shouldRunChangesets(state));
  setOutput('publish', shouldRunPublish(state));
  setOutput('merge', shouldRunMerge(state));

  // Global Variables
  setOutput('is_prerelease', state.prerelease);
  setOutput('version', version);
};

function shouldRunStart({ isMaster, isWorkflowDispatch, isRerun }) {
  return isMaster && isWorkflowDispatch && !isRerun;
}

function shouldRunPromote({ isReleaseBranch, isWorkflowDispatch, isRerun }) {
  return isReleaseBranch && isWorkflowDispatch && !isRerun;
}

function shouldRunChangesets({ isReleaseBranch, isPush, isRerun }) {
  return (isReleaseBranch && isPush) || isRerun;
}

function shouldRunPublish({ isReleaseBranch, isPush, hasPendingChangesets }) {
  return isReleaseBranch && isPush && !hasPendingChangesets;
}

function shouldRunMerge({
  isReleaseBranch,
  isPush,
  prerelease,
  isCurrentFinalVersion,
  hasPendingChangesets,
  prBackExists,
}) {
  return isReleaseBranch && isPush && !prerelease && isCurrentFinalVersion && !hasPendingChangesets && prBackExists;
}

async function getState({ github, context, core }) {
  // Variables not in the context
  const refName = process.env.GITHUB_REF_NAME;

  const { changesets, preState } = await readChangesetState();

  // Static vars
  const state = {
    refName,
    hasPendingChangesets: changesets.length > 0,
    prerelease: preState?.mode === 'pre',
    isMaster: refName === 'master',
    isReleaseBranch: refName.startsWith('release-v'),
    isWorkflowDispatch: context.eventName === 'workflow_dispatch',
    isPush: context.eventName === 'push',
    isCurrentFinalVersion: !version.includes('-rc.'),
    isRerun: core.getInput('rerun') === 'true',
  };

  // Async vars
  const { data: prs } = await github.rest.pulls.list({
    owner: context.repo.owner,
    repo: context.repo.repo,
    head: `${context.repo.owner}:merge/${state.refName}`,
    base: 'master',
    state: 'open',
  });

  state.prBackExists = prs.length === 0;

  // Log every state value in debug mode
  if (core.isDebug()) for (const [key, value] of Object.entries(state)) core.debug(`${key}: ${value}`);

  return state;
}

// From https://github.com/changesets/action/blob/v1.4.1/src/readChangesetState.ts
async function readChangesetState(cwd = process.cwd()) {
  const preState = await readPreState(cwd);
  const isInPreMode = preState !== undefined && preState.mode === 'pre';

  let changesets = await readChangesets(cwd);

  if (isInPreMode) {
    changesets = changesets.filter(x => !preState.changesets.includes(x.id));
  }

  return {
    preState: isInPreMode ? preState : undefined,
    changesets,
  };
}
