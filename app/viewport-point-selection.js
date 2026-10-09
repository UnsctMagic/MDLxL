export function viewportPointIndices(count, selection = [], hidden = []) {
  const selected = new Set(selection), invisible = new Set(hidden);
  if (!selected.size && !invisible.size) return { unselected: null, selected: [] };
  const chosen = [], other = [];
  for (let index = 0; index < count; index++) {
    if (invisible.has(index)) continue;
    (selected.has(index) ? chosen : other).push(index);
  }
  return { unselected: other, selected: chosen };
}

export function viewportPointDepth(pureWireframe, xrayVertices, drawThrough = false) {
  return { depthTest: !pureWireframe, showHidden: !pureWireframe && (!!xrayVertices || drawThrough) };
}

export function viewportSelectionKey(props, visual, includeVisible = false) {
  const selected = props.selectionByGeoset || { [props.selectedGeoset]: Array.from(props.selectedVertices || []) };
  const editable = props.selectableGeosets ?? [props.selectedGeoset];
  const active = new Set(includeVisible ? props.visibleGeosets ?? editable : editable);
  const stringify = value => JSON.stringify(value, (_, item) => item instanceof Set ? [...item] : item);
  return `${stringify(selected)}|${[...active].join(',')}|${stringify(props.hiddenVertices)}|${props.mode}|${props.sequenceIndex}|${props.transformMode}|${JSON.stringify(visual)}`;
}
