const assert=require('node:assert/strict');
async function selectOption(page,select,label){
 const index=await select.locator('option').evaluateAll((options,label)=>options.findIndex(o=>o.textContent===label),label);
 assert.ok(index>=0,'Option exists: '+label);
 await select.click();await page.keyboard.press('Home');
 for(let i=0;i<index;i++)await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Enter');
}
// The Add emitter / Add layer pickers: click the button, type in the search, click the row.
const PICKER={emitter:['Add emitter','Search emitters'],layer:['Add layer','Search layers']};
const plainName=name=>name.replace(/ \(recommended\)$/,'');
async function openFxPicker(fx,kind){
 await fx.getByRole('button',{name:PICKER[kind][0],exact:true}).click();
 const search=fx.getByLabel(PICKER[kind][1],{exact:true});await search.waitFor();
 return search;
}
/** The names the open picker lists, in order, then closes it with Escape. */
async function fxPickerNames(page,fx,kind){
 await openFxPicker(fx,kind);
 const names=await fx.locator('.fx-picker-row .fx-picker-name').allTextContents();
 await page.keyboard.press('Escape');await fx.getByLabel(PICKER[kind][1],{exact:true}).waitFor({state:'detached'});
 return names;
}
async function pickFx(page,fx,kind,name){
 await openFxPicker(fx,kind);
 await page.keyboard.type(plainName(name));
 const row=fx.getByRole('option').filter({has:fx.getByText(plainName(name),{exact:true})}).first();
 await row.waitFor();await row.click();
 await fx.getByLabel(PICKER[kind][1],{exact:true}).waitFor({state:'detached'});
}
/** Picks an emitter from Add emitter: it is only previewed until Add is clicked. */
const addFxEmitter=(page,fx,name)=>pickFx(page,fx,'emitter',name);
/** Picks a layer from Add layer: it is added at once. */
const addFxLayer=(page,fx,name)=>pickFx(page,fx,'layer',name);
/** Takes back a previewed emitter: the None row at the top of the open Add emitter list. */
async function clearFxEmitter(page,fx){
 await openFxPicker(fx,'emitter');
 await fx.getByRole('option').filter({has:fx.getByText('None',{exact:true})}).first().click();
 await fx.getByLabel(PICKER.emitter[1],{exact:true}).waitFor({state:'detached'});
}
async function addEmitter(page,fx,label,ready){
 await addFxEmitter(page,fx,label);await ready();
 await fx.getByRole('button',{name:'Add',exact:true}).click();await ready();
}
module.exports={selectOption,addEmitter,addFxEmitter,addFxLayer,clearFxEmitter,fxPickerNames,openFxPicker};
