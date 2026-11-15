/** One bounded step per wheel event; disabled options and action groups are skipped. */
export function wheelOptionIndex(options, index, deltaY) {
  if (!deltaY) return index;
  const direction = deltaY > 0 ? 1 : -1;
  for (let next=index+direction; next>=0 && next<options.length; next+=direction) {
    if (!options[next].disabled && !options[next].parentElement?.disabled && options[next].parentElement?.dataset?.wheelSkip === undefined) return next;
  }
  return index;
}
// Controlled choices use the same route and stepping as other dropdowns.
const choiceWheel=new WeakMap();
export function registerChoiceWheel(select, choose) { choiceWheel.set(select,choose); }
export function bindDropdownWheel(targetDocument) {
  const wheel = event => {
    // The editable animation name and its arrow share the same dropdown.
    const select = event.target.closest?.('select') || event.target.closest?.('.ac-sequence-combo')?.querySelector('select');
    if (!select || select.hasAttribute('data-wheel-skip') || select.disabled || select.multiple || select.size>1 || event.ctrlKey || event.metaKey || !event.deltaY) return;
    const choose=choiceWheel.get(select);
    const index = wheelOptionIndex(select.options, select.selectedIndex, event.deltaY);
    if (choose) {
      if (index === select.selectedIndex) return;
      event.preventDefault(); event.stopImmediatePropagation();
      choose(select.options[index].value);
      return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    if (index === select.selectedIndex) return;
    const setter = Object.getOwnPropertyDescriptor(targetDocument.defaultView.HTMLSelectElement.prototype, 'selectedIndex').set;
    setter.call(select,index);
    select.dispatchEvent(new targetDocument.defaultView.Event('change',{bubbles:true}));
  };
  targetDocument.addEventListener('wheel',wheel,{capture:true,passive:false});
  return () => targetDocument.removeEventListener('wheel',wheel,true);
}
