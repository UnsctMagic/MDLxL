// Holdouts selected from the owner's PC. IDs describe independently inspected
// anatomy; they are test data and never reach the recognition engine as hints.
// HeroNazgrel's helper 61 has only child 15, exactly the same authored pivot,
// and exactly the same head subtree (3002.7138711872 surface area, 532 vertices).
// Both drive the same skull; accepting either never permits an additional head.
const limb=(kind,root,middle,...ends)=>({kind,roots:[root],middle,ends});
export const holdoutAnatomyCases=[
 {key:'mindflayer',file:'pose-anatomy-holdouts/Mindflayer.mdx',limbs:[limb('arm',6,8,80),limb('arm',7,14,79),limb('chain',21,29,31),limb('chain',22,32,34),limb('chain',23,35,37),limb('chain',24,38,40),limb('chain',25,41,43),limb('chain',26,44,46),limb('chain',27,47,49),limb('chain',28,50,52)],heads:[77],exactHeadCount:true,forbiddenControlIds:[56,57,58,59,60,61,63,64,65,66,67,68,69,70,71,72,73,82,83,84],forbiddenChains:[56,57,58,59,60,61,63,64,65,66,67,68,69,70,71,72,73,82,83,84]},
 {key:'hero-nazgrel',file:'pose-anatomy-holdouts/HeroNazgrelV2.mdx',limbs:[limb('arm',8,10,70),limb('arm',13,14,72),limb('leg',19,20,21),limb('leg',22,23,24),limb('leg',26,28,29),limb('leg',34,36,37)],heads:[15,63],headAlternatives:{15:[61]},exactHeadCount:true,requiredRoles:{Tail:[5]},exactRoleCounts:{Tail:1},forbiddenChains:[9,11,12,16,17,18,38,39,40,41,42,43,44,45,46,47,48,49,51,52,53,54,55,56,57,58,59]},
 {key:'koto-drummer',file:'corpus-sd/orc__kotobeast.mdx',limbs:[limb('arm',71,72,73),limb('arm',74,75,76),limb('leg',62,63,64),limb('leg',65,66,67),limb('leg',82,83,84),limb('leg',85,86,87)],heads:[77,80],exactHeadCount:true,requiredRoles:{Tail:[69]},exactRoleCounts:{Tail:1},forbidden:[44]},
 {key:'doomguard',file:'corpus-sd/demon__doomguard.mdx',limbs:[limb('arm',43,44,45),limb('arm',48,49,50),limb('leg',70,71,73),limb('leg',74,75,77)],heads:[53],exactHeadCount:true,requiredRoles:{Tail:[69]},exactRoleCounts:{Tail:1},appendages:[{role:'Wing',nodes:[58,59],chainIds:[58,59,60,61]},{role:'Wing',nodes:[62],chainIds:[62,63,64]}],forbiddenControlIds:[5,8,12,15,16,17,18,19,20,21,22,23,24,25,27,28,29,30,39,46,51,54,55,56,57,78]},
 {key:'naga-serpent',file:'corpus-sd/naga__nagamyrmidon.mdx',limbs:[limb('arm',43,44,45),limb('arm',46,47,48)],heads:[50],exactHeadCount:true,requiredRoles:{Tail:[39]},exactRoleCounts:{Tail:1},forbiddenControlIds:[9,10,11,12,13,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,51,52,53]},
 {key:'undead-battleship',file:'corpus-sd/creeps__undeadshipbattleship.mdx',limbs:[],heads:[],exactHeadCount:true,noPartControls:true},
 {key:'wyvern-spear',file:'pose-anatomy-holdouts/WyvernSpearMissileV2.01.mdx',limbs:[],heads:[],exactHeadCount:true,noPartControls:true},
];
