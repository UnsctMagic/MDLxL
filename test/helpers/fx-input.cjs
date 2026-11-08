const assert=require('node:assert/strict');
async function selectOption(page,select,label){
 const index=await select.locator('option').evaluateAll((options,label)=>options.findIndex(o=>o.textContent===label),label);
 assert.ok(index>=0,'Option exists: '+label);
 await select.click();await page.keyboard.press('Home');
 for(let i=0;i<index;i++)await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Enter');
}
async function addEmitter(page,fx,label,ready){
 await selectOption(page,fx.getByLabel('Add emitter',{exact:true}),label);await ready();
 await fx.getByRole('button',{name:'Add',exact:true}).click();await ready();
}
module.exports={selectOption,addEmitter};
