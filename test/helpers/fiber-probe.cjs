// Page-side probes that launchApp (test/helpers/app.cjs) installs in every window.
//
// selector may also be a preview element (for paired OptimizeXL views).
// mdlxlProbe(selector = '.game-preview-root') returns { session, runtime, props } for the editor:
//   session: the open model session ({ doc, assets, path, ... }),
//   runtime: that preview's live state ({ native, controls, captureApi, ... }),
//   props:   that preview's current props (poseConfig, sequenceIndex, transformMode, ...).
// It reads the app's read-only test hook window.__mdlxl (app/test-hook.js, on when MDLXL_TEST_HOOK=1) and
// falls back to walking React fibers, so it also works on builds made before the hook existed.
//
// findFiberState(selector, predicate) is the generic walk for everything the hook does not cover: it starts at
// the element's fiber, goes up through its owners and returns the first hook state, or ref value, that
// matches predicate. { tree: true } searches the current root; { props: true } matches owner props instead.
function install() {
  const fiberOf = element => element && element[Object.keys(element).find(key => key.startsWith('__reactFiber'))];
  const elementOf = selector => typeof selector === 'string' ? document.querySelector(selector) : selector;
  // tree/props cover Citadel's workspace and preview owners, which are siblings rather than ancestors.
  window.findFiberState = (selector, predicate, { tree = false, props = false } = {}) => {
    const match = fiber => {
      if (props) return predicate(fiber.memoizedProps) ? fiber.memoizedProps : null;
      for (let hook = fiber.memoizedState; hook && typeof hook === 'object' && 'next' in hook; hook = hook.next) {
        const state = hook.memoizedState;
        if (state != null && predicate(state)) return state;
        if (state?.current != null && predicate(state.current)) return state.current;
      }
      return null;
    };
    let fiber = fiberOf(elementOf(selector));
    if (tree) {
      if (!fiber) return null;
      while (fiber.return) fiber = fiber.return;
      const visit = node => {
        const found = match(node);
        if (found != null) return found;
        for (let child = node.child; child; child = child.sibling) {
          const found = visit(child);
          if (found != null) return found;
        }
        return null;
      };
      return visit(fiber.stateNode?.current || fiber);
    }
    for (; fiber; fiber = fiber.return) {
      const found = match(fiber);
      if (found != null) return found;
    }
    return null;
  };
  window.mdlxlProbe = (selector = '.game-preview-root') => {
    const hook = window.__mdlxl;
    if (hook) {
      const preview = hook.preview(elementOf(selector)), session = hook.session();
      return {
        session: session?.doc?.model ? session : null,
        runtime: preview?.runtime?.native && preview.runtime.controls ? preview.runtime : null,
        props: preview?.props?.model ? preview.props : null,
      };
    }
    let runtime = null, props = null, session = null;
    for (let fiber = fiberOf(elementOf(selector)); fiber; fiber = fiber.return) {
      for (let hook = fiber.memoizedState; hook && typeof hook === 'object' && 'next' in hook; hook = hook.next) {
        const state = hook.memoizedState, ref = state?.current;
        if (ref?.native && ref?.controls) runtime = ref;
        if (ref?.model && (ref?.onPoseCommit || ref?.compareCamera)) props = ref;
        if (state?.doc?.model && state?.assets) session = state;
      }
    }
    return { session, runtime, props };
  };
}

const PROBE_SOURCE = `(${install.toString()})()`;

// Installs the probes again, for example after the page navigated.
const installProbes = page => page.evaluate(PROBE_SOURCE);

module.exports = { PROBE_SOURCE, installProbes };
