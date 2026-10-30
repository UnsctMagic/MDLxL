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
// current resolves the live DOM owner before walking ancestors; last retains assigning walks, where Forge's
// live extrusion preview follows its canonical draft. Predicates may also inspect the matched owner's props.
// findFiberProps(selector, predicate) returns matching owner props from React's committed tree.
function install() {
  const fiberOf = element => element && element[Object.keys(element).find(key => key.startsWith('__reactFiber'))];
  const elementOf = selector => typeof selector === 'string' ? document.querySelector(selector) : selector;
  // Resolve the host in React's committed tree; its DOM fiber may point at an older alternate.
  window.findFiberProps = (selector, predicate) => {
    const element = elementOf(selector);
    let fiber = fiberOf(element);
    if (!fiber) return null;
    let top = fiber; while (top.return) top = top.return;
    const pending = [top.stateNode.current];
    while (pending.length) {
      const node = pending.pop();
      if (node.stateNode === element) { fiber = node; break; }
      if (node.child) pending.push(node.child);
      if (node.sibling) pending.push(node.sibling);
    }
    for (; fiber; fiber = fiber.return) if (fiber.memoizedProps && predicate(fiber.memoizedProps)) return fiber.memoizedProps;
    return null;
  };
  // tree/props cover Citadel's workspace and preview owners, which are siblings rather than ancestors.
  window.findFiberState = (selector, predicate, { tree = false, props = false, current = false, last = false } = {}) => {
    const match = fiber => {
      if (props) return predicate(fiber.memoizedProps) ? fiber.memoizedProps : null;
      let found = null;
      for (let hook = fiber.memoizedState; hook && typeof hook === 'object' && 'next' in hook; hook = hook.next) {
        const state = hook.memoizedState;
        if (state != null && predicate(state, fiber.memoizedProps)) { if (!last) return state; found = state; }
        if (state?.current != null && predicate(state.current, fiber.memoizedProps)) { if (!last) return state.current; found = state.current; }
      }
      return found;
    };
    const element = elementOf(selector);
    let fiber = fiberOf(element);
    if (current && fiber) {
      let top = fiber; while (top.return) top = top.return;
      fiber = null;
      const stack = [top.stateNode.current];
      while (stack.length) {
        const owner = stack.pop();
        if (owner.stateNode === element) { fiber = owner; break; }
        for (let child = owner.child; child; child = child.sibling) stack.push(child);
      }
    }
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
    let found = null;
    for (; fiber; fiber = fiber.return) {
      const value = match(fiber);
      if (value != null) { if (!last) return value; found = value; }
    }
    return found;
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
