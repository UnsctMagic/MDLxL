function Ys(t,e){let n=[];if(![800,1e3].includes(e))return["Choose MDX800 or MDX1000."];if(![800,1e3].includes(t?.Version))return["Only editable MDX800 and MDX1000 models can be converted."];if(e===t.Version)return n;if(e===800){for(let i of["ParticleEmitterPopcorns","FaceFX","BindPoses"])t[i]?.length&&n.push(`${i} cannot be represented in MDX800.`);for(let[i,r]of(t.Geosets||[]).entries()){for(let s of["SkinWeights","Tangents"])r[s]?.length&&n.push(`Geoset ${i+1} has ${s}.`);(r.LevelOfDetail>0||r.Name)&&n.push(`Geoset ${i+1} has authored level-of-detail data.`)}for(let[i,r]of(t.Materials||[]).entries()){r.Shader&&n.push(`Material ${i+1} uses a shader.`);for(let s of r.Layers||[]){for(let a of["NormalTextureID","ORMTextureID","EmissiveTextureID","TeamColorTextureID","ReflectionsTextureID"])s[a]!=null&&n.push(`Material ${i+1} uses ${a}.`);let o=(a,c)=>s[a]!=null&&(typeof s[a]=="object"||s[a]!==c);(o("EmissiveGain",1)||o("FresnelOpacity",0)||o("FresnelTeamColor",0)||s.ShaderTypeId>0)&&n.push(`Material ${i+1} has Reforged lighting properties.`),s.FresnelColor&&(s.FresnelColor.Keys||Array.from(s.FresnelColor).some(a=>a!==1))&&n.push(`Material ${i+1} has a Fresnel color.`)}}}return[...new Set(n)]}function _i(t,e){if(t.Version=e,e===1e3)for(let n of t.Geosets||[])n.LevelOfDetail==null&&(n.LevelOfDetail=0);if(e===800){for(let n of t.Geosets||[])delete n.LevelOfDetail,delete n.Name;for(let n of t.Materials||[]){delete n.Shader;for(let i of n.Layers||[])for(let r of["EmissiveGain","FresnelColor","FresnelOpacity","FresnelTeamColor","ShaderTypeId"])delete i[r]}}}import{Buffer as ot}from"buffer";var Ti=(function(t){return t[t.WrapWidth=1]="WrapWidth",t[t.WrapHeight=2]="WrapHeight",t})({}),zt=(function(t){return t[t.None=0]="None",t[t.Transparent=1]="Transparent",t[t.Blend=2]="Blend",t[t.Additive=3]="Additive",t[t.AddAlpha=4]="AddAlpha",t[t.Modulate=5]="Modulate",t[t.Modulate2x=6]="Modulate2x",t})({}),Ze=(function(t){return t[t.DontInterp=0]="DontInterp",t[t.Linear=1]="Linear",t[t.Hermite=2]="Hermite",t[t.Bezier=3]="Bezier",t})({}),cn=(function(t){return t[t.Unshaded=1]="Unshaded",t[t.SphereEnvMap=2]="SphereEnvMap",t[t.TwoSided=16]="TwoSided",t[t.Unfogged=32]="Unfogged",t[t.NoDepthTest=64]="NoDepthTest",t[t.NoDepthSet=128]="NoDepthSet",t})({}),Si=(function(t){return t[t.ConstantColor=1]="ConstantColor",t[t.SortPrimsFarZ=16]="SortPrimsFarZ",t[t.FullResolution=32]="FullResolution",t})({}),Zs=(function(t){return t[t.DropShadow=1]="DropShadow",t[t.Color=2]="Color",t})({}),He=(function(t){return t[t.DontInheritTranslation=1]="DontInheritTranslation",t[t.DontInheritRotation=2]="DontInheritRotation",t[t.DontInheritScaling=4]="DontInheritScaling",t[t.Billboarded=8]="Billboarded",t[t.BillboardedLockX=16]="BillboardedLockX",t[t.BillboardedLockY=32]="BillboardedLockY",t[t.BillboardedLockZ=64]="BillboardedLockZ",t[t.CameraAnchored=128]="CameraAnchored",t})({}),pn=(function(t){return t[t.Helper=0]="Helper",t[t.Bone=256]="Bone",t[t.Light=512]="Light",t[t.EventObject=1024]="EventObject",t[t.Attachment=2048]="Attachment",t[t.ParticleEmitter=4096]="ParticleEmitter",t[t.CollisionShape=8192]="CollisionShape",t[t.RibbonEmitter=16384]="RibbonEmitter",t})({}),It=(function(t){return t[t.Box=0]="Box",t[t.Sphere=2]="Sphere",t})({}),Mr=(function(t){return t[t.EmitterUsesMDL=32768]="EmitterUsesMDL",t[t.EmitterUsesTGA=65536]="EmitterUsesTGA",t})({}),hn=(function(t){return t[t.Unshaded=32768]="Unshaded",t[t.SortPrimsFarZ=65536]="SortPrimsFarZ",t[t.LineEmitter=131072]="LineEmitter",t[t.Unfogged=262144]="Unfogged",t[t.ModelSpace=524288]="ModelSpace",t[t.XYQuad=1048576]="XYQuad",t})({}),Mn=(function(t){return t[t.Blend=0]="Blend",t[t.Additive=1]="Additive",t[t.Modulate=2]="Modulate",t[t.Modulate2x=3]="Modulate2x",t[t.AlphaKey=4]="AlphaKey",t})({}),nt=(function(t){return t[t.Head=1]="Head",t[t.Tail=2]="Tail",t})({}),Mi=(function(t){return t[t.Omnidirectional=0]="Omnidirectional",t[t.Directional=1]="Directional",t[t.Ambient=2]="Ambient",t})({}),Tn=(function(t){return t[t.Unshaded=32768]="Unshaded",t[t.SortPrimsFarZ=65536]="SortPrimsFarZ",t[t.Unfogged=262144]="Unfogged",t})({});var $l={TextureID:0,NormalTextureID:1,ORMTextureID:2,EmissiveTextureID:3,TeamColorTextureID:4,ReflectionsTextureID:5},un=["TextureID","NormalTextureID","ORMTextureID","EmissiveTextureID","TeamColorTextureID","ReflectionsTextureID"],Yl=class{constructor(t){this.str=t,this.pos=0}char(){return this.pos>=this.str.length&&ne(this,"incorrect model data"),this.str[this.pos]}};function ne(t,e=""){throw new Error(`SyntaxError, near ${t.pos}`+(e?", "+e:""))}function Ar(t){if(t.char()==="/"&&t.str[t.pos+1]==="/"){for(t.pos+=2;t.pos<t.str.length&&t.str[++t.pos]!==`
`;);return++t.pos,!0}return!1}var Kl=/\s/i;function Xt(t){for(;t.pos<t.str.length&&Kl.test(t.char());)++t.pos}var jl=/[a-z]/i,Zl=/[a-z0-9]/i;function H(t){if(!jl.test(t.char()))return null;let e=t.char();for(++t.pos;Zl.test(t.char());)e+=t.str[t.pos++];return Xt(t),e}function ce(t,e){t.char()===e&&(++t.pos,Xt(t))}function I(t,e){t.char()!==e&&ne(t,`extected ${e}`),++t.pos,Xt(t)}function Ae(t){if(t.char()==='"'){let e=++t.pos;for(;t.char()!=='"';)++t.pos;++t.pos;let n=t.str.substring(e,t.pos-1);return Xt(t),n}return null}var Jl=/[-0-9]/,Ql=/[-+.0-9e]/i;function z(t){if(Jl.test(t.char())){let e=t.pos;for(++t.pos;Ql.test(t.char());)++t.pos;let n=parseFloat(t.str.substring(e,t.pos));return Xt(t),n}return null}function ge(t,e,n){if(t.char()!=="{")return null;for(e||(e=[],n=0),I(t,"{");t.char()!=="}";){let i=z(t);i===null&&ne(t,"expected number"),e[n++]=i,ce(t,",")}return I(t,"}"),e}function ec(t,e,n){if(t.char()!=="{")return 0;let i=n;for(I(t,"{");t.char()!=="}";){let r=z(t);r===null&&ne(t,"expected number"),e[n++]=r,ce(t,",")}return I(t,"}"),n-i}function xr(t,e){if(t.char()!=="{")return e[0]=z(t),e;let n=0;for(I(t,"{");t.char()!=="}";){let i=z(t);i===null&&ne(t,"expected number"),e[n++]=i,ce(t,",")}return I(t,"}"),e}function ti(t){let e=null,n={};for(t.char()!=="{"&&(e=Ae(t),e===null&&(e=z(t)),e===null&&ne(t,"expected string or number")),I(t,"{");t.char()!=="}";){let i=H(t);i||ne(t),i==="Interval"?n[i]=ge(t,new Uint32Array(2),0):i==="MinimumExtent"||i==="MaximumExtent"?n[i]=ge(t,new Float32Array(3),0):(n[i]=ge(t)||Ae(t),n[i]===null&&(n[i]=z(t))),ce(t,",")}return I(t,"}"),[e,n]}function tc(t,e){let[n,i]=ti(t);i.FormatVersion&&(e.Version=i.FormatVersion)}function nc(t,e){let[n,i]=ti(t);e.Info=i,e.Info.Name=n}function ic(t,e){z(t),I(t,"{");let n=[];for(;t.char()!=="}";){H(t);let[i,r]=ti(t);r.Name=i,r.NonLooping="NonLooping"in r,r.MoveSpeed=r.MoveSpeed||0,r.Rarity=r.Rarity||0,n.push(r)}I(t,"}"),e.Sequences=n}function rc(t,e){let n=[];for(z(t),I(t,"{");t.char()!=="}";){H(t);let[i,r]=ti(t);r.Flags=0,"WrapWidth"in r&&(r.Flags+=Ti.WrapWidth,delete r.WrapWidth),"WrapHeight"in r&&(r.Flags+=Ti.WrapHeight,delete r.WrapHeight),n.push(r)}I(t,"}"),e.Textures=n}var X=(function(t){return t[t.INT1=0]="INT1",t[t.FLOAT1=1]="FLOAT1",t[t.FLOAT3=2]="FLOAT3",t[t.FLOAT4=3]="FLOAT4",t})(X||{}),sc={[X.INT1]:1,[X.FLOAT1]:1,[X.FLOAT3]:3,[X.FLOAT4]:4};function oc(t,e,n,i){let r={Frame:e,Vector:null},s=n===X.INT1?Int32Array:Float32Array,o=sc[n];return r.Vector=xr(t,new s(o)),I(t,","),(i===Ze.Hermite||i===Ze.Bezier)&&(H(t),r.InTan=xr(t,new s(o)),I(t,","),H(t),r.OutTan=xr(t,new s(o)),I(t,",")),r}function Se(t,e){let n={LineType:Ze.DontInterp,GlobalSeqId:null,Keys:[]};z(t),I(t,"{");let i=H(t);for((i==="DontInterp"||i==="Linear"||i==="Hermite"||i==="Bezier")&&(n.LineType=Ze[i]),I(t,",");t.char()!=="}";){let r=H(t);if(r==="GlobalSeqId")n[r]=z(t),I(t,",");else{let s=z(t);s===null&&ne(t,"expected frame number or GlobalSeqId"),I(t,":"),n.Keys.push(oc(t,s,e,n.LineType))}}return I(t,"}"),n}function ac(t,e){let n={Alpha:null,TVertexAnimId:null,Shading:0,CoordId:0};for(I(t,"{");t.char()!=="}";){let i=H(t),r=!1;if(i||ne(t),i==="static"&&(r=!0,i=H(t)),!r&&(i==="TextureID"||e.Version>=1100&&i in $l))n[i]=Se(t,X.INT1);else if(!r&&i==="Alpha")n[i]=Se(t,X.FLOAT1);else if(i==="Unshaded"||i==="SphereEnvMap"||i==="TwoSided"||i==="Unfogged"||i==="NoDepthTest"||i==="NoDepthSet")n.Shading|=cn[i];else if(i==="FilterMode"){let s=H(t);(s==="None"||s==="Transparent"||s==="Blend"||s==="Additive"||s==="AddAlpha"||s==="Modulate"||s==="Modulate2x")&&(n.FilterMode=zt[s])}else if(i==="TVertexAnimId")n.TVertexAnimId=z(t);else if(e.Version>=900&&i==="EmissiveGain")r?n[i]=z(t):n[i]=Se(t,X.FLOAT1);else if(e.Version>=1e3&&i==="FresnelColor")r?n[i]=ge(t,new Float32Array(3),0):n[i]=Se(t,X.FLOAT3);else if(e.Version>=1e3&&(i==="FresnelOpacity"||i==="FresnelTeamColor"))r?n[i]=z(t):n[i]=Se(t,X.FLOAT1);else{let s=z(t);s===null&&(s=H(t)),n[i]=s}ce(t,","),Ar(t),Xt(t)}return I(t,"}"),n}function lc(t,e){let n=[];for(z(t),I(t,"{");t.char()!=="}";){let i={RenderMode:0,Layers:[]};for(H(t),I(t,"{");t.char()!=="}";){let r=H(t);if(r||ne(t),r==="Layer")i.Layers.push(ac(t,e));else if(r==="PriorityPlane"||r==="RenderMode")i[r]=z(t);else if(r==="ConstantColor"||r==="SortPrimsFarZ"||r==="FullResolution")i.RenderMode|=Si[r];else if(e.Version>=900&&e.Version<=1100&&r==="Shader")i[r]=Ae(t);else throw new Error("Unknown material property "+r);ce(t,",")}I(t,"}"),n.push(i)}I(t,"}"),e.Materials=n}var Zn=(function(t){return t[t.INT=0]="INT",t[t.FLOAT=1]="FLOAT",t})(Zn||{});function yr(t,e,n){let i=z(t),r=new(n===Zn.FLOAT?Float32Array:Uint8Array)(i*e);I(t,"{");for(let s=0;s<i;++s)ge(t,r,s*e),I(t,",");return I(t,"}"),r}function cc(t,e){let n={Vertices:null,Normals:null,TVertices:[],VertexGroup:new Uint8Array(0),Faces:null,Groups:null,TotalGroupsCount:null,MinimumExtent:null,MaximumExtent:null,BoundsRadius:0,Anims:[],MaterialID:null,SelectionGroup:null,Unselectable:!1};for(I(t,"{");t.char()!=="}";){let i=H(t);if(i||ne(t),i==="Vertices"||i==="Normals"||i==="TVertices"){let r=3;i==="TVertices"&&(r=2);let s=yr(t,r,Zn.FLOAT);i==="TVertices"?n.TVertices.push(s):n[i]=s}else if(i==="VertexGroup")n[i]=new Uint8Array(n.Vertices.length/3),ge(t,n[i],0);else if(i==="Faces"){let r=z(t),s=z(t),o=0;n.Faces=new Uint16Array(s),I(t,"{"),H(t)!=="Triangles"&&ne(t,"unexpected faces type"),I(t,"{");for(let a=0;a<r;++a){let c=ec(t,n.Faces,o);c||ne(t,"expected array"),o+=c,ce(t,",")}(o!==s||s%3!==0)&&ne(t,"mismatched faces array"),I(t,"}"),I(t,"}")}else if(i==="Groups"){let r=[];for(z(t),n.TotalGroupsCount=z(t),I(t,"{");t.char()!=="}";)H(t),r.push(ge(t)),ce(t,",");I(t,"}"),n.Groups=r}else if(i==="MinimumExtent"||i==="MaximumExtent")n[i]=ge(t,new Float32Array(3),0),I(t,",");else if(i==="BoundsRadius"||i==="MaterialID"||i==="SelectionGroup")n[i]=z(t),I(t,",");else if(i==="Anim"){let[r,s]=ti(t);s.Alpha===void 0&&(s.Alpha=1),n.Anims.push(s)}else i==="Unselectable"?(n.Unselectable=!0,I(t,",")):e.Version>=900&&(i==="LevelOfDetail"?(n.LevelOfDetail=z(t),I(t,",")):i==="Name"?(n.Name=Ae(t),I(t,",")):i==="Tangents"?n.Tangents=yr(t,4,Zn.FLOAT):i==="SkinWeights"&&(n.SkinWeights=yr(t,8,Zn.INT)))}I(t,"}"),e.Geosets.push(n)}function hc(t,e){let n={GeosetId:-1,Alpha:1,Color:null,Flags:0};for(I(t,"{");t.char()!=="}";){let i=H(t),r=!1;if(i||ne(t),i==="static"&&(r=!0,i=H(t)),i==="Alpha")r?n.Alpha=z(t):n.Alpha=Se(t,X.FLOAT1);else if(i==="Color")if(r)n.Color=ge(t,new Float32Array(3),0),n.Color.reverse();else{n.Color=Se(t,X.FLOAT3);for(let s of n.Color.Keys)s.Vector.reverse(),s.InTan&&(s.InTan.reverse(),s.OutTan.reverse())}else i==="DropShadow"?n.Flags|=Zs[i]:n[i]=z(t);ce(t,",")}I(t,"}"),e.GeosetAnims.push(n)}function Er(t,e,n){let i={Name:Ae(t),ObjectId:null,Parent:null,PivotPoint:null,Flags:pn[e]};for(I(t,"{");t.char()!=="}";){let r=H(t);if(r||ne(t),r==="Translation"||r==="Rotation"||r==="Scaling"||r==="Visibility"){let s=X.FLOAT3;r==="Rotation"?s=X.FLOAT4:r==="Visibility"&&(s=X.FLOAT1),i[r]=Se(t,s)}else if(r==="BillboardedLockZ"||r==="BillboardedLockY"||r==="BillboardedLockX"||r==="Billboarded"||r==="CameraAnchored")i.Flags|=He[r];else if(r==="DontInherit"){I(t,"{");let s=H(t);s==="Translation"?i.Flags|=He.DontInheritTranslation:s==="Rotation"?i.Flags|=He.DontInheritRotation:s==="Scaling"&&(i.Flags|=He.DontInheritScaling),I(t,"}")}else if(r==="Path")i[r]=Ae(t);else{let s=H(t)||z(t);(r==="GeosetId"&&s==="Multiple"||r==="GeosetAnimId"&&s==="None")&&(s=null),i[r]=s}ce(t,","),Ar(t),Xt(t)}return I(t,"}"),n.Nodes[i.ObjectId]=i,i}function uc(t,e){let n=Er(t,"Bone",e);e.Bones.push(n)}function fc(t,e){let n=Er(t,"Helper",e);e.Helpers.push(n)}function dc(t,e){let n=Er(t,"Attachment",e);e.Attachments.push(n)}function pc(t,e){let n=z(t),i=[];I(t,"{");for(let r=0;r<n;++r)i.push(ge(t,new Float32Array(3),0)),I(t,",");I(t,"}"),e.PivotPoints=i}function mc(t,e){let n={Name:Ae(t),ObjectId:null,Parent:null,PivotPoint:null,EventTrack:null,Flags:pn.EventObject};for(I(t,"{");t.char()!=="}";){let i=H(t);if(i||ne(t),i==="EventTrack"){let r=z(t);n.EventTrack=ge(t,new Uint32Array(r),0)}else i==="Translation"||i==="Rotation"||i==="Scaling"?n[i]=Se(t,i==="Rotation"?X.FLOAT4:X.FLOAT3):n[i]=z(t);ce(t,",")}I(t,"}"),e.EventObjects.push(n),e.Nodes[n.ObjectId]=n}function gc(t,e){let n={Name:Ae(t),ObjectId:null,Parent:null,PivotPoint:null,Shape:It.Box,Vertices:null,Flags:pn.CollisionShape};for(I(t,"{");t.char()!=="}";){let i=H(t);if(i||ne(t),i==="Sphere")n.Shape=It.Sphere;else if(i==="Box")n.Shape=It.Box;else if(i==="Vertices"){let r=z(t),s=new Float32Array(r*3);I(t,"{");for(let o=0;o<r;++o)ge(t,s,o*3),I(t,",");I(t,"}"),n.Vertices=s}else i==="Translation"||i==="Rotation"||i==="Scaling"?n[i]=Se(t,i==="Rotation"?X.FLOAT4:X.FLOAT3):n[i]=z(t);ce(t,",")}I(t,"}"),e.CollisionShapes.push(n),e.Nodes[n.ObjectId]=n}function vc(t,e){let n=[],i=z(t);I(t,"{");for(let r=0;r<i;++r)H(t)==="Duration"&&n.push(z(t)),ce(t,",");I(t,"}"),e.GlobalSequences=n}function xc(t){let e;for(;t.char()!==void 0&&t.char()!=="{";)++t.pos;for(e=1,++t.pos;t.char()!==void 0&&e>0;)t.char()==="{"?++e:t.char()==="}"&&--e,++t.pos;Xt(t)}function yc(t,e){let n={ObjectId:null,Parent:null,Name:null,Flags:0};for(n.Name=Ae(t),I(t,"{");t.char()!=="}";){let i=H(t),r=!1;if(i||ne(t),i==="static"&&(r=!0,i=H(t)),i==="ObjectId"||i==="Parent")n[i]=z(t);else if(i==="EmitterUsesMDL"||i==="EmitterUsesTGA")n.Flags|=Mr[i];else if(!r&&(i==="Visibility"||i==="Translation"||i==="Rotation"||i==="Scaling"||i==="EmissionRate"||i==="Gravity"||i==="Longitude"||i==="Latitude")){let s=X.FLOAT3;i==="Visibility"||i==="EmissionRate"||i==="Gravity"||i==="Longitude"||i==="Latitude"?s=X.FLOAT1:i==="Rotation"&&(s=X.FLOAT4),n[i]=Se(t,s)}else if(i==="Particle"){for(I(t,"{");t.char()!=="}";){let s=H(t),o=!1;s==="static"&&(o=!0,s=H(t)),!o&&(s==="LifeSpan"||s==="InitVelocity")?n[s]=Se(t,X.FLOAT1):s==="LifeSpan"||s==="InitVelocity"?n[s]=z(t):s==="Path"&&(n.Path=Ae(t)),ce(t,",")}I(t,"}")}else n[i]=z(t);ce(t,",")}I(t,"}"),e.ParticleEmitters.push(n)}function _c(t,e){let n={Name:Ae(t),ObjectId:null,Parent:null,PivotPoint:null,Flags:pn.ParticleEmitter,FrameFlags:0};for(I(t,"{");t.char()!=="}";){let i=H(t),r=!1;if(i||ne(t),i==="static"&&(r=!0,i=H(t)),!r&&(i==="Speed"||i==="Latitude"||i==="Visibility"||i==="EmissionRate"||i==="Width"||i==="Length"||i==="Translation"||i==="Rotation"||i==="Scaling"||i==="Gravity"||i==="Variation")){let s=X.FLOAT3;switch(i){case"Rotation":s=X.FLOAT4;break;case"Speed":case"Latitude":case"Visibility":case"EmissionRate":case"Width":case"Length":case"Gravity":case"Variation":s=X.FLOAT1;break}n[i]=Se(t,s)}else if(i==="Variation"||i==="Gravity"||i==="ReplaceableId"||i==="PriorityPlane")n[i]=z(t);else if(i==="SortPrimsFarZ"||i==="Unshaded"||i==="LineEmitter"||i==="Unfogged"||i==="ModelSpace"||i==="XYQuad")n.Flags|=hn[i];else if(i==="Both")n.FrameFlags|=nt.Head|nt.Tail;else if(i==="Head"||i==="Tail")n.FrameFlags|=nt[i];else if(i==="Squirt")n[i]=!0;else if(i==="DontInherit"){I(t,"{");let s=H(t);s==="Translation"?n.Flags|=He.DontInheritTranslation:s==="Rotation"?n.Flags|=He.DontInheritRotation:s==="Scaling"&&(n.Flags|=He.DontInheritScaling),I(t,"}")}else if(i==="SegmentColor"){let s=[];for(I(t,"{");t.char()!=="}";){H(t);let o=new Float32Array(3);ge(t,o,0);let a=o[0];o[0]=o[2],o[2]=a,s.push(o),ce(t,",")}I(t,"}"),n.SegmentColor=s}else i==="Alpha"?(n.Alpha=new Uint8Array(3),ge(t,n.Alpha,0)):i==="ParticleScaling"?(n[i]=new Float32Array(3),ge(t,n[i],0)):i==="LifeSpanUVAnim"||i==="DecayUVAnim"||i==="TailUVAnim"||i==="TailDecayUVAnim"?(n[i]=new Uint32Array(3),ge(t,n[i],0)):i==="Transparent"||i==="Blend"||i==="Additive"||i==="AlphaKey"||i==="Modulate"||i==="Modulate2x"?n.FilterMode=Mn[i]:n[i]=z(t);ce(t,",")}I(t,"}"),e.ParticleEmitters2.push(n),e.Nodes[n.ObjectId]=n}function bc(t,e){let n={Name:null,Position:null,FieldOfView:0,NearClip:0,FarClip:0,TargetPosition:null};for(n.Name=Ae(t),I(t,"{");t.char()!=="}";){let i=H(t);if(i||ne(t),i==="Position")n.Position=new Float32Array(3),ge(t,n.Position,0);else if(i==="FieldOfView"||i==="NearClip"||i==="FarClip")n[i]=z(t);else if(i==="Target"){for(I(t,"{");t.char()!=="}";){let r=H(t);r==="Position"?(n.TargetPosition=new Float32Array(3),ge(t,n.TargetPosition,0)):r==="Translation"&&(n.TargetTranslation=Se(t,X.FLOAT3)),ce(t,",")}I(t,"}")}else(i==="Translation"||i==="Rotation")&&(n[i]=Se(t,i==="Rotation"?X.FLOAT1:X.FLOAT3));ce(t,",")}I(t,"}"),e.Cameras.push(n)}function Sc(t,e){let n={Name:Ae(t),ObjectId:null,Parent:null,PivotPoint:null,Flags:pn.Light,LightType:0};for(I(t,"{");t.char()!=="}";){let i=H(t),r=!1;if(i||ne(t),i==="static"&&(r=!0,i=H(t)),!r&&(i==="Visibility"||i==="Color"||i==="Intensity"||i==="AmbIntensity"||i==="AmbColor"||i==="Translation"||i==="Rotation"||i==="Scaling"||i==="AttenuationStart"||i==="AttenuationEnd")){let s=X.FLOAT3;switch(i){case"Rotation":s=X.FLOAT4;break;case"Visibility":case"Intensity":case"AmbIntensity":case"AttenuationStart":case"AttenuationEnd":s=X.FLOAT1;break}if(n[i]=Se(t,s),i==="Color"||i==="AmbColor")for(let o of n[i].Keys)o.Vector.reverse(),o.InTan&&(o.InTan.reverse(),o.OutTan.reverse())}else if(i==="Omnidirectional"||i==="Directional"||i==="Ambient")n.LightType=Mi[i];else if(i==="Color"||i==="AmbColor"){let s=new Float32Array(3);ge(t,s,0);let o=s[0];s[0]=s[2],s[2]=o,n[i]=s}else n[i]=z(t);ce(t,",")}I(t,"}"),e.Lights.push(n),e.Nodes[n.ObjectId]=n}function Mc(t,e){let n=[];for(z(t),I(t,"{");t.char()!=="}";){let i={};for(H(t),I(t,"{");t.char()!=="}";){let r=H(t);if(r||ne(t),r==="Translation"||r==="Rotation"||r==="Scaling")i[r]=Se(t,r==="Rotation"?X.FLOAT4:X.FLOAT3);else throw new Error("Unknown texture anim property "+r);ce(t,",")}I(t,"}"),n.push(i)}I(t,"}"),e.TextureAnims=n}function Tc(t,e){let n={Name:Ae(t),ObjectId:null,Parent:null,PivotPoint:null,Flags:pn.RibbonEmitter,HeightAbove:null,HeightBelow:null,Alpha:null,Color:null,LifeSpan:null,TextureSlot:null,EmissionRate:null,Rows:null,Columns:null,MaterialID:0,Gravity:null,Visibility:null};for(I(t,"{");t.char()!=="}";){let i=H(t),r=!1;if(i||ne(t),i==="static"&&(r=!0,i=H(t)),!r&&(i==="Visibility"||i==="HeightAbove"||i==="HeightBelow"||i==="Translation"||i==="Rotation"||i==="Scaling"||i==="Alpha"||i==="TextureSlot")){let s=X.FLOAT3;switch(i){case"Rotation":s=X.FLOAT4;break;case"Visibility":case"HeightAbove":case"HeightBelow":case"Alpha":s=X.FLOAT1;break;case"TextureSlot":s=X.INT1;break}n[i]=Se(t,s)}else if(i==="Color"){let s=new Float32Array(3);ge(t,s,0);let o=s[0];s[0]=s[2],s[2]=o,n[i]=s}else n[i]=z(t);ce(t,",")}I(t,"}"),e.RibbonEmitters.push(n),e.Nodes[n.ObjectId]=n}function Ac(t,e){e.Version<900&&ne(t,"Unexpected model chunk FaceFX");let n={Name:Ae(t),Path:""};for(I(t,"{");t.char()!=="}";){let i=H(t);i||ne(t),i==="Path"&&(n.Path=Ae(t)),ce(t,",")}I(t,"}"),e.FaceFX=e.FaceFX||[],e.FaceFX.push(n)}function Ec(t,e){e.Version<900&&ne(t,"Unexpected model chunk BindPose");let n={Matrices:[]};I(t,"{"),H(t);let i=z(t);I(t,"{");for(let r=0;r<i;++r){let s=new Float32Array(12);ge(t,s,0),ce(t,","),n.Matrices.push(s)}I(t,"}"),I(t,"}"),e.BindPoses=e.BindPoses||[],e.BindPoses.push(n)}function wc(t,e){e.Version<900&&ne(t,"Unexpected model chunk ParticleEmitterPopcorn");let n={Name:Ae(t),ObjectId:null,Parent:null,PivotPoint:null,Flags:pn.ParticleEmitter};for(I(t,"{");t.char()!=="}";){let i=H(t),r=!1;if(i||ne(t),i==="static"&&(r=!0,i=H(t)),!r&&(i==="LifeSpan"||i==="EmissionRate"||i==="Speed"||i==="Color"||i==="Alpha"||i==="Visibility"||i==="Rotation"||i==="Scaling"||i==="Translation")){let s=X.FLOAT3;switch(i){case"LifeSpan":case"EmissionRate":case"Speed":case"Alpha":case"Visibility":s=X.FLOAT1;break}n[i]=Se(t,s)}else i==="LifeSpan"||i==="EmissionRate"||i==="Speed"||i==="Alpha"?n[i]=z(t):i==="Color"?n[i]=ge(t,new Float32Array(3),0):i==="ReplaceableId"?n[i]=z(t):i==="Path"||i==="AnimVisibilityGuide"?n[i]=Ae(t):i==="Unshaded"||i==="SortPrimsFarZ"||i==="Unfogged"?i==="Unshaded"?n.Flags|=Tn.Unshaded:i==="Unfogged"?n.Flags|=Tn.Unfogged:i==="SortPrimsFarZ"&&(n.Flags|=Tn.SortPrimsFarZ):n[i]=z(t);ce(t,",")}I(t,"}"),e.ParticleEmitterPopcorns=e.ParticleEmitterPopcorns||[],e.ParticleEmitterPopcorns.push(n),e.Nodes[n.ObjectId]=n}var Ks={Version:tc,Model:nc,Sequences:ic,Textures:rc,Materials:lc,Geoset:cc,GeosetAnim:hc,Bone:uc,Helper:fc,Attachment:dc,PivotPoints:pc,EventObject:mc,CollisionShape:gc,GlobalSequences:vc,ParticleEmitter:yc,ParticleEmitter2:_c,Camera:bc,Light:Sc,TextureAnims:Mc,RibbonEmitter:Tc,FaceFX:Ac,BindPose:Ec,ParticleEmitterPopcorn:wc};function wi(t){let e=new Yl(t),n={Version:800,Info:{Name:"",MinimumExtent:null,MaximumExtent:null,BoundsRadius:0,BlendTime:150},Sequences:[],GlobalSequences:[],Textures:[],Materials:[],TextureAnims:[],Geosets:[],GeosetAnims:[],Bones:[],Helpers:[],Attachments:[],EventObjects:[],ParticleEmitters:[],ParticleEmitters2:[],Cameras:[],Lights:[],RibbonEmitters:[],CollisionShapes:[],PivotPoints:[],Nodes:[]};for(;e.pos<e.str.length;){for(;Ar(e););let i=H(e);if(i)i in Ks?Ks[i](e,n):xc(e);else break}for(let i=0;i<n.Nodes.length;++i)n.PivotPoints[i]&&(n.Nodes[i].PivotPoint=n.PivotPoints[i]);return n}var _r=!0,Ht=-1,B=(function(t){return t[t.INT1=0]="INT1",t[t.FLOAT1=1]="FLOAT1",t[t.FLOAT3=2]="FLOAT3",t[t.FLOAT4=3]="FLOAT4",t})(B||{}),Pc={[B.INT1]:1,[B.FLOAT1]:1,[B.FLOAT3]:3,[B.FLOAT4]:4},Cc=class{constructor(t){this.ab=t,this.pos=0,this.length=t.byteLength,this.view=new DataView(this.ab),this.uint=new Uint8Array(this.ab)}keyword(){let t=String.fromCharCode(this.uint[this.pos],this.uint[this.pos+1],this.uint[this.pos+2],this.uint[this.pos+3]);return this.pos+=4,t}expectKeyword(t,e){if(this.keyword()!==t)throw new Error(e)}uint8(){return this.view.getUint8(this.pos++)}uint16(){let t=this.view.getUint16(this.pos,_r);return this.pos+=2,t}int32(){let t=this.view.getInt32(this.pos,_r);return this.pos+=4,t}float32(){let t=this.view.getFloat32(this.pos,_r);return this.pos+=4,t}float32Array(t){let e=new Float32Array(t);for(let n=0;n<t;++n)e[n]=this.float32();return e}uint8Array(t){let e=new Uint8Array(t);for(let n=0;n<t;++n)e[n]=this.uint8();return e}str(t){let e=t;for(;this.uint[this.pos+e-1]===0&&e>0;)--e;let n=String.fromCharCode.apply(String,this.uint.slice(this.pos,this.pos+e));return this.pos+=t,n}animVector(t){let e={Keys:[]},n=t===B.INT1,i=Pc[t],r=this.int32();e.LineType=this.int32(),e.GlobalSeqId=this.int32(),e.GlobalSeqId===Ht&&(e.GlobalSeqId=null);for(let s=0;s<r;++s){let o={};o.Frame=this.int32(),n?o.Vector=new Int32Array(i):o.Vector=new Float32Array(i);for(let a=0;a<i;++a)n?o.Vector[a]=this.int32():o.Vector[a]=this.float32();if(e.LineType===Ze.Hermite||e.LineType===Ze.Bezier)for(let a of["InTan","OutTan"]){o[a]=new Float32Array(i);for(let c=0;c<i;++c)n?o[a][c]=this.int32():o[a][c]=this.float32()}e.Keys.push(o)}return e}};function Ai(t,e){t.BoundsRadius=e.float32();for(let n of["MinimumExtent","MaximumExtent"]){t[n]=new Float32Array(3);for(let i=0;i<3;++i)t[n][i]=e.float32()}}function Ic(t,e){t.Version=e.int32()}var Rc=336;function Lc(t,e){t.Info.Name=e.str(Rc),e.int32(),Ai(t.Info,e),t.Info.BlendTime=e.int32()}var Fc=80;function Dc(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.str(Fc),s={};s.Name=r;let o=new Uint32Array(2);o[0]=e.int32(),o[1]=e.int32(),s.Interval=o,s.MoveSpeed=e.float32(),s.NonLooping=e.int32()>0,s.Rarity=e.float32(),e.int32(),Ai(s,e),t.Sequences.push(s)}}function Uc(t,e,n){let i=e.pos;for(;e.pos<i+n;){e.int32();let r={Layers:[]};r.PriorityPlane=e.int32(),r.RenderMode=e.int32(),t.Version>=900&&t.Version<1100&&(r.Shader=e.str(80)),e.expectKeyword("LAYS","Incorrect materials format");let s=e.int32();for(let o=0;o<s;++o){let a=e.pos,c=e.int32(),h={};if(h.FilterMode=e.int32(),h.Shading=e.int32(),h.TextureID=e.int32(),h.TVertexAnimId=e.int32(),h.TVertexAnimId===Ht&&(h.TVertexAnimId=null),h.CoordId=e.int32(),h.Alpha=e.float32(),t.Version>=900&&(h.EmissiveGain=e.float32(),t.Version>=1e3&&(h.FresnelColor=e.float32Array(3),h.FresnelOpacity=e.float32(),h.FresnelTeamColor=e.float32())),t.Version>=1100){h.ShaderTypeId=e.int32();let l=e.int32();for(let d=0;d<l;++d){let u=e.int32();e.int32();let f=d;e.keyword()==="KMTF"?h[un[f]]=e.animVector(B.INT1):(h[un[f]]=u,e.pos-=4)}}for(;e.pos<a+c;){let l=e.keyword();if(l==="KMTA")h.Alpha=e.animVector(B.FLOAT1);else if(l==="KMTF")h.TextureID=e.animVector(B.INT1);else if(l==="KMTE"&&t.Version>=900)h.EmissiveGain=e.animVector(B.FLOAT1);else if(l==="KFC3"&&t.Version>=1e3)h.FresnelColor=e.animVector(B.FLOAT3);else if(l==="KFCA"&&t.Version>=1e3)h.FresnelOpacity=e.animVector(B.FLOAT1);else if(l==="KFTC"&&t.Version>=1e3)h.FresnelTeamColor=e.animVector(B.FLOAT1);else throw new Error("Unknown layer chunk data "+l)}r.Layers.push(h)}t.Materials.push(r)}}var Nc=256;function Bc(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r={};r.ReplaceableId=e.int32(),r.Image=e.str(Nc),e.int32(),r.Flags=e.int32(),t.Textures.push(r)}}function Oc(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r={};e.int32(),e.expectKeyword("VRTX","Incorrect geosets format");let s=e.int32();r.Vertices=new Float32Array(s*3);for(let g=0;g<s*3;++g)r.Vertices[g]=e.float32();e.expectKeyword("NRMS","Incorrect geosets format");let o=e.int32();r.Normals=new Float32Array(o*3);for(let g=0;g<o*3;++g)r.Normals[g]=e.float32();e.expectKeyword("PTYP","Incorrect geosets format");let a=e.int32();for(let g=0;g<a;++g)if(e.int32()!==4)throw new Error("Incorrect geosets format");e.expectKeyword("PCNT","Incorrect geosets format");let c=e.int32();for(let g=0;g<c;++g)e.int32();e.expectKeyword("PVTX","Incorrect geosets format");let h=e.int32();r.Faces=new Uint16Array(h);for(let g=0;g<h;++g)r.Faces[g]=e.uint16();e.expectKeyword("GNDX","Incorrect geosets format");let l=e.int32();r.VertexGroup=new Uint8Array(l);for(let g=0;g<l;++g)r.VertexGroup[g]=e.uint8();e.expectKeyword("MTGC","Incorrect geosets format");let d=e.int32();r.Groups=[];for(let g=0;g<d;++g)r.Groups[g]=new Array(e.int32());e.expectKeyword("MATS","Incorrect geosets format"),r.TotalGroupsCount=e.int32();let u=0,f=0;for(let g=0;g<r.TotalGroupsCount;++g)u>=r.Groups[f].length&&(u=0,f++),r.Groups[f][u++]=e.int32();r.MaterialID=e.int32(),r.SelectionGroup=e.int32(),r.Unselectable=e.int32()>0,t.Version>=900&&(r.LevelOfDetail=e.int32(),r.Name=e.str(80)),Ai(r,e);let p=e.int32();r.Anims=[];for(let g=0;g<p;++g){let y={};Ai(y,e),r.Anims.push(y)}let m=e.keyword();if(t.Version>=900)for(;;){if(e.pos>=e.length)throw new Error("Unexpected EOF");if(m==="TANG"){if(r.Tangents)throw new Error("Incorrect geoset, multiple Tangents");let g=e.int32();r.Tangents=e.float32Array(g*4)}else if(m==="SKIN"){if(r.SkinWeights)throw new Error("Incorrect geoset, multiple SkinWeights");let g=e.int32();r.SkinWeights=e.uint8Array(g)}else if(m==="UVAS")break;m=e.keyword()}else if(m!=="UVAS")throw new Error("Incorrect geosets format");let x=e.int32();r.TVertices=[];for(let g=0;g<x;++g){e.expectKeyword("UVBS","Incorrect geosets format");let y=e.int32(),v=new Float32Array(y*2);for(let _=0;_<y*2;++_)v[_]=e.float32();r.TVertices.push(v)}t.Geosets.push(r)}}function Vc(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};o.Alpha=e.float32(),o.Flags=e.int32(),o.Color=new Float32Array(3);for(let a=0;a<3;++a)o.Color[a]=e.float32();for(o.GeosetId=e.int32(),o.GeosetId===Ht&&(o.GeosetId=null);e.pos<r+s;){let a=e.keyword();if(a==="KGAO")o.Alpha=e.animVector(B.FLOAT1);else if(a==="KGAC")o.Color=e.animVector(B.FLOAT3);else throw new Error("Incorrect GeosetAnim chunk data "+a)}t.GeosetAnims.push(o)}}var Gc=80;function Tt(t,e,n){let i=n.pos,r=n.int32();for(e.Name=n.str(Gc),e.ObjectId=n.int32(),e.ObjectId===Ht&&(e.ObjectId=null),e.Parent=n.int32(),e.Parent===Ht&&(e.Parent=null),e.Flags=n.int32();n.pos<i+r;){let s=n.keyword();if(s==="KGTR")e.Translation=n.animVector(B.FLOAT3);else if(s==="KGRT")e.Rotation=n.animVector(B.FLOAT4);else if(s==="KGSC")e.Scaling=n.animVector(B.FLOAT3);else throw new Error("Incorrect node chunk data "+s)}t.Nodes[e.ObjectId]=e}function kc(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r={};Tt(t,r,e),r.GeosetId=e.int32(),r.GeosetId===Ht&&(r.GeosetId=null),r.GeosetAnimId=e.int32(),r.GeosetAnimId===Ht&&(r.GeosetAnimId=null),t.Bones.push(r)}}function zc(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r={};Tt(t,r,e),t.Helpers.push(r)}}var Hc=256;function Wc(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};Tt(t,o,e),o.Path=e.str(Hc),e.int32(),o.AttachmentID=e.int32(),e.pos<r+s&&(e.expectKeyword("KATV","Incorrect attachment chunk data"),o.Visibility=e.animVector(B.FLOAT1)),t.Attachments.push(o)}}function Xc(t,e,n){let i=n/12;for(let r=0;r<i;++r)t.PivotPoints[r]=new Float32Array(3),t.PivotPoints[r][0]=e.float32(),t.PivotPoints[r][1]=e.float32(),t.PivotPoints[r][2]=e.float32()}function qc(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r={};Tt(t,r,e),e.expectKeyword("KEVT","Incorrect EventObject chunk data");let s=e.int32();r.EventTrack=new Uint32Array(s),e.int32();for(let o=0;o<s;++o)r.EventTrack[o]=e.int32();t.EventObjects.push(r)}}function $c(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r={};Tt(t,r,e),r.Shape=e.int32(),r.Shape===It.Box?r.Vertices=new Float32Array(6):r.Vertices=new Float32Array(3);for(let s=0;s<r.Vertices.length;++s)r.Vertices[s]=e.float32();r.Shape===It.Sphere&&(r.BoundsRadius=e.float32()),t.CollisionShapes.push(r)}}function Yc(t,e,n){let i=e.pos;for(t.GlobalSequences=[];e.pos<i+n;)t.GlobalSequences.push(e.int32())}var Kc=256;function jc(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};for(Tt(t,o,e),o.EmissionRate=e.float32(),o.Gravity=e.float32(),o.Longitude=e.float32(),o.Latitude=e.float32(),o.Path=e.str(Kc),e.int32(),o.LifeSpan=e.float32(),o.InitVelocity=e.float32();e.pos<r+s;){let a=e.keyword();if(a==="KPEV")o.Visibility=e.animVector(B.FLOAT1);else if(a==="KPEE")o.EmissionRate=e.animVector(B.FLOAT1);else if(a==="KPEG")o.Gravity=e.animVector(B.FLOAT1);else if(a==="KPLN")o.Longitude=e.animVector(B.FLOAT1);else if(a==="KPLT")o.Latitude=e.animVector(B.FLOAT1);else if(a==="KPEL")o.LifeSpan=e.animVector(B.FLOAT1);else if(a==="KPES")o.InitVelocity=e.animVector(B.FLOAT1);else throw new Error("Incorrect particle emitter chunk data "+a)}t.ParticleEmitters.push(o)}}function Zc(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};Tt(t,o,e),o.Speed=e.float32(),o.Variation=e.float32(),o.Latitude=e.float32(),o.Gravity=e.float32(),o.LifeSpan=e.float32(),o.EmissionRate=e.float32(),o.Width=e.float32(),o.Length=e.float32(),o.FilterMode=e.int32(),o.Rows=e.int32(),o.Columns=e.int32();let a=e.int32();o.FrameFlags=0,(a===0||a===2)&&(o.FrameFlags|=nt.Head),(a===1||a===2)&&(o.FrameFlags|=nt.Tail),o.TailLength=e.float32(),o.Time=e.float32(),o.SegmentColor=[];for(let c=0;c<3;++c){o.SegmentColor[c]=new Float32Array(3);for(let h=0;h<3;++h)o.SegmentColor[c][h]=e.float32()}o.Alpha=new Uint8Array(3);for(let c=0;c<3;++c)o.Alpha[c]=e.uint8();o.ParticleScaling=new Float32Array(3);for(let c=0;c<3;++c)o.ParticleScaling[c]=e.float32();for(let c of["LifeSpanUVAnim","DecayUVAnim","TailUVAnim","TailDecayUVAnim"]){o[c]=new Uint32Array(3);for(let h=0;h<3;++h)o[c][h]=e.int32()}for(o.TextureID=e.int32(),o.TextureID===Ht&&(o.TextureID=null),o.Squirt=e.int32()>0,o.PriorityPlane=e.int32(),o.ReplaceableId=e.int32();e.pos<r+s;){let c=e.keyword();if(c==="KP2V")o.Visibility=e.animVector(B.FLOAT1);else if(c==="KP2E")o.EmissionRate=e.animVector(B.FLOAT1);else if(c==="KP2W")o.Width=e.animVector(B.FLOAT1);else if(c==="KP2N")o.Length=e.animVector(B.FLOAT1);else if(c==="KP2S")o.Speed=e.animVector(B.FLOAT1);else if(c==="KP2L")o.Latitude=e.animVector(B.FLOAT1);else if(c==="KP2G")o.Gravity=e.animVector(B.FLOAT1);else if(c==="KP2R")o.Variation=e.animVector(B.FLOAT1);else throw new Error("Incorrect particle emitter2 chunk data "+c)}t.ParticleEmitters2.push(o)}}var Jc=80;function Qc(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};for(o.Name=e.str(Jc),o.Position=new Float32Array(3),o.Position[0]=e.float32(),o.Position[1]=e.float32(),o.Position[2]=e.float32(),o.FieldOfView=e.float32(),o.FarClip=e.float32(),o.NearClip=e.float32(),o.TargetPosition=new Float32Array(3),o.TargetPosition[0]=e.float32(),o.TargetPosition[1]=e.float32(),o.TargetPosition[2]=e.float32();e.pos<r+s;){let a=e.keyword();if(a==="KCTR")o.Translation=e.animVector(B.FLOAT3);else if(a==="KTTR")o.TargetTranslation=e.animVector(B.FLOAT3);else if(a==="KCRL")o.Rotation=e.animVector(B.FLOAT1);else throw new Error("Incorrect camera chunk data "+a)}t.Cameras.push(o)}}function eh(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};Tt(t,o,e),o.LightType=e.int32(),o.AttenuationStart=e.float32(),o.AttenuationEnd=e.float32(),o.Color=new Float32Array(3);for(let a=0;a<3;++a)o.Color[a]=e.float32();o.Intensity=e.float32(),o.AmbColor=new Float32Array(3);for(let a=0;a<3;++a)o.AmbColor[a]=e.float32();for(o.AmbIntensity=e.float32();e.pos<r+s;){let a=e.keyword();if(a==="KLAV")o.Visibility=e.animVector(B.FLOAT1);else if(a==="KLAC")o.Color=e.animVector(B.FLOAT3);else if(a==="KLAI")o.Intensity=e.animVector(B.FLOAT1);else if(a==="KLBC")o.AmbColor=e.animVector(B.FLOAT3);else if(a==="KLBI")o.AmbIntensity=e.animVector(B.FLOAT1);else if(a==="KLAS")o.AttenuationStart=e.animVector(B.INT1);else if(a==="KLAE")o.AttenuationEnd=e.animVector(B.INT1);else throw new Error("Incorrect light chunk data "+a)}t.Lights.push(o)}}function th(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};for(;e.pos<r+s;){let a=e.keyword();if(a==="KTAT")o.Translation=e.animVector(B.FLOAT3);else if(a==="KTAR")o.Rotation=e.animVector(B.FLOAT4);else if(a==="KTAS")o.Scaling=e.animVector(B.FLOAT3);else throw new Error("Incorrect light chunk data "+a)}t.TextureAnims.push(o)}}function nh(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};Tt(t,o,e),o.HeightAbove=e.float32(),o.HeightBelow=e.float32(),o.Alpha=e.float32(),o.Color=new Float32Array(3);for(let a=0;a<3;++a)o.Color[a]=e.float32();for(o.LifeSpan=e.float32(),o.TextureSlot=e.int32(),o.EmissionRate=e.int32(),o.Rows=e.int32(),o.Columns=e.int32(),o.MaterialID=e.int32(),o.Gravity=e.float32();e.pos<r+s;){let a=e.keyword();if(a==="KRVS")o.Visibility=e.animVector(B.FLOAT1);else if(a==="KRHA")o.HeightAbove=e.animVector(B.FLOAT1);else if(a==="KRHB")o.HeightBelow=e.animVector(B.FLOAT1);else if(a==="KRAL")o.Alpha=e.animVector(B.FLOAT1);else if(a==="KRTX")o.TextureSlot=e.animVector(B.INT1);else throw new Error("Incorrect ribbon emitter chunk data "+a)}t.RibbonEmitters.push(o)}}function ih(t,e,n){if(t.Version<900)throw new Error("Mismatched version chunk");let i=e.pos;for(t.FaceFX=t.FaceFX||[];e.pos<i+n;){let r={Name:"",Path:""};r.Name=e.str(80),r.Path=e.str(260),t.FaceFX.push(r)}}function rh(t,e,n){if(t.Version<900)throw new Error("Mismatched version chunk");let i=e.pos;t.BindPoses=t.BindPoses||[];let r=e.int32(),s={Matrices:[]};for(let o=0;o<r;++o){let a=e.float32Array(12);s.Matrices.push(a)}if(t.BindPoses.push(s),e.pos!==i+n)throw new Error("Mismatched BindPose data")}function sh(t,e,n){if(t.Version<900)throw new Error("Mismatched version chunk");let i=e.pos;for(t.ParticleEmitterPopcorns=t.ParticleEmitterPopcorns||[];e.pos<i+n;){let r=e.pos,s=e.int32(),o={};for(Tt(t,o,e),o.LifeSpan=e.float32(),o.EmissionRate=e.float32(),o.Speed=e.float32(),o.Color=e.float32Array(3),o.Alpha=e.float32(),o.ReplaceableId=e.int32(),o.Path=e.str(260),o.AnimVisibilityGuide=e.str(260);e.pos<r+s;){let a=e.keyword();if(a==="KPPA")o.Alpha=e.animVector(B.FLOAT1);else if(a==="KPPC")o.Color=e.animVector(B.FLOAT3);else if(a==="KPPE")o.EmissionRate=e.animVector(B.FLOAT1);else if(a==="KPPL")o.LifeSpan=e.animVector(B.FLOAT1);else if(a==="KPPS")o.Speed=e.animVector(B.FLOAT1);else if(a==="KPPV")o.Visibility=e.animVector(B.FLOAT1);else throw new Error("Incorrect particle emitter popcorn chunk data "+a)}t.ParticleEmitterPopcorns.push(o)}}var js={VERS:Ic,MODL:Lc,SEQS:Dc,MTLS:Uc,TEXS:Bc,GEOS:Oc,GEOA:Vc,BONE:kc,HELP:zc,ATCH:Wc,PIVT:Xc,EVTS:qc,CLID:$c,GLBS:Yc,PREM:jc,PRE2:Zc,CAMS:Qc,LITE:eh,TXAN:th,RIBB:nh,FAFX:ih,BPOS:rh,CORN:sh};function Js(t){let e=new Cc(t);if(e.keyword()!=="MDLX")throw new Error("Not a mdx model");let n={Version:800,Info:{Name:"",MinimumExtent:null,MaximumExtent:null,BoundsRadius:0,BlendTime:150},Sequences:[],GlobalSequences:[],Textures:[],Materials:[],TextureAnims:[],Geosets:[],GeosetAnims:[],Bones:[],Helpers:[],Attachments:[],EventObjects:[],ParticleEmitters:[],ParticleEmitters2:[],Cameras:[],Lights:[],RibbonEmitters:[],CollisionShapes:[],PivotPoints:[],Nodes:[]};for(;e.pos<e.length;){let i=e.keyword(),r=e.int32();i in js?js[i](n,e,r):e.pos+=r}for(let i=0;i<n.Nodes.length;++i)n.Nodes[i]&&n.PivotPoints[i]&&(n.Nodes[i].PivotPoint=n.PivotPoints[i]);return n.Info.NumGeosets=n.Geosets.length,n.Info.NumGeosetAnims=n.GeosetAnims.length,n.Info.NumBones=n.Bones.length,n.Info.NumLights=n.Lights.length,n.Info.NumAttachments=n.Attachments.length,n.Info.NumEvents=n.EventObjects.length,n.Info.NumParticleEmitters=n.ParticleEmitters.length,n.Info.NumParticleEmitters2=n.ParticleEmitters2.length,n.Info.NumRibbonEmitters=n.RibbonEmitters.length,n}var oh=6,Jn=1e-6;function ah(t,e=0){return Math.abs(t[0]-e)>Jn||Math.abs(t[1]-e)>Jn||Math.abs(t[2]-e)>Jn}function _e(t=1){if(t===0)return"";let e="	";for(let n=1;n<t;++n)e+="	";return e}function Qs(t){return`"${t}"`}function lh(t){return typeof t=="number"?String(t):Qs(t)}function W(t,e=null,n=0){return _e(n)+t+" "+(e!==null?lh(e)+" ":"")+`{
`}function q(t=0){return _e(t)+`}
`}var ch=/(\..+?)0+$/,hh=/\.0+$/,uh=/^-0$/;function fn(t){return t.toFixed(oh).replace(ch,"$1").replace(hh,"").replace(uh,"0")}function Mt(t,e=!1){let n="";if(e)for(let i=t.length-1;i>=0;--i)i<t.length-1&&(n+=", "),n+=fn(t[i]);else for(let i=0;i<t.length;++i)i>0&&(n+=", "),n+=fn(t[i]);return"{ "+n+" }"}function wr(t){let e="";for(let n=0;n<t.length;++n)n>0&&(e+=", "),e+=String(t[n]);return"{ "+e+" }"}function fh(t){return t?"static ":""}function wn(t,e,n,i=1){return`${_e(i)+fh(n)+t} ${e},
`}function ye(t,e,n=null,i=1){return wn(t,String(e),n,i)}function An(t,e,n=null,i=1){return wn(t,fn(e),n,i)}function Tr(t,e,n=null,i=1){return wn(t,e,n,i)}function Wt(t,e,n=null,i=1){return wn(t,Qs(e),n,i)}function We(t,e,n=null,i=1){return wn(t,Mt(e),n,i)}function eo(t,e,n=null,i=1){return wn(t,wr(e),n,i)}function j(t,e=1){return _e(e)+t+`,
`}function le(t,e,n=0,i=null,r=1){return e!==n&&e!==null&&e!==void 0?ye(t,e,i,r):""}function En(t,e,n=0,i=null,r=1){return Math.abs(e-n)>Jn?An(t,e,i,r):""}function dh(t){switch(t){case Ze.DontInterp:return"DontInterp";case Ze.Linear:return"Linear";case Ze.Bezier:return"Bezier";case Ze.Hermite:return"Hermite"}return""}function ph(t,e=2,n=!1){let i=_e(e)+t.Frame+": "+(t.Vector.length===1?fn(t.Vector[0]):Mt(t.Vector,n))+`,
`;return t.InTan&&(i+=_e(e+1)+"InTan "+(t.InTan.length===1?fn(t.InTan[0]):Mt(t.InTan,n))+`,
`,i+=_e(e+1)+"OutTan "+(t.OutTan.length===1?fn(t.OutTan[0]):Mt(t.OutTan,n))+`,
`),i}function V(t,e,n=0,i=1,r=!1){return e==null?"":typeof e=="number"?typeof n=="number"&&Math.abs(e-n)<Jn?"":An(t,e,!0,i):W(t,e.Keys.length,i)+j(dh(e.LineType),i+1)+(e.GlobalSeqId!==null?ye("GlobalSeqId",e.GlobalSeqId,null,i+1):"")+e.Keys.map(s=>ph(s,i+1,r)).join("")+q(i)}function mh(t){return W("Version")+ye("FormatVersion",t.Version)+q()}function gh(t){return W("Model",t.Info.Name)+le("NumGeosets",t.Geosets.length)+le("NumGeosetAnims",t.GeosetAnims.length)+le("NumHelpers",t.Helpers.length)+le("NumBones",t.Bones.length)+(t.Lights.length?le("NumLights",t.Lights.length):"")+le("NumAttachments",t.Attachments.length)+le("NumEvents",t.EventObjects.length)+le("NumParticleEmitters",t.ParticleEmitters.length)+(t.ParticleEmitters2.length?le("NumParticleEmitters2",t.ParticleEmitters2.length):"")+(t.RibbonEmitters.length?le("NumRibbonEmitters",t.RibbonEmitters.length):"")+ye("BlendTime",t.Info.BlendTime)+We("MinimumExtent",t.Info.MinimumExtent)+We("MaximumExtent",t.Info.MaximumExtent)+En("BoundsRadius",t.Info.BoundsRadius)+q()}function vh(t){return W("Sequences",t.Sequences.length)+t.Sequences.map(xh).join("")+q()}function xh(t){return W("Anim",t.Name,1)+eo("Interval",t.Interval,null,2)+En("Rarity",t.Rarity,0,null,2)+En("MoveSpeed",t.MoveSpeed,0,null,2)+(t.NonLooping?j("NonLooping",2):"")+We("MinimumExtent",t.MinimumExtent,null,2)+We("MaximumExtent",t.MaximumExtent,null,2)+En("BoundsRadius",t.BoundsRadius,0,null,2)+q(1)}function yh(t){return!t.GlobalSequences||!t.GlobalSequences.length?"":W("GlobalSequences",t.GlobalSequences.length)+t.GlobalSequences.map(e=>ye("Duration",e)).join("")+q()}function _h(t){return t.Textures.length?W("Textures",t.Textures.length)+t.Textures.map(bh).join("")+q():""}function bh(t){return W("Bitmap",null,1)+Wt("Image",t.Image,null,2)+le("ReplaceableId",t.ReplaceableId,0,null,2)+(t.Flags&Ti.WrapWidth?j("WrapWidth",2):"")+(t.Flags&Ti.WrapHeight?j("WrapHeight",2):"")+q(1)}function Sh(t){return t.Materials.length?W("Materials",t.Materials.length)+t.Materials.map(e=>Mh(t,e)).join("")+q():""}function Mh(t,e){let n="";return t.Version>=900&&t.Version<1100&&e.Shader&&(n=Wt("Shader",e.Shader,!1,2)),W("Material",null,1)+(e.RenderMode&Si.ConstantColor?j("ConstantColor",2):"")+(e.RenderMode&Si.SortPrimsFarZ?j("SortPrimsFarZ",2):"")+(e.RenderMode&Si.FullResolution?j("FullResolution",2):"")+le("PriorityPlane",e.PriorityPlane,0,null,2)+le("RenderMode",e.RenderMode,0,null,2)+n+e.Layers.map(i=>Ah(t,i)).join("")+q(1)}function Th(t){switch(t){case zt.None:return"None";case zt.Transparent:return"Transparent";case zt.Blend:return"Blend";case zt.Additive:return"Additive";case zt.AddAlpha:return"AddAlpha";case zt.Modulate:return"Modulate";case zt.Modulate2x:return"Modulate2x"}return""}function Ah(t,e){let n="";return t.Version>=900&&(n+=e.EmissiveGain!==void 0?V("EmissiveGain",e.EmissiveGain,1,3):"",t.Version>=1e3&&(n+=e.FresnelColor!==void 0?dn("FresnelColor",e.FresnelColor,!0,3):"",n+=e.FresnelOpacity!==void 0?V("FresnelOpacity",e.FresnelOpacity,0,3):"",n+=e.FresnelTeamColor!==void 0?V("FresnelTeamColor",e.FresnelTeamColor,0,3):"")),t.Version>=1100&&(n+=ye("ShaderTypeId",e.ShaderTypeId||0,null,3),un.slice(1).forEach(i=>{let r=e[i];r!==void 0&&(n+=V(i,r,null,3))})),W("Layer",null,2)+Tr("FilterMode",Th(e.FilterMode),null,3)+(e.Alpha!==void 0?V("Alpha",e.Alpha,1,3):"")+(e.TextureID!==void 0?V("TextureID",e.TextureID,null,3):"")+(e.Shading&cn.TwoSided?j("TwoSided",3):"")+(e.Shading&cn.Unshaded?j("Unshaded",3):"")+(e.Shading&cn.Unfogged?j("Unfogged",3):"")+(e.Shading&cn.SphereEnvMap?j("SphereEnvMap",3):"")+(e.Shading&cn.NoDepthTest?j("NoDepthTest",3):"")+(e.Shading&cn.NoDepthSet?j("NoDepthSet",3):"")+le("CoordId",e.CoordId,0,null,3)+le("TVertexAnimId",e.TVertexAnimId,null,null,3)+n+q(2)}function Eh(t){return t.TextureAnims.length?W("TextureAnims",t.TextureAnims.length)+t.TextureAnims.map(wh).join("")+q():""}function wh(t){return W("TVertexAnim",null,1)+(t.Translation?V("Translation",t.Translation,null,2):"")+(t.Rotation?V("Rotation",t.Rotation,null,2):"")+(t.Scaling?V("Scaling",t.Scaling,null,2):"")+q(1)}function Ph(t){return t.Geosets.length?t.Geosets.map(e=>Ch(t,e)).join(""):""}function Ch(t,e){let n="";return t.Version>=900&&(n+=(e.LevelOfDetail!==void 0?ye("LevelOfDetail",e.LevelOfDetail):"")+(e.Name?Wt("Name",e.Name):"")+(e.Tangents?jn("Tangents",e.Tangents,4):"")+(e.SkinWeights?jn("SkinWeights",e.SkinWeights,8):"")),W("Geoset")+jn("Vertices",e.Vertices,3)+jn("Normals",e.Normals,3)+jn("TVertices",e.TVertices[0],2)+Ih(e.VertexGroup)+Rh(e.Faces)+Lh(e.Groups)+We("MinimumExtent",e.MinimumExtent)+We("MaximumExtent",e.MaximumExtent)+En("BoundsRadius",e.BoundsRadius)+Fh(e.Anims)+ye("MaterialID",e.MaterialID)+ye("SelectionGroup",e.SelectionGroup)+(e.Unselectable?j("Unselectable"):"")+n+q()}function jn(t,e,n){let i="",r=e.length/n;for(let s=0;s<r;++s)i+=_e(2)+Mt(e.slice(s*n,(s+1)*n))+`,
`;return W(t,r,1)+i+q(1)}function Ih(t){if(!t.length)return"";let e="";for(let n=0;n<t.length;++n)e+=_e(2)+t[n]+`,
`;return W("VertexGroup",null,1)+e+q(1)}function Rh(t){return W(`Faces 1 ${t.length}`,null,1)+W("Triangles",null,2)+_e(3)+wr(t)+`,
`+q(2)+q(1)}function Lh(t){let e=0,n="";for(let i of t)e+=i.length,n+=_e(2)+"Matrices "+wr(i)+`,
`;return W(`Groups ${t.length} ${e}`,null,1)+n+q(1)}function Fh(t){return t?t.map(Dh).join(""):""}function Dh(t){return W("Anim",null,1)+We("MinimumExtent",t.MinimumExtent,null,2)+We("MaximumExtent",t.MaximumExtent,null,2)+En("BoundsRadius",t.BoundsRadius,0,null,2)+q(1)}function Uh(t){return t.GeosetAnims.length?t.GeosetAnims.map(Nh).join(""):""}function dn(t,e,n,i=1){if(e)if(e instanceof Float32Array){if(!n||ah(e,1)){let r="";for(let s=2;s>=0;--s)s<2&&(r+=", "),r+=fn(e[s]);return`${_e(i)}${n?"static ":""}${t} { ${r} },
`}}else return V(t,e,null,i,!0);return""}function Nh(t){return W("GeosetAnim")+ye("GeosetId",t.GeosetId)+V("Alpha",t.Alpha,1)+dn("Color",t.Color,!0)+(t.Flags&Zs.DropShadow?j("DropShadow"):"")+q()}function At(t){return ye("ObjectId",t.ObjectId)+le("Parent",t.Parent,null)+Bh(t.Flags)+(t.Flags&He.Billboarded?j("Billboarded"):"")+(t.Flags&He.BillboardedLockX?j("BillboardedLockX"):"")+(t.Flags&He.BillboardedLockY?j("BillboardedLockY"):"")+(t.Flags&He.BillboardedLockZ?j("BillboardedLockZ"):"")+(t.Flags&He.CameraAnchored?j("CameraAnchored"):"")+(t.Translation!==void 0?V("Translation",t.Translation):"")+(t.Rotation!==void 0?V("Rotation",t.Rotation):"")+(t.Scaling!==void 0?V("Scaling",t.Scaling):"")}function Bh(t){let e=[];return t&He.DontInheritTranslation&&e.push("Translation"),t&He.DontInheritRotation&&e.push("Rotation"),t&He.DontInheritScaling&&e.push("Scaling"),e.length?_e(1)+"DontInherit { "+e.join(", ")+` },
`:""}function Oh(t){return t.Bones.length?t.Bones.map(Vh).join(""):""}function Vh(t){return W("Bone",t.Name)+At(t)+(t.GeosetId!==null?ye("GeosetId",t.GeosetId):Tr("GeosetId","Multiple"))+(t.GeosetAnimId!==null?ye("GeosetAnimId",t.GeosetAnimId):Tr("GeosetAnimId","None"))+q()}function Gh(t){return t.Lights.length?t.Lights.map(kh).join(""):""}function kh(t){return W("Light",t.Name)+At(t)+j(zh(t.LightType))+V("AttenuationStart",t.AttenuationStart)+V("AttenuationEnd",t.AttenuationEnd)+dn("Color",t.Color,!0)+V("Intensity",t.Intensity,null)+dn("AmbColor",t.AmbColor,!0)+V("AmbIntensity",t.AmbIntensity,null)+V("Visibility",t.Visibility,1)+q()}function zh(t){switch(t){case Mi.Omnidirectional:return"Omnidirectional";case Mi.Directional:return"Directional";case Mi.Ambient:return"Ambient"}return""}function Hh(t){return t.Helpers.map(Wh).join("")}function Wh(t){return W("Helper",t.Name)+At(t)+q()}function Xh(t){return t.Attachments.map(qh).join("")}function qh(t){return W("Attachment",t.Name)+At(t)+ye("AttachmentID",t.AttachmentID)+(t.Path?Wt("Path",t.Path):"")+V("Visibility",t.Visibility,1)+q()}function $h(t){return W("PivotPoints",t.PivotPoints.length)+t.PivotPoints.map(e=>`${_e()}${Mt(e)},
`).join("")+q()}function Yh(t){return t.ParticleEmitters.map(Kh).join("")}function Kh(t){return W("ParticleEmitter",t.Name)+At(t)+(t.Flags&Mr.EmitterUsesMDL?j("EmitterUsesMDL"):"")+(t.Flags&Mr.EmitterUsesTGA?j("EmitterUsesTGA"):"")+V("EmissionRate",t.EmissionRate)+V("Gravity",t.Gravity)+V("Longitude",t.Longitude)+V("Latitude",t.Latitude)+V("Visibility",t.Visibility)+W("Particle",null,1)+V("LifeSpan",t.LifeSpan,null,2)+V("InitVelocity",t.InitVelocity,null,2)+Wt("Path",t.Path,!1,2)+q(1)+q()}function jh(t){return t.ParticleEmitters2.map(eu).join("")}function Zh(t){switch(t){case Mn.Blend:return"Blend";case Mn.Additive:return"Additive";case Mn.Modulate:return"Modulate";case Mn.Modulate2x:return"Modulate2x";case Mn.AlphaKey:return"AlphaKey"}return""}function Jh(t){return W("SegmentColor",null,1)+t.map(e=>dn("Color",e,!1,2)).join("")+_e()+`},
`}function Qh(t){return t&nt.Head&&t&nt.Tail?"Both":t&nt.Head?"Head":t&nt.Tail?"Tail":""}function eu(t){return W("ParticleEmitter2",t.Name)+At(t)+j(Zh(t.FilterMode))+V("Speed",t.Speed,null)+V("Variation",t.Variation,null)+V("Latitude",t.Latitude,null)+V("Gravity",t.Gravity,null)+V("EmissionRate",t.EmissionRate,null)+V("Width",t.Width,null)+V("Length",t.Length,null)+V("Visibility",t.Visibility,1)+Jh(t.SegmentColor)+eo("Alpha",t.Alpha)+We("ParticleScaling",t.ParticleScaling)+We("LifeSpanUVAnim",t.LifeSpanUVAnim)+We("DecayUVAnim",t.DecayUVAnim)+We("TailUVAnim",t.TailUVAnim)+We("TailDecayUVAnim",t.TailDecayUVAnim)+le("Rows",t.Rows,0)+le("Columns",t.Columns,0)+ye("TextureID",t.TextureID)+le("Time",t.Time,0)+le("LifeSpan",t.LifeSpan,0)+le("TailLength",t.TailLength,0)+le("PriorityPlane",t.PriorityPlane,0)+le("ReplaceableId",t.ReplaceableId,null)+(t.Flags&hn.SortPrimsFarZ?j("SortPrimsFarZ"):"")+(t.Flags&hn.LineEmitter?j("LineEmitter"):"")+(t.Flags&hn.ModelSpace?j("ModelSpace"):"")+(t.Flags&hn.Unshaded?j("Unshaded"):"")+(t.Flags&hn.Unfogged?j("Unfogged"):"")+(t.Flags&hn.XYQuad?j("XYQuad"):"")+(t.Squirt?j("Squirt"):"")+j(Qh(t.FrameFlags))+q()}function tu(t){return t.RibbonEmitters.map(nu).join("")}function nu(t){return W("RibbonEmitter",t.Name)+At(t)+V("HeightAbove",t.HeightAbove,null)+V("HeightBelow",t.HeightBelow,null)+V("Alpha",t.Alpha,null)+dn("Color",t.Color,!0)+V("TextureSlot",t.TextureSlot,null)+V("Visibility",t.Visibility,1)+ye("EmissionRate",t.EmissionRate)+ye("LifeSpan",t.LifeSpan)+le("Gravity",t.Gravity,0)+ye("Rows",t.Rows)+ye("Columns",t.Columns)+ye("MaterialID",t.MaterialID)+q()}function iu(t){return t.EventObjects.map(su).join("")}function ru(t){let e="";for(let n=0;n<t.length;++n)e+=_e(2)+t[n]+`,
`;return W("EventTrack",t.length,1)+e+q(1)}function su(t){return W("EventObject",t.Name)+At(t)+ru(t.EventTrack)+q()}function ou(t){return t.Cameras.map(au).join("")}function au(t){return W("Camera",t.Name)+An("FieldOfView",t.FieldOfView)+An("FarClip",t.FarClip)+An("NearClip",t.NearClip)+We("Position",t.Position)+V("Translation",t.Translation)+V("Rotation",t.Rotation)+W("Target",null,1)+We("Position",t.TargetPosition,null,2)+V("Translation",t.TargetTranslation,null,2)+q(1)+q()}function lu(t){return t.CollisionShapes.map(cu).join("")}function cu(t){let e;return t.Shape===It.Box?(e=j("Box"),e+=W("Vertices",2,1)+_e(2)+Mt(t.Vertices.slice(0,3))+`,
`+_e(2)+Mt(t.Vertices.slice(3,6))+`,
`+q(1)):(e=j("Sphere"),e+=W("Vertices",1,1)+_e(2)+Mt(t.Vertices)+`,
`+q(1)+An("BoundsRadius",t.BoundsRadius)),W("CollisionShape",t.Name)+At(t)+e+q()}function hu(t){return t.Version<900||!t.FaceFX?"":t.FaceFX.map(uu).join("")}function uu(t){return W("FaceFX",t.Name)+Wt("Path",t.Path)+q()}function fu(t){return t.Version<900||!t.BindPoses?"":t.BindPoses.map(du).join("")}function du(t){let e=W("Matrices",t.Matrices.length,1)+t.Matrices.map(n=>_e(2)+Mt(n)+",").join(`
`)+`
`+q(1);return W("BindPose")+e+q()}function pu(t){return t.Version<900||!t.ParticleEmitterPopcorns?"":t.ParticleEmitterPopcorns.map(mu).join("")}function mu(t){return W("ParticleEmitterPopcorn",t.Name)+At(t)+(t.Flags&Tn.Unshaded?j("Unshaded"):"")+(t.Flags&Tn.SortPrimsFarZ?j("SortPrimsFarZ"):"")+(t.Flags&Tn.Unfogged?j("Unfogged"):"")+V("LifeSpan",t.LifeSpan,null)+V("EmissionRate",t.EmissionRate,0)+V("Speed",t.Speed,0)+dn("Color",t.Color,!0)+V("Alpha",t.Alpha,1)+le("ReplaceableId",t.ReplaceableId,0,null)+Wt("Path",t.Path,!1)+Wt("AnimVisibilityGuide",t.AnimVisibilityGuide,!1)+V("Visibility",t.Visibility)+q()}var gu=[mh,gh,vh,yh,_h,Sh,Eh,Ph,Uh,Oh,Gh,Hh,Xh,$h,Yh,jh,tu,iu,ou,lu,hu,fu,pu];function to(t){let e="";for(let n of gu)e+=n(t);return e}var bi=!0,Rt=-1,vu=class{constructor(t){this.ab=t,this.uint=new Uint8Array(this.ab),this.view=new DataView(this.ab),this.pos=0}keyword(t){this.uint[this.pos]=t.charCodeAt(0),this.uint[this.pos+1]=t.charCodeAt(1),this.uint[this.pos+2]=t.charCodeAt(2),this.uint[this.pos+3]=t.charCodeAt(3),this.pos+=4}uint8(t){this.view.setUint8(this.pos,t),this.pos+=1}uint16(t){this.view.setUint16(this.pos,t,bi),this.pos+=2}int32(t){this.view.setInt32(this.pos,t,bi),this.pos+=4}uint32(t){this.view.setUint32(this.pos,t,bi),this.pos+=4}float32(t){this.view.setFloat32(this.pos,t,bi),this.pos+=4}float32Array(t){for(let e=0;e<t.length;++e)this.float32(t[e])}uint8Array(t){for(let e=0;e<t.length;++e)this.uint8(t[e])}uint16Array(t){for(let e=0;e<t.length;++e)this.uint16(t[e])}int32Array(t){for(let e=0;e<t.length;++e)this.int32(t[e])}uint32Array(t){for(let e=0;e<t.length;++e)this.uint32(t[e])}str(t,e){for(let n=0;n<e;++n,++this.pos)this.uint[this.pos]=n<t.length?t.charCodeAt(n):0}animVector(t,e){let n=e===E.INT1;this.int32(t.Keys.length),this.int32(t.LineType),this.int32(t.GlobalSeqId!==null?t.GlobalSeqId:Rt);for(let i of t.Keys)this.int32(i.Frame),n?this.int32Array(i.Vector):this.float32Array(i.Vector),(t.LineType===Ze.Hermite||t.LineType===Ze.Bezier)&&(n?(this.int32Array(i.InTan),this.int32Array(i.OutTan)):(this.float32Array(i.InTan),this.float32Array(i.OutTan)))}};function Ei(t,e){e.float32(t.BoundsRadius||0);for(let n of["MinimumExtent","MaximumExtent"])e.float32Array(t[n])}var E=(function(t){return t[t.INT1=0]="INT1",t[t.FLOAT1=1]="FLOAT1",t[t.FLOAT3=2]="FLOAT3",t[t.FLOAT4=3]="FLOAT4",t})(E||{}),xu={[E.INT1]:1,[E.FLOAT1]:1,[E.FLOAT3]:3,[E.FLOAT4]:4};function O(t,e){return 12+t.Keys.length*(4+4*xu[e]*(t.LineType===Ze.Hermite||t.LineType===Ze.Bezier?3:1))}function be(t){return t.reduce((e,n)=>e+n,0)}function yu(){return 12}function _u(t,e){e.keyword("VERS"),e.int32(4),e.int32(t.Version)}var no=336;function io(){return 8+no+4+28+4}function bu(t,e){e.keyword("MODL"),e.int32(io()-8),e.str(t.Info.Name,no),e.int32(0),Ei(t.Info,e),e.int32(t.Info.BlendTime)}var ro=80;function Su(){return ro+8+4+4+4+4+28}function so(t){return t.Sequences.length?8+be(t.Sequences.map(Su)):0}function Mu(t,e){if(t.Sequences.length){e.keyword("SEQS"),e.int32(so(t)-8);for(let n of t.Sequences)e.str(n.Name,ro),e.int32(n.Interval[0]),e.int32(n.Interval[1]),e.float32(n.MoveSpeed),e.int32(n.NonLooping?1:0),e.float32(n.Rarity),e.int32(0),Ei(n,e)}}function Tu(t){return!t.GlobalSequences||!t.GlobalSequences.length?0:8+4*t.GlobalSequences.length}function Au(t,e){if(!(!t.GlobalSequences||!t.GlobalSequences.length)){e.keyword("GLBS"),e.int32(t.GlobalSequences.length*4);for(let n of t.GlobalSequences)e.int32(n)}}function oo(t,e){return 28+(t.Version>=900?4:0)+(t.Version>=1e3?20:0)+(t.Version>=1100?8+un.reduce((n,i)=>n+(typeof e[i]<"u"?8+(typeof e[i]=="object"?4+O(e[i],E.INT1):0):0),0):0)+(e.Alpha!==null&&typeof e.Alpha!="number"?4+O(e.Alpha,E.FLOAT1):0)+(t.Version<1100&&e.TextureID!==null&&typeof e.TextureID!="number"?4+O(e.TextureID,E.INT1):0)+(t.Version>=900&&e.EmissiveGain!==void 0&&e.EmissiveGain!==null&&typeof e.EmissiveGain!="number"?4+O(e.EmissiveGain,E.FLOAT1):0)+(t.Version>=1e3&&e.FresnelColor!==void 0&&e.FresnelColor!==null&&!(e.FresnelColor instanceof Float32Array)?4+O(e.FresnelColor,E.FLOAT3):0)+(t.Version>=1e3&&e.FresnelOpacity!==void 0&&e.FresnelOpacity!==null&&typeof e.FresnelOpacity!="number"?4+O(e.FresnelOpacity,E.FLOAT1):0)+(t.Version>=1e3&&e.FresnelTeamColor!==void 0&&e.FresnelTeamColor!==null&&typeof e.FresnelTeamColor!="number"?4+O(e.FresnelTeamColor,E.FLOAT1):0)}function ao(t,e){return 20+(t.Version>=900&&t.Version<1100?80:0)+be(e.Layers.map(n=>oo(t,n)))}function lo(t){return t.Materials.length?8+be(t.Materials.map(e=>ao(t,e))):0}function Eu(t,e){if(t.Materials.length){e.keyword("MTLS"),e.int32(lo(t)-8);for(let n of t.Materials){e.int32(ao(t,n)),e.int32(n.PriorityPlane),e.int32(n.RenderMode),t.Version>=900&&t.Version<1100&&e.str(n.Shader||"",80),e.keyword("LAYS"),e.int32(n.Layers.length);for(let i of n.Layers){if(e.int32(oo(t,i)),e.int32(i.FilterMode),e.int32(i.Shading),e.int32(t.Version<1100&&typeof i.TextureID=="number"?i.TextureID:0),e.int32(i.TVertexAnimId!==null?i.TVertexAnimId:Rt),e.int32(i.CoordId),e.float32(typeof i.Alpha=="number"?i.Alpha:1),t.Version>=900&&(e.float32(typeof i.EmissiveGain=="number"?i.EmissiveGain:1),t.Version>=1e3&&(e.float32Array(i.FresnelColor instanceof Float32Array?i.FresnelColor:new Float32Array([1,1,1])),e.float32(typeof i.FresnelOpacity=="number"?i.FresnelOpacity:0),e.float32(typeof i.FresnelTeamColor=="number"?i.FresnelTeamColor:0))),t.Version>=1100){e.int32(i.ShaderTypeId||0);let r=un.filter(s=>i[s]!==void 0).length;e.int32(r);for(let s=0;s<un.length;++s){let o=i[un[s]];o!==void 0&&(e.int32(typeof o=="number"?o:0),e.int32(typeof o=="number"?s:0),typeof o=="object"&&(e.keyword("KMTF"),e.animVector(o,E.INT1)))}}i.Alpha&&typeof i.Alpha!="number"&&(e.keyword("KMTA"),e.animVector(i.Alpha,E.FLOAT1)),t.Version<1100&&i.TextureID&&typeof i.TextureID!="number"&&(e.keyword("KMTF"),e.animVector(i.TextureID,E.INT1)),t.Version>=900&&i.EmissiveGain&&typeof i.EmissiveGain!="number"&&(e.keyword("KMTE"),e.animVector(i.EmissiveGain,E.FLOAT1)),t.Version>=1e3&&i.FresnelColor&&!(i.FresnelColor instanceof Float32Array)&&(e.keyword("KFC3"),e.animVector(i.FresnelColor,E.FLOAT3)),t.Version>=1e3&&i.FresnelOpacity&&typeof i.FresnelOpacity!="number"&&(e.keyword("KFCA"),e.animVector(i.FresnelOpacity,E.FLOAT1)),t.Version>=1e3&&i.FresnelTeamColor&&typeof i.FresnelTeamColor!="number"&&(e.keyword("KFTC"),e.animVector(i.FresnelTeamColor,E.FLOAT1))}}}}var co=256;function wu(){return 4+co+4+4}function ho(t){return t.Textures.length?8+be(t.Textures.map(e=>wu())):0}function Pu(t,e){if(t.Textures.length){e.keyword("TEXS"),e.int32(ho(t)-8);for(let n of t.Textures)e.int32(n.ReplaceableId),e.str(n.Image,co),e.int32(0),e.int32(n.Flags)}}function uo(t){return 4+(t.Translation?4+O(t.Translation,E.FLOAT3):0)+(t.Rotation?4+O(t.Rotation,E.FLOAT4):0)+(t.Scaling?4+O(t.Scaling,E.FLOAT3):0)}function fo(t){return!t.TextureAnims||!t.TextureAnims.length?0:8+be(t.TextureAnims.map(e=>uo(e)))}function Cu(t,e){if(!(!t.TextureAnims||!t.TextureAnims.length)){e.keyword("TXAN"),e.int32(fo(t)-8);for(let n of t.TextureAnims)e.int32(uo(n)),n.Translation&&(e.keyword("KTAT"),e.animVector(n.Translation,E.FLOAT3)),n.Rotation&&(e.keyword("KTAR"),e.animVector(n.Rotation,E.FLOAT4)),n.Scaling&&(e.keyword("KTAS"),e.animVector(n.Scaling,E.FLOAT3))}}function po(t,e){return 12+4*e.Vertices.length+4+4+4*e.Normals.length+4+4+4+4+4+4+4+4+2*e.Faces.length+4+4+e.VertexGroup.length+4+4+4*e.Groups.length+4+4+4*e.TotalGroupsCount+4+4+4+(t.Version>=900?84:0)+(t.Version>=900&&e.Tangents?.length?8+4*e.Tangents.length:0)+(t.Version>=900&&e.SkinWeights?.length?8+e.SkinWeights.length:0)+28+4+28*e.Anims.length+4+4+be(e.TVertices.map(n=>8+4*n.length))}function mo(t){return t.Geosets.length?8+be(t.Geosets.map(e=>po(t,e))):0}function Iu(t,e){if(t.Geosets.length){e.keyword("GEOS"),e.int32(mo(t)-8);for(let n of t.Geosets){e.int32(po(t,n)),e.keyword("VRTX"),e.int32(n.Vertices.length/3),e.float32Array(n.Vertices),e.keyword("NRMS"),e.int32(n.Normals.length/3),e.float32Array(n.Normals),e.keyword("PTYP"),e.int32(1),e.int32(4),e.keyword("PCNT"),e.int32(1),e.int32(n.Faces.length),e.keyword("PVTX"),e.int32(n.Faces.length),e.uint16Array(n.Faces),e.keyword("GNDX"),e.int32(n.VertexGroup.length),e.uint8Array(n.VertexGroup),e.keyword("MTGC"),e.int32(n.Groups.length);for(let i=0;i<n.Groups.length;++i)e.int32(n.Groups[i].length);e.keyword("MATS"),e.int32(n.TotalGroupsCount);for(let i of n.Groups)for(let r of i)e.int32(r);e.int32(n.MaterialID),e.int32(n.SelectionGroup),e.int32(n.Unselectable?4:0),t.Version>=900&&(e.int32(typeof n.LevelOfDetail=="number"?n.LevelOfDetail:-1),e.str(n.Name||"",80)),Ei(n,e),e.int32(n.Anims.length);for(let i of n.Anims)Ei(i,e);t.Version>=900&&(n.Tangents&&n.Tangents.length&&(e.keyword("TANG"),e.int32(n.Tangents.length/4),e.float32Array(n.Tangents)),n.SkinWeights&&n.SkinWeights.length&&(e.keyword("SKIN"),e.int32(n.SkinWeights.length),e.uint8Array(n.SkinWeights))),e.keyword("UVAS"),e.int32(n.TVertices.length);for(let i of n.TVertices)e.keyword("UVBS"),e.int32(i.length/2),e.float32Array(i)}}}function go(t){return 28+(typeof t.Alpha!="number"?4+O(t.Alpha,E.FLOAT1):0)+(t.Color&&!(t.Color instanceof Float32Array)?4+O(t.Color,E.FLOAT3):0)}function vo(t){return t.GeosetAnims.length?8+be(t.GeosetAnims.map(e=>go(e))):0}function Ru(t,e){if(t.GeosetAnims.length){e.keyword("GEOA"),e.int32(vo(t)-8);for(let n of t.GeosetAnims)e.int32(go(n)),e.float32(typeof n.Alpha=="number"?n.Alpha:1),e.int32(n.Flags),n.Color&&n.Color instanceof Float32Array?(e.float32(n.Color[0]),e.float32(n.Color[1]),e.float32(n.Color[2])):(e.float32(1),e.float32(1),e.float32(1)),e.int32(n.GeosetId!==null?n.GeosetId:Rt),n.Alpha!==null&&typeof n.Alpha!="number"&&(e.keyword("KGAO"),e.animVector(n.Alpha,E.FLOAT1)),n.Color&&!(n.Color instanceof Float32Array)&&(e.keyword("KGAC"),e.animVector(n.Color,E.FLOAT3))}}var xo=80;function pt(t){return 4+xo+4+4+4+(t.Translation?4+O(t.Translation,E.FLOAT3):0)+(t.Rotation?4+O(t.Rotation,E.FLOAT4):0)+(t.Scaling?4+O(t.Scaling,E.FLOAT3):0)}function Lu(t){return pt(t)+4+4}function yo(t){return t.Bones.length?8+be(t.Bones.map(Lu)):0}function Et(t,e){e.int32(pt(t)),e.str(t.Name,xo),e.int32(t.ObjectId!==null?t.ObjectId:Rt),e.int32(t.Parent!==null?t.Parent:Rt),e.int32(t.Flags),t.Translation&&(e.keyword("KGTR"),e.animVector(t.Translation,E.FLOAT3)),t.Rotation&&(e.keyword("KGRT"),e.animVector(t.Rotation,E.FLOAT4)),t.Scaling&&(e.keyword("KGSC"),e.animVector(t.Scaling,E.FLOAT3))}function Fu(t,e){if(t.Bones.length){e.keyword("BONE"),e.int32(yo(t)-8);for(let n of t.Bones)Et(n,e),e.int32(n.GeosetId!==null?n.GeosetId:Rt),e.int32(n.GeosetAnimId!==null?n.GeosetAnimId:Rt)}}function _o(t){return 4+pt(t)+4+4+4+12+4+12+4+(t.Visibility?4+O(t.Visibility,E.FLOAT1):0)+(t.Color&&!(t.Color instanceof Float32Array)?4+O(t.Color,E.FLOAT3):0)+(t.Intensity&&typeof t.Intensity!="number"?4+O(t.Intensity,E.FLOAT1):0)+(t.AttenuationStart&&typeof t.AttenuationStart!="number"?4+O(t.AttenuationStart,E.FLOAT1):0)+(t.AttenuationEnd&&typeof t.AttenuationEnd!="number"?4+O(t.AttenuationEnd,E.FLOAT1):0)+(t.AmbColor&&!(t.AmbColor instanceof Float32Array)?4+O(t.AmbColor,E.FLOAT3):0)+(t.AmbIntensity&&typeof t.AmbIntensity!="number"?4+O(t.AmbIntensity,E.FLOAT1):0)}function bo(t){return t.Lights.length?8+be(t.Lights.map(_o)):0}function Du(t,e){if(t.Lights.length){e.keyword("LITE"),e.int32(bo(t)-8);for(let n of t.Lights)e.int32(_o(n)),Et(n,e),e.int32(n.LightType),e.float32(typeof n.AttenuationStart=="number"?n.AttenuationStart:0),e.float32(typeof n.AttenuationEnd=="number"?n.AttenuationEnd:0),n.Color instanceof Float32Array?(e.float32(n.Color[0]),e.float32(n.Color[1]),e.float32(n.Color[2])):(e.float32(1),e.float32(1),e.float32(1)),e.float32(typeof n.Intensity=="number"?n.Intensity:0),n.AmbColor instanceof Float32Array?(e.float32(n.AmbColor[0]),e.float32(n.AmbColor[1]),e.float32(n.AmbColor[2])):(e.float32(1),e.float32(1),e.float32(1)),e.float32(typeof n.AmbIntensity=="number"?n.AmbIntensity:0),n.Intensity&&typeof n.Intensity!="number"&&(e.keyword("KLAI"),e.animVector(n.Intensity,E.FLOAT1)),n.Visibility&&(e.keyword("KLAV"),e.animVector(n.Visibility,E.FLOAT1)),n.Color&&!(n.Color instanceof Float32Array)&&(e.keyword("KLAC"),e.animVector(n.Color,E.FLOAT3)),n.AmbColor&&!(n.AmbColor instanceof Float32Array)&&(e.keyword("KLBC"),e.animVector(n.AmbColor,E.FLOAT3)),n.AmbIntensity&&typeof n.AmbIntensity!="number"&&(e.keyword("KLBI"),e.animVector(n.AmbIntensity,E.FLOAT1)),n.AttenuationStart&&typeof n.AttenuationStart!="number"&&(e.keyword("KLAS"),e.animVector(n.AttenuationStart,E.INT1)),n.AttenuationEnd&&typeof n.AttenuationEnd!="number"&&(e.keyword("KLAE"),e.animVector(n.AttenuationEnd,E.INT1))}}function So(t){return t.Helpers.length===0?0:8+be(t.Helpers.map(pt))}function Uu(t,e){if(t.Helpers.length!==0){e.keyword("HELP"),e.int32(So(t)-8);for(let n of t.Helpers)Et(n,e)}}var Mo=256;function To(t){return 4+pt(t)+Mo+4+4+(t.Visibility?4+O(t.Visibility,E.FLOAT1):0)}function Ao(t){return t.Attachments.length===0?0:8+be(t.Attachments.map(To))}function Nu(t,e){if(t.Attachments.length!==0){e.keyword("ATCH"),e.int32(Ao(t)-8);for(let n of t.Attachments)e.int32(To(n)),Et(n,e),e.str(n.Path||"",Mo),e.int32(0),e.int32(n.AttachmentID),n.Visibility&&(e.keyword("KATV"),e.animVector(n.Visibility,E.FLOAT1))}}function Bu(t){return t.PivotPoints.length?8+12*t.PivotPoints.length:0}function Ou(t,e){if(t.PivotPoints.length){e.keyword("PIVT"),e.int32(t.PivotPoints.length*4*3);for(let n of t.PivotPoints)e.float32Array(n)}}var Eo=256;function wo(t){return 4+pt(t)+4+4+4+4+Eo+4+4+4+(t.Visibility&&typeof t.Visibility!="number"?4+O(t.Visibility,E.FLOAT1):0)+(t.EmissionRate&&typeof t.EmissionRate!="number"?4+O(t.EmissionRate,E.FLOAT1):0)+(t.Gravity&&typeof t.Gravity!="number"?4+O(t.Gravity,E.FLOAT1):0)+(t.Longitude&&typeof t.Longitude!="number"?4+O(t.Longitude,E.FLOAT1):0)+(t.Latitude&&typeof t.Latitude!="number"?4+O(t.Latitude,E.FLOAT1):0)+(t.LifeSpan&&typeof t.LifeSpan!="number"?4+O(t.LifeSpan,E.FLOAT1):0)+(t.InitVelocity&&typeof t.InitVelocity!="number"?4+O(t.InitVelocity,E.FLOAT1):0)}function Po(t){return t.ParticleEmitters.length?8+be(t.ParticleEmitters.map(wo)):0}function Vu(t,e){if(t.ParticleEmitters.length){e.keyword("PREM"),e.int32(Po(t)-8);for(let n of t.ParticleEmitters)e.int32(wo(n)),Et(n,e),e.float32(typeof n.EmissionRate=="number"?n.EmissionRate:0),e.float32(typeof n.Gravity=="number"?n.Gravity:0),e.float32(typeof n.Longitude=="number"?n.Longitude:0),e.float32(typeof n.Latitude=="number"?n.Latitude:0),e.str(n.Path,Eo),e.int32(0),e.float32(typeof n.LifeSpan=="number"?n.LifeSpan:0),e.float32(typeof n.InitVelocity=="number"?n.InitVelocity:0),n.Visibility&&typeof n.Visibility!="number"&&(e.keyword("KPEV"),e.animVector(n.Visibility,E.FLOAT1)),n.EmissionRate&&typeof n.EmissionRate!="number"&&(e.keyword("KPEE"),e.animVector(n.EmissionRate,E.FLOAT1)),n.Gravity&&typeof n.Gravity!="number"&&(e.keyword("KPEG"),e.animVector(n.Gravity,E.FLOAT1)),n.Longitude&&typeof n.Longitude!="number"&&(e.keyword("KPLN"),e.animVector(n.Longitude,E.FLOAT1)),n.Latitude&&typeof n.Latitude!="number"&&(e.keyword("KPLT"),e.animVector(n.Latitude,E.FLOAT1)),n.LifeSpan&&typeof n.LifeSpan!="number"&&(e.keyword("KPEL"),e.animVector(n.LifeSpan,E.FLOAT1)),n.InitVelocity&&typeof n.InitVelocity!="number"&&(e.keyword("KPES"),e.animVector(n.InitVelocity,E.FLOAT1))}}function Co(t){return 4+pt(t)+4+4+4+4+4+4+4+4+4+4+4+4+4+4+36+3+12+12+12+12+12+4+4+4+4+(t.Visibility&&typeof t.Visibility!="number"?4+O(t.Visibility,E.FLOAT1):0)+(t.EmissionRate&&typeof t.EmissionRate!="number"?4+O(t.EmissionRate,E.FLOAT1):0)+(t.Width&&typeof t.Width!="number"?4+O(t.Width,E.FLOAT1):0)+(t.Length&&typeof t.Length!="number"?4+O(t.Length,E.FLOAT1):0)+(t.Speed&&typeof t.Speed!="number"?4+O(t.Speed,E.FLOAT1):0)+(t.Latitude&&typeof t.Latitude!="number"?4+O(t.Latitude,E.FLOAT1):0)+(t.Gravity&&typeof t.Gravity!="number"?4+O(t.Gravity,E.FLOAT1):0)+(t.Variation&&typeof t.Variation!="number"?4+O(t.Variation,E.FLOAT1):0)}function Io(t){return t.ParticleEmitters2.length?8+be(t.ParticleEmitters2.map(Co)):0}function Gu(t,e){if(t.ParticleEmitters2.length){e.keyword("PRE2"),e.int32(Io(t)-8);for(let n of t.ParticleEmitters2){e.int32(Co(n)),Et(n,e),e.float32(typeof n.Speed=="number"?n.Speed:0),e.float32(typeof n.Variation=="number"?n.Variation:0),e.float32(typeof n.Latitude=="number"?n.Latitude:0),e.float32(typeof n.Gravity=="number"?n.Gravity:0),e.float32(n.LifeSpan),e.float32(typeof n.EmissionRate=="number"?n.EmissionRate:0),e.float32(typeof n.Width=="number"?n.Width:0),e.float32(typeof n.Length=="number"?n.Length:0),e.int32(n.FilterMode),e.int32(n.Rows),e.int32(n.Columns),n.FrameFlags&nt.Head&&n.FrameFlags&nt.Tail?e.int32(2):n.FrameFlags&nt.Tail?e.int32(1):n.FrameFlags&nt.Head&&e.int32(0),e.float32(n.TailLength),e.float32(n.Time);for(let i=0;i<3;++i)for(let r=0;r<3;++r)e.float32(n.SegmentColor[i][r]);for(let i=0;i<3;++i)e.uint8(n.Alpha[i]);for(let i=0;i<3;++i)e.float32(n.ParticleScaling[i]);for(let i of["LifeSpanUVAnim","DecayUVAnim","TailUVAnim","TailDecayUVAnim"])for(let r=0;r<3;++r)e.int32(n[i][r]);e.int32(n.TextureID!==null?n.TextureID:Rt),e.int32(n.Squirt?1:0),e.int32(n.PriorityPlane),e.int32(n.ReplaceableId),n.Speed&&typeof n.Speed!="number"&&(e.keyword("KP2S"),e.animVector(n.Speed,E.FLOAT1)),n.Latitude&&typeof n.Latitude!="number"&&(e.keyword("KP2L"),e.animVector(n.Latitude,E.FLOAT1)),n.EmissionRate&&typeof n.EmissionRate!="number"&&(e.keyword("KP2E"),e.animVector(n.EmissionRate,E.FLOAT1)),n.Visibility&&typeof n.Visibility!="number"&&(e.keyword("KP2V"),e.animVector(n.Visibility,E.FLOAT1)),n.Length&&typeof n.Length!="number"&&(e.keyword("KP2N"),e.animVector(n.Length,E.FLOAT1)),n.Width&&typeof n.Width!="number"&&(e.keyword("KP2W"),e.animVector(n.Width,E.FLOAT1)),n.Gravity&&typeof n.Gravity!="number"&&(e.keyword("KP2G"),e.animVector(n.Gravity,E.FLOAT1)),n.Variation&&typeof n.Variation!="number"&&(e.keyword("KP2R"),e.animVector(n.Variation,E.FLOAT1))}}}function Ro(t){return 4+pt(t)+4+4+4+12+4+4+4+4+4+4+4+(t.Visibility?4+O(t.Visibility,E.FLOAT1):0)+(typeof t.HeightAbove!="number"?4+O(t.HeightAbove,E.FLOAT1):0)+(typeof t.HeightBelow!="number"?4+O(t.HeightBelow,E.FLOAT1):0)+(typeof t.Alpha!="number"?4+O(t.Alpha,E.FLOAT1):0)+(typeof t.TextureSlot!="number"?4+O(t.TextureSlot,E.FLOAT1):0)}function Lo(t){return t.RibbonEmitters.length?8+be(t.RibbonEmitters.map(Ro)):0}function ku(t,e){if(t.RibbonEmitters.length){e.keyword("RIBB"),e.int32(Lo(t)-8);for(let n of t.RibbonEmitters)e.int32(Ro(n)),Et(n,e),e.float32(typeof n.HeightAbove=="number"?n.HeightAbove:0),e.float32(typeof n.HeightBelow=="number"?n.HeightBelow:0),e.float32(typeof n.Alpha=="number"?n.Alpha:0),n.Color?e.float32Array(n.Color):(e.float32(1),e.float32(1),e.float32(1)),e.float32(n.LifeSpan),e.int32(typeof n.TextureSlot=="number"?n.TextureSlot:0),e.int32(n.EmissionRate),e.int32(n.Rows),e.int32(n.Columns),e.int32(n.MaterialID),e.float32(n.Gravity),n.Visibility&&(e.keyword("KRVS"),e.animVector(n.Visibility,E.FLOAT1)),typeof n.HeightAbove!="number"&&(e.keyword("KRHA"),e.animVector(n.HeightAbove,E.FLOAT1)),typeof n.HeightBelow!="number"&&(e.keyword("KRHB"),e.animVector(n.HeightBelow,E.FLOAT1)),typeof n.Alpha!="number"&&(e.keyword("KRAL"),e.animVector(n.Alpha,E.FLOAT1)),typeof n.TextureSlot!="number"&&(e.keyword("KRTX"),e.animVector(n.TextureSlot,E.INT1))}}var Fo=80;function Do(t){return 4+Fo+12+4+4+4+12+(t.Translation?4+O(t.Translation,E.FLOAT3):0)+(t.TargetTranslation?4+O(t.TargetTranslation,E.FLOAT3):0)+(t.Rotation?4+O(t.Rotation,E.FLOAT1):0)}function Uo(t){return t.Cameras.length?8+be(t.Cameras.map(Do)):0}function zu(t,e){if(t.Cameras.length){e.keyword("CAMS"),e.int32(Uo(t)-8);for(let n of t.Cameras)e.int32(Do(n)),e.str(n.Name,Fo),e.float32Array(n.Position),e.float32(n.FieldOfView),e.float32(n.FarClip),e.float32(n.NearClip),e.float32Array(n.TargetPosition),n.Translation&&(e.keyword("KCTR"),e.animVector(n.Translation,E.FLOAT3)),n.Rotation&&(e.keyword("KCRL"),e.animVector(n.Rotation,E.FLOAT1)),n.TargetTranslation&&(e.keyword("KTTR"),e.animVector(n.TargetTranslation,E.FLOAT3))}}function Hu(t){return pt(t)+4+4+4+4*t.EventTrack.length}function No(t){return t.EventObjects.length===0?0:8+be(t.EventObjects.map(Hu))}function Wu(t,e){if(t.EventObjects.length!==0){e.keyword("EVTS"),e.int32(No(t)-8);for(let n of t.EventObjects)Et(n,e),e.keyword("KEVT"),e.int32(n.EventTrack.length),e.int32(Rt),e.uint32Array(n.EventTrack)}}function Xu(t){return pt(t)+4+(t.Shape===It.Box?6:3)*4+(t.Shape===It.Sphere?4:0)}function Bo(t){return t.CollisionShapes.length===0?0:8+be(t.CollisionShapes.map(Xu))}function qu(t,e){if(t.CollisionShapes.length!==0){e.keyword("CLID"),e.int32(Bo(t)-8);for(let n of t.CollisionShapes)Et(n,e),e.int32(n.Shape),e.float32Array(n.Vertices),n.Shape===It.Sphere&&e.float32(n.BoundsRadius)}}function Oo(t){return t.Version<900||!t.FaceFX?0:8+340*t.FaceFX.length}function $u(t,e){if(!(t.Version<900||!t.FaceFX)){e.keyword("FAFX"),e.int32(Oo(t)-8);for(let n of t.FaceFX)e.str(n.Name,80),e.str(n.Path,260)}}function Yu(t){return 48*t.Matrices.length}function Vo(t){return t.Version<900||!t.BindPoses?0:12+be(t.BindPoses.map(Yu))}function Ku(t,e){if(t.Version<900||!t.BindPoses?.length)return;e.keyword("BPOS"),e.int32(Vo(t)-8);let n=t.BindPoses.reduce((i,r)=>i+r.Matrices.length,0);e.int32(n);for(let i of t.BindPoses)for(let r of i.Matrices)e.float32Array(r)}function Go(t){return 4+pt(t)+4+4+4+12+4+4+260+260+(t.Alpha&&typeof t.Alpha!="number"?4+O(t.Alpha,E.FLOAT1):0)+(t.Visibility&&typeof t.Visibility!="number"?4+O(t.Visibility,E.FLOAT1):0)+(t.EmissionRate&&typeof t.EmissionRate!="number"?4+O(t.EmissionRate,E.FLOAT1):0)+(t.Color&&!(t.Color instanceof Float32Array)?4+O(t.Color,E.FLOAT3):0)+(t.LifeSpan&&typeof t.LifeSpan!="number"?4+O(t.LifeSpan,E.FLOAT1):0)+(t.Speed&&typeof t.Speed!="number"?4+O(t.Speed,E.FLOAT1):0)}function ko(t){return t.Version<900||!t.ParticleEmitterPopcorns?.length?0:8+be(t.ParticleEmitterPopcorns.map(Go))}function ju(t,e){if(!(t.Version<900||!t.ParticleEmitterPopcorns?.length)){e.keyword("CORN"),e.int32(ko(t)-8);for(let n of t.ParticleEmitterPopcorns)e.int32(Go(n)),Et(n,e),e.float32(typeof n.LifeSpan=="number"?n.LifeSpan:0),e.float32(typeof n.EmissionRate=="number"?n.EmissionRate:1),e.float32(typeof n.Speed=="number"?n.Speed:0),n.Color instanceof Float32Array?(e.float32(n.Color[0]),e.float32(n.Color[1]),e.float32(n.Color[2])):(e.float32(1),e.float32(1),e.float32(1)),e.float32(typeof n.Alpha=="number"?n.Alpha:1),e.int32(typeof n.ReplaceableId=="number"?n.ReplaceableId:0),e.str(n.Path,260),e.str(n.AnimVisibilityGuide,260),n.Alpha&&typeof n.Alpha!="number"&&(e.keyword("KPPA"),e.animVector(n.Alpha,E.FLOAT1)),n.Color&&!(n.Color instanceof Float32Array)&&(e.keyword("KPPC"),e.animVector(n.Color,E.FLOAT3)),n.EmissionRate&&typeof n.EmissionRate!="number"&&(e.keyword("KPPE"),e.animVector(n.EmissionRate,E.FLOAT1)),n.LifeSpan&&typeof n.LifeSpan!="number"&&(e.keyword("KPPL"),e.animVector(n.LifeSpan,E.FLOAT1)),n.Speed&&typeof n.Speed!="number"&&(e.keyword("KPPS"),e.animVector(n.Speed,E.FLOAT1)),n.Visibility&&typeof n.Visibility!="number"&&(e.keyword("KPPV"),e.animVector(n.Visibility,E.FLOAT1))}}var Zu=[yu,io,so,Tu,lo,ho,fo,mo,vo,yo,bo,So,Ao,Bu,Po,Io,ko,Lo,Uo,No,Bo,Oo,Vo],Ju=[_u,bu,Mu,Au,Eu,Pu,Cu,Iu,Ru,Fu,Du,Uu,Nu,Ou,Vu,Gu,ju,ku,zu,Wu,qu,$u,Ku];function zo(t){let e=4;for(let r of Zu)e+=r(t);let n=new ArrayBuffer(e),i=new vu(n);i.keyword("MDLX");for(let r of Ju)r(t,i);return n}var Ng=(function(){"use strict";var e=new Int32Array([0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63]),n=4017,i=799,r=3406,s=2276,o=1567,a=3784,c=5793,h=2896;function l(){}function d(g,y){for(var v=0,_=[],M,b,T=16;T>0&&!g[T-1];)T--;_.push({children:[],index:0});var A=_[0],S;for(M=0;M<T;M++){for(b=0;b<g[M];b++){for(A=_.pop(),A.children[A.index]=y[v];A.index>0;)A=_.pop();for(A.index++,_.push(A);_.length<=M;)_.push(S={children:[],index:0}),A.children[A.index]=S.children,A=S;v++}M+1<T&&(_.push(S={children:[],index:0}),A.children[A.index]=S.children,A=S)}return _[0].children}function u(g,y,v){return 64*((g.blocksPerLine+1)*y+v)}function f(g,y,v,_,M,b,T,A,S){v.precision,v.samplesPerLine,v.scanLines;var D=v.mcusPerLine,R=v.progressive;v.maxH,v.maxV;var L=y,P=0,U=0;function w(){if(U>0)return U--,P>>U&1;if(P=g[y++],P==255){var k=g[y++];if(k)throw"unexpected marker: "+(P<<8|k).toString(16)}return U=7,P>>>7}function C(k){for(var K=k,te;(te=w())!==null;){if(K=K[te],typeof K=="number")return K;if(typeof K!="object")throw"invalid huffman sequence"}return null}function G(k){for(var K=0;k>0;){var te=w();if(te===null)return;K=K<<1|te,k--}return K}function N(k){var K=G(k);return K>=1<<k-1?K:K+(-1<<k)+1}function ee(k,K){var te=C(k.huffmanTableDC),se=te===0?0:N(te);k.blockData[K]=k.pred+=se;for(var ae=1;ae<64;){var Te=C(k.huffmanTableAC),Ue=Te&15,St=Te>>4;if(Ue===0){if(St<15)break;ae+=16;continue}ae+=St;var vr=e[ae];k.blockData[K+vr]=N(Ue),ae++}}function xe(k,K){var te=C(k.huffmanTableDC),se=te===0?0:N(te)<<S;k.blockData[K]=k.pred+=se}function ie(k,K){k.blockData[K]|=w()<<S}var fe=0;function me(k,K){if(fe>0){fe--;return}for(var te=b,se=T;te<=se;){var ae=C(k.huffmanTableAC),Te=ae&15,Ue=ae>>4;if(Te===0){if(Ue<15){fe=G(Ue)+(1<<Ue)-1;break}te+=16;continue}te+=Ue;var St=e[te];k.blockData[K+St]=N(Te)*(1<<S),te++}}var re=0,J;function Me(k,K){for(var te=b,se=T,ae=0;te<=se;){var Te=e[te];switch(re){case 0:var Ue=C(k.huffmanTableAC),St=Ue&15,ae=Ue>>4;if(St===0)ae<15?(fe=G(ae)+(1<<ae),re=4):(ae=16,re=1);else{if(St!==1)throw"invalid ACn encoding";J=N(St),re=ae?2:3}continue;case 1:case 2:k.blockData[K+Te]?k.blockData[K+Te]+=w()<<S:(ae--,ae===0&&(re=re==2?3:0));break;case 3:k.blockData[K+Te]?k.blockData[K+Te]+=w()<<S:(k.blockData[K+Te]=J<<S,re=0);break;case 4:k.blockData[K+Te]&&(k.blockData[K+Te]+=w()<<S);break}te++}re===4&&(fe--,fe===0&&(re=0))}function Ke(k,K,te,se,ae){var Te=te/D|0,Ue=te%D;K(k,u(k,Te*k.v+se,Ue*k.h+ae))}function ze(k,K,te){K(k,u(k,te/k.blocksPerLine|0,te%k.blocksPerLine))}var je=_.length,Fe,Ce,et,De,tt,ln;R?b===0?ln=A===0?xe:ie:ln=A===0?me:Me:ln=ee;var kt=0,de,Sn;je==1?Sn=_[0].blocksPerLine*_[0].blocksPerColumn:Sn=D*v.mcusPerColumn,M||(M=Sn);for(var Kn,yi;kt<Sn;){for(Ce=0;Ce<je;Ce++)_[Ce].pred=0;if(fe=0,je==1)for(Fe=_[0],tt=0;tt<M;tt++)ze(Fe,ln,kt),kt++;else for(tt=0;tt<M;tt++){for(Ce=0;Ce<je;Ce++)for(Fe=_[Ce],Kn=Fe.h,yi=Fe.v,et=0;et<yi;et++)for(De=0;De<Kn;De++)Ke(Fe,ln,kt,et,De);kt++}if(U=0,de=g[y]<<8|g[y+1],de<=65280)throw"marker was not found";if(de>=65488&&de<=65495)y+=2;else break}return y-L}function p(g,y,v){var _=g.quantizationTable,M,b,T,A,S,D,R,L,P,U;for(U=0;U<64;U++)v[U]=g.blockData[y+U]*_[U];for(U=0;U<8;++U){var w=8*U;if(v[1+w]==0&&v[2+w]==0&&v[3+w]==0&&v[4+w]==0&&v[5+w]==0&&v[6+w]==0&&v[7+w]==0){P=c*v[0+w]+512>>10,v[0+w]=P,v[1+w]=P,v[2+w]=P,v[3+w]=P,v[4+w]=P,v[5+w]=P,v[6+w]=P,v[7+w]=P;continue}M=c*v[0+w]+128>>8,b=c*v[4+w]+128>>8,T=v[2+w],A=v[6+w],S=h*(v[1+w]-v[7+w])+128>>8,L=h*(v[1+w]+v[7+w])+128>>8,D=v[3+w]<<4,R=v[5+w]<<4,P=M-b+1>>1,M=M+b+1>>1,b=P,P=T*a+A*o+128>>8,T=T*o-A*a+128>>8,A=P,P=S-R+1>>1,S=S+R+1>>1,R=P,P=L+D+1>>1,D=L-D+1>>1,L=P,P=M-A+1>>1,M=M+A+1>>1,A=P,P=b-T+1>>1,b=b+T+1>>1,T=P,P=S*s+L*r+2048>>12,S=S*r-L*s+2048>>12,L=P,P=D*i+R*n+2048>>12,D=D*n-R*i+2048>>12,R=P,v[0+w]=M+L,v[7+w]=M-L,v[1+w]=b+R,v[6+w]=b-R,v[2+w]=T+D,v[5+w]=T-D,v[3+w]=A+S,v[4+w]=A-S}for(U=0;U<8;++U){var C=U;if(v[8+C]==0&&v[16+C]==0&&v[24+C]==0&&v[32+C]==0&&v[40+C]==0&&v[48+C]==0&&v[56+C]==0){P=c*v[U+0]+8192>>14,v[0+C]=P,v[8+C]=P,v[16+C]=P,v[24+C]=P,v[32+C]=P,v[40+C]=P,v[48+C]=P,v[56+C]=P;continue}M=c*v[0+C]+2048>>12,b=c*v[32+C]+2048>>12,T=v[16+C],A=v[48+C],S=h*(v[8+C]-v[56+C])+2048>>12,L=h*(v[8+C]+v[56+C])+2048>>12,D=v[24+C],R=v[40+C],P=M-b+1>>1,M=M+b+1>>1,b=P,P=T*a+A*o+2048>>12,T=T*o-A*a+2048>>12,A=P,P=S-R+1>>1,S=S+R+1>>1,R=P,P=L+D+1>>1,D=L-D+1>>1,L=P,P=M-A+1>>1,M=M+A+1>>1,A=P,P=b-T+1>>1,b=b+T+1>>1,T=P,P=S*s+L*r+2048>>12,S=S*r-L*s+2048>>12,L=P,P=D*i+R*n+2048>>12,D=D*n-R*i+2048>>12,R=P,v[0+C]=M+L,v[56+C]=M-L,v[8+C]=b+R,v[48+C]=b-R,v[16+C]=T+D,v[40+C]=T-D,v[24+C]=A+S,v[32+C]=A-S}for(U=0;U<64;++U){var G=y+U,N=v[U];N=N<=-2056?0:N>=2024?255:N+2056>>4,g.blockData[G]=N}}function m(g,y){var v=y.blocksPerLine,_=y.blocksPerColumn;v<<3;for(var M=new Int32Array(64),b=0;b<_;b++)for(var T=0;T<v;T++)p(y,u(y,b,T),M);return y.blockData}function x(g){return g<=0?0:g>=255?255:g|0}return l.prototype={load:function(y){var v=new XMLHttpRequest;v.open("GET",y,!0),v.responseType="arraybuffer",v.onload=(function(){var _=new Uint8Array(v.response||v.mozResponseArrayBuffer);this.parse(_),this.onload&&this.onload()}).bind(this),v.send(null)},loadFromBuffer:function(y){this.parse(y),this.onload&&this.onload()},parse:function(y){function v(){var se=y[b]<<8|y[b+1];return b+=2,se}function _(){var se=v(),ae=y.subarray(b,b+se-2);return b+=ae.length,ae}function M(se){for(var ae=Math.ceil(se.samplesPerLine/8/se.maxH),Te=Math.ceil(se.scanLines/8/se.maxV),Ue=0;Ue<se.components.length;Ue++){de=se.components[Ue];var St=Math.ceil(Math.ceil(se.samplesPerLine/8)*de.h/se.maxH),vr=Math.ceil(Math.ceil(se.scanLines/8)*de.v/se.maxV),Xl=ae*de.h,ql=64*(Te*de.v)*(Xl+1);de.blockData=new Int16Array(ql),de.blocksPerLine=St,de.blocksPerColumn=vr}se.mcusPerLine=ae,se.mcusPerColumn=Te}var b=0;y.length;var T=null,A=null,S,D,R=[],L=[],P=[],U=v();if(U!=65496)throw"SOI not found";for(U=v();U!=65497;){var w,C,G;switch(U){case 65504:case 65505:case 65506:case 65507:case 65508:case 65509:case 65510:case 65511:case 65512:case 65513:case 65514:case 65515:case 65516:case 65517:case 65518:case 65519:case 65534:var N=_();U===65504&&N[0]===74&&N[1]===70&&N[2]===73&&N[3]===70&&N[4]===0&&(T={version:{major:N[5],minor:N[6]},densityUnits:N[7],xDensity:N[8]<<8|N[9],yDensity:N[10]<<8|N[11],thumbWidth:N[12],thumbHeight:N[13],thumbData:N.subarray(14,14+3*N[12]*N[13])}),U===65518&&N[0]===65&&N[1]===100&&N[2]===111&&N[3]===98&&N[4]===101&&N[5]===0&&(A={version:N[6],flags0:N[7]<<8|N[8],flags1:N[9]<<8|N[10],transformCode:N[11]});break;case 65499:for(var ee=v()+b-2;b<ee;){var xe=y[b++],ie=new Int32Array(64);if(xe>>4===0)for(C=0;C<64;C++){var fe=e[C];ie[fe]=y[b++]}else if(xe>>4===1)for(C=0;C<64;C++){var fe=e[C];ie[fe]=v()}else throw"DQT: invalid table spec";R[xe&15]=ie}break;case 65472:case 65473:case 65474:if(S)throw"Only single frame JPEGs supported";v(),S={},S.extended=U===65473,S.progressive=U===65474,S.precision=y[b++],S.scanLines=v(),S.samplesPerLine=v(),S.components=[],S.componentIds={};var me=y[b++],re,J=0,Me=0;for(w=0;w<me;w++){re=y[b];var Ke=y[b+1]>>4,ze=y[b+1]&15;J<Ke&&(J=Ke),Me<ze&&(Me=ze);var je=y[b+2],G=S.components.push({h:Ke,v:ze,quantizationTable:R[je]});S.componentIds[re]=G-1,b+=3}S.maxH=J,S.maxV=Me,M(S);break;case 65476:var Fe=v();for(w=2;w<Fe;){var Ce=y[b++],et=new Uint8Array(16),De=0;for(C=0;C<16;C++,b++)De+=et[C]=y[b];var tt=new Uint8Array(De);for(C=0;C<De;C++,b++)tt[C]=y[b];w+=17+De,(Ce>>4===0?P:L)[Ce&15]=d(et,tt)}break;case 65501:v(),D=v();break;case 65498:v();var ln=y[b++],kt=[],de;for(w=0;w<ln;w++){var Sn=S.componentIds[y[b++]];de=S.components[Sn];var Kn=y[b++];de.huffmanTableDC=P[Kn>>4],de.huffmanTableAC=L[Kn&15],kt.push(de)}var yi=y[b++],k=y[b++],K=y[b++],te=f(y,b,S,kt,D,yi,k,K>>4,K&15);b+=te;break;default:if(y[b-3]==255&&y[b-2]>=192&&y[b-2]<=254){b-=3;break}throw"unknown JPEG marker "+U.toString(16)}U=v()}this.width=S.samplesPerLine,this.height=S.scanLines,this.jfif=T,this.adobe=A,this.components=[];for(var w=0;w<S.components.length;w++){var de=S.components[w];this.components.push({output:m(S,de),scaleX:de.h/S.maxH,scaleY:de.v/S.maxV,blocksPerLine:de.blocksPerLine,blocksPerColumn:de.blocksPerColumn})}},getData:function(y,v,_){var M=this.width/v,b=this.height/_,T,A,S,D,R,L,P=0,U=this.components.length;v*_*U;var w=y.data,C=new Uint8Array((this.components[0].blocksPerLine<<3)*this.components[0].blocksPerColumn*8);for(L=0;L<U;L++){T=this.components[L<3?2-L:L];for(var G=T.blocksPerLine,N=T.blocksPerColumn,ee=G<<3,xe,ie,fe=0,me=0;me<N;me++)for(var re=me<<3,J=0;J<G;J++){var Me=u(T,me,J),P=0,Ke=J<<3;for(xe=0;xe<8;xe++){var fe=(re+xe)*ee;for(ie=0;ie<8;ie++)C[fe+Ke+ie]=T.output[Me+P++]}}A=T.scaleX*M,S=T.scaleY*b,P=L;var ze,je,Fe;for(R=0;R<_;R++)for(D=0;D<v;D++)je=0|R*S,ze=0|D*A,Fe=je*ee+ze,w[P]=C[Fe],P+=U}return w},copyToImageData:function(y){var v=y.width,_=y.height,M=v*_*4,b=y.data,T=this.getData(v,_),A=0,S=0,D,R,L,P,U,w,C,G,N;switch(this.components.length){case 1:for(;S<M;)L=T[A++],b[S++]=L,b[S++]=L,b[S++]=L,b[S++]=255;break;case 3:for(;S<M;)C=T[A++],G=T[A++],N=T[A++],b[S++]=C,b[S++]=G,b[S++]=N,b[S++]=255;break;case 4:for(;S<M;)U=T[A++],w=T[A++],L=T[A++],P=T[A++],D=255-P,R=D/255,C=x(D-U*R),G=x(D-w*R),N=x(D-L*R),b[S++]=C,b[S++]=G,b[S++]=N,b[S++]=255;break;default:throw"Unsupported color mode"}}},l})();var ct=typeof Float32Array<"u"?Float32Array:Array;Math.PI/180;Math.hypot||(Math.hypot=function(){for(var t=0,e=arguments.length;e--;)t+=arguments[e]*arguments[e];return Math.sqrt(t)});function Pr(){var t=new ct(9);return ct!=Float32Array&&(t[1]=0,t[2]=0,t[3]=0,t[5]=0,t[6]=0,t[7]=0),t[0]=1,t[4]=1,t[8]=1,t}function Pi(){var t=new ct(16);return ct!=Float32Array&&(t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0),t[0]=1,t[5]=1,t[10]=1,t[15]=1,t}function Xe(){var t=new ct(3);return ct!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t}function Qu(t){var e=t[0],n=t[1],i=t[2];return Math.hypot(e,n,i)}function Qn(t,e,n){var i=new ct(3);return i[0]=t,i[1]=e,i[2]=n,i}function ef(t,e){var n=e[0],i=e[1],r=e[2],s=n*n+i*i+r*r;return s>0&&(s=1/Math.sqrt(s)),t[0]=e[0]*s,t[1]=e[1]*s,t[2]=e[2]*s,t}function tf(t,e){return t[0]*e[0]+t[1]*e[1]+t[2]*e[2]}function br(t,e,n){var i=e[0],r=e[1],s=e[2],o=n[0],a=n[1],c=n[2];return t[0]=r*c-s*a,t[1]=s*o-i*c,t[2]=i*a-r*o,t}var nf=Qu;(function(){var t=Xe();return function(e,n,i,r,s,o){var a,c;for(n||(n=3),i||(i=0),r?c=Math.min(r*n+i,e.length):c=e.length,a=i;a<c;a+=n)t[0]=e[a],t[1]=e[a+1],t[2]=e[a+2],s(t,t,o),e[a]=t[0],e[a+1]=t[1],e[a+2]=t[2];return e}})();function Ci(){var t=new ct(4);return ct!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0,t[3]=0),t}function rf(t,e,n,i){var r=new ct(4);return r[0]=t,r[1]=e,r[2]=n,r[3]=i,r}function sf(t,e){var n=e[0],i=e[1],r=e[2],s=e[3],o=n*n+i*i+r*r+s*s;return o>0&&(o=1/Math.sqrt(o)),t[0]=n*o,t[1]=i*o,t[2]=r*o,t[3]=s*o,t}(function(){var t=Ci();return function(e,n,i,r,s,o){var a,c;for(n||(n=4),i||(i=0),r?c=Math.min(r*n+i,e.length):c=e.length,a=i;a<c;a+=n)t[0]=e[a],t[1]=e[a+1],t[2]=e[a+2],t[3]=e[a+3],s(t,t,o),e[a]=t[0],e[a+1]=t[1],e[a+2]=t[2],e[a+3]=t[3];return e}})();function ei(){var t=new ct(4);return ct!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t[3]=1,t}function of(t,e,n){n=n*.5;var i=Math.sin(n);return t[0]=i*e[0],t[1]=i*e[1],t[2]=i*e[2],t[3]=Math.cos(n),t}function Sr(t,e,n,i){var r=e[0],s=e[1],o=e[2],a=e[3],c=n[0],h=n[1],l=n[2],d=n[3],u,f=r*c+s*h+o*l+a*d,p,m,x;return f<0&&(f=-f,c=-c,h=-h,l=-l,d=-d),1-f>1e-6?(u=Math.acos(f),p=Math.sin(u),m=Math.sin((1-i)*u)/p,x=Math.sin(i*u)/p):(m=1-i,x=i),t[0]=m*r+x*c,t[1]=m*s+x*h,t[2]=m*o+x*l,t[3]=m*a+x*d,t}function af(t,e){var n=e[0]+e[4]+e[8],i;if(n>0)i=Math.sqrt(n+1),t[3]=.5*i,i=.5/i,t[0]=(e[5]-e[7])*i,t[1]=(e[6]-e[2])*i,t[2]=(e[1]-e[3])*i;else{var r=0;e[4]>e[0]&&(r=1),e[8]>e[r*3+r]&&(r=2);var s=(r+1)%3,o=(r+2)%3;i=Math.sqrt(e[r*3+r]-e[s*3+s]-e[o*3+o]+1),t[r]=.5*i,i=.5/i,t[3]=(e[s*3+o]-e[o*3+s])*i,t[s]=(e[s*3+r]+e[r*3+s])*i,t[o]=(e[o*3+r]+e[r*3+o])*i}return t}var lf=rf;var Ho=sf,Bg=(function(){var t=Xe(),e=Qn(1,0,0),n=Qn(0,1,0);return function(i,r,s){var o=tf(r,s);return o<-.999999?(br(t,e,r),nf(t)<1e-6&&br(t,n,r),ef(t,t),of(i,t,Math.PI),i):o>.999999?(i[0]=0,i[1]=0,i[2]=0,i[3]=1,i):(br(t,r,s),i[0]=t[0],i[1]=t[1],i[2]=t[2],i[3]=1+o,Ho(i,i))}})(),Og=(function(){var t=ei(),e=ei();return function(n,i,r,s,o,a){return Sr(t,i,o,a),Sr(e,r,s,a),Sr(n,t,e,2*a*(1-a)),n}})();(function(){var t=Pr();return function(e,n,i,r){return t[0]=i[0],t[3]=i[1],t[6]=i[2],t[1]=r[0],t[4]=r[1],t[7]=r[2],t[2]=-n[0],t[5]=-n[1],t[8]=-n[2],Ho(e,af(e,t))}})();var Vg=Qn(0,0,0),Gg=Ci(),kg=Ci(),zg=Ci(),Hg=Xe(),Wg=Xe();var cf=`attribute vec3 aVertexPosition;
attribute vec3 aNormal;
attribute vec2 aTextureCoord;
attribute vec4 aGroup;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNodesMatrices[\${MAX_NODES}];

varying vec3 vNormal;
varying vec2 vTextureCoord;

void main(void) {
    vec4 position = vec4(aVertexPosition, 1.0);
    int count = 1;
    vec4 sum = uNodesMatrices[int(aGroup[0])] * position;

    if (aGroup[1] < \${MAX_NODES}.) {
        sum += uNodesMatrices[int(aGroup[1])] * position;
        count += 1;
    }
    if (aGroup[2] < \${MAX_NODES}.) {
        sum += uNodesMatrices[int(aGroup[2])] * position;
        count += 1;
    }
    if (aGroup[3] < \${MAX_NODES}.) {
        sum += uNodesMatrices[int(aGroup[3])] * position;
        count += 1;
    }
    sum.xyz /= float(count);
    sum.w = 1.;
    position = sum;

    gl_Position = uPMatrix * uMVMatrix * position;
    vTextureCoord = aTextureCoord;
    vNormal = aNormal;
}`;var hf=`attribute vec3 aVertexPosition;
attribute vec3 aNormal;
attribute vec2 aTextureCoord;
attribute vec4 aSkin;
attribute vec4 aBoneWeight;
attribute vec4 aTangent;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNodesMatrices[\${MAX_NODES}];

varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBinormal;
varying vec2 vTextureCoord;
varying mat3 vTBN;
varying vec3 vFragPos;

void main(void) {
    vec4 position = vec4(aVertexPosition, 1.0);
    mat4 sum;

    // sum += uNodesMatrices[int(aSkin[0])] * 1.;
    sum += uNodesMatrices[int(aSkin[0])] * aBoneWeight[0];
    sum += uNodesMatrices[int(aSkin[1])] * aBoneWeight[1];
    sum += uNodesMatrices[int(aSkin[2])] * aBoneWeight[2];
    sum += uNodesMatrices[int(aSkin[3])] * aBoneWeight[3];

    mat3 rotation = mat3(sum);

    position = sum * position;
    position.w = 1.;

    gl_Position = uPMatrix * uMVMatrix * position;
    vTextureCoord = aTextureCoord;

    vec3 normal = aNormal;
    vec3 tangent = aTangent.xyz;

    // https://learnopengl.com/Advanced-Lighting/Normal-Mapping
    tangent = normalize(tangent - dot(tangent, normal) * normal);

    vec3 binormal = cross(normal, tangent) * aTangent.w;

    normal = normalize(rotation * normal);
    tangent = normalize(rotation * tangent);
    binormal = normalize(rotation * binormal);

    vNormal = normal;
    vTangent = tangent;
    vBinormal = binormal;

    vTBN = mat3(tangent, binormal, normal);

    vFragPos = position.xyz;
}`,uf=`#version 300 es
in vec3 aVertexPosition;
in vec3 aNormal;
in vec2 aTextureCoord;
in vec4 aSkin;
in vec4 aBoneWeight;
in vec4 aTangent;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNodesMatrices[\${MAX_NODES}];

out vec3 vNormal;
out vec3 vTangent;
out vec3 vBinormal;
out vec2 vTextureCoord;
out mat3 vTBN;
out vec3 vFragPos;

void main(void) {
    vec4 position = vec4(aVertexPosition, 1.0);
    mat4 sum;

    // sum += uNodesMatrices[int(aSkin[0])] * 1.;
    sum += uNodesMatrices[int(aSkin[0])] * aBoneWeight[0];
    sum += uNodesMatrices[int(aSkin[1])] * aBoneWeight[1];
    sum += uNodesMatrices[int(aSkin[2])] * aBoneWeight[2];
    sum += uNodesMatrices[int(aSkin[3])] * aBoneWeight[3];

    mat3 rotation = mat3(sum);

    position = sum * position;
    position.w = 1.;

    gl_Position = uPMatrix * uMVMatrix * position;
    vTextureCoord = aTextureCoord;

    vec3 normal = aNormal;
    vec3 tangent = aTangent.xyz;

    // https://learnopengl.com/Advanced-Lighting/Normal-Mapping
    tangent = normalize(tangent - dot(tangent, normal) * normal);

    vec3 binormal = cross(normal, tangent) * aTangent.w;

    normal = normalize(rotation * normal);
    tangent = normalize(rotation * tangent);
    binormal = normalize(rotation * binormal);

    vNormal = normal;
    vTangent = tangent;
    vBinormal = binormal;

    vTBN = mat3(tangent, binormal, normal);

    vFragPos = position.xyz;
}`;var ff=`#version 300 es
precision mediump float;

in vec2 vTextureCoord;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vBinormal;
in mat3 vTBN;
in vec3 vFragPos;

out vec4 FragColor;

uniform sampler2D uSampler;
uniform sampler2D uNormalSampler;
uniform sampler2D uOrmSampler;
uniform vec3 uReplaceableColor;
uniform float uDiscardAlphaLevel;
uniform mat3 uTVertexAnim;
uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform vec3 uCameraPos;
uniform vec3 uShadowParams;
uniform sampler2D uShadowMapSampler;
uniform mat4 uShadowMapLightMatrix;
uniform bool uHasEnv;
uniform samplerCube uIrradianceMap;
uniform samplerCube uPrefilteredEnv;
uniform sampler2D uBRDFLUT;
uniform float uWireframe;

const float PI = 3.14159265359;
const float gamma = 2.2;
const float MAX_REFLECTION_LOD = \${MAX_ENV_MIP_LEVELS};

float distributionGGX(vec3 normal, vec3 halfWay, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float nDotH = max(dot(normal, halfWay), 0.0);
    float nDotH2 = nDotH * nDotH;

    float num = a2;
    float denom = (nDotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return num / denom;
}

float geometrySchlickGGX(float nDotV, float roughness) {
    float r = roughness + 1.;
    float k = r * r / 8.;
    // float k = roughness * roughness / 2.;

    float num = nDotV;
    float denom = nDotV * (1. - k) + k;

    return num / denom;
}

float geometrySmith(vec3 normal, vec3 viewDir, vec3 lightDir, float roughness) {
    float nDotV = max(dot(normal, viewDir), .0);
    float nDotL = max(dot(normal, lightDir), .0);
    float ggx2  = geometrySchlickGGX(nDotV, roughness);
    float ggx1  = geometrySchlickGGX(nDotL, roughness);

    return ggx1 * ggx2;
}

vec3 fresnelSchlick(float lightFactor, vec3 f0) {
    return f0 + (1. - f0) * pow(clamp(1. - lightFactor, 0., 1.), 5.);
}

vec3 fresnelSchlickRoughness(float lightFactor, vec3 f0, float roughness) {
    return f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow(clamp(1.0 - lightFactor, 0.0, 1.0), 5.0);
}

void main(void) {
    if (uWireframe > 0.) {
        FragColor = vec4(1.);
        return;
    }

    vec2 texCoord = (uTVertexAnim * vec3(vTextureCoord.s, vTextureCoord.t, 1.)).st;

    vec4 orm = texture(uOrmSampler, texCoord);

    float occlusion = orm.r;
    float roughness = orm.g;
    float metallic = orm.b;
    float teamColorFactor = orm.a;

    vec4 baseColor = texture(uSampler, texCoord);
    vec3 teamColor = baseColor.rgb * uReplaceableColor;
    baseColor.rgb = mix(baseColor.rgb, teamColor, teamColorFactor);
    baseColor.rgb = pow(baseColor.rgb, vec3(gamma));

    vec3 normal = texture(uNormalSampler, texCoord).rgb;
    normal = normal * 2.0 - 1.0;
    normal.x = -normal.x;
    normal.y = -normal.y;
    if (!gl_FrontFacing) {
        normal = -normal;
    }
    normal = normalize(vTBN * -normal);

    vec3 viewDir = normalize(uCameraPos - vFragPos);
    vec3 reflected = reflect(-viewDir, normal);

    vec3 lightDir = normalize(uLightPos - vFragPos);
    float lightFactor = max(dot(normal, lightDir), .0);
    vec3 radiance = uLightColor;

    vec3 f0 = vec3(.04);
    f0 = mix(f0, baseColor.rgb, metallic);

    vec3 totalLight = vec3(0.);
    vec3 halfWay = normalize(viewDir + lightDir);
    float ndf = distributionGGX(normal, halfWay, roughness);
    float g = geometrySmith(normal, viewDir, lightDir, roughness);
    vec3 f = fresnelSchlick(max(dot(halfWay, viewDir), 0.), f0);

    vec3 kS = f;
    vec3 kD = vec3(1.);// - kS;
    if (uHasEnv) {
        kD *= 1.0 - metallic;
    }
    vec3 num = ndf * g * f;
    float denom = 4. * max(dot(normal, viewDir), 0.) * max(dot(normal, lightDir), 0.) + .0001;
    vec3 specular = num / denom;

    totalLight = (kD * baseColor.rgb / PI + specular) * radiance * lightFactor;

    if (uShadowParams[0] > .5) {
        float shadowBias = uShadowParams[1];
        float shadowStep = uShadowParams[2];
        vec4 fragInLightPos = uShadowMapLightMatrix * vec4(vFragPos, 1.);
        vec3 shadowMapCoord = fragInLightPos.xyz / fragInLightPos.w;
        shadowMapCoord.xyz = (shadowMapCoord.xyz + 1.0) * .5;

        int passes = 5;
        float step = 1. / float(passes);

        float lightDepth = texture(uShadowMapSampler, shadowMapCoord.xy).r;
        float lightDepth0 = texture(uShadowMapSampler, vec2(shadowMapCoord.x + shadowStep, shadowMapCoord.y)).r;
        float lightDepth1 = texture(uShadowMapSampler, vec2(shadowMapCoord.x, shadowMapCoord.y + shadowStep)).r;
        float lightDepth2 = texture(uShadowMapSampler, vec2(shadowMapCoord.x, shadowMapCoord.y - shadowStep)).r;
        float lightDepth3 = texture(uShadowMapSampler, vec2(shadowMapCoord.x - shadowStep, shadowMapCoord.y)).r;
        float currentDepth = shadowMapCoord.z;

        float visibility = 0.;
        if (lightDepth > currentDepth - shadowBias) {
            visibility += step;
        }
        if (lightDepth0 > currentDepth - shadowBias) {
            visibility += step;
        }
        if (lightDepth1 > currentDepth - shadowBias) {
            visibility += step;
        }
        if (lightDepth2 > currentDepth - shadowBias) {
            visibility += step;
        }
        if (lightDepth3 > currentDepth - shadowBias) {
            visibility += step;
        }

        totalLight *= visibility;
    }

    vec3 color;

    if (uHasEnv) {
        vec3 f = fresnelSchlickRoughness(max(dot(normal, viewDir), 0.0), f0, roughness);
        vec3 kS = f;
        vec3 kD = vec3(1.0) - kS;
        kD *= 1.0 - metallic;

        vec3 diffuse = texture(uIrradianceMap, normal).rgb * baseColor.rgb;
        vec3 prefilteredColor = textureLod(uPrefilteredEnv, reflected, roughness * MAX_REFLECTION_LOD).rgb;
        vec2 envBRDF = texture(uBRDFLUT, vec2(max(dot(normal, viewDir), 0.0), roughness)).rg;
        specular = prefilteredColor * (f * envBRDF.x + envBRDF.y);

        vec3 ambient = (kD * diffuse + specular) * occlusion;
        color = ambient + totalLight;
    } else {
        vec3 ambient = vec3(.03);
        ambient *= baseColor.rgb * occlusion;
        color = ambient + totalLight;
    }

    color = color / (vec3(1.) + color);
    color = pow(color, vec3(1. / gamma));

    FragColor = vec4(color, baseColor.a);

    // hand-made alpha-test
    if (FragColor[3] < uDiscardAlphaLevel) {
        discard;
    }
}
`;var df=`struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
    nodesMatrices: array<mat4x4f, \${MAX_NODES}>,
}

struct FSUniforms {
    replaceableColor: vec3f,
    replaceableType: u32,
    discardAlphaLevel: f32,
    wireframe: u32,
    tVertexAnim: mat3x3f,
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
@group(1) @binding(0) var<uniform> fsUniforms: FSUniforms;
@group(1) @binding(1) var fsUniformSampler: sampler;
@group(1) @binding(2) var fsUniformTexture: texture_2d<f32>;

struct VSIn {
    @location(0) vertexPosition: vec3f,
    @location(1) normal: vec3f,
    @location(2) textureCoord: vec2f,
    @location(3) group: vec4<u32>,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) textureCoord: vec2f,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var position: vec4f = vec4f(in.vertexPosition, 1.0);
    var count: i32 = 1;
    var sum: vec4f = vsUniforms.nodesMatrices[in.group[0]] * position;

    if (in.group[1] < \${MAX_NODES}) {
        sum += vsUniforms.nodesMatrices[in.group[1]] * position;
        count += 1;
    }
    if (in.group[2] < \${MAX_NODES}) {
        sum += vsUniforms.nodesMatrices[in.group[2]] * position;
        count += 1;
    }
    if (in.group[3] < \${MAX_NODES}) {
        sum += vsUniforms.nodesMatrices[in.group[3]] * position;
        count += 1;
    }
    sum /= f32(count);
    sum.w = 1.;
    position = sum;

    var out: VSOut;
    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * position;
    out.textureCoord = in.textureCoord;
    out.normal = in.normal;
    return out;
}

fn hypot(z: vec2f) -> f32 {
    var t: f32 = 0;
    var x: f32 = abs(z.x);
    let y: f32 = abs(z.y);
    t = min(x, y);
    x = max(x, y);
    t = t / x;
    if (z.x == 0.0 && z.y == 0.0) {
        return 0.0;
    }
    return x * sqrt(1.0 + t * t);
}

@fragment fn fs(
    in: VSOut
) -> @location(0) vec4f {
    if (fsUniforms.wireframe > 0) {
        return vec4f(1);
    }

    let texCoord: vec2f = (fsUniforms.tVertexAnim * vec3f(in.textureCoord.x, in.textureCoord.y, 1.)).xy;
    var color: vec4f = vec4f(0.0);

    if (fsUniforms.replaceableType == 0) {
        color = textureSample(fsUniformTexture, fsUniformSampler, texCoord);
    } else if (fsUniforms.replaceableType == 1) {
        color = vec4f(fsUniforms.replaceableColor, 1.0);
    } else if (fsUniforms.replaceableType == 2) {
        let dist: f32 = hypot(texCoord - vec2(0.5, 0.5)) * 2.;
        let truncateDist: f32 = clamp(1. - dist * 1.4, 0., 1.);
        let alpha: f32 = sin(truncateDist);
        color = vec4f(fsUniforms.replaceableColor * alpha, 1.0);
    }

    // hand-made alpha-test
    if (color.a < fsUniforms.discardAlphaLevel) {
        discard;
    }

    return color;
}
`,pf=`struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
    nodesMatrices: array<mat4x4f, \${MAX_NODES}>,
}

struct FSUniforms {
    replaceableColor: vec3f,
    // replaceableType: u32,
    discardAlphaLevel: f32,
    tVertexAnim: mat3x3f,
    lightPos: vec3f,
    hasEnv: u32,
    lightColor: vec3f,
    wireframe: u32,
    cameraPos: vec3f,
    shadowParams: vec3f,
    shadowMapLightMatrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
@group(1) @binding(0) var<uniform> fsUniforms: FSUniforms;
@group(1) @binding(1) var fsUniformDiffuseSampler: sampler;
@group(1) @binding(2) var fsUniformDiffuseTexture: texture_2d<f32>;
@group(1) @binding(3) var fsUniformNormalSampler: sampler;
@group(1) @binding(4) var fsUniformNormalTexture: texture_2d<f32>;
@group(1) @binding(5) var fsUniformOrmSampler: sampler;
@group(1) @binding(6) var fsUniformOrmTexture: texture_2d<f32>;
@group(1) @binding(7) var fsUniformShadowSampler: sampler_comparison;
@group(1) @binding(8) var fsUniformShadowTexture: texture_depth_2d;
@group(1) @binding(9) var irradienceMapSampler: sampler;
@group(1) @binding(10) var irradienceMapTexture: texture_cube<f32>;
@group(1) @binding(11) var prefilteredEnvSampler: sampler;
@group(1) @binding(12) var prefilteredEnvTexture: texture_cube<f32>;
@group(1) @binding(13) var brdfLutSampler: sampler;
@group(1) @binding(14) var brdfLutTexture: texture_2d<f32>;

struct VSIn {
    @location(0) vertexPosition: vec3f,
    @location(1) normal: vec3f,
    @location(2) textureCoord: vec2f,
    @location(3) tangent: vec4f,
    @location(4) skin: vec4<u32>,
    @location(5) boneWeight: vec4f,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) textureCoord: vec2f,
    @location(2) tangent: vec3f,
    @location(3) binormal: vec3f,
    @location(4) fragPos: vec3f,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var position: vec4f = vec4f(in.vertexPosition, 1.0);
    var sum: mat4x4f;

    sum += vsUniforms.nodesMatrices[in.skin[0]] * in.boneWeight[0];
    sum += vsUniforms.nodesMatrices[in.skin[1]] * in.boneWeight[1];
    sum += vsUniforms.nodesMatrices[in.skin[2]] * in.boneWeight[2];
    sum += vsUniforms.nodesMatrices[in.skin[3]] * in.boneWeight[3];

    let rotation: mat3x3f = mat3x3f(sum[0].xyz, sum[1].xyz, sum[2].xyz);

    position = sum * position;
    position.w = 1;

    var out: VSOut;
    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * position;
    out.textureCoord = in.textureCoord;
    out.normal = in.normal;

    var normal: vec3f = in.normal;
    var tangent: vec3f = in.tangent.xyz;

    // https://learnopengl.com/Advanced-Lighting/Normal-Mapping
    tangent = normalize(tangent - dot(tangent, normal) * normal);

    var binormal: vec3f = cross(normal, tangent) * in.tangent.w;

    normal = normalize(rotation * normal);
    tangent = normalize(rotation * tangent);
    binormal = normalize(rotation * binormal);

    out.normal = normal;
    out.tangent = tangent;
    out.binormal = binormal;

    out.fragPos = position.xyz;

    return out;
}

fn hypot(z: vec2f) -> f32 {
    var t: f32 = 0;
    var x: f32 = abs(z.x);
    let y: f32 = abs(z.y);
    t = min(x, y);
    x = max(x, y);
    t = t / x;
    if (z.x == 0.0 && z.y == 0.0) {
        return 0.0;
    }
    return x * sqrt(1.0 + t * t);
}

const PI: f32 = 3.14159265359;
const gamma: f32 = 2.2;
const MAX_REFLECTION_LOD: f32 = \${MAX_ENV_MIP_LEVELS};

fn distributionGGX(normal: vec3f, halfWay: vec3f, roughness: f32) -> f32 {
    let a: f32 = roughness * roughness;
    let a2: f32 = a * a;
    let nDotH: f32 = max(dot(normal, halfWay), 0.0);
    let nDotH2: f32 = nDotH * nDotH;

    let num: f32 = a2;
    var denom: f32 = (nDotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return num / denom;
}

fn geometrySchlickGGX(nDotV: f32, roughness: f32) -> f32 {
    let r: f32 = roughness + 1.;
    let k: f32 = r * r / 8.;
    // float k = roughness * roughness / 2.;

    let num: f32 = nDotV;
    let denom: f32 = nDotV * (1. - k) + k;

    return num / denom;
}

fn geometrySmith(normal: vec3f, viewDir: vec3f, lightDir: vec3f, roughness: f32) -> f32 {
    let nDotV: f32 = max(dot(normal, viewDir), .0);
    let nDotL: f32 = max(dot(normal, lightDir), .0);
    let ggx2: f32  = geometrySchlickGGX(nDotV, roughness);
    let ggx1: f32  = geometrySchlickGGX(nDotL, roughness);

    return ggx1 * ggx2;
}

fn fresnelSchlick(lightFactor: f32, f0: vec3f) -> vec3f {
    return f0 + (1. - f0) * pow(clamp(1. - lightFactor, 0., 1.), 5.);
}

fn fresnelSchlickRoughness(lightFactor: f32, f0: vec3f, roughness: f32) -> vec3f {
    return f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow(clamp(1.0 - lightFactor, 0.0, 1.0), 5.0);
}

@fragment fn fs(
    in: VSOut,
    @builtin(front_facing) isFront: bool
) -> @location(0) vec4f {
    if (fsUniforms.wireframe > 0) {
        return vec4f(1);
    }

    let texCoord: vec2f = (fsUniforms.tVertexAnim * vec3f(in.textureCoord.x, in.textureCoord.y, 1.)).xy;
    var baseColor: vec4f = textureSample(fsUniformDiffuseTexture, fsUniformDiffuseSampler, texCoord);

    // hand-made alpha-test
    if (baseColor.a < fsUniforms.discardAlphaLevel) {
        discard;
    }

    let orm: vec4f = textureSample(fsUniformOrmTexture, fsUniformOrmSampler, texCoord);

    let occlusion: f32 = orm.r;
    let roughness: f32 = orm.g;
    let metallic: f32 = orm.b;
    let teamColorFactor: f32 = orm.a;

    var teamColor: vec3f = baseColor.rgb * fsUniforms.replaceableColor;
    baseColor = vec4(mix(baseColor.rgb, teamColor, teamColorFactor), baseColor.a);
    baseColor = vec4(pow(baseColor.rgb, vec3f(gamma)), baseColor.a);

    let TBN: mat3x3f = mat3x3f(in.tangent, in.binormal, in.normal);

    var normal: vec3f = textureSample(fsUniformNormalTexture, fsUniformNormalSampler, texCoord).xyz;
    normal = normal * 2 - 1;
    normal.x = -normal.x;
    normal.y = -normal.y;
    if (!isFront) {
        normal = -normal;
    }
    normal = normalize(TBN * -normal);

    let viewDir: vec3f = normalize(fsUniforms.cameraPos - in.fragPos);
    let reflected = reflect(-viewDir, normal);

    let lightDir: vec3f = normalize(fsUniforms.lightPos - in.fragPos);
    let lightFactor: f32 = max(dot(normal, lightDir), 0);
    let radiance: vec3f = fsUniforms.lightColor;

    var f0 = vec3f(.04);
    f0 = mix(f0, baseColor.rgb, metallic);

    var totalLight: vec3f = vec3f(0);
    let halfWay: vec3f = normalize(viewDir + lightDir);
    let ndf: f32 = distributionGGX(normal, halfWay, roughness);
    let g: f32 = geometrySmith(normal, viewDir, lightDir, roughness);
    let f: vec3f = fresnelSchlick(max(dot(halfWay, viewDir), 0), f0);

    let kS = f;
    var kD = vec3f(1);// - kS;
    if (fsUniforms.hasEnv > 0) {
        kD *= 1 - metallic;
    }
    let num: vec3f = ndf * g * f;
    let denom: f32 = 4. * max(dot(normal, viewDir), 0.) * max(dot(normal, lightDir), 0.) + .0001;
    var specular: vec3f = num / denom;

    totalLight = (kD * baseColor.rgb / PI + specular) * radiance * lightFactor;

    if (fsUniforms.shadowParams[0] > .5) {
        let shadowBias: f32 = fsUniforms.shadowParams[1];
        let shadowStep: f32 = fsUniforms.shadowParams[2];
        let fragInLightPos: vec4f = fsUniforms.shadowMapLightMatrix * vec4f(in.fragPos, 1.);
        var shadowMapCoord: vec3f = fragInLightPos.xyz / fragInLightPos.w;
        shadowMapCoord = vec3f((shadowMapCoord.xy + 1) * .5, shadowMapCoord.z);
        shadowMapCoord.y = 1 - shadowMapCoord.y;

        let passes: u32 = 5;
        let step: f32 = 1. / f32(passes);

        let currentDepth: f32 = shadowMapCoord.z;
        var lightDepth: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, shadowMapCoord.xy, currentDepth - shadowBias);
        let lightDepth0: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, vec2f(shadowMapCoord.x + shadowStep, shadowMapCoord.y), currentDepth - shadowBias);
        let lightDepth1: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, vec2f(shadowMapCoord.x, shadowMapCoord.y + shadowStep), currentDepth - shadowBias);
        let lightDepth2: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, vec2f(shadowMapCoord.x, shadowMapCoord.y - shadowStep), currentDepth - shadowBias);
        let lightDepth3: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, vec2f(shadowMapCoord.x - shadowStep, shadowMapCoord.y), currentDepth - shadowBias);

        var visibility: f32 = 0.;
        if (lightDepth > .5) {
            visibility += step;
        }
        if (lightDepth0 > .5) {
            visibility += step;
        }
        if (lightDepth1 > .5) {
            visibility += step;
        }
        if (lightDepth2 > .5) {
            visibility += step;
        }
        if (lightDepth3 > .5) {
            visibility += step;
        }

        totalLight *= visibility;
    }

    var color: vec3f = vec3f(0.0);

    if (fsUniforms.hasEnv > 0) {
        let f: vec3f = fresnelSchlickRoughness(max(dot(normal, viewDir), 0.0), f0, roughness);
        let kS: vec3f = f;
        var kD: vec3f = vec3f(1.0) - kS;
        kD *= 1.0 - metallic;

        let diffuse: vec3f = textureSample(irradienceMapTexture, irradienceMapSampler, normal).rgb * baseColor.rgb;
        let prefilteredColor: vec3f = textureSampleLevel(prefilteredEnvTexture, prefilteredEnvSampler, reflected, roughness * MAX_REFLECTION_LOD).rgb;
        let envBRDF: vec2f = textureSample(brdfLutTexture, brdfLutSampler, vec2f(max(dot(normal, viewDir), 0.0), roughness)).rg;
        specular = prefilteredColor * (f * envBRDF.x + envBRDF.y);

        let ambient: vec3f = (kD * diffuse + specular) * occlusion;
        color = ambient + totalLight;
    } else {
        var ambient: vec3f = vec3(.03);
        ambient *= baseColor.rgb * occlusion;
        color = ambient + totalLight;
    }

    color = color / (vec3f(1) + color);
    color = pow(color, vec3f(1 / gamma));

    return vec4f(color, baseColor.a);
}
`,mf=`struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
    nodesMatrices: array<mat4x4f, \${MAX_NODES}>,
}

struct FSUniforms {
    replaceableColor: vec3f,
    // replaceableType: u32,
    discardAlphaLevel: f32,
    tVertexAnim: mat3x3f,
    lightPos: vec3f,
    lightColor: vec3f,
    cameraPos: vec3f,
    shadowParams: vec3f,
    shadowMapLightMatrix: mat4x4f,
    // env
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
@group(1) @binding(0) var<uniform> fsUniforms: FSUniforms;
@group(1) @binding(1) var fsUniformDiffuseSampler: sampler;
@group(1) @binding(2) var fsUniformDiffuseTexture: texture_2d<f32>;
@group(1) @binding(3) var fsUniformNormalSampler: sampler;
@group(1) @binding(4) var fsUniformNormalTexture: texture_2d<f32>;
@group(1) @binding(5) var fsUniformOrmSampler: sampler;
@group(1) @binding(6) var fsUniformOrmTexture: texture_2d<f32>;
@group(1) @binding(7) var fsUniformShadowSampler: sampler_comparison;
// @group(1) @binding(7) var fsUniformShadowSampler: sampler;
@group(1) @binding(8) var fsUniformShadowTexture: texture_depth_2d;

struct VSIn {
    @location(0) vertexPosition: vec3f,
    @location(1) normal: vec3f,
    @location(2) textureCoord: vec2f,
    @location(3) tangent: vec4f,
    @location(4) skin: vec4<u32>,
    @location(5) boneWeight: vec4f,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) textureCoord: vec2f,
    @location(1) depth: f32,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var position: vec4f = vec4f(in.vertexPosition, 1.0);
    var sum: mat4x4f;

    sum += vsUniforms.nodesMatrices[in.skin[0]] * in.boneWeight[0];
    sum += vsUniforms.nodesMatrices[in.skin[1]] * in.boneWeight[1];
    sum += vsUniforms.nodesMatrices[in.skin[2]] * in.boneWeight[2];
    sum += vsUniforms.nodesMatrices[in.skin[3]] * in.boneWeight[3];

    position = sum * position;
    position.w = 1;

    var out: VSOut;
    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * position;
    out.textureCoord = in.textureCoord;

    out.depth = out.position.z / out.position.w;

    return out;
}

struct FSOut {
    @builtin(frag_depth) depth: f32,
    @location(0) color: vec4f
}

@fragment fn fs(
    in: VSOut,
    @builtin(front_facing) isFront: bool
) -> FSOut {
    let texCoord: vec2f = (fsUniforms.tVertexAnim * vec3f(in.textureCoord.x, in.textureCoord.y, 1.)).xy;
    var baseColor: vec4f = textureSample(fsUniformDiffuseTexture, fsUniformDiffuseSampler, texCoord);

    // hand-made alpha-test
    if (baseColor.a < fsUniforms.discardAlphaLevel) {
        discard;
    }

    var out: FSOut;
    out.color = vec4f(1, 1, 1, 1);
    out.depth = in.depth;
    return out;
}
`;var Pn=254;var Wo=8;var Xg=cf.replace(/\$\{MAX_NODES}/g,String(Pn)),qg=hf.replace(/\$\{MAX_NODES}/g,String(Pn)),$g=uf.replace(/\$\{MAX_NODES}/g,String(Pn)),Yg=ff.replace(/\$\{MAX_ENV_MIP_LEVELS}/g,String(Wo.toFixed(1))),Kg=df.replace(/\$\{MAX_NODES}/g,String(Pn)),jg=pf.replace(/\$\{MAX_NODES}/g,String(Pn)).replace(/\$\{MAX_ENV_MIP_LEVELS}/g,String(Wo.toFixed(1))),Zg=mf.replace(/\$\{MAX_NODES}/g,String(Pn)),Jg=Xe(),Qg=ei(),e0=Xe(),t0=Qn(0,0,0),n0=lf(0,0,0,1),i0=Qn(1,1,1),r0=ei(),s0=Pi(),o0=Pi(),a0=Xe(),l0=Xe(),c0=ei(),h0=Pi(),u0=Xe(),f0=Xe(),d0=Xe(),p0=Xe(),m0=Xe(),g0=Xe(),v0=Xe(),x0=Pr(),y0=Pi(),_0=Pr();import{Buffer as $}from"buffer";import{Buffer as qt}from"buffer";function it(t,e,n,i,r={}){return Object.freeze({severity:t,code:e,message:n,offset:i,...r})}var gf=qt.from("MDLX","ascii"),Lt=Object.freeze([800,900,1e3,1100,1200,1300,1400,1600,1800]);function vf(t){if(qt.isBuffer(t))return qt.from(t);if(t instanceof Uint8Array)return qt.from(t.buffer,t.byteOffset,t.byteLength);throw new TypeError("Expected a Buffer or Uint8Array")}function Ii(t){return t.toString("latin1")}var Ri=class{#e;constructor(e,n,i,r,s){this.#e=e,this.chunks=n,this.trailingBytes=i,this.diagnostics=r,this.version=s}get hasErrors(){return this.diagnostics.some(e=>e.severity==="error")}toBytes(){return qt.from(this.#e)}summary(){return{format:"mdx",byteLength:this.#e.length,magic:this.#e.subarray(0,4).toString("latin1"),version:this.version,supportedVersion:Lt.includes(this.version),chunks:this.chunks.map(e=>({tag:e.tag,offset:e.offset,declaredSize:e.declaredSize,actualSize:e.data.length,complete:e.complete})),trailingByteLength:this.trailingBytes.length,diagnostics:this.diagnostics}}};function Ie(t){let e=vf(t),n=[],i=[];if(e.length<4||!e.subarray(0,4).equals(gf))return n.push(it("error","MDX_INVALID_MAGIC","Expected the four-byte MDLX signature.",0,{actual:e.subarray(0,Math.min(4,e.length)).toString("hex")})),new Ri(e,i,e.subarray(Math.min(4,e.length)),n,null);let r=4,s=qt.alloc(0);for(;r<e.length;){let c=e.length-r;if(c<8){s=e.subarray(r),n.push(it("error","MDX_TRUNCATED_CHUNK_HEADER",`A top-level chunk header needs 8 bytes; only ${c} remain.`,r,{remaining:c}));break}let h=e.subarray(r,r+4),l=e.readUInt32LE(r+4),d=r+8,u=e.length-d,f=Math.min(l,u),p=f===l,m=e.subarray(d,d+f);if(i.push(Object.freeze({tag:Ii(h),tagBytes:qt.from(h),offset:r,payloadOffset:d,declaredSize:l,data:qt.from(m),complete:p,known:xf(Ii(h))})),!p){n.push(it("error","MDX_TRUNCATED_CHUNK_PAYLOAD",`Chunk ${JSON.stringify(Ii(h))} declares ${l} bytes but only ${u} remain.`,r,{tag:Ii(h),declaredSize:l,available:u})),r=e.length;break}r=d+l}let o=i.filter(c=>c.tag==="VERS"),a=null;if(o.length===0)n.push(it("warning","MDX_MISSING_VERSION","No VERS chunk was found.",4));else{o.length>1&&n.push(it("warning","MDX_DUPLICATE_VERSION",`Found ${o.length} VERS chunks; the first complete value is reported.`,o[1].offset,{count:o.length}));let c=o.find(h=>h.data.length>=4);for(let h of o.filter(l=>l.data.length<4))n.push(it("error","MDX_SHORT_VERSION_CHUNK","A VERS chunk must contain at least a 32-bit version value.",h.payloadOffset,{actualSize:h.data.length}));c&&(a=c.data.readUInt32LE(0))}return a!==null&&!Lt.includes(a)&&n.push(it("warning","MDX_UNSUPPORTED_VERSION",`Format version ${a} is retained but has no semantic decoder yet.`,o.find(c=>c.data.length>=4).payloadOffset,{version:a,supportedVersions:Lt})),new Ri(e,i,s,n,a)}function xf(t){return new Set(["VERS","MODL","SEQS","GLBS","MTLS","TEXS","TXAN","GEOS","GEOA","BONE","LITE","HELP","ATCH","PIVT","PREM","PRE2","RIBB","CAMS","EVTS","CLID","FAFX","BPOS","CORN","DILG","SNDS","SNEM","MDVI"]).has(t)}var $t=["TextureID","NormalTextureID","ORMTextureID","EmissiveTextureID","TeamColorTextureID","ReflectionsTextureID"],yf=t=>t.buffer.slice(t.byteOffset,t.byteOffset+t.byteLength),he=t=>{let e=$.alloc(4);return e.writeUInt32LE(t>>>0),e},mt=t=>{let e=$.alloc(4);return e.writeFloatLE(t),e},mn=t=>$.concat(Array.from(t,mt)),Cn=(t,e)=>{let n=$.alloc(e);return n.write(t||"",0,e,"latin1"),n},In=(t,e,n)=>t.subarray(e,e+n).toString("latin1").split("\0")[0],gn=(t,e,n=3)=>Float32Array.from({length:n},(i,r)=>t.readFloatLE(e+r*4)),Li=t=>{let e=$.concat([he(0),...t]);return e.writeUInt32LE(e.length),e},ht=(t,e)=>$.concat([$.from(t),he(e.length),e]);function Ne(t,e){let n=[];for(let i=0;i<t.length;){let r;if(e==="MODL")r=372;else if(e==="SEQS")r=132;else if(e==="TEXS")r=268;else if(e==="PIVT")r=12;else if(e==="GLBS"||e==="DILG")r=4;else{if(i+4>t.length)throw new Error(`Truncated ${e} record.`);if(r=t.readUInt32LE(i),e==="CAMS"&&(r&=16777215),e==="BONE"&&(r+=8),e==="EVTS"){if(r<96||i+r+12>t.length||t.toString("ascii",i+r,i+r+4)!=="KEVT")throw new Error("Invalid event record.");r+=12+t.readUInt32LE(i+r+4)*4}if(e==="CLID"){let s=t.readUInt32LE(i+r);if(s>3)throw new Error(`Unsupported collision shape ${s}.`);r+=4+(s===2?12:24)+(s>=2?4:0)}}if(r<4||i+r>t.length)throw new Error(`Invalid ${e} record size.`);n.push(t.subarray(i,i+r)),i+=r}return n}function qo(t,e,n=1,i=!1){if(e+16>t.length)throw new Error("Truncated animation header.");let r=t.readUInt32LE(e+4),s=t.readUInt32LE(e+8),o=t.readInt32LE(e+12);if(s>3)throw new Error("Invalid animation interpolation.");let a=16+r*(4+n*4*(s>=2?3:1));if(e+a>t.length)throw new Error("Truncated animation keys.");let c=e+16,h=[];for(let l=0;l<r;l++){let d={Frame:t.readInt32LE(c)};c+=4;for(let u of s>=2?["Vector","InTan","OutTan"]:["Vector"]){let f=i?Int32Array:Float32Array;d[u]=f.from({length:n},()=>{let p=i?t.readInt32LE(c):t.readFloatLE(c);return c+=4,p})}h.push(d)}return{track:{LineType:s,GlobalSeqId:o<0?null:o,Keys:h},size:a}}function $o(t,e,n=!1){return e?.Keys?$.concat([$.from(t),he(e.Keys.length),he(e.LineType),he(e.GlobalSeqId??-1),...e.Keys.flatMap(i=>[he(i.Frame),...(e.LineType>=2?[i.Vector,i.InTan,i.OutTan]:[i.Vector]).map(r=>$.concat(Array.from(r,n?he:mt)))])]):$.alloc(0)}var Yo={KMTA:["Alpha",1],KMTF:["TextureID",1,!0],KMTE:["EmissiveGain",1],KFC3:["FresnelColor",3],KFCA:["FresnelOpacity",1],KFTC:["FresnelTeamColor",1]},Ko={KLAS:["AttenuationStart",1],KLAE:["AttenuationEnd",1],KLAC:["Color",3],KLAI:["Intensity",1],KLBC:["AmbColor",3],KLBI:["AmbIntensity",1],KLAV:["Visibility",1],KLSS:["ShadowCastingStart",1],KLSE:["ShadowCastingEnd",1],KLQF:["QuadraticFalloff",1],KLLF:["LinearFalloff",1],KLDA:["Damping",1]},jo={KRHA:["HeightAbove",1],KRHB:["HeightBelow",1],KRAL:["Alpha",1],KRCO:["Color",3],KRTX:["TextureSlot",1,!0],KRVS:["Visibility",1]},Zo={KCTR:["Translation",3],KCRL:["Rotation",1],KTTR:["TargetTranslation",3],KCVS:["Visibility",1],IDUF:["FocusDistance",1],ELAF:["FocalLength",1],PTSF:["FStop",1]},Cr={PREM:{key:"ParticleEmitters",fields:[["EmissionRate",0],["Gravity",4],["Longitude",8],["Latitude",12],["LifeSpan",276],["InitVelocity",280]]},PRE2:{key:"ParticleEmitters2",fields:[["Speed",0],["Variation",4],["Latitude",8],["Gravity",12],["EmissionRate",20],["Length",24],["Width",28]]},CORN:{key:"ParticleEmitterPopcorns",fields:[["LifeSpan",0],["EmissionRate",4],["Speed",8],["Color",12,3],["Alpha",24]]}},Jo=new Set(["KLAC","KLBC","KRCO"]);function Qo(t){return t?.Keys?{...t,Keys:t.Keys.map(e=>{let n={...e};for(let i of["Vector","InTan","OutTan"])e[i]&&(n[i]=Float32Array.of(e[i][2],e[i][1],e[i][0]));return n})}:t}function Fi(t,e,n,i){for(let r=e;r<t.length;){let s=t.toString("ascii",r,r+4),o=i[s];if(!o)throw new Error(`Unsupported animation ${s}.`);let[a,c,h]=o,{track:l,size:d}=qo(t,r,c,h);if(n[a]?.Keys)throw new Error(`Duplicate animation ${s}.`);n[a]!=null&&((n._MdxDefaults||={})[a]=n[a]),n[a]=Jo.has(s)?Qo(l):l,r+=d}}var Di=(t,e)=>Object.entries(e).map(([n,[i,,r]])=>$o(n,Jo.has(n)?Qo(t[i]):t[i],r)),Je=(t,e,n=0)=>t[e]?.Keys?t._MdxDefaults?.[e]??n:t[e]??n;function _f(t,e){return Ne(t,"MTLS").map(n=>{let i={PriorityPlane:n.readInt32LE(4),RenderMode:n.readUInt32LE(8),Layers:[]},r=12;if(e>=900&&e<1100&&(i.Shader=In(n,r,80),r+=80),n.toString("ascii",r,r+4)!=="LAYS")throw new Error("Missing material layers.");let s=n.readUInt32LE(r+4);r+=8;for(let o=0;o<s;o++){let a=n.readUInt32LE(r),c=n.subarray(r,r+a);if(a<28||r+a>n.length)throw new Error("Invalid layer size.");let h={FilterMode:c.readUInt32LE(4),Shading:c.readUInt32LE(8),TextureID:c.readInt32LE(12),TVertexAnimId:c.readInt32LE(16),CoordId:c.readUInt32LE(20),Alpha:c.readFloatLE(24)};h.TVertexAnimId===-1&&(h.TVertexAnimId=null);let l=28;if(e>=900&&(h.EmissiveGain=c.readFloatLE(l),l+=4),e>=1e3&&(h.FresnelColor=gn(c,l),h.FresnelOpacity=c.readFloatLE(l+12),h.FresnelTeamColor=c.readFloatLE(l+16),l+=20),e>=1100){h._MdxTextureId=h.TextureID,delete h.TextureID,h.ShaderTypeId=c.readUInt32LE(l);let d=c.readUInt32LE(l+4);l+=8,h._MdxSlots=[];for(let u=0;u<d;u++){let f=c.readInt32LE(l),p=c.readUInt32LE(l+4),m=$t[p];if(l+=8,!m||h._MdxSlots.includes(p))throw new Error(`Unsupported or duplicate texture slot ${p}.`);if(h._MdxSlots.push(p),h[m]=f,l+4<=c.length&&c.toString("ascii",l,l+4)==="KMTF"){let{track:x,size:g}=qo(c,l,1,!0);(h._MdxDefaults||={})[m]=f,h[m]=x,l+=g}}}Fi(c,l,h,Yo),i.Layers.push(h),r+=a}if(r!==n.length)throw new Error("Unrecognized material tail.");return i})}function bf(t,e){return $.concat(t.map(n=>Li([he(n.PriorityPlane),he(n.RenderMode),...e>=900&&e<1100?[Cn(n.Shader,80)]:[],$.from("LAYS"),he(n.Layers.length),...n.Layers.map(i=>{let r=[he(i.FilterMode),he(i.Shading),he(e>=1100?i._MdxTextureId??0:Je(i,"TextureID")),he(i.TVertexAnimId??-1),he(i.CoordId),mt(Je(i,"Alpha",1))];if(e>=900&&r.push(mt(Je(i,"EmissiveGain",1))),e>=1e3&&r.push(mn(Je(i,"FresnelColor",[1,1,1])),mt(Je(i,"FresnelOpacity")),mt(Je(i,"FresnelTeamColor"))),e>=1100){let s=[...new Set([...i._MdxSlots||[],...$t.map((o,a)=>a)])].filter(o=>i[$t[o]]!=null);r.push(he(i.ShaderTypeId),he(s.length));for(let o of s){let a=$t[o];r.push(he(Je(i,a)),he(o),$o("KMTF",i[a],!0))}}return r.push(...Di(i,Object.fromEntries(Object.entries(Yo).filter(([s])=>s!=="KMTF"||e<1100)))),Li(r)})])))}function Ir(t,e){let n={},i=4,r=(o,a)=>{if(t.toString("ascii",i,i+4)!==o)throw new Error(`Missing geoset ${o}.`);let c=i,h=t.readUInt32LE(i+4);if(i+=8+h*a,i>t.length)throw new Error(`Truncated geoset ${o}.`);n[o]={start:c,end:i,count:h}};for(let[o,a]of[["VRTX",12],["NRMS",12],["PTYP",4],["PCNT",4],["PVTX",2],["GNDX",1],["MTGC",4],["MATS",4]])r(o,a);n.selection=i+8,i+=12+(e>=900?84:0)+28;let s=t.readUInt32LE(i);for(i+=4+s*28;i<t.length;){let o=t.toString("ascii",i,i+4);if(o==="TANG")r(o,16);else if(o==="SKIN")r(o,e>=1400?2:1);else{if(o==="UVAS")break;throw new Error(`Unsupported geoset subchunk ${o}.`)}}return n}function ea(t,e){let n=[],i=0;for(let{start:r,end:s,data:o}of e.sort((a,c)=>a.start-c.start))n.push(t.subarray(i,r),o),i=s;return n.push(t.subarray(i)),$.concat(n)}function Sf(t,e,n,i){let r=4+t.readUInt32LE(4),s=i||{},o=(a,c=1,h=!1)=>{s[a]=c===3?gn(t,r):h?t.readUInt32LE(r):t.readFloatLE(r),r+=c*4};if(e==="LITE")o("LightType",1,!0),n>=1300&&o("ShadowCasting",1,!0),o("AttenuationStart"),o("AttenuationEnd"),o("Color",3),o("Intensity"),o("AmbColor",3),o("AmbIntensity"),n>=1200&&o("ShadowIntensity"),n>=1300&&(o("ShadowCastingStart"),o("ShadowCastingEnd")),n>=1600&&(o("QuadraticFalloff"),o("LinearFalloff"),o("Damping")),Fi(t,r,s,Ko);else{for(let[a,c,h]of[["HeightAbove",1],["HeightBelow",1],["Alpha",1],["Color",3],["LifeSpan",1],["TextureSlot",1,!0],["EmissionRate",1,!0],["Rows",1,!0],["Columns",1,!0],["MaterialID",1,!0],["Gravity",1]])o(a,c,h);Fi(t,r,s,jo)}return s}function Mf(t,e,n,i){let r=[t.subarray(4,4+t.readUInt32LE(4))],s=(o,a=1,c=!1,h=0)=>r.push(a===3?mn(Je(e,o,[1,1,1])):c?he(Je(e,o,h)):mt(Je(e,o,h)));if(n==="LITE")s("LightType",1,!0),i>=1300&&s("ShadowCasting",1,!0),s("AttenuationStart"),s("AttenuationEnd"),s("Color",3),s("Intensity"),s("AmbColor",3),s("AmbIntensity"),i>=1200&&s("ShadowIntensity"),i>=1300&&(s("ShadowCastingStart"),s("ShadowCastingEnd")),i>=1600&&(s("QuadraticFalloff",1,!1,5e-4),s("LinearFalloff"),s("Damping",1,!1,1e-5)),r.push(...Di(e,Ko));else{for(let[o,a,c]of[["HeightAbove",1],["HeightBelow",1],["Alpha",1],["Color",3],["LifeSpan",1],["TextureSlot",1,!0],["EmissionRate",1,!0],["Rows",1,!0],["Columns",1,!0],["MaterialID",1,!0],["Gravity",1]])s(o,a,c);r.push(...Di(e,jo))}return Li(r)}function Tf(t){let e=t.readUInt32LE(0)>>>24,n=e===1||e===2,i={Variant:e,Name:In(t,4,80),Position:gn(t,84),FieldOfView:t.readFloatLE(96),FarClip:t.readFloatLE(100),NearClip:t.readFloatLE(104),TargetPosition:gn(t,n?120:108)};return n&&(i.VariantData=new Uint8Array(t.subarray(108,120))),Fi(t,n?132:120,i,Zo),i}function Xo(t){let e=t.Variant||0,n=Li([Cn(t.Name,80),mn(t.Position),mt(t.FieldOfView),mt(t.FarClip),mt(t.NearClip),...[1,2].includes(e)?[$.from(t.VariantData||new Uint8Array(12))]:[],mn(t.TargetPosition),...Di(t,Zo)]);if(n.length>16777215)throw new Error("Camera exceeds its 24-bit size field.");return n.writeUInt32LE((n.length|e<<24)>>>0),n}function ta(t){let e=$.from(t),n=Ie(e),i=n.version;if(n.chunks.some(c=>c.tag==="SNEM"))throw new Error("Sound-emitter nodes are not supported; preserving the original file is required to retain their node and pivot references");if(n.chunks.filter(c=>c.tag==="VERS").length>1)throw new Error("Repeated version chunks cannot be edited safely");let r=new Map,s=[$.from("MDLX"),ht("VERS",he(i))];for(let c of n.chunks){let h=e.subarray(c.payloadOffset,c.payloadOffset+c.declaredSize);if(c.tag!=="VERS"){if(r.has(c.tag))throw new Error(`Duplicate ${c.tag} chunks cannot be edited safely.`);if(r.set(c.tag,h),["MTLS","LITE","RIBB","CAMS","CLID"].includes(c.tag)){if(["LITE","RIBB","CLID"].includes(c.tag)){let l=Ne(h,c.tag).map(d=>{let u=c.tag==="CLID"?0:4;return d.subarray(u,u+d.readUInt32LE(u))});s.push(ht("HELP",$.concat(l)))}continue}if(c.tag==="GEOS"){let l=Ne(h,"GEOS").map(d=>{let u=Ir(d,i),f=[];for(let m of["MTGC","MATS"])f.push({...u[m],data:ht(m,$.alloc(0))});if(i>=1400&&u.SKIN){let m=u.SKIN,x=$.alloc(8+m.count);d.copy(x,0,m.start,m.start+8);for(let g=0;g<m.count;g++)x[8+g]=d.readUInt16LE(m.start+8+g*2)&255;f.push({...m,data:x})}let p=ea(d,f);return p.writeUInt32LE(p.length),p});s.push(ht("GEOS",$.concat(l)));continue}s.push(ht(c.tag,h))}}let o=Js(yf($.concat(s)));r.has("DILG")&&(o.Gliders=Ne(r.get("DILG"),"DILG").map(c=>({GeosetId:c.readUInt32LE(0)}))),r.has("MTLS")&&(o.Materials=_f(r.get("MTLS"),i));for(let[c,h]of[["LITE","Lights"],["RIBB","RibbonEmitters"],["CLID","CollisionShapes"]])r.has(c)&&(o[h]=Ne(r.get(c),c).map(l=>{let d=c==="CLID"?0:4,u=l.readInt32LE(d+84),f=o.Nodes[u];if(o.Helpers=o.Helpers.filter(x=>x!==f),c!=="CLID")return Sf(l,c,i,f);let p=l.readUInt32LE(0);f.Shape=l.readUInt32LE(p),p+=4;let m=f.Shape===2?3:6;return f.Vertices=gn(l,p,m),p+=m*4,f.Shape>=2&&(f.BoundsRadius=l.readFloatLE(p)),f}));r.has("CAMS")&&(o.Cameras=Ne(r.get("CAMS"),"CAMS").map(Tf));let a=r.get("MODL");a&&(o.Info.Name=In(a,0,80),o.Info.AnimationFile=In(a,80,260));for(let[c,h]of Ne(r.get("SEQS")||$.alloc(0),"SEQS").entries())o.Sequences[c].SyncPoint=h.readUInt32LE(100),o.Sequences[c].Flags=h.readUInt32LE(92),o.Sequences[c].NonLooping=!!(o.Sequences[c].Flags&1);for(let[c,h]of Ne(r.get("TEXS")||$.alloc(0),"TEXS").entries())o.Textures[c].Image=In(h,4,260);for(let[c,h,l]of[["ATCH","Attachments",0],["PREM","ParticleEmitters",16]])for(let[d,u]of Ne(r.get(c)||$.alloc(0),c).entries())o[h][d].Path=In(u,4+u.readUInt32LE(4)+l,260);for(let c of o.EventObjects)c.EventTrack=Int32Array.from(c.EventTrack);for(let[c,h]of Ne(r.get("GEOS")||$.alloc(0),"GEOS").entries()){let l=o.Geosets[c],d=Ir(h,i),u=Array.from({length:d.MTGC.count},(p,m)=>h.readUInt32LE(d.MTGC.start+8+m*4));if(u.reduce((p,m)=>p+m,0)!==d.MATS.count)throw new Error("Geoset matrix-group sizes do not match matrix indices.");let f=d.MATS.start+8;l.Groups=u.map(p=>Array.from({length:p},()=>{let m=h.readInt32LE(f);return f+=4,m})),l.TotalGroupsCount=d.MATS.count,l.PrimitiveTypes=Uint32Array.from({length:d.PTYP.count},(p,m)=>h.readUInt32LE(d.PTYP.start+8+m*4)),l.PrimitiveCounts=Uint32Array.from({length:d.PCNT.count},(p,m)=>h.readUInt32LE(d.PCNT.start+8+m*4)),l.SelectionFlags=h.readUInt32LE(d.selection),l.Unselectable=!!(l.SelectionFlags&4),i>=1400&&d.SKIN&&(l.SkinWeights=Uint16Array.from({length:d.SKIN.count},(p,m)=>h.readUInt16LE(d.SKIN.start+8+m*2)))}for(let[c,h]of Ne(r.get("GEOA")||$.alloc(0),"GEOA").entries()){let l=o.GeosetAnims[c];l.Alpha?.Keys&&((l._MdxDefaults||={}).Alpha=h.readFloatLE(4)),l.Color?.Keys&&((l._MdxDefaults||={}).Color=gn(h,12))}for(let[c,{key:h,fields:l}]of Object.entries(Cr))for(let[d,u]of Ne(r.get(c)||$.alloc(0),c).entries()){let f=o[h][d],p=4+u.readUInt32LE(4);for(let[m,x,g]of l){let y=g===3?gn(u,p+x):u.readFloatLE(p+x);f[m]?.Keys?(f._MdxDefaults||={})[m]=y:c==="PRE2"&&(m==="Length"||m==="Width")&&(f[m]=y)}}return o}function Ui(t){let e={...t};for(let a of["Attachments","Lights","ParticleEmitters","ParticleEmitters2","RibbonEmitters","ParticleEmitterPopcorns","Cameras"])e[a]=(e[a]||[]).map(c=>{if(typeof c.Visibility!="number")return c;let h=[...new Set([0,...(e.Sequences||[]).flatMap(l=>Array.from(l.Interval))])].sort((l,d)=>l-d);return{...c,Visibility:{LineType:0,GlobalSeqId:null,Keys:h.map(l=>({Frame:l,Vector:Float32Array.of(c.Visibility)}))}}});let n={...e,Materials:[],Lights:e.Lights.map(a=>({...a,AttenuationStart:0,AttenuationEnd:0})),RibbonEmitters:e.RibbonEmitters.map(a=>({...a,Color:new Float32Array([1,1,1])})),Cameras:[],CollisionShapes:e.CollisionShapes.map(a=>({...a,Shape:0,Vertices:new Float32Array(6)})),BindPoses:e.BindPoses?.length?e.BindPoses:void 0},i=$.from(zo(n)),r=Ie(i),s=[$.from("MDLX")];if(r.hasErrors)throw new Error("Invalid generated MDX structure.");let o=new Set;for(let a of r.chunks){let c=$.from(i.subarray(a.payloadOffset,a.payloadOffset+a.declaredSize));if(o.add(a.tag),a.tag==="MODL"&&(Cn(e.Info.Name,80).copy(c,0),Cn(e.Info.AnimationFile,260).copy(c,80)),a.tag==="SEQS"&&e.Sequences.forEach((h,l)=>{c.writeUInt32LE(h.SyncPoint||0,l*132+100),c.writeUInt32LE(((h.Flags||0)&-2|(h.NonLooping?1:0))>>>0,l*132+92)}),a.tag==="TEXS"&&e.Textures.forEach((h,l)=>Cn(h.Image,260).copy(c,l*268+4)),a.tag==="CAMS"&&(c=$.concat(e.Cameras.map(Xo))),["LITE","RIBB","CLID","ATCH","PREM","PRE2","CORN","GEOS","GEOA"].includes(a.tag)){let h={LITE:"Lights",RIBB:"RibbonEmitters",CLID:"CollisionShapes",ATCH:"Attachments",PREM:"ParticleEmitters",PRE2:"ParticleEmitters2",CORN:"ParticleEmitterPopcorns",GEOS:"Geosets",GEOA:"GeosetAnims"}[a.tag];c=$.concat(Ne(c,a.tag).map((l,d)=>{let u=e[h][d];if(Cr[a.tag]){let x=4+l.readUInt32LE(4);a.tag==="PRE2"&&(l.writeFloatLE(Je(u,"Length"),x+24),l.writeFloatLE(Je(u,"Width"),x+28));for(let[g,y,v]of Cr[a.tag].fields)if(u[g]?.Keys&&u._MdxDefaults?.[g]!=null){let _=u._MdxDefaults[g];v===3?mn(_).copy(l,x+y):l.writeFloatLE(_,x+y)}if(a.tag!=="PREM")return l}if(a.tag==="LITE"||a.tag==="RIBB")return Mf(l,u,a.tag,e.Version);if(a.tag==="CLID")return $.concat([l.subarray(0,l.readUInt32LE(0)),he(u.Shape),mn(u.Vertices),...u.Shape>=2?[mt(u.BoundsRadius)]:[]]);if(a.tag==="ATCH"||a.tag==="PREM")return Cn(u.Path,260).copy(l,4+l.readUInt32LE(4)+(a.tag==="PREM"?16:0)),l;if(a.tag==="GEOA")return u.Alpha?.Keys&&l.writeFloatLE(Je(u,"Alpha",1),4),u.Color?.Keys&&mn(Je(u,"Color",[1,1,1])).copy(l,12),l;let f=Ir(l,Math.min(e.Version,1100)),p=[];if(l.writeUInt32LE(((u.SelectionFlags||0)&-5|(u.Unselectable?4:0))>>>0,f.selection),u.PrimitiveCounts&&Array.from(u.PrimitiveCounts).reduce((x,g)=>x+g,0)===u.Faces.length)for(let[x,g]of[["PTYP",u.PrimitiveTypes],["PCNT",u.PrimitiveCounts]])p.push({...f[x],data:$.concat([$.from(x),he(g.length),...Array.from(g,he)])});if(e.Version>=1400&&f.SKIN){let x=$.alloc(8+u.SkinWeights.length*2);x.write("SKIN"),x.writeUInt32LE(u.SkinWeights.length,4),u.SkinWeights.forEach((g,y)=>x.writeUInt16LE(g,8+y*2)),p.push({...f.SKIN,data:x})}let m=ea(l,p);return m.writeUInt32LE(m.length),m}))}s.push(ht(a.tag,c))}return e.Materials.length&&s.push(ht("MTLS",bf(e.Materials,e.Version))),!o.has("CAMS")&&e.Cameras.length&&s.push(ht("CAMS",$.concat(e.Cameras.map(Xo)))),e.Gliders?.length&&s.push(ht("DILG",$.concat(e.Gliders.map(a=>he(a.GeosetId))))),$.concat(s)}import{Buffer as xn}from"buffer";import{Buffer as vn}from"buffer";var na=t=>t===32||t===9||t===10||t===13||t===12,Rn=t=>t>=48&&t<=57,ra=t=>t>=65&&t<=90||t>=97&&t<=122||t===95||t===36,Af=t=>ra(t)||Rn(t)||t===46,Ef=(t,e)=>{let n=t[e];return Rn(n)?!0:n===46?Rn(t[e+1]):n===43||n===45?Rn(t[e+1])||t[e+1]===46&&Rn(t[e+2]):!1};function wf(t){if(typeof t=="string")return vn.from(t,"utf8");if(vn.isBuffer(t))return vn.from(t);if(t instanceof Uint8Array)return vn.from(t.buffer,t.byteOffset,t.byteLength);throw new TypeError("Expected a string, Buffer, or Uint8Array")}function Yt(t,e,n,i){return Object.freeze({kind:t,start:n,end:i,raw:vn.from(e.subarray(n,i))})}function Pf(t){return t.kind==="whitespace"||t.kind==="line-comment"||t.kind==="block-comment"}function Lr(t,e){let n=t.indexOf(34,e+1);return n<0?-1:n+1}function ia(t){return t.raw.toString("ascii")}var Rr=class{#e;constructor(e,n,i,r){this.#e=e,this.tokens=n,this.diagnostics=i,this.version=r}get hasErrors(){return this.diagnostics.some(e=>e.severity==="error")}toBytes(){return vn.from(this.#e)}summary(){let e={};for(let n of this.tokens)e[n.kind]=(e[n.kind]??0)+1;return{format:"mdl",byteLength:this.#e.length,version:this.version,supportedVersion:Lt.includes(this.version),tokenCount:this.tokens.length,tokenKinds:e,diagnostics:this.diagnostics}}};function Be(t){let e=wf(t),n=[],i=[],r=0;for(;r<e.length;){let a=r,c=e[r];if(na(c)){for(r+=1;r<e.length&&na(e[r]);)r+=1;i.push(Yt("whitespace",e,a,r));continue}if(c===47&&e[r+1]===47){for(r+=2;r<e.length&&e[r]!==10&&e[r]!==13;)r+=1;i.push(Yt("line-comment",e,a,r));continue}if(c===34){let h=Lr(e,r),l=h>=0;r=l?h:e.length,i.push(Yt("string",e,a,r)),l||n.push(it("error","MDL_UNTERMINATED_STRING","String reaches end of file without a closing quote.",a));continue}if(c===47&&e[r+1]===42){let h=e.indexOf(vn.from("*/"),r+2);r=h<0?e.length:h+2,i.push(Yt("block-comment",e,a,r)),h<0&&n.push(it("error","MDL_UNTERMINATED_BLOCK_COMMENT","Block comment reaches end of file without a closing */.",a));continue}if(ra(c)){for(r+=1;r<e.length&&Af(e[r]);)r+=1;i.push(Yt("identifier",e,a,r));continue}if(Ef(e,r)){for(r+=1;r<e.length;){let h=e[r];if(Rn(h)||h===46||h===101||h===69||h===43||h===45)r+=1;else break}i.push(Yt("number",e,a,r));continue}if(c===123||c===125||c===44||c===58){r+=1,i.push(Yt("symbol",e,a,r));continue}r+=1,i.push(Yt("other",e,a,r))}let s=i.filter(a=>!Pf(a)),o=null;for(let a=0;a<s.length-1;a+=1)if(s[a].kind==="identifier"&&ia(s[a])==="FormatVersion"){let c=s[a+1];if(c.kind==="number"){let h=Number.parseInt(ia(c),10);Number.isFinite(h)&&(o=h)}break}return o===null?n.push(it("warning","MDL_MISSING_VERSION","No FormatVersion value was found.",0)):Lt.includes(o)||n.push(it("warning","MDL_UNSUPPORTED_VERSION",`Format version ${o} is retained but has no semantic decoder yet.`,0,{version:o,supportedVersions:Lt})),new Rr(e,i,n,o)}var Cf=new Set(["whitespace","line-comment","block-comment"]),ve=t=>t?.raw.toString("utf8"),la=t=>/^(?:[+-]?(?:\d|\.)|[+-]?(?:nan|inf(?:inity)?)$)/i.test(ve(t)||""),Dn=t=>/^[-+]?nan$/i.test(ve(t))?NaN:/^[+]?inf(?:inity)?$/i.test(ve(t))?1/0:/^-inf(?:inity)?$/i.test(ve(t))?-1/0:Number(ve(t)),Oi=t=>Number.isNaN(t)?"nan":t===1/0?"inf":t===-1/0?"-inf":Object.is(t,-0)?"-0":String(t);function yn(t){let e=xn.from(t),n=Be(e).tokens.filter(s=>!Cf.has(s.kind));for(let s=n.length-2;s>=0;s--)ve(n[s])==="-"&&/^inf(?:inity)?$/i.test(ve(n[s+1]))&&n.splice(s,2,{...n[s],end:n[s+1].end,raw:xn.from("-inf")});let i=0;function r(s=!1){let o=[];for(;i<n.length&&(!s||ve(n[i])!=="}");){if(ve(n[i])===","){i++;continue}let a=i,c=[];for(;i<n.length&&!["{","}",","].includes(ve(n[i]));)c.push(n[i++]);let h=null,l=null,d=null;if(ve(n[i])==="{"){if(l=n[i++],h=r(!0),d=n[i++],ve(d)!=="}")throw new Error("Unterminated MDL member.")}else if(ve(n[i])==="}"&&i===a)break;if(ve(n[i])===","&&i++,i===a)throw new Error("Invalid MDL member.");let u=ve(c[0])==="static",f=ve(c[u?1:0])||"";o.push({name:f,isStatic:u,header:c,children:h,open:l,close:d,start:n[a].start,end:n[i-1].end,tokens:n.slice(a,i)})}return o}return{bytes:e,members:r()}}var If=t=>t.tokens.filter(e=>la(e)),Ft=t=>If(t).map(Dn);function Ln(t,e=!1,n=!1){if(!t.children){let o=t.header.find(a=>a.kind==="string");return o?ve(o).slice(1,-1):Dn(t.header[t.isStatic?2:1])}let i=t.children.find(o=>["DontInterp","Linear","Hermite","Bezier"].includes(o.name)),r=e?Int32Array:Float32Array;if(!i){let o=r.from(Ft({...t,tokens:t.tokens.filter(a=>a.start>t.open.start)}));return n?o.reverse():o}let s={LineType:["DontInterp","Linear","Hermite","Bezier"].indexOf(i.name),GlobalSeqId:null,Keys:[]};for(let o of t.children)if(o.name==="GlobalSeqId")s.GlobalSeqId=Ln(o);else if(o.header.some(a=>ve(a)===":")){let a=o.header.find(l=>ve(l)===":"),c=Ft({...o,tokens:o.tokens.filter(l=>l.start>(o.open?.start??a.start))}),h=r.from(c);s.Keys.push({Frame:Dn(o.header[0]),Vector:n?h.reverse():h})}else if(["InTan","OutTan"].includes(o.name)&&s.Keys.length){let a=r.from(Ft(o));s.Keys.at(-1)[o.name]=n?a.reverse():a}return s}function ca(t,e){let n=[],i=0;for(let r of e.sort((s,o)=>s.start-o.start||o.end-s.end))r.start<i||(n.push(t.subarray(i,r.start),xn.from(r.text)),i=r.end);return n.push(t.subarray(i)),xn.concat(n)}var Rf={Model:"Info",Sequences:"Sequences",GlobalSequences:"GlobalSequences",Textures:"Textures",Materials:"Materials",TextureAnims:"TextureAnims",Geoset:"Geosets",GeosetAnim:"GeosetAnims",Bone:"Bones",Helper:"Helpers",Light:"Lights",Attachment:"Attachments",EventObject:"EventObjects",CollisionShape:"CollisionShapes",ParticleEmitter:"ParticleEmitters",ParticleEmitter2:"ParticleEmitters2",RibbonEmitter:"RibbonEmitters",ParticleEmitterPopcorn:"ParticleEmitterPopcorns",Camera:"Cameras",PivotPoints:"PivotPoints",FaceFX:"FaceFX",BindPose:"BindPoses"},sa={Sequences:"Anim",Textures:"Bitmap",Materials:"Material",TextureAnims:"TVertexAnim"};function ha(t,e,n){let i={};for(let r of t){let s=Rf[r.name];if(s){if(sa[r.name])(r.children||[]).filter(o=>o.name===sa[r.name]).forEach((o,a)=>ni(o,e[s]?.[a],n));else if(["Model","PivotPoints"].includes(r.name))ni(r,e[s],n);else if(r.name!=="GlobalSequences"){let o=i[s]||0;i[s]=o+1,ni(r,e[s]?.[o],n)}}}}function ni(t,e,n){if(e){if(n(t,e),t.name==="Material"&&(t.children||[]).filter(i=>i.name==="Layer").forEach((i,r)=>ni(i,e.Layers?.[r],n)),t.name==="Geoset"&&(t.children||[]).filter(i=>i.name==="Anim").forEach((i,r)=>ni(i,e.Anims?.[r],n)),t.name==="ParticleEmitter")for(let i of t.children||[])i.name==="Particle"&&n(i,e);if(t.name==="Camera")for(let i of t.children||[])i.name==="Target"&&n(i,{Position:e.TargetPosition,Translation:e.TargetTranslation})}}var Ni={WrapWidth:4,WrapHeight:8,Unlit:256,BackFacesForShadows:512,AmbientOcclusion:1024},Bi={SortPrimsNearZ:8,TwoSided:2},ii={DontInheritTranslation:1,DontInheritRotation:2,DontInheritScaling:4,Billboarded:8,BillboardedLockX:16,BillboardedLockY:32,BillboardedLockZ:64,CameraAnchored:128},oa={shader_sd_legacy:0,shader_hd_defaultunit:1,shader_sd_fixedfunction:2,shader_hd_crystal:24},Dr=new Set(["SyncPoint","SelectionFlags","ShadowIntensity","ShadowCasting","ShadowCastingStart","ShadowCastingEnd","QuadraticFalloff","LinearFalloff","Damping"]),Fr={DOFDistance:"FocusDistance",FocusDistanceKeys:"FocusDistance",FocalLength:"FocalLength",FocalLengthKeys:"FocalLength",FStop:"FStop",FStopKeys:"FStop"},Lf={ShadowIntensity:1200,ShadowCasting:1300,ShadowCastingStart:1300,ShadowCastingEnd:1300,QuadraticFalloff:1600,LinearFalloff:1600,Damping:1600};function ua(t){let e=yn(t),n=[];function i(r,s){let o=()=>n.push({start:r.start,end:r.end,text:""});if(r.name==="Glider"){o();return}if(r.name==="Visibility"&&r.isStatic&&!r.children){o();return}if(s==="ParticleEmitter"&&["Path","LifeSpan","InitVelocity"].includes(r.name)){n.push({start:r.start,end:r.end,text:`Particle { ${e.bytes.subarray(r.start,r.end).toString("utf8")} }`});return}if(r.name==="DontInherit"){o();return}if(r.name in ii&&r.name.startsWith("DontInherit")){o();return}if(r.name==="SortPrimitives"&&n.push({start:r.header[0].start,end:r.header[0].end,text:"SortPrimsFarZ"}),r.name==="LevelOfDetailName"&&n.push({start:r.header[0].start,end:r.header[0].end,text:"Name"}),(r.name==="EmitterUsesMdl"||r.name==="EmitterUsesTga")&&n.push({start:r.header[0].start,end:r.header[0].end,text:r.name==="EmitterUsesMdl"?"EmitterUsesMDL":"EmitterUsesTGA"}),Dr.has(r.name)||s==="Layer"&&r.name in Ni||s==="Material"&&(r.name in Bi||r.name==="Unfogged")||r.name==="PopcornScaling"){o();return}if(s==="Layer"&&r.name==="Shader"){let a=Ln(r).toLowerCase();if(!(a in oa))throw new Error(`Unknown layer shader ${a}.`);n.push({start:r.start,end:r.end,text:`ShaderTypeId ${oa[a]},`});return}if(s==="RibbonEmitter"&&r.name==="Color"&&!r.isStatic&&r.children?.some(a=>["DontInterp","Linear","Hermite","Bezier"].includes(a.name))){o();return}if(s==="Camera"&&(r.name==="Visibility"||r.name in Fr)){o();return}if((r.name==="Plane"||r.name==="Cylinder")&&n.push({start:r.start,end:r.end,text:"Box,"}),r.name==="SkinWeights"&&r.children){let a=Ft({...r,tokens:r.tokens.filter(h=>h.start>r.open.start)}),c=[];if(a.length%8)throw new Error("SkinWeights requires eight values per vertex.");for(let h=0;h<a.length;h+=8)c.push(`{ ${a.slice(h,h+8).map(l=>l&255).join(", ")} },`);n.push({start:r.open.end,end:r.close.start,text:c.join(`
`)});return}if(r.name==="TextureID"){let a=r.tokens.findIndex(c=>ve(c)==="<");if(a>=0){let c=Dn(r.tokens[a+2]),h=$t[c];if(!h)throw new Error(`Unsupported texture slot ${c}.`);let l=r.header[r.isStatic?1:0];n.push({start:l.start,end:l.end,text:h}),n.push({start:r.tokens[a].start,end:r.tokens[a+2].end,text:""})}}for(let a of r.children||[])i(a,r.name)}for(let r of e.members)i(r,null);for(let r of Be(e.bytes).tokens)(r.kind==="line-comment"||r.kind==="block-comment")&&n.push({start:r.start,end:r.end,text:" "});for(let r of Be(e.bytes).tokens)r.kind!=="string"&&/^[-+]?(?:nan|inf(?:inity)?)$/i.test(ve(r))&&n.push({start:r.start,end:r.end,text:"0"});return{text:ca(e.bytes,n).toString("utf8"),restore(r){Ff(e.members,r)}}}function Ff(t,e){e.Gliders=t.filter(n=>n.name==="Glider").map(n=>({GeosetId:Ln(n.children.find(i=>i.name==="GeosetId"))})),ha(t,e,(n,i)=>{if(n.name==="PivotPoints")return;if(n.name==="Anim"&&!n.header.some(s=>s.kind==="string"))for(let s of["Alpha","Color","Flags","GeosetId"])n.children.some(o=>o.name===s)||delete i[s];n.name==="ParticleEmitterPopcorn"&&(i.Flags&=-393217);let r=0;for(let s of n.children||[]){let o=s.name==="LevelOfDetailName"?"Name":s.name;if(!["FilterMode","Shape","LightType","Groups"].includes(o)){if(o==="Faces"&&n.name==="Geoset"){let a=(s.children||[]).flatMap(c=>(c.children||[]).filter(h=>h.children));i.PrimitiveTypes=Uint32Array.from(a,()=>4),i.PrimitiveCounts=Uint32Array.from(a,c=>Ft(c).length);continue}if(o==="TextureID"){let a=s.tokens.findIndex(c=>ve(c)==="<");a>=0&&(o=$t[Dn(s.tokens[a+2])])}if(n.name==="Layer"&&o in Ni){i.Shading|=Ni[o];continue}if(n.name==="Material"&&o in Bi){i.RenderMode|=Bi[o];continue}if(n.name==="Material"&&o==="Unfogged"){i.Unfogged=!0;continue}if(n.name==="Light"&&o==="ShadowCasting"){i.ShadowCasting=1;continue}if(n.name==="Camera"&&o in Fr){let a=Ln(s);i[Fr[o]]=typeof a=="number"?{LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:Float32Array.of(a)}]}:a;continue}if("ObjectId"in i&&o in ii){i.Flags|=ii[o],delete i[o];continue}if(o==="DontInherit"){for(let a of s.children||[])i.Flags|=ii["DontInherit"+a.name]||0;continue}if(n.name==="ParticleEmitterPopcorn"&&o==="Unfogged"){i.Flags|=131072;continue}if(n.name==="ParticleEmitterPopcorn"&&o==="PopcornScaling"){i.Flags|=262144;continue}if(o==="Plane"||o==="Cylinder"){i.Shape=o==="Plane"?1:3;continue}if(o==="SkinWeights"){i.SkinWeights=(e.Version>=1400?Uint16Array:Uint8Array).from(Ft({...s,tokens:s.tokens.filter(a=>a.start>s.open.start)}));continue}if(["Interval","LifeSpanUVAnim","DecayUVAnim","TailUVAnim","TailDecayUVAnim"].includes(o)){i[o]=Uint32Array.from(Ft(s));continue}if(o==="TVertices"){i.TVertices[r++]=Ln(s);continue}if(["Vertices","Normals","Tangents","VertexGroup","EventTrack"].includes(o)){let a=o==="EventTrack"?Int32Array:o==="VertexGroup"?Uint8Array:Float32Array;i[o]=a.from(Ft({...s,tokens:s.tokens.filter(c=>c.start>s.open.start)}));continue}if(Dr.has(o)||o in i&&(typeof i[o]=="number"||typeof i[o]=="string"||ArrayBuffer.isView(i[o])||i[o]?.Keys)||o==="Visibility"&&"ObjectId"in i||["Color","Visibility"].includes(o)&&["RibbonEmitter","Camera"].includes(n.name)){if(["ObjectId","Parent"].includes(o)||!s.header[1]&&!s.children)continue;let a=["Color","AmbColor"].includes(o)&&n.name!=="ParticleEmitterPopcorn",c=i[o],h=Ln(s,$t.includes(o)||o==="TextureSlot",a);h?.Keys&&c!=null&&!c.Keys&&(n.children||[]).some(l=>l!==s&&l.name===s.name&&l.isStatic)&&((i._MdxDefaults||={})[o]=c),i[o]=h}}}n.name==="Geoset"&&i.SelectionFlags!=null&&(i.Unselectable=!!(i.SelectionFlags&4))});for(let n of e.EventObjects||[])n.EventTrack=Int32Array.from(n.EventTrack)}var Fn=(t,e=!1)=>`{ ${Array.from(t,Oi)[e?"reverse":"slice"]().join(", ")} }`,aa=(t,e)=>t.length===1?Oi(t[0]):Fn(t,e);function ut(t,e,n=!1,i=!1){if(e?.Keys){let r=[["DontInterp","Linear","Hermite","Bezier"][e.LineType]+","];e.GlobalSeqId!=null&&r.push(`GlobalSeqId ${e.GlobalSeqId},`);for(let s of e.Keys)if(r.push(`${s.Frame}: ${aa(s.Vector,n)},`),e.LineType>=2)for(let o of["InTan","OutTan"])r.push(`${o} ${aa(s[o],n)},`);return`${t} ${e.Keys.length} {
${r.join(`
`)}
}`}return`${i?"static ":""}${t} ${typeof e=="string"?`"${e}"`:typeof e=="number"?Oi(e):Fn(e,n)},`}function fa(t,e){let n=yn(t),i=[];ha(n.members,e,(s,o)=>{s.name==="Particle"&&(o={Path:o.Path,LifeSpan:o.LifeSpan,InitVelocity:o.InitVelocity});let a=[],c=0;if(s.name==="PivotPoints"){i.push({start:s.open.end,end:s.close.start,text:`
`+o.map(l=>Fn(l)+",").join(`
`)+`
`});return}if(s.name==="BindPose"){let l=s.children.find(d=>d.name==="Matrices");l&&i.push({start:l.open.end,end:l.close.start,text:`
`+o.Matrices.map(d=>Fn(d)+",").join(`
`)+`
`});return}let h=new Set;for(let l of s.children||[]){let d=l.name;h.add(d);let u=o[d];if(s.name==="Material"&&d==="SortPrimsFarZ"){i.push({start:l.start,end:l.end,text:"SortPrimitives,"});continue}if(d==="Faces"&&o.PrimitiveCounts&&Array.from(o.PrimitiveCounts).reduce((f,p)=>f+p,0)===o.Faces.length){let f=0,p=Array.from(o.PrimitiveCounts,m=>{let x=Fn(o.Faces.subarray(f,f+m));return f+=m,x+","});i.push({start:l.start,end:l.end,text:`Faces ${p.length} ${o.Faces.length} { Triangles { ${p.join(`
`)} } }`});continue}if(d==="TVertices"&&(u=o.TVertices[c++]),d==="SegmentColor"&&o.SegmentColor){i.push({start:l.open.end,end:l.close.start,text:o.SegmentColor.map(f=>ut("Color",f,!0)).join(`
`)});continue}if(d==="TVertices"&&!u){i.push({start:l.start,end:l.end,text:""});continue}if(d==="DontInherit"){i.push({start:l.start,end:l.end,text:(l.children||[]).map(f=>`DontInherit { ${f.name} },`).join(`
`)});continue}if(["Vertices","Normals","Tangents","TVertices","VertexGroup","EventTrack","SkinWeights"].includes(d)&&ArrayBuffer.isView(u)){let f={Vertices:3,Normals:3,Tangents:4,TVertices:2,VertexGroup:1,EventTrack:1,SkinWeights:8}[d],p=[];for(let m=0;m<u.length;m+=f)p.push(f===1?Oi(u[m])+",":Fn(u.subarray(m,m+f))+",");i.push({start:l.open.end,end:l.close.start,text:`
`+p.join(`
`)+`
`});continue}if(!(u==null||typeof u=="boolean"||["ObjectId","Parent","Flags","Shape","LightType","FilterMode","RenderMode","Shading","Rows","Columns","Faces","Groups"].includes(d))&&(typeof u=="number"||typeof u=="string"||ArrayBuffer.isView(u)||u.Keys)){let f=["Color","AmbColor"].includes(d)&&s.name!=="ParticleEmitterPopcorn",p=o._MdxDefaults?.[d],m=u.Keys&&p!=null?ut(d,p,f,!0)+`
`:"";i.push({start:l.start,end:l.end,text:m+ut(s.name==="Geoset"&&d==="Name"?"LevelOfDetailName":d,u,f,l.isStatic)})}}for(let l of Dr)if(o[l]!=null&&!h.has(l)&&l!=="ShadowCasting"&&e.Version>=(Lf[l]||0)){let d=l==="SelectionFlags"?(o.SelectionFlags&-5|(o.Unselectable?4:0))>>>0:o[l];a.push(ut(l,d,!1,d?.Keys?!1:["ShadowIntensity","ShadowCastingStart","ShadowCastingEnd","QuadraticFalloff","LinearFalloff","Damping"].includes(l)))}if(s.name==="Light"&&o.ShadowCasting&&e.Version>=1300&&a.push("ShadowCasting,"),s.name==="Camera")for(let l of["FocusDistance","FocalLength","FStop"])o[l]&&a.push(ut(l+"Keys",o[l]));if(s.name==="Layer")for(let[l,d]of Object.entries(Ni))o.Shading&d&&a.push(l+",");if(s.name==="Material")for(let[l,d]of Object.entries(Bi))o.RenderMode&d&&a.push(l+",");if(s.name==="Material"&&o.Unfogged&&a.push("Unfogged,"),"ObjectId"in o)for(let[l,d]of Object.entries(ii))o.Flags&d&&!h.has(l)&&!l.startsWith("DontInherit")&&a.push(l+",");if(s.name==="ParticleEmitterPopcorn"){for(let l of s.children||[])l.name==="Unfogged"&&i.push({start:l.start,end:l.end,text:""});o.Flags&131072&&a.push("Unfogged,"),o.Flags&262144&&a.push("PopcornScaling,");for(let l of["LifeSpan","EmissionRate","Speed","Alpha"])o[l]!=null&&!h.has(l)&&a.push(ut(l,o[l],!1,!0))}if(s.name==="CollisionShape"&&[1,3].includes(o.Shape)){let l=s.children.find(d=>["Box","Sphere"].includes(d.name));l&&i.push({start:l.start,end:l.end,text:o.Shape===1?"Plane,":"Cylinder,"}),o.Shape===3&&!h.has("BoundsRadius")&&a.push(ut("BoundsRadius",o.BoundsRadius))}for(let l of["Color","Visibility"])o[l]?.Keys&&!h.has(l)&&a.push(ut(l,o[l],l==="Color"));if(typeof o.Visibility=="number"&&!h.has("Visibility")&&a.push(ut("Visibility",o.Visibility,!1,!0)),s.name==="GeosetAnim"&&o.Flags&2&&!h.has("Color")&&o.Color&&a.push(ut("Color",o.Color,!0,!0)),s.name==="Light")for(let l of["Color","AmbColor"])o[l]&&!h.has(l)&&a.push(ut(l,o[l],!0,!0));for(let l of["BoundsRadius","MinimumExtent","MaximumExtent"])o[l]!=null&&!h.has(l)&&a.push(ut(l,o[l]));a.length&&i.push({start:s.close.start,end:s.close.start,text:`
`+a.join(`
`)+`
`})});let r=(e.Gliders||[]).map(s=>`
Glider { GeosetId ${s.GeosetId}, }
`).join("");return xn.concat([ca(n.bytes,i),xn.from(r)])}function da(t){let{bytes:e,members:n}=yn(t);function i(r,s){let o="	".repeat(s);if(!r.children)return o+e.subarray(r.start,r.end).toString("utf8").trim();let a=e.subarray(r.start,r.open.start).toString("utf8").trim(),c=e.subarray(r.close.end,r.end).toString("utf8").trim(),h=r.name==="DontInherit"||!["VertexGroup","EventTrack","GlobalSequences"].includes(r.name)&&r.children.length>0&&r.children.every(d=>!d.children&&d.header.every(la)),l=a?a+" ":"";return h?o+l+"{ "+r.children.map(d=>i(d,0)).join(" ")+" }"+c:o+l+`{
`+r.children.map(d=>i(d,s+1)).join(`
`)+(r.children.length?`
`:"")+o+"}"+c}return xn.from(n.map(r=>i(r,0)).join(`
`)+`
`)}function pa(t){let e=yn(t).members[0],n=Ft({...e,tokens:e.tokens.filter(r=>r.start>e.open.start)}),i=Dn(e.header[1]);if(n.length!==i*3)throw new Error("PivotPoints count does not match its coordinates.");return Array.from({length:i},(r,s)=>Float32Array.from(n.slice(s*3,s*3+3)))}var Vi=Object.freeze(["Bones","Lights","Helpers","Attachments","ParticleEmitters","ParticleEmitters2","ParticleEmitterPopcorns","RibbonEmitters","EventObjects","CollisionShapes"]),Ur=t=>Vi.flatMap(e=>t[e]||[]);function ma(t,{preserveUnusedPivots:e=!1}={}){let n=Ur(t),i=new Set;for(let l of n){if(!Number.isInteger(l?.ObjectId)||l.ObjectId<0||i.has(l.ObjectId))throw Error("The model has invalid or duplicate node object IDs.");i.add(l.ObjectId)}let r=new Map(n.map((l,d)=>[l.ObjectId,d])),s=n.map(l=>{if(l.Parent==null||l.Parent===-1)return l.Parent;if(!r.has(l.Parent))throw Error(`Node ${l.Name||l.ObjectId} references missing parent ${l.Parent}.`);return r.get(l.Parent)}),o=n.map(l=>{let d=t.PivotPoints?.[l.ObjectId]||l.PivotPoint;if(!d||d.length!==3||Array.from(d).some(u=>!Number.isFinite(u)))throw Error(`Node ${l.Name||l.ObjectId} has an invalid pivot reference.`);return d});e&&t.PivotPoints?.forEach((l,d)=>{i.has(d)||o.push(l)});let a=(t.Geosets||[]).map((l,d)=>(l.Groups||[]).map(u=>u.map(f=>{if(!r.has(f))throw Error(`Geoset ${d} references missing node ${f}.`);return r.get(f)}))),c=(t.Geosets||[]).map((l,d)=>{if(!l.SkinWeights?.length)return null;let u=new l.SkinWeights.constructor(l.SkinWeights),f=t.Version>=1400?65535:255;for(let p=0;p<u.length;p+=8)for(let m=0;m<4;m++){if(!u[p+4+m]){u[p+m]=0;continue}let x=u[p+m],g=r.get(x);if(g==null)throw Error(`Geoset ${d} skin weights reference missing node ${x}.`);if(g>f)throw Error(`Geoset ${d} cannot represent remapped node ${g} in its skin-weight format.`);u[p+m]=g}return u}),h=(t.BindPoses||[]).map((l,d)=>{if(!Array.isArray(l.Matrices))throw Error(`Bind pose ${d} has invalid matrices.`);let u=l.Matrices.length-(t.Cameras?.length||0);return n.map(p=>{let m=l.Matrices[p.ObjectId];if(!m||p.ObjectId>=u)throw Error(`Bind pose ${d} is missing matrix ${p.ObjectId}.`);return m}).concat(l.Matrices.slice(u))});n.forEach((l,d)=>{l.ObjectId=d,l.Parent=s[d],l.PivotPoint=o[d]});for(let l=0;l<(t.Geosets||[]).length;l++)t.Geosets[l].Groups=a[l],t.Geosets[l].TotalGroupsCount=a[l].reduce((d,u)=>d+u.length,0),c[l]&&(t.Geosets[l].SkinWeights=c[l]);return(t.BindPoses||[]).forEach((l,d)=>{l.Matrices=h[d]}),t.PivotPoints=o,t.Nodes=[],n.forEach(l=>{t.Nodes[l.ObjectId]=l}),r}var Nr=t=>Array.isArray(t?.Color?.Keys),ga=t=>!!(t?.Flags&2),Df=t=>t==null||(Array.isArray(t)||ArrayBuffer.isView(t))&&t.length===3&&Array.from(t).every(e=>e===1),ri=t=>!ga(t)&&!Nr(t)&&Df(t?.Color),va=(t,e)=>ri(t)&&ri(e);function xa(t,e){return t.map(n=>ri(n)?{...n,Color:e==="mdl"?null:new Float32Array([1,1,1])}:n)}function ya(t,e){let n=[];for(let[i,r]of t.entries()){let s=`GeosetAnims[${i}].Color`;!Nr(r)&&!ri(r)&&(!(r.Color instanceof Float32Array)||r.Color.length!==3||!r.Color.every(Number.isFinite))?n.push(`${s}: invalid static color; expected three finite RGB values.`):e==="mdl"&&!ga(r)&&!ri(r)&&n.push(`${s}: ${Nr(r)?"disabled tint with a color track":"dormant nonwhite color"} cannot be represented in MDL without enabling tint; save as MDX to preserve it.`)}return n}var Uf=new Set(["_GeosetTabId","_AnimationSpeed","_AnimationSpeedFrame","_AnimationSpeedEvents","Nodes","PivotPoint","TotalGroupsCount","NumGeosets","NumGeosetAnims","NumBones","NumHelpers","NumLights","NumAttachments","NumEvents","NumParticleEmitters","NumParticleEmitters2","NumRibbonEmitters"]),Br={AnimationFile:"",Path:"",PriorityPlane:0,Gravity:0,SyncPoint:0,Flags:0,SelectionFlags:0,Variant:0,Shader:"",Name:"",LevelOfDetail:0,Alpha:1,EmissiveGain:1,FresnelOpacity:0,FresnelTeamColor:0,ShaderTypeId:0,ShadowIntensity:0,ShadowCasting:0,ShadowCastingStart:0,ShadowCastingEnd:0,QuadraticFalloff:5e-4,LinearFalloff:0,Damping:1e-5,_MdxTextureId:0},Or=(t,e)=>Object.is(t,e)||Object.is(Math.fround(t),Math.fround(e)),Nf=new Set(["Version","Frame","Flags","RenderMode","Shading","SelectionFlags","SyncPoint","ObjectId","Parent","GeosetId","GeosetAnimId","MaterialID","TextureID","NormalTextureID","ORMTextureID","EmissiveTextureID","TeamColorTextureID","ReflectionsTextureID","TextureSlot","TVertexAnimId","CoordId","GlobalSeqId","LineType","AttachmentID","ReplaceableId","FilterMode","LightType","Shape","Rows","Columns","PriorityPlane","SelectionGroup","LevelOfDetail","ShaderTypeId","Variant","BlendTime","_MdxTextureId"]);function Bf(t,e){return t==null?!0:e in Br?typeof t=="number"?Or(t,Br[e]):t===Br[e]:e==="FresnelColor"?Array.from(t).every(n=>n===1):!1}function Of(t,e,{keys:n=Object.keys(t),limit:i=12}={}){let r=[],s=0,o=c=>{s++,r.length<i&&r.push(c)};function a(c,h,l,d,u=!1){if(!Uf.has(d)&&d!=="_MdxSlots"){if(d==="Visibility"&&typeof c=="number"&&h?.Keys&&h.LineType===0&&h.GlobalSeqId==null){let f=h.Keys.length>0&&h.Keys.every(m=>m.Vector.length===1&&Or(c,m.Vector[0])),p=(t.Sequences||[]).every(m=>h.Keys.some(x=>x.Frame>=m.Interval[0]&&x.Frame<=m.Interval[1]));if(f&&p)return}if(c==null||h==null){if(c==null&&h==null||Bf(c??h,d))return;o(l);return}if(typeof c=="number"&&typeof h=="number"){(u||Nf.has(d)?c!==h:!Or(c,h))&&o(l);return}if(typeof c!="object"||typeof h!="object"){c!==h&&o(l);return}if(ArrayBuffer.isView(c)||Array.isArray(c)){if(c.length!==h.length){o(l+".length");return}let f=ArrayBuffer.isView(c)&&!(c instanceof Float32Array)&&!(c instanceof Float64Array);for(let p=0;p<c.length;p++)a(c[p],h[p],`${l}[${p}]`,String(p),f);return}for(let f of new Set([...Object.keys(c),...Object.keys(h)]))if(!(f==="Color"&&/^GeosetAnims\[\d+\]$/.test(l)&&va(c,h))&&!(f==="BoundsRadius"&&"Shape"in c&&c.Shape<2)){if(f==="Flags"&&"NonLooping"in c){a((c.Flags||0)&-2,(h.Flags||0)&-2,l+".Flags",f);continue}if(f==="SelectionFlags"){a((c[f]||0)&-5,(h[f]||0)&-5,l+"."+f,f);continue}if((f==="PrimitiveTypes"||f==="PrimitiveCounts")&&(!c[f]||!h[f])){let p=c.PrimitiveTypes||h.PrimitiveTypes,m=c.PrimitiveCounts||h.PrimitiveCounts;if(p?.length===1&&p[0]===4&&m?.length===1&&m[0]===(c.Faces||h.Faces)?.length)continue}if(f==="_MdxDefaults"){for(let p of Object.keys(c[f]||{}))a(c[f][p],h[f]?.[p],`${l}.${f}.${p}`,p);continue}a(c[f],h[f],`${l}.${f}`,f)}}}for(let c of n)a(t[c],e[c],c,c);return{total:s,differences:r}}function Gi(t,e,n=12){return`${t} (${e.length} issue${e.length===1?"":"s"}): ${e.slice(0,n).join(" ")}${e.length>n?` ${e.length-n} more.`:""}`}function Vr(t,e,n){let{total:i,differences:r}=Of(t,e,n);if(i){let s=performance.now(),o=new Error(`Save verification failed: serialization changed ${i} field${i===1?"":"s"}: ${r.join(", ")}${i>r.length?`; ${i-r.length} more`:""}.`);throw n?.timings&&(n.timings.errorFormattingMs=performance.now()-s),o}}import{Buffer as Bn}from"buffer";import{Buffer as Dt}from"buffer";var Vf="MDLXL_GEOSET_TABS_V1:8f75130f-6e97-4b72-97d5-bf1d348e91ab",_a="XLGT",Un="_GeosetTabs",gt="_GeosetTabId",Nn=`// ${Vf} `;function ba(t,e){return Array.isArray(t?.tabs)&&t.geosets&&typeof t.geosets=="object"&&!Array.isArray(t.geosets)&&t.tabs.every(n=>typeof n?.id=="string"&&n.id&&!["all","ungrouped"].includes(n.id)&&typeof n.name=="string"&&typeof n.visible=="boolean")&&new Set(t.tabs.map(n=>n.id)).size===t.tabs.length&&Object.entries(t.geosets).every(([n,i])=>/^\d+$/.test(n)&&Number.isSafeInteger(Number(n))&&(!e||e.Geosets[n])&&t.tabs.some(r=>r.id===i))}function Gf(t){try{return ba(JSON.parse(t.text.slice(Nn.length)))}catch{return!1}}function Kt(t){let e=t[Un]||[],n=new Set(e.map(r=>r.id)),i={};return t.Geosets.forEach((r,s)=>{n.has(r[gt])&&(i[s]=r[gt])}),{tabs:e,geosets:i}}function Sa(t){let e=new Set((t[Un]||[]).map(n=>n.id));for(let n of t.Geosets)e.has(n[gt])||delete n[gt]}function Gr(t,e){return e.tag===_a&&Dt.from(t).subarray(e.payloadOffset,e.payloadOffset+Nn.length).toString("utf8")===Nn}function Ma(t,e,n){return e==="mdl"?(n||Be(t)).tokens.filter(i=>i.kind==="line-comment"&&i.raw.toString("utf8").startsWith(Nn)).map(i=>({start:i.start,end:i.end+(t[i.end]===13?t[i.end+1]===10?2:1:t[i.end]===10?1:0),text:i.raw.toString("utf8")})):(n||Ie(t)).chunks.filter(i=>Gr(t,i)).map(i=>({start:i.offset,end:i.payloadOffset+i.declaredSize,text:t.subarray(i.payloadOffset,i.payloadOffset+i.declaredSize).toString("utf8")}))}function Ta(t,e,n,i){let r=Dt.from(t),s=Ma(r,e,i),o=[];for(let a of s){let c;try{c=JSON.parse(a.text.slice(Nn.length))}catch{o.push({severity:"warning",code:"GEOSET_TABS_METADATA",message:"The MDLxL geoset tab comment contains invalid JSON; its source bytes are retained."});continue}if(!ba(c,n)){o.push({severity:"warning",code:"GEOSET_TABS_METADATA",message:"The MDLxL geoset tab comment has invalid tab or geoset references; its source bytes are retained."});continue}c.tabs.length?n[Un]=c.tabs:delete n[Un];for(let h of n.Geosets)delete h[gt];for(let[h,l]of Object.entries(c.geosets))n.Geosets[h][gt]=l}return o}function kr(t,e,n){let i=Dt.from(t),r=[],s=Ma(i,e).filter(Gf),o=0;for(let f of s)r.push(i.subarray(o,f.start)),o=f.end;r.push(i.subarray(o));let a=Dt.concat(r),c=Kt(n);if(!c.tabs.length)return a;let h=Dt.from(Nn+JSON.stringify(c)+`
`,"utf8");if(e==="mdl"){let f=a.subarray(0,3).equals(Dt.from([239,187,191]))?3:0;return Dt.concat([a.subarray(0,f),h,a.subarray(f)])}let l=Dt.alloc(8);l.write(_a,"ascii"),l.writeUInt32LE(h.length,4);let d=Ie(a),u=a.length-d.trailingBytes.length;return Dt.concat([a.subarray(0,u),l,h,a.subarray(u)])}var Aa=t=>JSON.stringify(t,(e,n)=>e==="PivotPoint"||e===gt||["_AnimationSpeed","_AnimationSpeedFrame","_AnimationSpeedEvents"].includes(e)?void 0:ArrayBuffer.isView(n)?Array.from(n):typeof n=="number"&&!Number.isFinite(n)?String(n):n),kf=new Set(["SEQS","TEXS","MTLS","TXAN","GEOS","GEOA","BONE","HELP","ATCH","LITE","PREM","PRE2","RIBB","CORN","CAMS","CLID","EVTS","PIVT","GLBS"]);function wa(t,e){let n=new Map;return t.forEach((i,r)=>{let s=Aa(i);n.has(s)||n.set(s,[]),n.get(s).push(r)}),e.map(i=>n.get(Aa(i))?.shift())}function Pa(t,e,n,i,r){let s=Bn.from(t),o=Bn.from(e),a=new Map(Ie(s).chunks.map(h=>[h.tag,h])),c=new Map(Object.entries(r).map(([h,[,l]])=>[l,h]));return Bn.concat([Bn.from("MDLX"),...Ie(o).chunks.map(h=>{let l=c.get(h.tag),d=a.get(h.tag),u=o.subarray(h.payloadOffset,h.payloadOffset+h.declaredSize);if(!kf.has(h.tag)||!d||!Array.isArray(n[l])||!Array.isArray(i[l]))return ht(h.tag,u);let f=Ne(s.subarray(d.payloadOffset,d.payloadOffset+d.declaredSize),h.tag),p=Ne(u,h.tag),m=wa(n[l],i[l]);if(f.length!==n[l].length||p.length!==i[l].length)throw new Error(`Cannot match ${h.tag} source records safely.`);return ht(h.tag,Bn.concat(p.map((x,g)=>m[g]===void 0?x:f[m[g]])))})])}var Ea={Sequences:"Anim",Textures:"Bitmap",Materials:"Material",TextureAnims:"TVertexAnim"};function Ca(t,e,n,i,r){let s=yn(t),o=yn(e),a=[];for(let[l,[d]]of Object.entries(r)){if(!Array.isArray(n[l])||!Array.isArray(i[l])||["PivotPoints","GlobalSequences","BindPoses"].includes(l))continue;let u=x=>x.members.filter(g=>g.name===d).flatMap(g=>Ea[d]?(g.children||[]).filter(y=>y.name===Ea[d]):[g]),f=u(s),p=u(o),m=wa(n[l],i[l]);f.length!==n[l].length||p.length!==i[l].length||p.forEach((x,g)=>{if(m[g]!==void 0){let y=f[m[g]];a.push({start:x.start,end:x.end,bytes:s.bytes.subarray(y.start,y.end)})}})}let c=[],h=0;for(let l of a.sort((d,u)=>d.start-u.start))c.push(o.bytes.subarray(h,l.start),l.bytes),h=l.end;return c.push(o.bytes.subarray(h)),Bn.concat(c)}var zr=t=>Number.isInteger(t)&&t>=0&&t<=4294967295;function Hr(t){let e=s=>s instanceof Uint32Array,n=(s,o)=>Object.keys(s).every(a=>o.includes(a)),i=s=>!!s&&typeof s=="object"&&!Array.isArray(s)&&Object.entries(s).every(([o,a])=>zr(Number(o))&&e(a)),r=s=>!!s&&e(s.selectable)&&i(s.selection)&&i(s.hidden)&&(s.activeGeoset===-1||zr(s.activeGeoset))&&zr(s.uvSet)&&(s.visibleOnly===void 0||e(s.visibleOnly))&&(s.selectedNodeIds===void 0||e(s.selectedNodeIds))&&n(s,["selectable","visibleOnly","selection","hidden","activeGeoset","uvSet","selectedNodeIds"]);return t?.version===1&&r(t.before)&&r(t.after)&&n(t,["version","before","after"])}var Ia=Object.freeze({budgetBytes:512*1024*1024,maxSteps:1e4}),Ut=t=>structuredClone(t),zi=new Set(["__proto__","prototype","constructor"]),qe=(t,e)=>Object.prototype.hasOwnProperty.call(t,e);function si(t){return t instanceof ArrayBuffer?new Uint8Array(t):new Uint8Array(t.buffer,t.byteOffset,t.byteLength)}function ki(t,e=new Set){return t==null?8:typeof t=="string"?24+t.length*2:typeof t!="object"?16:e.has(t)?8:(e.add(t),ArrayBuffer.isView(t)||t instanceof ArrayBuffer?80+t.byteLength:64+Object.entries(t).reduce((n,[i,r])=>n+16+i.length*2+ki(r,e),0))}function On(t,e,{ignore:n=()=>!1}={}){let i=[],r=new Set,s=[];function o(l,d,u){if(n(u)||Object.is(l,d))return!0;if(!l||!d||typeof l!="object"||typeof d!="object"||l.constructor!==d.constructor)return!1;if(ArrayBuffer.isView(l)||l instanceof ArrayBuffer){if(l.byteLength!==d.byteLength)return!1;if(Wr(l,d))return!0;let p=si(l),m=si(d);for(let x=0;x<p.length;x++)if(p[x]!==m[x])return!1;return!0}if(Array.isArray(l)&&l.length!==d.length)return!1;let f=Object.keys(l);return f.length===Object.keys(d).length&&f.every(p=>qe(d,p)&&o(l[p],d[p],[...u,p]))}function a(l,d,u,f){i.push({kind:"value",path:[...s],beforeExists:u,afterExists:f,before:Ut(l),after:Ut(d)})}function c(l,d,u,f,p){if(zi.has(u))throw new Error(`Unsafe document property: ${u}.`);f===p&&Object.is(l[u],d[u])||(s.push(u),h(l[u],d[u],f,p),s.pop())}function h(l,d,u=!0,f=!0){if(!(n(s)||u===f&&Object.is(l,d))){if(!u||!f||!l||!d||typeof l!="object"||typeof d!="object"||l.constructor!==d.constructor){a(l,d,u,f);return}if(ArrayBuffer.isView(l)||l instanceof ArrayBuffer){if(l.byteLength!==d.byteLength){a(l,d,u,f);return}if(Wr(l,d))return;let p=si(l),m=si(d),x=-1,g=-1,y=()=>{x>=0&&i.push({kind:"bytes",path:[...s],offset:x,before:p.slice(x,g+1),after:m.slice(x,g+1)})};for(let v=0;v<p.length;v++)p[v]!==m[v]?(x<0&&(x=v),g=v):x>=0&&v-g>32&&(y(),x=-1);y();return}if(Array.isArray(l)&&l.length!==d.length){let p=0,m=0;for(;p<Math.min(l.length,d.length)&&o(l[p],d[p],[...s,String(p)]);)p++;for(;m<Math.min(l.length,d.length)-p&&o(l[l.length-m-1],d[d.length-m-1],[...s,String(l.length-m-1)]);)m++;i.push({kind:"splice",path:[...s],index:p,before:Ut(l.slice(p,l.length-m)),after:Ut(d.slice(p,d.length-m))});return}if(!(s.at(-1)==="Keys"&&Array.isArray(l)&&zf(l,d))){if(r.has(d))throw new Error("Document history cannot store a cyclic model value.");r.add(d);for(let p in l)qe(l,p)&&c(l,d,p,!0,qe(d,p));for(let p in d)qe(d,p)&&!qe(l,p)&&c(l,d,p,!1,!0);r.delete(d)}}}for(let l of new Set([...Object.keys(t),...Object.keys(e)])){if(zi.has(l))throw new Error(`Unsafe document property: ${l}.`);s.push(l),h(t[l],e[l],qe(t,l),qe(e,l)),s.pop()}return i}function Wr(t,e){if(t.length===void 0||t.length!==e.length)return!1;for(let n=0;n<t.length;n++)if(!Object.is(t[n],e[n])||t[n]!==t[n])return!1;return!0}function zf(t,e){let n=0;for(let i=0;i<t.length;i++){if(qe(t,i)!==qe(e,i))return!1;qe(t,i)&&n++;let r=t[i],s=e[i];if(!Object.is(r,s)){if(!r||!s||typeof r!="object"||typeof s!="object"||r.constructor!==s.constructor)return!1;for(let o in r)if(qe(r,o)){if(zi.has(o)||!qe(s,o))return!1;if(Object.is(r[o],s[o]))continue;if(!ArrayBuffer.isView(r[o])||r[o].constructor!==s[o]?.constructor||!Wr(r[o],s[o]))return!1}for(let o in s)if(qe(s,o)&&!qe(r,o))return!1}}return Object.keys(t).length===n&&Object.keys(e).length===n}function Ra(t){if(!t||!Array.isArray(t.path)||!t.path.length||t.path.length>128||t.path.some(e=>typeof e!="string"||zi.has(e)))throw new Error("Invalid recovery history path.");if(t.kind==="bytes"){if(!Number.isSafeInteger(t.offset)||t.offset<0||!(t.before instanceof Uint8Array)||!(t.after instanceof Uint8Array)||t.before.length!==t.after.length)throw new Error("Invalid recovery history byte range.")}else if(t.kind==="splice"){if(!Number.isSafeInteger(t.index)||t.index<0||!Array.isArray(t.before)||!Array.isArray(t.after))throw new Error("Invalid recovery history array range.")}else if(t.kind!=="value"||typeof t.beforeExists!="boolean"||typeof t.afterExists!="boolean")throw new Error("Invalid recovery history change.")}function Vn(t,e,n="after"){if(!["before","after"].includes(n))throw new Error("Invalid history direction.");let i=e.map(r=>{Ra(r);let s=t;for(let a of r.path.slice(0,-1)){if(!s||typeof s!="object"||!qe(s,a))throw new Error("History no longer matches this document.");s=s[a]}if(!s||typeof s!="object")throw new Error("History no longer matches this document.");let o=r.path.at(-1);if(r.kind==="bytes"){let a=s[o];if(!(ArrayBuffer.isView(a)||a instanceof ArrayBuffer)||r.offset+r[n].length>a.byteLength)throw new Error("History byte range no longer matches this document.");return{bytes:si(a),offset:r.offset,value:r[n]}}if(r.kind==="splice"){let a=s[o],c=r[n==="after"?"before":"after"].length;if(!Array.isArray(a)||r.index+c>a.length)throw new Error("History array range no longer matches this document.");return{parent:s,key:o,exists:!0,value:a.slice(0,r.index).concat(Ut(r[n]),a.slice(r.index+c))}}return{parent:s,key:o,exists:r[`${n}Exists`],value:Ut(r[n])}});for(let r of i)r.bytes?r.bytes.set(r.value,r.offset):r.exists?r.parent[r.key]=r.value:delete r.parent[r.key]}var oi=class t{constructor(e={}){this.undoEntries=[],this.redoEntries=[],this.usedBytes=0,this.evictedSteps=0,this.lastEntryRetained=!0,this.configure(e)}configure(e={}){let n=e.budgetBytes??this.budgetBytes??Ia.budgetBytes,i=e.maxSteps??this.maxSteps??Ia.maxSteps;if(!Number.isSafeInteger(n)||n<0||!Number.isSafeInteger(i)||i<0)throw new Error("Undo cache limits must be nonnegative integers.");return this.budgetBytes=n,this.maxSteps=i,this._trim(),this.stats}_trim(){for(;this.usedBytes>this.budgetBytes||this.undoEntries.length+this.redoEntries.length>this.maxSteps;){let e=this.undoEntries.length?this.undoEntries.shift():this.redoEntries.shift();if(!e)break;this.usedBytes-=e.bytes,this.evictedSteps++}this.usedBytes=Math.max(0,this.usedBytes)}prepare({label:e,sections:n,changes:i}){let r={label:String(e),sections:[...n],changes:i};return r.bytes=ki(r),r}push(e){return e.changes.length?this.commit(this.prepare(e)):!1}commit(e){for(let n of this.redoEntries)this.usedBytes-=n.bytes;return this.redoEntries=[],this.undoEntries.push(e),this.usedBytes+=e.bytes,this._trim(),this.lastEntryRetained=this.undoEntries.at(-1)===e,this.lastEntryRetained}setSelection(e,n){if(!this.undoEntries.includes(e)&&!this.redoEntries.includes(e))return!1;if(!Hr(n))throw new Error("Invalid selection history.");let{bytes:i,selection:r,...s}=e,o=Ut(n),a=ki({...s,selection:o});e.selection=o,e.bytes=a,this.usedBytes+=a-i,this._trim();let c=this.undoEntries.includes(e)||this.redoEntries.includes(e);return c||(this.lastEntryRetained=!1),c}undo(e){let n=this.undoEntries.at(-1);return n?(e(n.changes,"before"),this.undoEntries.pop(),this.redoEntries.push(n),n):null}redo(e){let n=this.redoEntries.at(-1);return n?(e(n.changes,"after"),this.redoEntries.pop(),this.undoEntries.push(n),n):null}get stats(){return{undoSteps:this.undoEntries.length,redoSteps:this.redoEntries.length,usedBytes:this.usedBytes,budgetBytes:this.budgetBytes,maxSteps:this.maxSteps,evictedSteps:this.evictedSteps,undoLabel:this.undoEntries.at(-1)?.label||"",redoLabel:this.redoEntries.at(-1)?.label||"",lastEntryRetained:this.lastEntryRetained}}capture(){return Ut(this._recoveryState())}_recoveryState(){return{version:1,budgetBytes:this.budgetBytes,maxSteps:this.maxSteps,evictedSteps:this.evictedSteps,lastEntryRetained:this.lastEntryRetained,undoEntries:this.undoEntries,redoEntries:this.redoEntries}}static restore(e){if(e?.version!==1||!Array.isArray(e.undoEntries)||!Array.isArray(e.redoEntries))throw new Error("Invalid recovery history.");let n=new t(e);for(let i of["undoEntries","redoEntries"])n[i]=e[i].map(r=>{if(typeof r.label!="string"||!Array.isArray(r.sections)||!Array.isArray(r.changes))throw new Error("Invalid recovery history entry.");r.changes.forEach(Ra);let s=Ut({label:r.label,sections:r.sections,changes:r.changes,...Hr(r.selection)?{selection:r.selection}:{}});return s.bytes=ki(s),n.usedBytes+=s.bytes,s});return n.evictedSteps=Number.isSafeInteger(e.evictedSteps)&&e.evictedSteps>=0?e.evictedSteps:0,n.lastEntryRetained=e.lastEntryRetained!==!1,n._trim(),n}};import{Buffer as jt}from"buffer";function La(t){let e=jt.from(t),n=Be(e).tokens.filter(h=>!["whitespace","line-comment","block-comment"].includes(h.kind)),i=h=>h?.raw.toString("utf8"),r=null,s=null,o=null,a=null,c=0;for(let h=0;h<n.length;h++){let l=n[h],d=i(l);if(d==="{"&&c++,d==="}"&&c--,c===1&&d==="ObjectId"&&(r=Number(i(n[h+1]))),c===1&&d==="EventTrack"&&i(n[h+2])==="{"){o=n[h+2];for(let u=h+3;u<n.length&&i(n[u])!=="}";u++)if(i(n[u])==="GlobalSeqId"){if(a)throw new Error("EventTrack contains more than one GlobalSeqId.");let f=Number(i(n[u+1]));if(!Number.isInteger(f)||f<0||f>2147483647||i(n[u+2])!==",")throw new Error("EventTrack GlobalSeqId must be a non-negative integer.");s=f,a={start:n[u].start,end:n[u+2].end}}}}return{bytes:e,objectId:r,globalSeqId:s,trackOpen:o,remove:a}}function Fa(t){let{bytes:e,objectId:n,globalSeqId:i,remove:r}=La(t);return{objectId:n,globalSeqId:i,bytes:r?jt.concat([e.subarray(0,r.start),jt.from(" "),e.subarray(r.end)]):e}}function Da(t,e,n){let i=jt.from(t),r=new Map((n.EventObjects||[]).map(a=>[a.ObjectId,a])),s=[],o=0;for(let a of e){if(a.key!=="EventObjects")continue;let c=i.subarray(a.start,a.end),{objectId:h,trackOpen:l}=La(c),d=r.get(h)?.GlobalSeqId;if(!Number.isInteger(d)||d<0||!l)continue;let u=a.start+l.end;s.push(i.subarray(o,u),jt.from(`
		GlobalSeqId ${d},`)),o=u}return s.push(i.subarray(o)),jt.concat(s)}function Ua(t,e){for(let n of Ie(t).chunks)if(n.tag==="EVTS"){let i=n.payloadOffset+n.declaredSize;for(let r=n.payloadOffset;r<i;){if(r+96>i)throw new Error("Truncated EventObject node.");let s=t.readUInt32LE(r),o=r+s;if(s<96||o+12>i||t.toString("ascii",o,o+4)!=="KEVT")throw new Error("Invalid EventObject track layout.");let a=t.readUInt32LE(o+4),c=o+12+a*4;if(c>i)throw new Error("Truncated EventObject track.");e({objectId:t.readInt32LE(r+84),globalSeqId:t.readInt32LE(o+8),offset:o+8}),r=c}}}function Na(t,e){let n=jt.from(t),i=new Map((e.EventObjects||[]).map(r=>[r.ObjectId,r]));Ua(n,({objectId:r,globalSeqId:s})=>{let o=i.get(r);o&&s>=0&&(o.GlobalSeqId=s)})}function Xr(t,e){let n=jt.from(t),i=new Map((e.EventObjects||[]).map(r=>[r.ObjectId,r]));return Ua(n,({objectId:r,offset:s})=>{let o=i.get(r)?.GlobalSeqId;n.writeInt32LE(Number.isInteger(o)&&o>=0?o:-1,s)}),n}import{Buffer as Hf}from"buffer";function Ba(t,e,n){let i=Hf.from(t),r=new Map((n.ParticleEmitterPopcorns||[]).map(s=>[s.ObjectId,s]));if(r.size)for(let s of e){if(s.key!=="ParticleEmitterPopcorns")continue;let o=i.subarray(s.start,s.end),a=Be(o).tokens.filter(u=>!["whitespace","line-comment","block-comment"].includes(u.kind)),c=u=>u?.raw.toString("utf8"),h=0,l=null,d=null;for(let u=0;u<a.length;u++){let f=c(a[u]);if(f==="{"&&h++,f==="}"&&h--,h===1&&f==="ObjectId"&&(l=Number(c(a[u+1]))),h===1&&f==="Rotation"&&c(a[u+2])==="{"){if(d)throw new Error("Popcorn emitter contains duplicate rotation controllers.");let p=0,m=-1;for(let x=u+2;x<a.length;x++)if(c(a[x])==="{"&&p++,c(a[x])==="}"&&--p===0){m=a[x].end;break}if(m<0)throw new Error("Popcorn rotation controller is incomplete.");d=o.subarray(a[u].start,m).toString("utf8").replace(/\/\*[\s\S]*?\*\//g," ")}}if(d&&r.has(l)){let u=wi(`Version { FormatVersion 800, } Helper "PopcornRotation" { ObjectId 0, ${d} }`);r.get(l).Rotation=u.Helpers[0].Rotation}}}function Oa(t=[]){return t.map(e=>{let n=structuredClone(e.Color);if(n?.Keys)for(let i of n.Keys)for(let r of["Vector","InTan","OutTan"])i[r]?.reverse();else(Array.isArray(n)||ArrayBuffer.isView(n))&&n.reverse();return{...e,Color:n}})}import{Buffer as qr}from"buffer";function Va(t,e,n){let i=qr.from(t),r=[],s=0,o=0;for(let a of e){if(a.key!=="Geosets")continue;let c=n.Geosets[o++]?.TVertices||[];if(c.length<2)continue;let h=Be(i.subarray(a.start,a.end)).tokens.filter(m=>!["whitespace","line-comment","block-comment"].includes(m.kind)),l=0,d=0,u=null;for(let m of h){let x=m.raw.toString("ascii");x==="{"&&l++,l===1&&x==="TVertices"&&m.kind!=="string"&&d++,x==="}"&&(l--,l===0&&(u=m))}if(!u||d>=c.length)continue;let f=c.slice(d).map(m=>{if(m.length%2||Array.from(m).some(g=>!Number.isFinite(g)))throw new Error("Cannot write invalid UV coordinates.");let x=[];for(let g=0;g<m.length;g+=2)x.push(`		{ ${m[g]}, ${m[g+1]} },`);return`	TVertices ${m.length/2} {
${x.join(`
`)}
	}
`}).join(""),p=a.start+u.start;r.push(i.subarray(s,p),qr.from(f)),s=p}return r.push(i.subarray(s)),qr.concat(r)}function Hi(t=[]){return t.map(e=>e.Color?.Keys?{...e,Color:{...e.Color,Keys:e.Color.Keys.map(n=>{let i={...n};for(let r of["Vector","InTan","OutTan"])n[r]&&(i[r]=new Float32Array([n[r][2],n[r][1],n[r][0]]));return i})}}:e)}import{Buffer as Oe}from"buffer";var Re=Uint8Array,rt=Uint16Array,ts=Int32Array,Wi=new Re([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Xi=new Re([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),jr=new Re([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),Ha=function(t,e){for(var n=new rt(31),i=0;i<31;++i)n[i]=e+=1<<t[i-1];for(var r=new ts(n[30]),i=1;i<30;++i)for(var s=n[i];s<n[i+1];++s)r[s]=s-n[i]<<5|i;return{b:n,r}},Wa=Ha(Wi,2),Xa=Wa.b,Zr=Wa.r;Xa[28]=258,Zr[258]=28;var qa=Ha(Xi,0),Wf=qa.b,Ga=qa.r,Jr=new rt(32768);for(Q=0;Q<32768;++Q)Nt=(Q&43690)>>1|(Q&21845)<<1,Nt=(Nt&52428)>>2|(Nt&13107)<<2,Nt=(Nt&61680)>>4|(Nt&3855)<<4,Jr[Q]=((Nt&65280)>>8|(Nt&255)<<8)>>1;var Nt,Q,wt=(function(t,e,n){for(var i=t.length,r=0,s=new rt(e);r<i;++r)t[r]&&++s[t[r]-1];var o=new rt(e);for(r=1;r<e;++r)o[r]=o[r-1]+s[r-1]<<1;var a;if(n){a=new rt(1<<e);var c=15-e;for(r=0;r<i;++r)if(t[r])for(var h=r<<4|t[r],l=e-t[r],d=o[t[r]-1]++<<l,u=d|(1<<l)-1;d<=u;++d)a[Jr[d]>>c]=h}else for(a=new rt(i),r=0;r<i;++r)t[r]&&(a[r]=Jr[o[t[r]-1]++]>>15-t[r]);return a}),Zt=new Re(288);for(Q=0;Q<144;++Q)Zt[Q]=8;var Q;for(Q=144;Q<256;++Q)Zt[Q]=9;var Q;for(Q=256;Q<280;++Q)Zt[Q]=7;var Q;for(Q=280;Q<288;++Q)Zt[Q]=8;var Q,ci=new Re(32);for(Q=0;Q<32;++Q)ci[Q]=5;var Q,Xf=wt(Zt,9,0),qf=wt(Zt,9,1),$f=wt(ci,5,0),Yf=wt(ci,5,1),$r=function(t){for(var e=t[0],n=1;n<t.length;++n)t[n]>e&&(e=t[n]);return e},vt=function(t,e,n){var i=e/8|0;return(t[i]|t[i+1]<<8)>>(e&7)&n},Yr=function(t,e){var n=e/8|0;return(t[n]|t[n+1]<<8|t[n+2]<<16)>>(e&7)},ns=function(t){return(t+7)/8|0},$a=function(t,e,n){return(e==null||e<0)&&(e=0),(n==null||n>t.length)&&(n=t.length),new Re(t.subarray(e,n))};var Kf=["unexpected EOF","invalid block type","invalid length/literal","invalid distance","stream finished","no stream handler",,"no callback","invalid UTF-8 data","extra field too long","date not in range 1980-2099","filename too long","stream finishing","invalid zip data"],xt=function(t,e,n){var i=new Error(e||Kf[t]);if(i.code=t,Error.captureStackTrace&&Error.captureStackTrace(i,xt),!n)throw i;return i},jf=function(t,e,n,i){var r=t.length,s=i?i.length:0;if(!r||e.f&&!e.l)return n||new Re(0);var o=!n,a=o||e.i!=2,c=e.i;o&&(n=new Re(r*3));var h=function(Ce){var et=n.length;if(Ce>et){var De=new Re(Math.max(et*2,Ce));De.set(n),n=De}},l=e.f||0,d=e.p||0,u=e.b||0,f=e.l,p=e.d,m=e.m,x=e.n,g=r*8;do{if(!f){l=vt(t,d,1);var y=vt(t,d+1,3);if(d+=3,y)if(y==1)f=qf,p=Yf,m=9,x=5;else if(y==2){var b=vt(t,d,31)+257,T=vt(t,d+10,15)+4,A=b+vt(t,d+5,31)+1;d+=14;for(var S=new Re(A),D=new Re(19),R=0;R<T;++R)D[jr[R]]=vt(t,d+R*3,7);d+=T*3;for(var L=$r(D),P=(1<<L)-1,U=wt(D,L,1),R=0;R<A;){var w=U[vt(t,d,P)];d+=w&15;var v=w>>4;if(v<16)S[R++]=v;else{var C=0,G=0;for(v==16?(G=3+vt(t,d,3),d+=2,C=S[R-1]):v==17?(G=3+vt(t,d,7),d+=3):v==18&&(G=11+vt(t,d,127),d+=7);G--;)S[R++]=C}}var N=S.subarray(0,b),ee=S.subarray(b);m=$r(N),x=$r(ee),f=wt(N,m,1),p=wt(ee,x,1)}else xt(1);else{var v=ns(d)+4,_=t[v-4]|t[v-3]<<8,M=v+_;if(M>r){c&&xt(0);break}a&&h(u+_),n.set(t.subarray(v,M),u),e.b=u+=_,e.p=d=M*8,e.f=l;continue}if(d>g){c&&xt(0);break}}a&&h(u+131072);for(var xe=(1<<m)-1,ie=(1<<x)-1,fe=d;;fe=d){var C=f[Yr(t,d)&xe],me=C>>4;if(d+=C&15,d>g){c&&xt(0);break}if(C||xt(2),me<256)n[u++]=me;else if(me==256){fe=d,f=null;break}else{var re=me-254;if(me>264){var R=me-257,J=Wi[R];re=vt(t,d,(1<<J)-1)+Xa[R],d+=J}var Me=p[Yr(t,d)&ie],Ke=Me>>4;Me||xt(3),d+=Me&15;var ee=Wf[Ke];if(Ke>3){var J=Xi[Ke];ee+=Yr(t,d)&(1<<J)-1,d+=J}if(d>g){c&&xt(0);break}a&&h(u+131072);var ze=u+re;if(u<ee){var je=s-ee,Fe=Math.min(ee,ze);for(je+u<0&&xt(3);u<Fe;++u)n[u]=i[je+u]}for(;u<ze;++u)n[u]=n[u-ee]}}e.l=f,e.p=fe,e.b=u,e.f=l,f&&(l=1,e.m=m,e.d=p,e.n=x)}while(!l);return u!=n.length&&o?$a(n,0,u):n.subarray(0,u)},Bt=function(t,e,n){n<<=e&7;var i=e/8|0;t[i]|=n,t[i+1]|=n>>8},ai=function(t,e,n){n<<=e&7;var i=e/8|0;t[i]|=n,t[i+1]|=n>>8,t[i+2]|=n>>16},Kr=function(t,e){for(var n=[],i=0;i<t.length;++i)t[i]&&n.push({s:i,f:t[i]});var r=n.length,s=n.slice();if(!r)return{t:Ka,l:0};if(r==1){var o=new Re(n[0].s+1);return o[n[0].s]=1,{t:o,l:1}}n.sort(function(M,b){return M.f-b.f}),n.push({s:-1,f:25001});var a=n[0],c=n[1],h=0,l=1,d=2;for(n[0]={s:-1,f:a.f+c.f,l:a,r:c};l!=r-1;)a=n[n[h].f<n[d].f?h++:d++],c=n[h!=l&&n[h].f<n[d].f?h++:d++],n[l++]={s:-1,f:a.f+c.f,l:a,r:c};for(var u=s[0].s,i=1;i<r;++i)s[i].s>u&&(u=s[i].s);var f=new rt(u+1),p=Qr(n[l-1],f,0);if(p>e){var i=0,m=0,x=p-e,g=1<<x;for(s.sort(function(b,T){return f[T.s]-f[b.s]||b.f-T.f});i<r;++i){var y=s[i].s;if(f[y]>e)m+=g-(1<<p-f[y]),f[y]=e;else break}for(m>>=x;m>0;){var v=s[i].s;f[v]<e?m-=1<<e-f[v]++-1:++i}for(;i>=0&&m;--i){var _=s[i].s;f[_]==e&&(--f[_],++m)}p=e}return{t:new Re(f),l:p}},Qr=function(t,e,n){return t.s==-1?Math.max(Qr(t.l,e,n+1),Qr(t.r,e,n+1)):e[t.s]=n},ka=function(t){for(var e=t.length;e&&!t[--e];);for(var n=new rt(++e),i=0,r=t[0],s=1,o=function(c){n[i++]=c},a=1;a<=e;++a)if(t[a]==r&&a!=e)++s;else{if(!r&&s>2){for(;s>138;s-=138)o(32754);s>2&&(o(s>10?s-11<<5|28690:s-3<<5|12305),s=0)}else if(s>3){for(o(r),--s;s>6;s-=6)o(8304);s>2&&(o(s-3<<5|8208),s=0)}for(;s--;)o(r);s=1,r=t[a]}return{c:n.subarray(0,i),n:e}},li=function(t,e){for(var n=0,i=0;i<e.length;++i)n+=t[i]*e[i];return n},Ya=function(t,e,n){var i=n.length,r=ns(e+2);t[r]=i&255,t[r+1]=i>>8,t[r+2]=t[r]^255,t[r+3]=t[r+1]^255;for(var s=0;s<i;++s)t[r+s+4]=n[s];return(r+4+i)*8},za=function(t,e,n,i,r,s,o,a,c,h,l){Bt(e,l++,n),++r[256];for(var d=Kr(r,15),u=d.t,f=d.l,p=Kr(s,15),m=p.t,x=p.l,g=ka(u),y=g.c,v=g.n,_=ka(m),M=_.c,b=_.n,T=new rt(19),A=0;A<y.length;++A)++T[y[A]&31];for(var A=0;A<M.length;++A)++T[M[A]&31];for(var S=Kr(T,7),D=S.t,R=S.l,L=19;L>4&&!D[jr[L-1]];--L);var P=h+5<<3,U=li(r,Zt)+li(s,ci)+o,w=li(r,u)+li(s,m)+o+14+3*L+li(T,D)+2*T[16]+3*T[17]+7*T[18];if(c>=0&&P<=U&&P<=w)return Ya(e,l,t.subarray(c,c+h));var C,G,N,ee;if(Bt(e,l,1+(w<U)),l+=2,w<U){C=wt(u,f,0),G=u,N=wt(m,x,0),ee=m;var xe=wt(D,R,0);Bt(e,l,v-257),Bt(e,l+5,b-1),Bt(e,l+10,L-4),l+=14;for(var A=0;A<L;++A)Bt(e,l+3*A,D[jr[A]]);l+=3*L;for(var ie=[y,M],fe=0;fe<2;++fe)for(var me=ie[fe],A=0;A<me.length;++A){var re=me[A]&31;Bt(e,l,xe[re]),l+=D[re],re>15&&(Bt(e,l,me[A]>>5&127),l+=me[A]>>12)}}else C=Xf,G=Zt,N=$f,ee=ci;for(var A=0;A<a;++A){var J=i[A];if(J>255){var re=J>>18&31;ai(e,l,C[re+257]),l+=G[re+257],re>7&&(Bt(e,l,J>>23&31),l+=Wi[re]);var Me=J&31;ai(e,l,N[Me]),l+=ee[Me],Me>3&&(ai(e,l,J>>5&8191),l+=Xi[Me])}else ai(e,l,C[J]),l+=G[J]}return ai(e,l,C[256]),l+G[256]},Zf=new ts([65540,131080,131088,131104,262176,1048704,1048832,2114560,2117632]),Ka=new Re(0),Jf=function(t,e,n,i,r,s){var o=s.z||t.length,a=new Re(i+o+5*(1+Math.ceil(o/7e3))+r),c=a.subarray(i,a.length-r),h=s.l,l=(s.r||0)&7;if(e){l&&(c[0]=s.r>>3);for(var d=Zf[e-1],u=d>>13,f=d&8191,p=(1<<n)-1,m=s.p||new rt(32768),x=s.h||new rt(p+1),g=Math.ceil(n/3),y=2*g,v=function(tt){return(t[tt]^t[tt+1]<<g^t[tt+2]<<y)&p},_=new ts(25e3),M=new rt(288),b=new rt(32),T=0,A=0,S=s.i||0,D=0,R=s.w||0,L=0;S+2<o;++S){var P=v(S),U=S&32767,w=x[P];if(m[U]=w,x[P]=U,R<=S){var C=o-S;if((T>7e3||D>24576)&&(C>423||!h)){l=za(t,c,0,_,M,b,A,D,L,S-L,l),D=T=A=0,L=S;for(var G=0;G<286;++G)M[G]=0;for(var G=0;G<30;++G)b[G]=0}var N=2,ee=0,xe=f,ie=U-w&32767;if(C>2&&P==v(S-ie))for(var fe=Math.min(u,C)-1,me=Math.min(32767,S),re=Math.min(258,C);ie<=me&&--xe&&U!=w;){if(t[S+N]==t[S+N-ie]){for(var J=0;J<re&&t[S+J]==t[S+J-ie];++J);if(J>N){if(N=J,ee=ie,J>fe)break;for(var Me=Math.min(ie,J-2),Ke=0,G=0;G<Me;++G){var ze=S-ie+G&32767,je=m[ze],Fe=ze-je&32767;Fe>Ke&&(Ke=Fe,w=ze)}}}U=w,w=m[U],ie+=U-w&32767}if(ee){_[D++]=268435456|Zr[N]<<18|Ga[ee];var Ce=Zr[N]&31,et=Ga[ee]&31;A+=Wi[Ce]+Xi[et],++M[257+Ce],++b[et],R=S+N,++T}else _[D++]=t[S],++M[t[S]]}}for(S=Math.max(S,R);S<o;++S)_[D++]=t[S],++M[t[S]];l=za(t,c,h,_,M,b,A,D,L,S-L,l),h||(s.r=l&7|c[l/8|0]<<3,l-=7,s.h=x,s.p=m,s.i=S,s.w=R)}else{for(var S=s.w||0;S<o+h;S+=65535){var De=S+65535;De>=o&&(c[l/8|0]=h,De=o),l=Ya(c,l+1,t.subarray(S,De))}s.i=o}return $a(a,0,i+ns(l)+r)},Qf=(function(){for(var t=new Int32Array(256),e=0;e<256;++e){for(var n=e,i=9;--i;)n=(n&1&&-306674912)^n>>>1;t[e]=n}return t})(),ed=function(){var t=-1;return{p:function(e){for(var n=t,i=0;i<e.length;++i)n=Qf[n&255^e[i]]^n>>>8;t=n},d:function(){return~t}}};var td=function(t,e,n,i,r){if(!r&&(r={l:1},e.dictionary)){var s=e.dictionary.subarray(-32768),o=new Re(s.length+t.length);o.set(s),o.set(t,s.length),t=o,r.w=s.length}return Jf(t,e.level==null?6:e.level,e.mem==null?r.l?Math.ceil(Math.max(8,Math.min(13,Math.log(t.length)))*1.5):20:12+e.mem,n,i,r)};var es=function(t,e,n){for(;n;++e)t[e]=n,n>>>=8},nd=function(t,e){var n=e.filename;if(t[0]=31,t[1]=139,t[2]=8,t[8]=e.level<2?4:e.level==9?2:0,t[9]=3,e.mtime!=0&&es(t,4,Math.floor(new Date(e.mtime||Date.now())/1e3)),n){t[3]=8;for(var i=0;i<=n.length;++i)t[i+10]=n.charCodeAt(i)}},id=function(t){(t[0]!=31||t[1]!=139||t[2]!=8)&&xt(6,"invalid gzip data");var e=t[3],n=10;e&4&&(n+=(t[10]|t[11]<<8)+2);for(var i=(e>>3&1)+(e>>4&1);i>0;i-=!t[n++]);return n+(e&2)},rd=function(t){var e=t.length;return(t[e-4]|t[e-3]<<8|t[e-2]<<16|t[e-1]<<24)>>>0},sd=function(t){return 10+(t.filename?t.filename.length+1:0)};function ja(t,e){e||(e={});var n=ed(),i=t.length;n.p(t);var r=td(t,e,sd(e),8),s=r.length;return nd(r,e),es(r,s-8,n.d()),es(r,s-4,i),r}function Za(t,e){var n=id(t);return n+8>t.length&&xt(6,"invalid gzip data"),jf(t.subarray(n,-8),{i:2},e&&e.out||new Re(rd(t)),e&&e.dictionary)}var od=typeof TextDecoder<"u"&&new TextDecoder,ad=0;try{od.decode(Ka,{stream:!0}),ad=1}catch{}var st="_AnimationSpeed",_n="_AnimationSpeedFrame",bn="_AnimationSpeedEvents",ld="MDLXL_ANIMATION_SPEED_V1:6324b9ab-c97d-4884-bffa-a623adc41438",cd="MDLXL_ANIMATION_SPEED_V2:6324b9ab-c97d-4884-bffa-a623adc41438",tl="XLAS";var hd=new Set([st,_n,bn]),Gn=`// ${cd} `,qi=`// ${ld} `,nl=[Gn,qi],is=2147483647,Ja=-2147483648,Qa=t=>Number.isInteger(t)&&t>=1&&t<=300,ud=t=>Array.isArray(t)&&t.length===2&&t.every(e=>Number.isInteger(e)&&e>=0&&e<=is)&&t[1]>=t[0],el=t=>Number.isInteger(t.GlobalSeqId)&&t.GlobalSeqId>=0;function fd(t){return t[st]?.master??100}function dd(t){return t[st]?.rememberOriginal!==!1}function il(t){let e=[],n=[],i=new Set;function r(s,o){if(!(!s||typeof s!="object"||ArrayBuffer.isView(s)||i.has(s))){if(i.add(s),Array.isArray(s.Keys)){el(s)||e.push({value:s,path:o});return}s.EventTrack&&!el(s)&&n.push({value:s,path:o});for(let[a,c]of Object.entries(s))hd.has(a)||a==="Nodes"||a==="EventTrack"||r(c,[...o,Array.isArray(s)?Number(a):a])}}return r(t,[]),{tracks:e,events:n}}function pd(t,e,n=!1){let i=0;for(let r of e){let s=n?r.current:r.original,o=n?r.original:r.current;if(t<s[0])break;if(t<=s[1])return o[0]+(s[1]===s[0]?0:(t-s[0])/(s[1]-s[0])*(o[1]-o[0]));i=o[1]-s[1]}return t+i}function md(t){let e=(t.Sequences||[]).map((i,r)=>({sequence:i,index:r})).sort((i,r)=>i.sequence.Interval[0]-r.sequence.Interval[0]),n=0;return e.map(({sequence:i,index:r})=>{let s=Array.from(i.Interval),o=i[st]?.originalInterval||[s[0]-n,s[1]-n];return n=s[1]-o[1],{sequence:i,index:r,original:o,current:s}})}function gd(t,e,n){let i=[...e||[]],r=new Map;return i.forEach((s,o)=>{s&&(r.has(s.frame)||r.set(s.frame,{indices:[],cursor:0}),r.get(s.frame).indices.push(o))}),t.map((s,o)=>{let a=r.get(s);for(;a&&a.cursor<a.indices.length&&!i[a.indices[a.cursor]];)a.cursor++;let c=i[o]?.frame===s?o:a?.indices[a.cursor]??-1,h=c<0?null:i[c];return c>=0&&(i[c]=null),h?h.originalFrame:pd(s,n,!0)})}function Jt(t){if(!dd(t)||!(t.Sequences||[]).some(s=>s[st]?.originalInterval))return null;let{tracks:e,events:n}=il(t),i=md(t),r=(s,o)=>gd(s,o,i).map((a,c)=>({originalFrame:a,frame:s[c]}));return{master:fd(t),sequences:(t.Sequences||[]).map(s=>s[st]?.originalInterval?s[st]:null),tracks:e.map(({path:s,value:o})=>({path:s,frames:r(o.Keys.map(a=>a.Frame),o.Keys.map(a=>a[_n]))})),events:n.map(({path:s,value:o})=>({path:s,frames:r(Array.from(o.EventTrack),o[bn])}))}}function rl(t){let e=i=>i===null||i&&Number.isFinite(i.originalFrame)&&i.originalFrame>=Ja&&i.originalFrame<=is&&Number.isInteger(i.frame)&&i.frame>=Ja&&i.frame<=is,n=i=>Array.isArray(i)&&i.every(r=>Array.isArray(r?.path)&&r.path.length&&r.path.every(s=>typeof s=="string"&&!["__proto__","constructor","prototype"].includes(s)||Number.isInteger(s)&&s>=0)&&Array.isArray(r.frames)&&r.frames.every(e));return t&&Qa(t.master)&&Array.isArray(t.sequences)&&t.sequences.every(i=>i===null||i&&Qa(i.percent)&&typeof i.checked=="boolean"&&ud(i.originalInterval))&&n(t.tracks)&&n(t.events)}function rs(t,e){return e.tag===tl&&nl.includes(Oe.from(t).subarray(e.payloadOffset,e.payloadOffset+Gn.length).toString("utf8"))}function sl(t,e,n){return e==="mdl"?(n||Be(t)).tokens.filter(i=>i.kind==="line-comment"&&nl.some(r=>i.raw.toString("utf8").startsWith(r))).map(i=>({start:i.start,end:i.end+(t[i.end]===13?t[i.end+1]===10?2:1:t[i.end]===10?1:0),payload:i.raw})):(n||Ie(t)).chunks.filter(i=>rs(t,i)).map(i=>({start:i.offset,end:i.payloadOffset+i.declaredSize,payload:t.subarray(i.payloadOffset,i.payloadOffset+i.declaredSize)}))}function ol(t,e){let n=Oe.from(t.payload);if(n.subarray(0,qi.length).toString("utf8")===qi)return JSON.parse(n.subarray(qi.length).toString("utf8"));let i=e==="mdl"?Oe.from(n.subarray(Gn.length).toString("utf8").trim(),"base64"):n.subarray(Gn.length);return JSON.parse(Oe.from(Za(i)).toString("utf8"))}function al(t,e,n,i){let r=[],s=Oe.from(t);for(let o of sl(s,e,i)){let a;try{a=ol(o,e)}catch{}if(!rl(a)){r.push({severity:"warning",code:"ANIMATION_SPEED_METADATA",message:"The MDLxL animation speed comment is invalid; its source bytes are retained."});continue}let{tracks:c,events:h}=il(n),l=(f,p)=>f.find(m=>JSON.stringify(m.path)===JSON.stringify(p))?.value,d=a.tracks.map(f=>({...f,value:l(c,f.path)})),u=a.events.map(f=>({...f,value:l(h,f.path)}));if(a.sequences.length!==n.Sequences.length||d.some(f=>!f.value||f.frames.length!==f.value.Keys.length||f.frames.some((p,m)=>p&&p.frame!==f.value.Keys[m].Frame))||u.some(f=>!f.value||f.frames.length!==f.value.EventTrack.length||f.frames.some((p,m)=>!p||p.frame!==f.value.EventTrack[m]))){r.push({severity:"warning",code:"ANIMATION_SPEED_METADATA",message:"The MDLxL animation speed comment is invalid; its source bytes are retained."});continue}n[st]={master:a.master},n.Sequences.forEach((f,p)=>{a.sequences[p]?f[st]=a.sequences[p]:delete f[st]});for(let{value:f}of c)for(let p of f.Keys)delete p[_n];for(let f of d)f.value.Keys.forEach((p,m)=>{f.frames[m]&&(p[_n]=f.frames[m])});for(let{value:f}of h)delete f[bn];for(let f of u)f.value[bn]=f.frames}return r}function $i(t,e,n){let i=Oe.from(t),r=[],s=0;for(let u of sl(i,e)){let f=!1;try{f=rl(ol(u,e))}catch{}f&&(r.push(i.subarray(s,u.start)),s=u.end)}r.push(i.subarray(s));let o=Oe.concat(r),a=Jt(n);if(!a)return o;let c=Oe.from(ja(Oe.from(JSON.stringify(a),"utf8"),{level:9,mtime:0})),h=e==="mdl"?Oe.from(Gn+c.toString("base64")+`
`,"utf8"):Oe.concat([Oe.from(Gn),c]);if(e==="mdl"){let u=o.subarray(0,3).equals(Oe.from([239,187,191]))?3:0;return Oe.concat([o.subarray(0,u),h,o.subarray(u)])}let l=Oe.alloc(8);l.write(tl,"ascii"),l.writeUInt32LE(h.length,4);let d=o.length-Ie(o).trailingBytes.length;return Oe.concat([o.subarray(0,d),l,h,o.subarray(d)])}var Le=(t=0,e=0,n=0)=>new Float32Array([t,e,n]),Ee=t=>structuredClone(t),yt=Object.freeze({Bone:["Bones","BONE",256],Helper:["Helpers","HELP",0],Attachment:["Attachments","ATCH",2048],Light:["Lights","LITE",512],EventObject:["EventObjects","EVTS",1024],CollisionShape:["CollisionShapes","CLID",8192],ParticleEmitter:["ParticleEmitters","PREM",4096],ParticleEmitter2:["ParticleEmitters2","PRE2",4096],RibbonEmitter:["RibbonEmitters","RIBB",16384],ParticleEmitterPopcorn:["ParticleEmitterPopcorns","CORN",4096]}),$e={Version:["Version","VERS"],Info:["Model","MODL"],Sequences:["Sequences","SEQS"],GlobalSequences:["GlobalSequences","GLBS"],Materials:["Materials","MTLS"],Textures:["Textures","TEXS"],TextureAnims:["TextureAnims","TXAN"],Geosets:["Geoset","GEOS"],GeosetAnims:["GeosetAnim","GEOA"],PivotPoints:["PivotPoints","PIVT"],Cameras:["Camera","CAMS"],FaceFX:["FaceFX","FAFX"],BindPoses:["BindPose","BPOS"],Gliders:["Glider","DILG"],...Object.fromEntries(Object.entries(yt).map(([t,[e,n]])=>[e,[t,n]]))},vd=Object.fromEntries(Object.entries($e).map(([t,e])=>[e[0],t])),xd=["TextureID","NormalTextureID","ORMTextureID","EmissiveTextureID","TeamColorTextureID","ReflectionsTextureID"],os=t=>Object.values(yt).flatMap(([e])=>t[e]||[]),Qt=t=>JSON.stringify(t,(e,n)=>{if(![gt,st,_n,bn].includes(e))return ArrayBuffer.isView(n)?{$type:n.constructor.name,$data:Array.from(n)}:typeof n=="number"&&!Number.isFinite(n)?{$number:String(n)}:n}),Yi=new Set(Object.values(yt).map(([t])=>t)),hi=t=>t[0]==="Nodes"||t.length===3&&Yi.has(t[0])&&t[2]==="PivotPoint",yd=t=>hi(t)||t[0]===Un||t[0]==="Geosets"&&t[2]===gt||t.some(e=>[st,_n,bn].includes(e)),ll=(t,e)=>Object.fromEntries([...e].filter(n=>n!=="Nodes").map(n=>[n,t[n]]));function _d(t=800,e="Untitled"){let n={Version:t,Info:{Name:e,MinimumExtent:Le(),MaximumExtent:Le(),BoundsRadius:0,BlendTime:150},Nodes:[]};for(let i of Object.keys($e))!(i in n)&&i!=="Version"&&(n[i]=[]);return n}function ui(t){let e=ot.from(t),n=[],i=-1,r="",s=0,o=0;for(;o<e.length;){let a=e[o];if(a===47&&e[o+1]===47)for(o+=2;o<e.length&&e[o]!==10&&e[o]!==13;)o++;else if(a===47&&e[o+1]===42){let c=e.indexOf(ot.from("*/"),o+2);if(c<0)throw new Error("Unterminated MDL block comment.");o=c+2}else if(a===34){let c=Lr(e,o);if(c<0)throw new Error("Unterminated MDL string.");o=c}else if(a===123)s++,o++;else if(a===125){if(--s<0)throw new Error("Unmatched MDL closing brace.");o++,s===0&&i>=0&&(n.push({name:r,key:vd[r],start:i,end:o}),i=-1)}else if(s===0&&i<0&&(a>=65&&a<=90||a>=97&&a<=122||a===95)){for(i=o++;o<e.length&&/[A-Za-z0-9_]/.test(String.fromCharCode(e[o]));)o++;r=e.subarray(i,o).toString("ascii")}else o++}if(s!==0)throw new Error("Unterminated MDL section.");if(i>=0)throw new Error(`Incomplete MDL section ${r}.`);return n}function bd(t){return t.replace(/"[^"]*"|\/\*[\s\S]*?\*\//g,e=>e.startsWith("/*")?" ":e)}function cl(t){return t.replace(/"(?:\\.|[^"\\])*"|Faces\s+1\s+0\s*\{\s*Triangles\s*\{\s*\{\s*\},?\s*\}\s*\}/g,e=>e.startsWith('"')?e:"Faces 0 0 { Triangles { } }")}function Sd(t,e){let n=new Map,i=e.filter(a=>a.key&&a.key!=="PivotPoints").map(a=>{let c=t.subarray(a.start,a.end);if(a.key==="EventObjects"){let h=Fa(c);c=h.bytes,h.globalSeqId!=null&&n.set(h.objectId,h.globalSeqId)}return bd(c.toString("utf8"))}).join(`
`),r=ua(cl(i)),s=wi(r.text);r.restore(s);for(let a of s.ParticleEmitters||[])a.Flags|=4096;Ba(t,e,s);for(let a of s.EventObjects||[])n.has(a.ObjectId)&&(a.GlobalSeqId=n.get(a.ObjectId));for(let a of s.GeosetAnims||[])a.Color!=null&&(a.Flags=(a.Flags||0)|2);let o=e.filter(a=>a.key==="PivotPoints");return o.length&&(s.PivotPoints=pa(t.subarray(o.at(-1).start,o.at(-1).end))),Ot(s),s}function Ot(t,e){for(let r of Object.keys($e))r!=="Version"&&r!=="Info"&&t[r]==null&&(t[r]=[]);t.Nodes=[];for(let r of os(t)){let s=r.ObjectId;if(!Number.isInteger(s)||s<0||s>1e6)continue;r.Parent===void 0&&(r.Parent=null);let o=e?.Nodes?.[s],a=e?.PivotPoints?.[s],c=o&&Qt(o.PivotPoint)!==Qt(r.PivotPoint),h=a&&Qt(a)!==Qt(t.PivotPoints[s]);c&&!h&&(t.PivotPoints[s]=r.PivotPoint),t.PivotPoints[s]||(t.PivotPoints[s]=r.PivotPoint||Le()),r.PivotPoint=t.PivotPoints[s],t.Nodes[s]=r}for(let r=0;r<t.PivotPoints.length;r++)t.PivotPoints[r]||=Le();let n=new Set;function i(r){if(!(!r||typeof r!="object"||ArrayBuffer.isView(r)||n.has(r))){if(n.add(r),Array.isArray(r.Keys)){r.GlobalSeqId===void 0&&(r.GlobalSeqId=null);return}for(let s of Object.values(r))i(s)}}i(t);for(let r of t.Materials)for(let s of r.Layers||[])s.TVertexAnimId===void 0&&(s.TVertexAnimId=null),s.CoordId??=0,s.FilterMode??=0,s.Shading??=0;for(let r of t.Bones)r.GeosetId??=null,r.GeosetAnimId??=null;for(let r of t.Lights)r.QuadraticFalloff??=5e-4,r.LinearFalloff??=0,r.Damping??=1e-5;for(let[r,s]of t.Geosets.entries())e&&Qt(e.Geosets[r]?.Faces)!==Qt(s.Faces)&&s.PrimitiveCounts&&Array.from(s.PrimitiveCounts).reduce((o,a)=>o+a,0)!==s.Faces.length&&(s.PrimitiveTypes=s.Faces.length?Uint32Array.of(4):new Uint32Array,s.PrimitiveCounts=s.Faces.length?Uint32Array.of(s.Faces.length):new Uint32Array);for(let r of t.ParticleEmitters2)for(let s of["TailLength","Time","LifeSpan","PriorityPlane","ReplaceableId","Rows","Columns"])r[s]??=0;for(let r of t.ParticleEmitters)for(let s of["EmissionRate","Gravity","Longitude","Latitude","LifeSpan","InitVelocity"])r[s]??=0;for(let r of t.ParticleEmitterPopcorns){for(let s of["LifeSpan","EmissionRate","Speed","Alpha"])r[s]??=1;r.ReplaceableId??=0,r.Path??="",r.AnimVisibilityGuide??="",r.Color??=Le(1,1,1)}for(let r of t.RibbonEmitters)r.HeightAbove??=0,r.HeightBelow??=0,r.Alpha??=1,r.TextureSlot??=0;for(let r of[t.Info,...t.Sequences,...t.Geosets,...t.Geosets.flatMap(s=>s.Anims||[])])r&&(r.MinimumExtent||=Le(),r.MaximumExtent||=Le(),r.BoundsRadius??=0);t.Info&&(t.Info.BlendTime??=0);for(let r of t.Textures)r.Image??="",r.ReplaceableId??=0,r.Flags??=0;for(let r of t.ParticleEmitters2)r.Squirt=!!r.Squirt;fl(t),Sa(t)}function Md(t,e,n,i){let r=ui(n),s=new Map;for(let l of i)s.set(l,ot.concat(r.filter(d=>d.key===l).flatMap(d=>[n.subarray(d.start,d.end),ot.from(`
`)])));let o=[],a=new Set,c=0;for(let l of e)s.has(l.key)&&(o.push(t.subarray(c,l.start)),a.has(l.key)||(o.push(s.get(l.key)),a.add(l.key)),c=l.end);o.push(t.subarray(c));for(let[l,d]of s)!a.has(l)&&d.length&&o.push(ot.from(`
`),d);let h=ot.concat(o);return hl(h)}function hl(t){let e=ui(t).filter(s=>Yi.has(s.key)),n=[...e].sort((s,o)=>Vi.indexOf(s.key)-Vi.indexOf(o.key)),i=[],r=0;return e.forEach((s,o)=>{let a=n[o];i.push(t.subarray(r,s.start),t.subarray(a.start,a.end)),r=s.end}),i.push(t.subarray(r)),ot.concat(i)}function Td(t,e,n,i){let r=Ie(n);if(r.hasErrors)throw new Error("Generated MDX has an invalid chunk structure.");let s=new Set(i.map(h=>$e[h][1])),o=new Map([...s].map(h=>[h,ot.concat(r.chunks.filter(l=>l.tag===h).map(l=>n.subarray(l.offset,l.payloadOffset+l.declaredSize)))])),a=new Set,c=[t.subarray(0,4)];for(let h of e.chunks)s.has(h.tag)?a.has(h.tag)||(c.push(o.get(h.tag)),a.add(h.tag)):c.push(t.subarray(h.offset,h.payloadOffset+h.declaredSize));for(let[h,l]of o)a.has(h)||c.push(l);return c.push(e.trailingBytes),ot.concat(c)}var ss=class t{constructor(e,n="Untitled.mdl",i={}){if(this.name=n,this.revision=0,this.history=[],this._historyStore=new oi(i.history),this._serializedStates=new WeakMap,this._loadSource(e),this.model=_d(this.version||800,n),this.readOnly=this._sourceErrors.length>0||!Lt.includes(this.version),!this.readOnly)try{this.model=this.format==="mdx"?ta(this._original):Sd(this._original,this._sections),this.format==="mdx"&&(Na(this._original,this.model),this.model.GeosetAnims=Hi(this.model.GeosetAnims)),Ot(this.model),this._sourceWarnings.push(...Ta(this._original,this.format,this.model,this._container)),this._sourceWarnings.push(...al(this._original,this.format,this.model,this._container))}catch(r){this.readOnly=!0,this._sourceErrors.push({severity:"error",code:"SEMANTIC_DECODE_FAILED",message:`Editing unavailable: ${r.message}. The original file can still be copied exactly.`})}this._savedModel=Ee(this.model),this._committedModel=Ee(this.model),this._dirtyCandidates=new Set(Object.keys(this.model)),this._trackedModel=this.model,this._recoverySavedChanges=[]}_loadSource(e){if(this._original=typeof e=="string"?ot.from(e,"utf8"):ot.from(e instanceof ArrayBuffer?new Uint8Array(e):e),this.format=this._original.subarray(0,4).toString("ascii")==="MDLX"?"mdx":"mdl",this._container=this.format==="mdx"?Ie(this._original):Be(this._original),this.version=this._container.version,this._sourceErrors=this._container.diagnostics.filter(n=>n.severity==="error"),this._sourceWarnings=this._container.diagnostics.filter(n=>n.severity!=="error"),this._sections=[],this.format==="mdl")try{this._sections=ui(this._original)}catch(n){this._sourceErrors.push({severity:"error",code:"MDL_STRUCTURE",message:n.message})}}get originalBytes(){return new Uint8Array(this._original)}_candidateKeys(){return this.model!==this._trackedModel&&(this._dirtyCandidates=new Set([...Object.keys(this._savedModel),...Object.keys(this.model)]),this._trackedModel=this.model,this._changeCache=null),this._dirtyCandidates}_changedKeys(){let e=this._candidateKeys();if(this._changeCache?.revision!==this.revision||this._changeCache.savedModel!==this._savedModel){let n=On(ll(this._savedModel,e),ll(this.model,e),{ignore:yd});this._dirtyCandidates=new Set(n.map(i=>i.path[0])),this._changeCache={revision:this.revision,savedModel:this._savedModel,keys:[...new Set(n.map(i=>i.path[0]).filter(i=>i in $e))]}}return this._changeCache.keys}get _tabsChanged(){return this._changedKeys(),this._changeCache.tabs??=JSON.stringify(Kt(this._savedModel))!==JSON.stringify(Kt(this.model))}get _speedChanged(){return this._changedKeys(),this._changeCache.speed??=JSON.stringify(Jt(this._savedModel))!==JSON.stringify(Jt(this.model))}get dirty(){return this._changedKeys().length>0||this._tabsChanged||this._speedChanged}get canUndo(){return this._historyStore.stats.undoSteps>0}get canRedo(){return this._historyStore.stats.redoSteps>0}get historyStats(){return this._historyStore.stats}configureHistory(e){return this._historyStore.configure(e)}_recordHistory(e){this.history.push(e);let n=Math.max(1,this.historyStats.maxSteps);this.history.length>n&&this.history.splice(0,this.history.length-n)}get diagnostics(){if(this._diagnosticCache?.revision===this.revision)return this._diagnosticCache.diagnostics;let e=[...this._sourceErrors,...this._sourceWarnings];this.readOnly||e.push(...tn(this.model));let n=this._unknownSections();return n.length&&e.push({severity:"info",code:"OPAQUE_DATA_PRESERVED",message:`Unrecognized source data is retained: ${n.join(", ")}.`}),this._diagnosticCache={revision:this.revision,diagnostics:e},e}_unknownSections(){let e=new Set(Object.values($e).map(n=>n[1]));return this.format==="mdx"?[...new Set(this._container.chunks.filter(n=>!e.has(n.tag)&&!Gr(this._original,n)&&!rs(this._original,n)).map(n=>n.tag))]:[...new Set(this._sections.filter(n=>!n.key).map(n=>n.name))]}convertVersion(e){if(this.readOnly)throw new Error("This document is read-only.");if(e===this.model.Version)return!1;let n=Ys(this.model,e);if(this._unknownSections().length&&n.push("Unrecognized source sections prevent safe version conversion."),n.length)throw new Error(n.join(`
`));let i=Ee(this.model);_i(i,e);let r=Xr(Ui({...i,GeosetAnims:Hi(i.GeosetAnims),BindPoses:i.BindPoses?.length?i.BindPoses:void 0}),i),s=en(r,"converted.mdx");if(s.readOnly||s.version!==e||s.diagnostics.some(o=>o.severity==="error"))throw new Error("Target format verification failed. The model was kept.");Vr(i,s.model,{keys:Object.keys($e)});for(let o of Object.keys($e))if(Array.isArray(i[o])&&i[o].length!==s.model[o]?.length)throw new Error("Target conversion changed "+o+" count.");this._versionConversion=!0;try{return this.apply("Convert to MDX"+e,["Version","Materials","Geosets"],o=>_i(o,e))}finally{this._versionConversion=!1}}apply(e,n,i){if(this.readOnly)throw new Error(`This document is read-only (format ${this.version??"unknown"} or unsupported data).`);if(typeof i!="function")throw new TypeError("apply requires a model mutator function.");if(this._applying)throw new Error("Nested document edits are not supported.");let r=this._committedModel,s=this.model;this._candidateKeys();let o,a,c,h;this._applying=!0;try{if(o=i(s),o&&typeof o.then=="function")throw new Error("Document edits must be synchronous.");if(s.Version!==r.Version&&!this._versionConversion)throw new Error("Changing the model version is not supported; no automatic downgrades are performed.");Ot(s,r),a=On(r,s,{ignore:hi}),c=[...new Set(a.map(m=>m.path[0]).filter(m=>m in $e))];let l=this._committedDiagnostics||=tn(r),d=this._committedErrors||=new Set(l.filter(m=>m.severity==="error").map(m=>`${m.code}:${m.path}`)),u=c.includes("GlobalSequences")?null:new Set(a.map(m=>m.path[0]));if(u&&(u.has("PivotPoints")||c.some(m=>Yi.has(m)))){u.add("PivotPoints");for(let m of Yi)u.add(m)}let f=tn(s,{numericSections:u,previousDiagnostics:l}),p=f.filter(m=>m.severity==="error"&&!d.has(`${m.code}:${m.path}`));if(p.length)throw new Error(p.slice(0,4).map(m=>m.message).join(`
`));a.length&&(h=this._historyStore.prepare({label:e,sections:c,changes:a})),Vn(r,a),Ot(r),this._committedErrors=new Set(f.filter(m=>m.severity==="error").map(m=>`${m.code}:${m.path}`)),this._committedDiagnostics=f}catch(l){throw this.model=Ee(r),this._trackedModel=this.model,l}finally{this._applying=!1}if(!a.length)return!1;this._historyStore.commit(h),this.model=s;for(let l of a)this._dirtyCandidates.add(l.path[0]);return this.version=this.model.Version,this.revision++,this._recordHistory({label:e,sections:c,requestedSections:[...n||[]],revision:this.revision}),o===void 0?!0:o}undo(){if(this._applying)throw new Error("Cannot undo inside a document edit.");let e=this._historyStore.undo((n,i)=>this._applyHistory(n,i));return e?(e.changes.length&&this.revision++,this._recordHistory({label:`Undo: ${e.label}`,sections:e.sections,revision:this.revision}),!0):!1}redo(){if(this._applying)throw new Error("Cannot redo inside a document edit.");let e=this._historyStore.redo((n,i)=>this._applyHistory(n,i));return e?(e.changes.length&&this.revision++,this._recordHistory({label:`Redo: ${e.label}`,sections:e.sections,revision:this.revision}),!0):!1}_applyHistory(e,n){Vn(this._committedModel,e,n),Ot(this._committedModel);try{Vn(this.model,e,n),Ot(this.model)}catch{this.model=Ee(this._committedModel)}this.version=this.model.Version,this._committedErrors=null,this._committedDiagnostics=null;for(let i of e)this._dirtyCandidates.add(i.path[0]);this._trackedModel=this.model}captureRecoveryState({includeHistory:e=!0,compact:n=!1}={}){if(this._applying)throw new Error("Cannot capture recovery inside a document edit.");return n?(this._candidateKeys(),Ee({schema:"mdlvis-document-recovery",version:2,name:this.name,originalBytes:new Uint8Array(this._original.buffer,this._original.byteOffset,this._original.byteLength),savedChanges:this._recoverySavedChanges,modelChanges:On(this._savedModel,this.model,{ignore:hi}),revision:this.revision,history:e?this._historyStore._recoveryState():null,activity:this.history})):Ee({schema:"mdlvis-document-recovery",version:1,name:this.name,originalBytes:new Uint8Array(this._original.buffer,this._original.byteOffset,this._original.byteLength),model:this.model,savedModel:this._savedModel,revision:this.revision,history:e?this._historyStore._recoveryState():null,activity:this.history})}static restoreRecoveryState(e){if(e?.schema!=="mdlvis-document-recovery"||![1,2].includes(e.version)||!(e.originalBytes instanceof Uint8Array)||typeof e.name!="string"||(e.version===1?!e.model:!Array.isArray(e.savedChanges)||!Array.isArray(e.modelChanges)))throw new Error("Invalid document recovery data.");let n=new t(e.originalBytes,e.name),i,r;if(e.version===2?(i=Ee(n.model),Vn(i,e.savedChanges),Ot(i),r=Ee(i),Vn(r,e.modelChanges)):(i=e.savedModel,r=Ee(e.model)),!i||i.Version!==n.version||![800,1e3,n.version].includes(r.Version))throw new Error("Recovery model version does not match its original file.");Ot(r);let s=new Set(tn(n.model).filter(a=>a.severity==="error").map(a=>`${a.code}:${a.path}`)),o=tn(r).filter(a=>a.severity==="error"&&!s.has(`${a.code}:${a.path}`));if(o.length)throw new Error(`Recovery model is invalid: ${o[0].message}`);return n.model=r,n.version=r.Version,n._committedModel=Ee(r),n._recoverySavedChanges=e.version===2?Ee(e.savedChanges):On(n._savedModel,i,{ignore:hi}),n._savedModel=Ee(i),Ot(n._savedModel),n._dirtyCandidates=new Set(Object.keys(r)),n._trackedModel=r,e.history&&(n._historyStore=oi.restore(e.history)),n.revision=Number.isSafeInteger(e.revision)&&e.revision>=0?e.revision:0,n.history=Array.isArray(e.activity)?Ee(e.activity.slice(-Math.max(1,n.historyStats.maxSteps))):[],n}saveImpact(e=this.format){e=e.toLowerCase();let n=e!==this.format||this.model.Version!==this._container.version,i=this._changedKeys(),r=[];n?r.push("Format conversion regenerates the entire file. Unknown chunks, unknown MDL sections, comments and unsupported fields cannot be carried into the other format."):i.length&&r.push("Changed sections are regenerated. Their formatting, comments and unsupported subfields may change; all other source sections remain byte-for-byte intact."),this.version===900&&r.push("Version 900 support in the parser library is experimental."),this.readOnly&&n&&r.push("This document cannot be converted because its version or source data is unsupported."),n&&this.model.Geosets?.some(a=>a.SkinWeights?.length)&&e==="mdl"&&r.push("Weighted HD geometry requires a compatible Reforged MDL consumer.");let s=(n||i.length)&&!this.readOnly?Ad(this.model,e,n?Object.keys($e):i):[];r.push(...s);let o=this._unknownSections();return n&&o.length&&r.push(`Cannot convert unrecognized source data: ${o.join(", ")}.`),{format:e,conversion:n,exact:!n&&i.length===0&&!this._tabsChanged&&!this._speedChanged,readOnly:this.readOnly,changedSections:i.map(a=>a==="Info"?"Model":a),preservedUnknown:o,warnings:r,canSave:["mdl","mdx"].includes(e)&&(!this.readOnly||!n&&!i.length&&!this._tabsChanged&&!this._speedChanged)&&!s.length&&!(n&&o.length)}}serialize(e=this.format,{timings:n={}}={}){Object.assign(n,{serializationMs:0,reparsingMs:0,verificationMs:0,errorFormattingMs:0});let i="serializationMs",r=performance.now(),s=o=>{let a=performance.now();n[i]+=a-r,i=o,r=a};try{e=e.toLowerCase();let o=this.saveImpact(e);if(!o.canSave)throw new Error(`This document cannot be saved in that format. ${o.warnings.at(-1)||"An exact copy in its original format is available."}`);let a=_=>{let M=new Uint8Array(_);return this._serializedStates.set(M,{model:Ee(this.model),revision:this.revision}),M};if(o.exact&&(this.readOnly||$i(this._original,e,this.model).equals(this._original)))return a(this._original);if(!o.conversion&&!o.changedSections.length){let _=$i(kr(this._original,e,this.model),e,this.model);s("reparsingMs");let M=en(_,`validation.${e}`);if(s("verificationMs"),M.readOnly||JSON.stringify(Kt(this.model))!==JSON.stringify(Kt(M.model)))throw new Error("Save verification failed: geoset tab metadata did not reopen.");if(JSON.stringify(Jt(this.model))!==JSON.stringify(Jt(M.model)))throw new Error("Save verification failed: animation speed metadata did not reopen.");return a(_)}let c=this.model;Ur(c).some((_,M)=>_.ObjectId!==M)&&(c=Ee(c),ma(c,{preserveUnusedPivots:!0}));let h=ya(this.model.GeosetAnims,e);if(h.length)throw s("errorFormattingMs"),new Error(Gi("Cannot export geoset colors",h));let l=xa(c.GeosetAnims,e),d=e==="mdl"?{...c,ParticleEmitterPopcorns:Oa(c.ParticleEmitterPopcorns),GeosetAnims:l}:{...c,GeosetAnims:Hi(l),BindPoses:c.BindPoses?.length?c.BindPoses:void 0},u=e==="mdl"?{...d,Geosets:d.Geosets.map(_=>({..._,TVertices:_.TVertices.length?_.TVertices:[new Float32Array]})),CollisionShapes:d.CollisionShapes.map(_=>[1,3].includes(_.Shape)?{..._,Shape:0}:_)}:null,f=e==="mdl"?fa(ot.from(cl(to(u)),"utf8"),{...c,GeosetAnims:l}):ot.from(Ui(d));e==="mdl"&&(f=Va(f,ui(f),d)),f=e==="mdl"?Da(f,ui(f),d):Xr(f,d),e==="mdl"&&(f=hl(da(f)));let p=this._recoverySavedChanges.length?en(this._original,this.name).model:this._savedModel;o.conversion||(f=e==="mdx"?Pa(this._original,f,p,c,$e):Ca(this._original,f,p,c,$e));let m=c!==this.model||this._recoverySavedChanges.length?Object.keys($e).filter(_=>Qt(p[_])!==Qt(c[_])):this._changedKeys(),x=$i(kr(o.conversion?f:e==="mdl"?Md(this._original,this._sections,f,m):Td(this._original,this._container,f,m),e,c),e,c);s("reparsingMs");let g=en(x,`validation.${e}`);if(s("verificationMs"),g.readOnly)throw s("errorFormattingMs"),new Error(Gi("Save verification failed",g.diagnostics.filter(_=>_.severity==="error").map(_=>_.message)));if(g.version!==this.version)throw new Error("Save verification failed: model version changed.");if(Vr(c,g.model,{keys:Object.keys($e),timings:n}),JSON.stringify(Kt(c))!==JSON.stringify(Kt(g.model)))throw new Error("Save verification failed: geoset tab metadata changed.");if(JSON.stringify(Jt(c))!==JSON.stringify(Jt(g.model)))throw new Error("Save verification failed: animation speed metadata changed.");for(let _ of Object.keys($e))if(Array.isArray(this.model[_])&&this.model[_].length!==g.model[_]?.length)throw new Error(`Save verification failed: ${_} count changed during serialization.`);for(let _=0;_<this.model.Geosets.length;_++)if(this.model.Geosets[_].TVertices.length!==g.model.Geosets[_].TVertices.length)throw new Error(`Save verification failed: Geoset ${_} UV set count changed during serialization.`);let y=new Set(tn(this.model).filter(_=>_.severity==="error").map(_=>`${_.code}:${_.path}`)),v=g.diagnostics.filter(_=>_.severity==="error"&&!y.has(`${_.code}:${_.path}`));if(v.length)throw s("errorFormattingMs"),new Error(Gi("Save verification failed",v.map(_=>_.message)));return a(x)}finally{n[i]+=performance.now()-r,i==="verificationMs"&&(n.verificationMs-=n.errorFormattingMs),this.lastSaveTimings={...n}}}rememberSerializedSnapshot(e,n,i=this.revision){this._serializedStates.set(e,{model:Ee(n),revision:i})}markSaved(e,n=this.name){let i=e||this.serialize(),r=this._serializedStates.get(i),s=r?r.model:en(i,n).model;this.name=n,this._loadSource(i),this.version=this.model.Version,this._savedModel=Ee(s),this._recoverySavedChanges=On(en(i,n).model,s,{ignore:hi}),this._dirtyCandidates=new Set([...Object.keys(this._savedModel),...Object.keys(this.model)]),this._trackedModel=this.model,this.revision++}};function en(t,e,n){return new ss(t,e,n)}function Ad(t,e,n){let i=[],r=new Set;function s(o,a,c){if(typeof o=="string"){if(e==="mdl"&&(/["\0]/.test(o)||c!=="AnimVisibilityGuide"&&/[\r\n]/.test(o))&&i.push(`${a} contains a quote, newline or NUL that this MDL writer cannot safely encode.`),e==="mdx"){[...o].some(l=>l.charCodeAt(0)>255)&&i.push(`${a} contains Unicode characters that this MDX writer cannot encode. Save as MDL or use a compatible name.`);let h=["Image","Path","AnimationFile","AnimVisibilityGuide"].includes(c)?260:["Name","Shader"].includes(c)?80:null;h&&o.length>h&&i.push(`${a} exceeds its ${h}-byte MDX field; saving would truncate it.`)}return}if(!(!o||typeof o!="object"||ArrayBuffer.isView(o)||r.has(o))){r.add(o);for(let[h,l]of Object.entries(o))s(l,`${a}.${h}`,h)}}for(let o of n)s(t[o],o,o);return i}function tn(t,{numericSections:e=null,previousDiagnostics:n=[]}={}){let i=[],r=(u,f,p,m)=>i.push({severity:u,code:f,message:p,path:m});if(!t)return[{severity:"error",code:"NO_MODEL",message:"No model is loaded."}];let s=os(t),o=new Map;for(let u of s){let f=`Nodes[${u.ObjectId}]`;(!Number.isInteger(u.ObjectId)||u.ObjectId<0||u.ObjectId>1e6)&&r("error","NODE_ID",`Node ${u.Name} has an invalid object ID.`,f),o.has(u.ObjectId)&&r("error","DUPLICATE_NODE_ID",`Object ID ${u.ObjectId} is used by more than one node.`,f),o.set(u.ObjectId,u),(!u.PivotPoint||u.PivotPoint.length!==3)&&r("error","NODE_PIVOT",`Node ${u.Name} has no valid pivot point.`,f)}for(let u of s){let f=`Nodes[${u.ObjectId}]`;u.Parent!=null&&u.Parent!==-1&&!o.has(u.Parent)&&r("error","NODE_PARENT",`Node ${u.Name} references missing parent ${u.Parent}.`,f);let p=new Set([u.ObjectId]),m=u;for(;m&&m.Parent!=null&&m.Parent!==-1;){if(p.has(m.Parent)){r("error","HIERARCHY_CYCLE",`Node ${u.Name} would create a hierarchy cycle.`,f);break}p.add(m.Parent),m=o.get(m.Parent)}}for(let[u,f]of(t.Geosets||[]).entries()){let p=`Geosets[${u}]`,m=(f.Vertices?.length||0)/3;(!Number.isInteger(m)||!m)&&r("error","VERTEX_COUNT",`Geoset ${u} has invalid or empty vertex data.`,p),m>65536&&r("error","FACE_INDEX_LIMIT",`Geoset ${u} exceeds MDX's 16-bit face index capacity; split it into geosets.`,p),f.Normals?.length!==f.Vertices?.length&&r("error","NORMAL_COUNT",`Geoset ${u} normals do not match its vertices.`,p),(!ArrayBuffer.isView(f.Faces)||f.Faces.length%3)&&r("error","TRIANGLE_COUNT",`Geoset ${u} has invalid triangle data.`,p),f.Faces?.some(g=>g>=m||g<0||!Number.isInteger(g))&&r("error","FACE_REFERENCE",`Geoset ${u} contains a face with a missing vertex.`,p),(!Number.isInteger(f.MaterialID)||!t.Materials?.[f.MaterialID])&&r("error","MATERIAL_REFERENCE",`Geoset ${u} references missing material ${f.MaterialID}.`,p),f.TVertices?.length||r("warning","MISSING_UV",`Geoset ${u} has no texture coordinates.`,p),f.TVertices?.length>16&&r("error","UV_SET_LIMIT",`Geoset ${u} exceeds the 16 UV set limit.`,p);for(let[g,y]of(f.TVertices||[]).entries())y.length!==m*2&&r("error","UV_COUNT",`Geoset ${u} UV set ${g} has a mismatched vertex count.`,`${p}.TVertices[${g}]`);f.VertexGroup?.length!==m&&r("error","VERTEX_GROUP_COUNT",`Geoset ${u} vertex groups do not match its vertices.`,p),f.VertexGroup?.some(g=>g>=(f.Groups?.length||0))&&r("error","GROUP_REFERENCE",`Geoset ${u} references a missing matrix group.`,p);for(let g of new Set((f.Groups||[]).flat()))o.has(g)||r("error","BONE_REFERENCE",`Geoset ${u} references missing matrix node ${g}.`,`${p}.Groups[${g}]`);if(f.SkinWeights?.length){f.SkinWeights.length!==m*8&&r("error","SKIN_COUNT",`Geoset ${u} skin weights do not match its vertices.`,p),f.SkinWeights.some((v,_)=>!Number.isInteger(v)||v<0||v>(_%8<4&&t.Version>=1400?65535:255))&&r("error","SKIN_VALUE_RANGE",`Geoset ${u} skin indices or weights exceed their format range.`,p);let g=new Set,y=!1;for(let v=0;v<f.SkinWeights.length;v+=8){let _=0;for(let M=0;M<4;M++){let b=f.SkinWeights[v+4+M];_+=b,b&&!o.has(f.SkinWeights[v+M])&&g.add(f.SkinWeights[v+M])}_!==255&&(y=!0)}for(let v of g)r("error","SKIN_BONE_REFERENCE",`Geoset ${u} weights reference missing node ${v}.`,`${p}.SkinWeights[${v}]`);y&&r("warning","SKIN_WEIGHT_SUM",`Geoset ${u} has vertex weights that do not total 255.`,p)}f.Tangents?.length&&f.Tangents.length!==m*4&&r("error","TANGENT_COUNT",`Geoset ${u} tangents do not match its vertices.`,p);let x=0;for(let g=0;g<(f.Faces?.length||0);g+=3)(f.Faces[g]===f.Faces[g+1]||f.Faces[g]===f.Faces[g+2]||f.Faces[g+1]===f.Faces[g+2])&&x++;x&&r("warning","DEGENERATE_FACES",`Geoset ${u} has ${x} triangles with repeated vertices.`,p)}let a=(u,f)=>{u!=null&&u!==-1&&(!Number.isInteger(u)||!t.Textures?.[u])&&r("error","TEXTURE_REFERENCE",`${f} references missing texture ${u}.`,f)};for(let[u,f]of(t.Materials||[]).entries()){f.Layers?.length||r("error","EMPTY_MATERIAL",`Material ${u} needs at least one layer.`,`Materials[${u}]`);for(let[p,m]of(f.Layers||[]).entries()){let x=`Materials[${u}].Layers[${p}]`;for(let g of xd)if(typeof m[g]=="number")a(m[g],`${x}.${g}`);else if(m[g]?.Keys)for(let y of m[g].Keys)for(let v of y.Vector)a(v,`${x}.${g}`);m.TVertexAnimId!=null&&m.TVertexAnimId!==-1&&!t.TextureAnims?.[m.TVertexAnimId]&&r("error","TEXTURE_ANIM_REFERENCE",`${x} references a missing texture animation.`,x),typeof m.Alpha=="number"&&(m.Alpha<0||m.Alpha>1)&&r("warning","ALPHA_RANGE",`${x} alpha is outside 0\u20131.`,x)}}for(let[u,f]of(t.GeosetAnims||[]).entries())t.Geosets?.[f.GeosetId]||r("error","GEOSET_ANIM_REFERENCE",`Geoset animation ${u} references missing geoset ${f.GeosetId}.`,`GeosetAnims[${u}]`);for(let[u,f]of(t.Gliders||[]).entries())t.Geosets?.[f.GeosetId]||r("error","GLIDER_REFERENCE",`Glider ${u} references missing geoset ${f.GeosetId}.`,`Gliders[${u}]`);for(let u of t.Bones||[])u.GeosetId!=null&&u.GeosetId!==-1&&!t.Geosets?.[u.GeosetId]&&r("error","BONE_GEOSET_REFERENCE",`Bone ${u.Name} references missing geoset ${u.GeosetId}.`,`Nodes[${u.ObjectId}].GeosetId`),u.GeosetAnimId!=null&&u.GeosetAnimId!==-1&&!t.GeosetAnims?.[u.GeosetAnimId]&&r("error","BONE_GEOSET_ANIM_REFERENCE",`Bone ${u.Name} references a missing geoset animation.`,`Nodes[${u.ObjectId}].GeosetAnimId`);for(let u of t.ParticleEmitters2||[])a(u.TextureID,`Nodes[${u.ObjectId}].TextureID`);for(let u of t.RibbonEmitters||[])t.Materials?.[u.MaterialID]||r("error","RIBBON_MATERIAL_REFERENCE",`Ribbon ${u.Name} references a missing material.`,`Nodes[${u.ObjectId}].MaterialID`);for(let[u,f]of(t.Sequences||[]).entries())(!f.Interval||f.Interval.length!==2||f.Interval[0]>=f.Interval[1])&&r("error","SEQUENCE_INTERVAL",`Sequence ${f.Name||u} must end after it starts.`,`Sequences[${u}]`);for(let[u,f]of(t.GlobalSequences||[]).entries())(!Number.isInteger(f)||f<=0)&&r("error","GLOBAL_SEQUENCE_DURATION",`Global sequence ${u} needs a positive integer duration.`,`GlobalSequences[${u}]`);for(let u of t.EventObjects||[])u.GlobalSeqId!=null&&u.GlobalSeqId!==-1&&(!Number.isInteger(u.GlobalSeqId)||u.GlobalSeqId<0||t.GlobalSequences?.[u.GlobalSeqId]===void 0)&&r("error","GLOBAL_SEQUENCE_REFERENCE",`Event ${u.Name} references missing global sequence ${u.GlobalSeqId}.`,`Nodes[${u.ObjectId}].GlobalSeqId`);let c=new Set,h=["Model"],l=()=>h.join(".");function d(u){if(typeof u=="number"){if(!Number.isFinite(u)){let f=l();r("error","NON_FINITE_NUMBER",`${f} contains a non-finite number.`,f)}return}if(!(!u||typeof u!="object"||c.has(u))){if(c.add(u),ArrayBuffer.isView(u)){for(let f=0;f<u.length;f++)if(!Number.isFinite(u[f])){let p=l();r("error","NON_FINITE_NUMBER",`${p} contains a non-finite coordinate.`,p);break}return}if(u.Keys){let f=l();(!Number.isInteger(u.LineType)||u.LineType<0||u.LineType>3)&&r("error","KEYFRAME_INTERPOLATION",`${f} has an invalid interpolation mode.`,f),u.GlobalSeqId!=null&&u.GlobalSeqId!==-1&&t.GlobalSequences?.[u.GlobalSeqId]===void 0&&r("error","GLOBAL_SEQUENCE_REFERENCE",`${f} references missing global sequence ${u.GlobalSeqId}.`,f);let p=-1/0,m=h.at(-1),x=m==="Rotation"?h.includes("Cameras")?1:4:["Translation","Scaling","Color","AmbColor","FresnelColor","TargetTranslation"].includes(m)?3:1;for(let g of u.Keys)(!Number.isInteger(g.Frame)||g.Frame<-2147483648||g.Frame>2147483647||g.Frame<p)&&r("error","KEYFRAME_ORDER",`${f} keyframes must use signed 32-bit integer frames in increasing order.`,f),p=g.Frame,g.Vector?.length?g.Vector.length!==x&&r("error","KEYFRAME_DIMENSIONS",`${f} keyframes need ${x} values.`,f):r("error","KEYFRAME_VECTOR",`${f} has a keyframe without a value.`,f),u.LineType>=2&&(!g.InTan||!g.OutTan||g.InTan.length!==g.Vector?.length||g.OutTan.length!==g.Vector?.length)&&r("error","KEYFRAME_TANGENTS",`${f} spline keyframes need matching in/out tangents.`,f)}for(let f in u)f!=="Nodes"&&Object.prototype.hasOwnProperty.call(u,f)&&(h.push(f),d(u[f]),h.pop())}}if(e){for(let u of Object.keys(t))u!=="Nodes"&&e.has(u)&&(h.push(u),d(t[u]),h.pop());i.push(...n.filter(u=>u.path?.startsWith("Model.")&&!e.has(u.path.split(".")[1])))}else d(t);return i}function ul(t,e="Bone"){if(!yt[e])throw new Error(`Unsupported node type: ${e}.`);let[n,,i]=yt[e],r=Math.max(-1,...os(t).map(a=>a.ObjectId),(t.PivotPoints?.length||0)-1)+1,s=Le(),o={Name:`${e}_${r}`,ObjectId:r,Parent:null,PivotPoint:s,Flags:i};if(e==="Bone"&&Object.assign(o,{GeosetId:null,GeosetAnimId:null}),e==="Attachment"&&Object.assign(o,{AttachmentID:Math.max(-1,...(t.Attachments||[]).map(a=>a.AttachmentID||0))+1,Path:""}),e==="EventObject"&&(o.EventTrack=new Uint32Array([0])),e==="CollisionShape"&&Object.assign(o,{Shape:2,Vertices:Le(),BoundsRadius:16}),e==="Light"&&Object.assign(o,{LightType:0,AttenuationStart:80,AttenuationEnd:200,Color:Le(.2,.8,1),Intensity:1,AmbColor:Le(1,1,1),AmbIntensity:0}),e==="ParticleEmitter2"&&Object.assign(o,{Speed:10,Variation:0,Latitude:20,Gravity:0,LifeSpan:1,EmissionRate:10,Width:4,Length:4,FilterMode:1,Rows:1,Columns:1,FrameFlags:1,TailLength:0,Time:.5,SegmentColor:[Le(.2,.7,1),Le(.3,.9,1),Le(.1,.3,1)],Alpha:new Uint8Array([255,200,0]),ParticleScaling:Le(1,1,0),LifeSpanUVAnim:new Uint32Array([0,0,1]),DecayUVAnim:new Uint32Array([0,0,1]),TailUVAnim:new Uint32Array([0,0,1]),TailDecayUVAnim:new Uint32Array([0,0,1]),TextureID:t.Textures?.length?0:null,ReplaceableId:0,PriorityPlane:0}),e==="RibbonEmitter"){if(!t.Materials?.length)throw new Error("Create a material before adding a ribbon emitter.");Object.assign(o,{HeightAbove:4,HeightBelow:4,Alpha:1,Color:Le(.3,.8,1),LifeSpan:.5,TextureSlot:0,EmissionRate:10,Rows:1,Columns:1,MaterialID:0,Gravity:0})}if(e==="ParticleEmitter"&&Object.assign(o,{EmissionRate:10,Gravity:0,Longitude:0,Latitude:0,Path:"",LifeSpan:1,InitVelocity:0}),e==="ParticleEmitterPopcorn"){if(t.Version<900)throw new Error("Popcorn emitters need a Reforged model version.");Object.assign(o,{LifeSpan:1,EmissionRate:0,Speed:0,Color:Le(1,1,1),Alpha:1,ReplaceableId:0,Path:"",AnimVisibilityGuide:""})}(t[n]||=[]).push(o),(t.Nodes||=[])[r]=o,(t.PivotPoints||=[])[r]=s;for(let a of t.BindPoses||[]){let c=a.Matrices.length-(t.Cameras?.length||0),h=Array.from({length:Math.max(0,r-c+1)},()=>new Float32Array([1,0,0,0,1,0,0,0,1,0,0,0]));a.Matrices.splice(c,0,...h),a.Matrices[r]=new Float32Array([1,0,0,0,1,0,0,0,1,0,0,0])}return fl(t),o}function fl(t){for(let[e,n]of Object.entries({NumGeosets:"Geosets",NumGeosetAnims:"GeosetAnims",NumBones:"Bones",NumHelpers:"Helpers",NumLights:"Lights",NumAttachments:"Attachments",NumEvents:"EventObjects",NumParticleEmitters:"ParticleEmitters",NumParticleEmitters2:"ParticleEmitters2",NumRibbonEmitters:"RibbonEmitters"}))t.Info[e]=t[n]?.length||0}var Ed={Float32Array,Float64Array,Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array},Hv=16*1024*1024;function dl(t){return JSON.stringify(t,(e,n)=>{if(ArrayBuffer.isView(n)){if(!Object.hasOwn(Ed,n.constructor.name))throw Error("Unsupported typed array.");return{$array:n.constructor.name,values:Array.from(n)}}if(typeof n=="number"&&!Number.isFinite(n))throw Error("Preset contains a non-finite number.");return n})}function kn(t){if(typeof t!="string"||t.length>260||/[\x00-\x1f]/.test(t))return!1;let e=t.replace(/^(?:[\w.-]+\.w3mod:)+/i,"").replaceAll("\\","/");return!e.startsWith("/")&&!/^[a-z]:/i.test(e)&&!e.split("/").includes("..")}var pl=4*1024*1024,ml=t=>String(t||"").replaceAll("/","\\").toLowerCase();function gl(t){let e=t.embeddedAssets||[];if(!Array.isArray(e)||e.length>64)throw Error("Too many embedded pictures.");let n=0,i=new Set;for(let r of e){if(!r||!kn(r.path)||!/\.(blp|dds|tga)$/i.test(r.path)||i.has(r.path.toLowerCase())||typeof r.data!="string"||r.data.length>Math.ceil(pl/3)*4||r.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(r.data))throw Error("Invalid embedded picture.");let s=r.data.length/4*3-(r.data.endsWith("==")?2:r.data.endsWith("=")?1:0);if(!s||s>pl||(n+=s)>8*1024*1024)throw Error("Embedded pictures exceed the portable preset budget.");if(!t.native.Textures.some(o=>ml(o.Image)===ml(r.path)))throw Error("Embedded picture is not a recipe dependency.");i.add(r.path.toLowerCase())}return e}var vl=["ParticleEmitters2","RibbonEmitters","ParticleEmitters","ParticleEmitterPopcorns"],Pt=t=>structuredClone(t),wd=["TextureID","NormalTextureID","ORMTextureID","EmissiveTextureID","TeamColorTextureID","ReflectionsTextureID"];function Pd(t=800){let e={Version:t,Info:{Name:"Particle Lab",MinimumExtent:new Float32Array([-64,-64,-16]),MaximumExtent:new Float32Array([64,64,128]),BoundsRadius:120,BlendTime:150},Nodes:[]};for(let n of["Sequences","GlobalSequences","Textures","Materials","TextureAnims","Geosets","GeosetAnims","PivotPoints","Cameras","FaceFX","BindPoses","Gliders",...Object.values(yt).map(i=>i[0])])e[n]=[];return e}function Ki(t){return vl.flatMap(e=>(t[e]||[]).map(n=>({family:e,node:n})))}function Cd(t,e,n,{parent:i=null,sourceInterval:r,targetInterval:s,fit:o=!1}={}){if(t.Version!==e.Version)throw Error("Effect placement requires matching native model versions.");if(e.BindPoses?.length||t.BindPoses?.length)throw Error("Effect placement with bind-pose matrices is not yet supported.");if(i!=null&&!t.Nodes?.[i])throw Error("The attachment node no longer exists.");let a=new Set(n),c=new Set,h=new Set,l=new Map(Object.values(yt).flatMap(([x])=>e[x]||[]).map(x=>[x.ObjectId,x]));for(let x of a)if(!Ki(e).some(g=>g.node.ObjectId===x))throw Error("Selected effect no longer exists.");function d(x){if(h.has(x))return;if(c.has(x))throw Error("Effect hierarchy contains a cycle.");let g=l.get(x);if(!g)throw Error("Missing effect parent "+x);c.add(x),g.Parent!=null&&g.Parent!==-1&&d(g.Parent),c.delete(x),h.add(x)}n.forEach(d);let u={nodes:new Map,textures:new Map,materials:new Map,textureAnims:new Map,globals:new Map};function f(x){if(!(!x||typeof x!="object"||ArrayBuffer.isView(x))){if(x.GlobalSeqId!=null&&x.GlobalSeqId!==-1){let g=x.GlobalSeqId;if(!u.globals.has(g)){if(!Number.isFinite(e.GlobalSequences[g])||e.GlobalSequences[g]<0)throw Error("Missing global sequence.");u.globals.set(g,t.GlobalSequences.push(e.GlobalSequences[g])-1)}x.GlobalSeqId=u.globals.get(g)}else if(x.Keys&&r&&s){let[g,y]=r,[v,_]=s;if(!(y>g&&_>v))throw Error("Choose valid source and target intervals.");let M=x.Keys.filter(T=>T.Frame>=g&&T.Frame<=y),b=o?(_-v)/(y-g):1;if(x.Keys=M.sort((T,A)=>T.Frame-A.Frame).map(T=>({...T,Frame:Math.round(v+(T.Frame-g)*b)})),x.Keys.some((T,A)=>T.Frame>_||A&&T.Frame<=x.Keys[A-1].Frame))throw Error("The target interval cannot contain these source keys; choose Fit timing or a longer interval.")}for(let g of Object.values(x))f(g)}}function p(x){if(x==null||x===-1)return x;if(!e.Textures[x])throw Error("Missing effect texture "+x);return u.textures.has(x)||u.textures.set(x,t.Textures.push(Pt(e.Textures[x]))-1),u.textures.get(x)}function m(x){if(!e.Materials[x])throw Error("Missing ribbon material.");if(!u.materials.has(x)){let g=Pt(e.Materials[x]);for(let y of g.Layers||[]){for(let _ of wd){if(typeof y[_]=="number")y[_]=p(y[_]);else if(y[_]?.Keys)for(let M of y[_].Keys)for(let b of["Vector","InTan","OutTan"])M[b]&&(M[b]=new Int32Array(Array.from(M[b],p)));typeof y._MdxDefaults?.[_]=="number"&&(y._MdxDefaults[_]=p(y._MdxDefaults[_]))}let v=y.TVertexAnimId;if(v!=null&&v!==-1){if(!e.TextureAnims[v])throw Error("Missing texture animation.");if(!u.textureAnims.has(v)){let _=Pt(e.TextureAnims[v]);f(_),u.textureAnims.set(v,t.TextureAnims.push(_)-1)}y.TVertexAnimId=u.textureAnims.get(v)}}f(g),u.materials.set(x,t.Materials.push(g)-1)}return u.materials.get(x)}for(let x of h){let g=l.get(x),y=a.has(x)?Object.keys(yt).find(b=>e[yt[b][0]]?.some(T=>T.ObjectId===x)):"Helper",v=a.has(x)?Pt(g):Object.fromEntries(["Name","Flags","Translation","Rotation","Scaling","PivotPoint"].filter(b=>g[b]!==void 0).map(b=>[b,Pt(g[b])]));a.has(x)||(v.Flags=(v.Flags||0)&255),y==="ParticleEmitter2"&&(v.TextureID=p(v.TextureID)),y==="RibbonEmitter"&&(v.MaterialID=m(v.MaterialID));let _=ul(t,y),M=_.ObjectId;u.nodes.set(x,M),Object.assign(_,v,{ObjectId:M,Parent:g.Parent==null||g.Parent===-1?i:u.nodes.get(g.Parent)}),_.PivotPoint=Pt(e.PivotPoints[x]||g.PivotPoint||new Float32Array(3)),t.PivotPoints[M]=_.PivotPoint,f(_)}return{ids:n.map(x=>u.nodes.get(x)),maps:u}}function Id(t,e,n={}){let i=Pd(t.Version);i.Info=Pt(t.Info),i.Sequences=Pt(t.Sequences||[]);let{ids:r}=Cd(i,t,e),s=Ki(i).filter(c=>r.includes(c.node.ObjectId)).map(c=>({id:"ingredient-"+c.node.ObjectId,family:c.family,objectId:c.node.ObjectId})),o=s.filter(c=>["ParticleEmitters","ParticleEmitterPopcorns"].includes(c.family)).map(c=>({id:c.id,reason:c.family==="ParticleEmitters"?"External model emitter preview is not implemented by the pinned renderer.":"Popcorn/HD authoring is outside the classic library."})),a=[...i.Textures.map((c,h)=>({kind:"texture",index:h,path:c.Image,replaceableId:c.ReplaceableId||0})),...i.ParticleEmitters.filter(c=>c.Path).map(c=>({kind:"model",path:c.Path}))];for(let c of a){let h=n.dependencies?.find(l=>l.kind===c.kind&&l.path===c.path);h&&Object.assign(c,Pt(h),c.index==null?{}:{index:c.index})}return{schema:"mdlxl-particle-recipe",version:1,id:n.id||"draft",name:n.name||"Particle effect",categories:n.categories||["Other"],tags:n.tags||[],aliases:n.aliases||[],naming:{state:"review-needed"},sources:n.sources||[],...n.grouping?{grouping:Pt(n.grouping)}:{},ingredients:s,native:i,dependencies:a,anchor:{position:[0,0,0]},defaultSequence:n.defaultSequence??0,compatibility:{preview:o.length?"incomplete":"unverified",insertion:"unverified",unsupported:o}}}function Rd(t){if(t?.schema!=="mdlxl-particle-recipe"||t.version!==1)throw Error("Unsupported particle preset version.");if(typeof t.name!="string"||!t.name.trim()||t.name.length>120||typeof t.id!="string"||t.id.length>120)throw Error("Invalid preset identity.");if(!t.native||!Array.isArray(t.ingredients)||t.ingredients.length<1||t.ingredients.length>256)throw Error("Invalid effect ingredients.");let e=t.native;if((e.Nodes?.length||0)>1e4||(e.Textures?.length||0)>1024||(e.Sequences?.length||0)>2048)throw Error("Preset exceeds native resource limits.");let n=Object.values(yt).flatMap(([o])=>e[o]||[]);if(n.length>1e4||n.some(o=>!Number.isInteger(o.ObjectId)||o.ObjectId<0||o.ObjectId>1e4))throw Error("Preset exceeds node identity limits.");let i=Ki(e);if(i.length!==t.ingredients.length||new Set(t.ingredients.map(o=>o.objectId)).size!==i.length)throw Error("Every native effect needs one ingredient identity.");let r=o=>{if(typeof o=="number"&&(!Number.isFinite(o)||Math.abs(o)>34028234663852886e22))throw Error("Preset exceeds finite native numeric values.");if(o&&typeof o=="object")for(let a of Object.values(o))r(a)};r(e);for(let o of t.dependencies||[])if(o.path&&!kn(o.path))throw Error("Preset dependency needs a portable logical path.");for(let o of e.Textures||[])if(o.Image&&!kn(o.Image))throw Error("Invalid texture dependency path.");for(let o of[...e.ParticleEmitters||[],...e.ParticleEmitterPopcorns||[]])if(o.Path&&!kn(o.Path))throw Error("Invalid external effect path.");for(let o of t.ingredients)if(!vl.includes(o.family)||!e[o.family]?.some(a=>a.ObjectId===o.objectId))throw Error("Missing native ingredient.");gl(t);let s=tn(e).filter(o=>o.severity==="error");if(s.length)throw Error(s.slice(0,3).map(o=>o.message).join(`
`));return dl(t),t}var Cl=1;var Il=3;var ps=0,ms=1,gs=2,vs=3,xs=4,ys=5,_s=6,bs=7,Rl=0,Ll=1,Fl=2;var Ds=1,Us=2,Ns=3,Bs=4,Os=5,Vs=6,Gs=7;var ks=300,Dl=301,zs=302;var Ul=306,Ss=1e3,di=1001,Ms=1002;var Nl=1006;var Bl=1008;var Ol=1009;var Vl=1023;var mi=2300,nr=2301,er=2302,Ts=2303,As=2400,Es=2401,ws=2402;var Hs="",dt="srgb",Ps="srgb-linear",Cs="linear",tr="srgb";var pi=2e3,Is=2001;function Ld(t){return ArrayBuffer.isView(t)&&!(t instanceof DataView)}function Rs(t){return document.createElementNS("http://www.w3.org/1999/xhtml",t)}var xl={},ir=null;function Gl(t){let e=t[0];if(typeof e=="string"&&e.startsWith("TSL:")){let n=t[1];n&&n.isStackTrace?t[0]+=" "+n.getLocation():t[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return t}function ke(...t){t=Gl(t);let e="THREE."+t.shift();if(ir)ir("warn",e,...t);else{let n=t[0];n&&n.isStackTrace?console.warn(n.getError(e)):console.warn(e,...t)}}function we(...t){t=Gl(t);let e="THREE."+t.shift();if(ir)ir("error",e,...t);else{let n=t[0];n&&n.isStackTrace?console.error(n.getError(e)):console.error(e,...t)}}function Ls(...t){let e=t.join(" ");e in xl||(xl[e]=!0,ke(...t))}var Fd={[ps]:ms,[gs]:_s,[xs]:bs,[vs]:ys,[ms]:ps,[_s]:gs,[bs]:xs,[ys]:vs},gi=class{addEventListener(e,n){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(n)===-1&&i[e].push(n)}hasEventListener(e,n){let i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(n)!==-1}removeEventListener(e,n){let i=this._listeners;if(i===void 0)return;let r=i[e];if(r!==void 0){let s=r.indexOf(n);s!==-1&&r.splice(s,1)}}dispatchEvent(e){let n=this._listeners;if(n===void 0)return;let i=n[e.type];if(i!==void 0){e.target=this;let r=i.slice(0);for(let s=0,o=r.length;s<o;s++)r[s].call(this,e);e.target=null}}},Ve=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var Jv=Math.PI/180,Dd=180/Math.PI;function Ws(){let t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Ve[t&255]+Ve[t>>8&255]+Ve[t>>16&255]+Ve[t>>24&255]+"-"+Ve[e&255]+Ve[e>>8&255]+"-"+Ve[e>>16&15|64]+Ve[e>>24&255]+"-"+Ve[n&63|128]+Ve[n>>8&255]+"-"+Ve[n>>16&255]+Ve[n>>24&255]+Ve[i&255]+Ve[i>>8&255]+Ve[i>>16&255]+Ve[i>>24&255]).toLowerCase()}function oe(t,e,n){return Math.max(e,Math.min(n,t))}function Ud(t,e){return(t%e+e)%e}function as(t,e,n){return(1-n)*t+n*e}var bt=class t{constructor(e=0,n=0){t.prototype.isVector2=!0,this.x=e,this.y=n}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,n){return this.x=e,this.y=n,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,n){switch(e){case 0:this.x=n;break;case 1:this.y=n;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,n){return this.x=e.x+n.x,this.y=e.y+n.y,this}addScaledVector(e,n){return this.x+=e.x*n,this.y+=e.y*n,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,n){return this.x=e.x-n.x,this.y=e.y-n.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let n=this.x,i=this.y,r=e.elements;return this.x=r[0]*n+r[3]*i+r[6],this.y=r[1]*n+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,n){return this.x=oe(this.x,e.x,n.x),this.y=oe(this.y,e.y,n.y),this}clampScalar(e,n){return this.x=oe(this.x,e,n),this.y=oe(this.y,e,n),this}clampLength(e,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(oe(i,e,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let n=Math.sqrt(this.lengthSq()*e.lengthSq());if(n===0)return Math.PI/2;let i=this.dot(e)/n;return Math.acos(oe(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let n=this.x-e.x,i=this.y-e.y;return n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,n){return this.x+=(e.x-this.x)*n,this.y+=(e.y-this.y)*n,this}lerpVectors(e,n,i){return this.x=e.x+(n.x-e.x)*i,this.y=e.y+(n.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,n=0){return this.x=e[n],this.y=e[n+1],this}toArray(e=[],n=0){return e[n]=this.x,e[n+1]=this.y,e}fromBufferAttribute(e,n){return this.x=e.getX(n),this.y=e.getY(n),this}rotateAround(e,n){let i=Math.cos(n),r=Math.sin(n),s=this.x-e.x,o=this.y-e.y;return this.x=s*i-o*r+e.x,this.y=s*r+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Qe=class{constructor(e=0,n=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=n,this._z=i,this._w=r}static slerpFlat(e,n,i,r,s,o,a){let c=i[r+0],h=i[r+1],l=i[r+2],d=i[r+3],u=s[o+0],f=s[o+1],p=s[o+2],m=s[o+3];if(d!==m||c!==u||h!==f||l!==p){let x=c*u+h*f+l*p+d*m;x<0&&(u=-u,f=-f,p=-p,m=-m,x=-x);let g=1-a;if(x<.9995){let y=Math.acos(x),v=Math.sin(y);g=Math.sin(g*y)/v,a=Math.sin(a*y)/v,c=c*g+u*a,h=h*g+f*a,l=l*g+p*a,d=d*g+m*a}else{c=c*g+u*a,h=h*g+f*a,l=l*g+p*a,d=d*g+m*a;let y=1/Math.sqrt(c*c+h*h+l*l+d*d);c*=y,h*=y,l*=y,d*=y}}e[n]=c,e[n+1]=h,e[n+2]=l,e[n+3]=d}static multiplyQuaternionsFlat(e,n,i,r,s,o){let a=i[r],c=i[r+1],h=i[r+2],l=i[r+3],d=s[o],u=s[o+1],f=s[o+2],p=s[o+3];return e[n]=a*p+l*d+c*f-h*u,e[n+1]=c*p+l*u+h*d-a*f,e[n+2]=h*p+l*f+a*u-c*d,e[n+3]=l*p-a*d-c*u-h*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,n,i,r){return this._x=e,this._y=n,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,n=!0){let i=e._x,r=e._y,s=e._z,o=e._order,a=Math.cos,c=Math.sin,h=a(i/2),l=a(r/2),d=a(s/2),u=c(i/2),f=c(r/2),p=c(s/2);switch(o){case"XYZ":this._x=u*l*d+h*f*p,this._y=h*f*d-u*l*p,this._z=h*l*p+u*f*d,this._w=h*l*d-u*f*p;break;case"YXZ":this._x=u*l*d+h*f*p,this._y=h*f*d-u*l*p,this._z=h*l*p-u*f*d,this._w=h*l*d+u*f*p;break;case"ZXY":this._x=u*l*d-h*f*p,this._y=h*f*d+u*l*p,this._z=h*l*p+u*f*d,this._w=h*l*d-u*f*p;break;case"ZYX":this._x=u*l*d-h*f*p,this._y=h*f*d+u*l*p,this._z=h*l*p-u*f*d,this._w=h*l*d+u*f*p;break;case"YZX":this._x=u*l*d+h*f*p,this._y=h*f*d+u*l*p,this._z=h*l*p-u*f*d,this._w=h*l*d-u*f*p;break;case"XZY":this._x=u*l*d-h*f*p,this._y=h*f*d-u*l*p,this._z=h*l*p+u*f*d,this._w=h*l*d+u*f*p;break;default:ke("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return n===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,n){let i=n/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let n=e.elements,i=n[0],r=n[4],s=n[8],o=n[1],a=n[5],c=n[9],h=n[2],l=n[6],d=n[10],u=i+a+d;if(u>0){let f=.5/Math.sqrt(u+1);this._w=.25/f,this._x=(l-c)*f,this._y=(s-h)*f,this._z=(o-r)*f}else if(i>a&&i>d){let f=2*Math.sqrt(1+i-a-d);this._w=(l-c)/f,this._x=.25*f,this._y=(r+o)/f,this._z=(s+h)/f}else if(a>d){let f=2*Math.sqrt(1+a-i-d);this._w=(s-h)/f,this._x=(r+o)/f,this._y=.25*f,this._z=(c+l)/f}else{let f=2*Math.sqrt(1+d-i-a);this._w=(o-r)/f,this._x=(s+h)/f,this._y=(c+l)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,n){let i=e.dot(n)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*n.z-e.z*n.y,this._y=e.z*n.x-e.x*n.z,this._z=e.x*n.y-e.y*n.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(oe(this.dot(e),-1,1)))}rotateTowards(e,n){let i=this.angleTo(e);if(i===0)return this;let r=Math.min(1,n/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,n){let i=e._x,r=e._y,s=e._z,o=e._w,a=n._x,c=n._y,h=n._z,l=n._w;return this._x=i*l+o*a+r*h-s*c,this._y=r*l+o*c+s*a-i*h,this._z=s*l+o*h+i*c-r*a,this._w=o*l-i*a-r*c-s*h,this._onChangeCallback(),this}slerp(e,n){let i=e._x,r=e._y,s=e._z,o=e._w,a=this.dot(e);a<0&&(i=-i,r=-r,s=-s,o=-o,a=-a);let c=1-n;if(a<.9995){let h=Math.acos(a),l=Math.sin(h);c=Math.sin(c*h)/l,n=Math.sin(n*h)/l,this._x=this._x*c+i*n,this._y=this._y*c+r*n,this._z=this._z*c+s*n,this._w=this._w*c+o*n,this._onChangeCallback()}else this._x=this._x*c+i*n,this._y=this._y*c+r*n,this._z=this._z*c+s*n,this._w=this._w*c+o*n,this.normalize();return this}slerpQuaternions(e,n,i){return this.copy(e).slerp(n,i)}random(){let e=2*Math.PI*Math.random(),n=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(n),s*Math.cos(n))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,n=0){return this._x=e[n],this._y=e[n+1],this._z=e[n+2],this._w=e[n+3],this._onChangeCallback(),this}toArray(e=[],n=0){return e[n]=this._x,e[n+1]=this._y,e[n+2]=this._z,e[n+3]=this._w,e}fromBufferAttribute(e,n){return this._x=e.getX(n),this._y=e.getY(n),this._z=e.getZ(n),this._w=e.getW(n),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},pe=class t{constructor(e=0,n=0,i=0){t.prototype.isVector3=!0,this.x=e,this.y=n,this.z=i}set(e,n,i){return i===void 0&&(i=this.z),this.x=e,this.y=n,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,n){switch(e){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,n){return this.x=e.x+n.x,this.y=e.y+n.y,this.z=e.z+n.z,this}addScaledVector(e,n){return this.x+=e.x*n,this.y+=e.y*n,this.z+=e.z*n,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,n){return this.x=e.x-n.x,this.y=e.y-n.y,this.z=e.z-n.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,n){return this.x=e.x*n.x,this.y=e.y*n.y,this.z=e.z*n.z,this}applyEuler(e){return this.applyQuaternion(yl.setFromEuler(e))}applyAxisAngle(e,n){return this.applyQuaternion(yl.setFromAxisAngle(e,n))}applyMatrix3(e){let n=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*n+s[3]*i+s[6]*r,this.y=s[1]*n+s[4]*i+s[7]*r,this.z=s[2]*n+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let n=this.x,i=this.y,r=this.z,s=e.elements,o=1/(s[3]*n+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*n+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*n+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*n+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(e){let n=this.x,i=this.y,r=this.z,s=e.x,o=e.y,a=e.z,c=e.w,h=2*(o*r-a*i),l=2*(a*n-s*r),d=2*(s*i-o*n);return this.x=n+c*h+o*d-a*l,this.y=i+c*l+a*h-s*d,this.z=r+c*d+s*l-o*h,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let n=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*n+s[4]*i+s[8]*r,this.y=s[1]*n+s[5]*i+s[9]*r,this.z=s[2]*n+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,n){return this.x=oe(this.x,e.x,n.x),this.y=oe(this.y,e.y,n.y),this.z=oe(this.z,e.z,n.z),this}clampScalar(e,n){return this.x=oe(this.x,e,n),this.y=oe(this.y,e,n),this.z=oe(this.z,e,n),this}clampLength(e,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(oe(i,e,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,n){return this.x+=(e.x-this.x)*n,this.y+=(e.y-this.y)*n,this.z+=(e.z-this.z)*n,this}lerpVectors(e,n,i){return this.x=e.x+(n.x-e.x)*i,this.y=e.y+(n.y-e.y)*i,this.z=e.z+(n.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,n){let i=e.x,r=e.y,s=e.z,o=n.x,a=n.y,c=n.z;return this.x=r*c-s*a,this.y=s*o-i*c,this.z=i*a-r*o,this}projectOnVector(e){let n=e.lengthSq();if(n===0)return this.set(0,0,0);let i=e.dot(this)/n;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return ls.copy(this).projectOnVector(e),this.sub(ls)}reflect(e){return this.sub(ls.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let n=Math.sqrt(this.lengthSq()*e.lengthSq());if(n===0)return Math.PI/2;let i=this.dot(e)/n;return Math.acos(oe(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let n=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return n*n+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,n,i){let r=Math.sin(n)*e;return this.x=r*Math.sin(i),this.y=Math.cos(n)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,n,i){return this.x=e*Math.sin(n),this.y=i,this.z=e*Math.cos(n),this}setFromMatrixPosition(e){let n=e.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this}setFromMatrixScale(e){let n=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=n,this.y=i,this.z=r,this}setFromMatrixColumn(e,n){return this.fromArray(e.elements,n*4)}setFromMatrix3Column(e,n){return this.fromArray(e.elements,n*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,n=0){return this.x=e[n],this.y=e[n+1],this.z=e[n+2],this}toArray(e=[],n=0){return e[n]=this.x,e[n+1]=this.y,e[n+2]=this.z,e}fromBufferAttribute(e,n){return this.x=e.getX(n),this.y=e.getY(n),this.z=e.getZ(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,n=Math.random()*2-1,i=Math.sqrt(1-n*n);return this.x=i*Math.cos(e),this.y=n,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},ls=new pe,yl=new Qe,Y=class t{constructor(e,n,i,r,s,o,a,c,h){t.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,n,i,r,s,o,a,c,h)}set(e,n,i,r,s,o,a,c,h){let l=this.elements;return l[0]=e,l[1]=r,l[2]=a,l[3]=n,l[4]=s,l[5]=c,l[6]=i,l[7]=o,l[8]=h,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let n=this.elements,i=e.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],this}extractBasis(e,n,i){return e.setFromMatrix3Column(this,0),n.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let n=e.elements;return this.set(n[0],n[4],n[8],n[1],n[5],n[9],n[2],n[6],n[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,n){let i=e.elements,r=n.elements,s=this.elements,o=i[0],a=i[3],c=i[6],h=i[1],l=i[4],d=i[7],u=i[2],f=i[5],p=i[8],m=r[0],x=r[3],g=r[6],y=r[1],v=r[4],_=r[7],M=r[2],b=r[5],T=r[8];return s[0]=o*m+a*y+c*M,s[3]=o*x+a*v+c*b,s[6]=o*g+a*_+c*T,s[1]=h*m+l*y+d*M,s[4]=h*x+l*v+d*b,s[7]=h*g+l*_+d*T,s[2]=u*m+f*y+p*M,s[5]=u*x+f*v+p*b,s[8]=u*g+f*_+p*T,this}multiplyScalar(e){let n=this.elements;return n[0]*=e,n[3]*=e,n[6]*=e,n[1]*=e,n[4]*=e,n[7]*=e,n[2]*=e,n[5]*=e,n[8]*=e,this}determinant(){let e=this.elements,n=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],c=e[6],h=e[7],l=e[8];return n*o*l-n*a*h-i*s*l+i*a*c+r*s*h-r*o*c}invert(){let e=this.elements,n=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],c=e[6],h=e[7],l=e[8],d=l*o-a*h,u=a*c-l*s,f=h*s-o*c,p=n*d+i*u+r*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let m=1/p;return e[0]=d*m,e[1]=(r*h-l*i)*m,e[2]=(a*i-r*o)*m,e[3]=u*m,e[4]=(l*n-r*c)*m,e[5]=(r*s-a*n)*m,e[6]=f*m,e[7]=(i*c-h*n)*m,e[8]=(o*n-i*s)*m,this}transpose(){let e,n=this.elements;return e=n[1],n[1]=n[3],n[3]=e,e=n[2],n[2]=n[6],n[6]=e,e=n[5],n[5]=n[7],n[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let n=this.elements;return e[0]=n[0],e[1]=n[3],e[2]=n[6],e[3]=n[1],e[4]=n[4],e[5]=n[7],e[6]=n[2],e[7]=n[5],e[8]=n[8],this}setUvTransform(e,n,i,r,s,o,a){let c=Math.cos(s),h=Math.sin(s);return this.set(i*c,i*h,-i*(c*o+h*a)+o+e,-r*h,r*c,-r*(-h*o+c*a)+a+n,0,0,1),this}scale(e,n){return this.premultiply(cs.makeScale(e,n)),this}rotate(e){return this.premultiply(cs.makeRotation(-e)),this}translate(e,n){return this.premultiply(cs.makeTranslation(e,n)),this}makeTranslation(e,n){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,n,0,0,1),this}makeRotation(e){let n=Math.cos(e),i=Math.sin(e);return this.set(n,-i,0,i,n,0,0,0,1),this}makeScale(e,n){return this.set(e,0,0,0,n,0,0,0,1),this}equals(e){let n=this.elements,i=e.elements;for(let r=0;r<9;r++)if(n[r]!==i[r])return!1;return!0}fromArray(e,n=0){for(let i=0;i<9;i++)this.elements[i]=e[i+n];return this}toArray(e=[],n=0){let i=this.elements;return e[n]=i[0],e[n+1]=i[1],e[n+2]=i[2],e[n+3]=i[3],e[n+4]=i[4],e[n+5]=i[5],e[n+6]=i[6],e[n+7]=i[7],e[n+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}},cs=new Y,_l=new Y().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),bl=new Y().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Nd(){let t={enabled:!0,workingColorSpace:Ps,spaces:{},convert:function(r,s,o){return this.enabled===!1||s===o||!s||!o||(this.spaces[s].transfer===tr&&(r.r=Gt(r.r),r.g=Gt(r.g),r.b=Gt(r.b)),this.spaces[s].primaries!==this.spaces[o].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===tr&&(r.r=qn(r.r),r.g=qn(r.g),r.b=qn(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===Hs?Cs:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,o){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return Ls("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),t.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return Ls("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),t.colorSpaceToWorking(r,s)}},e=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],i=[.3127,.329];return t.define({[Ps]:{primaries:e,whitePoint:i,transfer:Cs,toXYZ:_l,fromXYZ:bl,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:dt},outputColorSpaceConfig:{drawingBufferColorSpace:dt}},[dt]:{primaries:e,whitePoint:i,transfer:tr,toXYZ:_l,fromXYZ:bl,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:dt}}}),t}var ft=Nd();function Gt(t){return t<.04045?t*.0773993808:Math.pow(t*.9478672986+.0521327014,2.4)}function qn(t){return t<.0031308?t*12.92:1.055*Math.pow(t,.41666)-.055}var zn,rr=class{static getDataURL(e,n="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{zn===void 0&&(zn=Rs("canvas")),zn.width=e.width,zn.height=e.height;let r=zn.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),i=zn}return i.toDataURL(n)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let n=Rs("canvas");n.width=e.width,n.height=e.height;let i=n.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let o=0;o<s.length;o++)s[o]=Gt(s[o]/255)*255;return i.putImageData(r,0,0),n}else if(e.data){let n=e.data.slice(0);for(let i=0;i<n.length;i++)n instanceof Uint8Array||n instanceof Uint8ClampedArray?n[i]=Math.floor(Gt(n[i]/255)*255):n[i]=Gt(n[i]);return{data:n,width:e.width,height:e.height}}else return ke("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},Bd=0,sr=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Bd++}),this.uuid=Ws(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let n=this.data;return typeof HTMLVideoElement<"u"&&n instanceof HTMLVideoElement?e.set(n.videoWidth,n.videoHeight,0):typeof VideoFrame<"u"&&n instanceof VideoFrame?e.set(n.displayHeight,n.displayWidth,0):n!==null?e.set(n.width,n.height,n.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let n=e===void 0||typeof e=="string";if(!n&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(hs(r[o].image)):s.push(hs(r[o]))}else s=hs(r);i.url=s}return n||(e.images[this.uuid]=i),i}};function hs(t){return typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap?rr.getDataURL(t):t.data?{data:Array.from(t.data),width:t.width,height:t.height,type:t.data.constructor.name}:(ke("Texture: Unable to serialize Texture."),{})}var Od=0,us=new pe,$n=class t extends gi{constructor(e=t.DEFAULT_IMAGE,n=t.DEFAULT_MAPPING,i=di,r=di,s=Nl,o=Bl,a=Vl,c=Ol,h=t.DEFAULT_ANISOTROPY,l=Hs){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Od++}),this.uuid=Ws(),this.name="",this.source=new sr(e),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=h,this.format=a,this.internalFormat=null,this.type=c,this.offset=new bt(0,0),this.repeat=new bt(1,1),this.center=new bt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Y,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=l,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(us).x}get height(){return this.source.getSize(us).y}get depth(){return this.source.getSize(us).z}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,n){this.updateRanges.push({start:e,count:n})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let n in e){let i=e[n];if(i===void 0){ke(`Texture.setValues(): parameter '${n}' has value of undefined.`);continue}let r=this[n];if(r===void 0){ke(`Texture.setValues(): property '${n}' does not exist.`);continue}r&&i&&r.isVector2&&i.isVector2||r&&i&&r.isVector3&&i.isVector3||r&&i&&r.isMatrix3&&i.isMatrix3?r.copy(i):this[n]=i}}toJSON(e){let n=e===void 0||typeof e=="string";if(!n&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),n||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==ks)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Ss:e.x=e.x-Math.floor(e.x);break;case di:e.x=e.x<0?0:1;break;case Ms:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Ss:e.y=e.y-Math.floor(e.y);break;case di:e.y=e.y<0?0:1;break;case Ms:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};$n.DEFAULT_IMAGE=null;$n.DEFAULT_MAPPING=ks;$n.DEFAULT_ANISOTROPY=1;var Ct=class t{constructor(e,n,i,r,s,o,a,c,h,l,d,u,f,p,m,x){t.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,n,i,r,s,o,a,c,h,l,d,u,f,p,m,x)}set(e,n,i,r,s,o,a,c,h,l,d,u,f,p,m,x){let g=this.elements;return g[0]=e,g[4]=n,g[8]=i,g[12]=r,g[1]=s,g[5]=o,g[9]=a,g[13]=c,g[2]=h,g[6]=l,g[10]=d,g[14]=u,g[3]=f,g[7]=p,g[11]=m,g[15]=x,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new t().fromArray(this.elements)}copy(e){let n=this.elements,i=e.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],n[9]=i[9],n[10]=i[10],n[11]=i[11],n[12]=i[12],n[13]=i[13],n[14]=i[14],n[15]=i[15],this}copyPosition(e){let n=this.elements,i=e.elements;return n[12]=i[12],n[13]=i[13],n[14]=i[14],this}setFromMatrix3(e){let n=e.elements;return this.set(n[0],n[3],n[6],0,n[1],n[4],n[7],0,n[2],n[5],n[8],0,0,0,0,1),this}extractBasis(e,n,i){return this.determinant()===0?(e.set(1,0,0),n.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),n.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,n,i){return this.set(e.x,n.x,i.x,0,e.y,n.y,i.y,0,e.z,n.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinant()===0)return this.identity();let n=this.elements,i=e.elements,r=1/Hn.setFromMatrixColumn(e,0).length(),s=1/Hn.setFromMatrixColumn(e,1).length(),o=1/Hn.setFromMatrixColumn(e,2).length();return n[0]=i[0]*r,n[1]=i[1]*r,n[2]=i[2]*r,n[3]=0,n[4]=i[4]*s,n[5]=i[5]*s,n[6]=i[6]*s,n[7]=0,n[8]=i[8]*o,n[9]=i[9]*o,n[10]=i[10]*o,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromEuler(e){let n=this.elements,i=e.x,r=e.y,s=e.z,o=Math.cos(i),a=Math.sin(i),c=Math.cos(r),h=Math.sin(r),l=Math.cos(s),d=Math.sin(s);if(e.order==="XYZ"){let u=o*l,f=o*d,p=a*l,m=a*d;n[0]=c*l,n[4]=-c*d,n[8]=h,n[1]=f+p*h,n[5]=u-m*h,n[9]=-a*c,n[2]=m-u*h,n[6]=p+f*h,n[10]=o*c}else if(e.order==="YXZ"){let u=c*l,f=c*d,p=h*l,m=h*d;n[0]=u+m*a,n[4]=p*a-f,n[8]=o*h,n[1]=o*d,n[5]=o*l,n[9]=-a,n[2]=f*a-p,n[6]=m+u*a,n[10]=o*c}else if(e.order==="ZXY"){let u=c*l,f=c*d,p=h*l,m=h*d;n[0]=u-m*a,n[4]=-o*d,n[8]=p+f*a,n[1]=f+p*a,n[5]=o*l,n[9]=m-u*a,n[2]=-o*h,n[6]=a,n[10]=o*c}else if(e.order==="ZYX"){let u=o*l,f=o*d,p=a*l,m=a*d;n[0]=c*l,n[4]=p*h-f,n[8]=u*h+m,n[1]=c*d,n[5]=m*h+u,n[9]=f*h-p,n[2]=-h,n[6]=a*c,n[10]=o*c}else if(e.order==="YZX"){let u=o*c,f=o*h,p=a*c,m=a*h;n[0]=c*l,n[4]=m-u*d,n[8]=p*d+f,n[1]=d,n[5]=o*l,n[9]=-a*l,n[2]=-h*l,n[6]=f*d+p,n[10]=u-m*d}else if(e.order==="XZY"){let u=o*c,f=o*h,p=a*c,m=a*h;n[0]=c*l,n[4]=-d,n[8]=h*l,n[1]=u*d+m,n[5]=o*l,n[9]=f*d-p,n[2]=p*d-f,n[6]=a*l,n[10]=m*d+u}return n[3]=0,n[7]=0,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Vd,e,Gd)}lookAt(e,n,i){let r=this.elements;return at.subVectors(e,n),at.lengthSq()===0&&(at.z=1),at.normalize(),nn.crossVectors(i,at),nn.lengthSq()===0&&(Math.abs(i.z)===1?at.x+=1e-4:at.z+=1e-4,at.normalize(),nn.crossVectors(i,at)),nn.normalize(),ji.crossVectors(at,nn),r[0]=nn.x,r[4]=ji.x,r[8]=at.x,r[1]=nn.y,r[5]=ji.y,r[9]=at.y,r[2]=nn.z,r[6]=ji.z,r[10]=at.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,n){let i=e.elements,r=n.elements,s=this.elements,o=i[0],a=i[4],c=i[8],h=i[12],l=i[1],d=i[5],u=i[9],f=i[13],p=i[2],m=i[6],x=i[10],g=i[14],y=i[3],v=i[7],_=i[11],M=i[15],b=r[0],T=r[4],A=r[8],S=r[12],D=r[1],R=r[5],L=r[9],P=r[13],U=r[2],w=r[6],C=r[10],G=r[14],N=r[3],ee=r[7],xe=r[11],ie=r[15];return s[0]=o*b+a*D+c*U+h*N,s[4]=o*T+a*R+c*w+h*ee,s[8]=o*A+a*L+c*C+h*xe,s[12]=o*S+a*P+c*G+h*ie,s[1]=l*b+d*D+u*U+f*N,s[5]=l*T+d*R+u*w+f*ee,s[9]=l*A+d*L+u*C+f*xe,s[13]=l*S+d*P+u*G+f*ie,s[2]=p*b+m*D+x*U+g*N,s[6]=p*T+m*R+x*w+g*ee,s[10]=p*A+m*L+x*C+g*xe,s[14]=p*S+m*P+x*G+g*ie,s[3]=y*b+v*D+_*U+M*N,s[7]=y*T+v*R+_*w+M*ee,s[11]=y*A+v*L+_*C+M*xe,s[15]=y*S+v*P+_*G+M*ie,this}multiplyScalar(e){let n=this.elements;return n[0]*=e,n[4]*=e,n[8]*=e,n[12]*=e,n[1]*=e,n[5]*=e,n[9]*=e,n[13]*=e,n[2]*=e,n[6]*=e,n[10]*=e,n[14]*=e,n[3]*=e,n[7]*=e,n[11]*=e,n[15]*=e,this}determinant(){let e=this.elements,n=e[0],i=e[4],r=e[8],s=e[12],o=e[1],a=e[5],c=e[9],h=e[13],l=e[2],d=e[6],u=e[10],f=e[14],p=e[3],m=e[7],x=e[11],g=e[15],y=c*f-h*u,v=a*f-h*d,_=a*u-c*d,M=o*f-h*l,b=o*u-c*l,T=o*d-a*l;return n*(m*y-x*v+g*_)-i*(p*y-x*M+g*b)+r*(p*v-m*M+g*T)-s*(p*_-m*b+x*T)}transpose(){let e=this.elements,n;return n=e[1],e[1]=e[4],e[4]=n,n=e[2],e[2]=e[8],e[8]=n,n=e[6],e[6]=e[9],e[9]=n,n=e[3],e[3]=e[12],e[12]=n,n=e[7],e[7]=e[13],e[13]=n,n=e[11],e[11]=e[14],e[14]=n,this}setPosition(e,n,i){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=n,r[14]=i),this}invert(){let e=this.elements,n=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],c=e[6],h=e[7],l=e[8],d=e[9],u=e[10],f=e[11],p=e[12],m=e[13],x=e[14],g=e[15],y=n*a-i*o,v=n*c-r*o,_=n*h-s*o,M=i*c-r*a,b=i*h-s*a,T=r*h-s*c,A=l*m-d*p,S=l*x-u*p,D=l*g-f*p,R=d*x-u*m,L=d*g-f*m,P=u*g-f*x,U=y*P-v*L+_*R+M*D-b*S+T*A;if(U===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let w=1/U;return e[0]=(a*P-c*L+h*R)*w,e[1]=(r*L-i*P-s*R)*w,e[2]=(m*T-x*b+g*M)*w,e[3]=(u*b-d*T-f*M)*w,e[4]=(c*D-o*P-h*S)*w,e[5]=(n*P-r*D+s*S)*w,e[6]=(x*_-p*T-g*v)*w,e[7]=(l*T-u*_+f*v)*w,e[8]=(o*L-a*D+h*A)*w,e[9]=(i*D-n*L-s*A)*w,e[10]=(p*b-m*_+g*y)*w,e[11]=(d*_-l*b-f*y)*w,e[12]=(a*S-o*R-c*A)*w,e[13]=(n*R-i*S+r*A)*w,e[14]=(m*v-p*M-x*y)*w,e[15]=(l*M-d*v+u*y)*w,this}scale(e){let n=this.elements,i=e.x,r=e.y,s=e.z;return n[0]*=i,n[4]*=r,n[8]*=s,n[1]*=i,n[5]*=r,n[9]*=s,n[2]*=i,n[6]*=r,n[10]*=s,n[3]*=i,n[7]*=r,n[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,n=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(n,i,r))}makeTranslation(e,n,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,n,0,0,1,i,0,0,0,1),this}makeRotationX(e){let n=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,n,-i,0,0,i,n,0,0,0,0,1),this}makeRotationY(e){let n=Math.cos(e),i=Math.sin(e);return this.set(n,0,i,0,0,1,0,0,-i,0,n,0,0,0,0,1),this}makeRotationZ(e){let n=Math.cos(e),i=Math.sin(e);return this.set(n,-i,0,0,i,n,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,n){let i=Math.cos(n),r=Math.sin(n),s=1-i,o=e.x,a=e.y,c=e.z,h=s*o,l=s*a;return this.set(h*o+i,h*a-r*c,h*c+r*a,0,h*a+r*c,l*a+i,l*c-r*o,0,h*c-r*a,l*c+r*o,s*c*c+i,0,0,0,0,1),this}makeScale(e,n,i){return this.set(e,0,0,0,0,n,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,n,i,r,s,o){return this.set(1,i,s,0,e,1,o,0,n,r,1,0,0,0,0,1),this}compose(e,n,i){let r=this.elements,s=n._x,o=n._y,a=n._z,c=n._w,h=s+s,l=o+o,d=a+a,u=s*h,f=s*l,p=s*d,m=o*l,x=o*d,g=a*d,y=c*h,v=c*l,_=c*d,M=i.x,b=i.y,T=i.z;return r[0]=(1-(m+g))*M,r[1]=(f+_)*M,r[2]=(p-v)*M,r[3]=0,r[4]=(f-_)*b,r[5]=(1-(u+g))*b,r[6]=(x+y)*b,r[7]=0,r[8]=(p+v)*T,r[9]=(x-y)*T,r[10]=(1-(u+m))*T,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,n,i){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let s=this.determinant();if(s===0)return i.set(1,1,1),n.identity(),this;let o=Hn.set(r[0],r[1],r[2]).length(),a=Hn.set(r[4],r[5],r[6]).length(),c=Hn.set(r[8],r[9],r[10]).length();s<0&&(o=-o),_t.copy(this);let h=1/o,l=1/a,d=1/c;return _t.elements[0]*=h,_t.elements[1]*=h,_t.elements[2]*=h,_t.elements[4]*=l,_t.elements[5]*=l,_t.elements[6]*=l,_t.elements[8]*=d,_t.elements[9]*=d,_t.elements[10]*=d,n.setFromRotationMatrix(_t),i.x=o,i.y=a,i.z=c,this}makePerspective(e,n,i,r,s,o,a=pi,c=!1){let h=this.elements,l=2*s/(n-e),d=2*s/(i-r),u=(n+e)/(n-e),f=(i+r)/(i-r),p,m;if(c)p=s/(o-s),m=o*s/(o-s);else if(a===pi)p=-(o+s)/(o-s),m=-2*o*s/(o-s);else if(a===Is)p=-o/(o-s),m=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return h[0]=l,h[4]=0,h[8]=u,h[12]=0,h[1]=0,h[5]=d,h[9]=f,h[13]=0,h[2]=0,h[6]=0,h[10]=p,h[14]=m,h[3]=0,h[7]=0,h[11]=-1,h[15]=0,this}makeOrthographic(e,n,i,r,s,o,a=pi,c=!1){let h=this.elements,l=2/(n-e),d=2/(i-r),u=-(n+e)/(n-e),f=-(i+r)/(i-r),p,m;if(c)p=1/(o-s),m=o/(o-s);else if(a===pi)p=-2/(o-s),m=-(o+s)/(o-s);else if(a===Is)p=-1/(o-s),m=-s/(o-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return h[0]=l,h[4]=0,h[8]=0,h[12]=u,h[1]=0,h[5]=d,h[9]=0,h[13]=f,h[2]=0,h[6]=0,h[10]=p,h[14]=m,h[3]=0,h[7]=0,h[11]=0,h[15]=1,this}equals(e){let n=this.elements,i=e.elements;for(let r=0;r<16;r++)if(n[r]!==i[r])return!1;return!0}fromArray(e,n=0){for(let i=0;i<16;i++)this.elements[i]=e[i+n];return this}toArray(e=[],n=0){let i=this.elements;return e[n]=i[0],e[n+1]=i[1],e[n+2]=i[2],e[n+3]=i[3],e[n+4]=i[4],e[n+5]=i[5],e[n+6]=i[6],e[n+7]=i[7],e[n+8]=i[8],e[n+9]=i[9],e[n+10]=i[10],e[n+11]=i[11],e[n+12]=i[12],e[n+13]=i[13],e[n+14]=i[14],e[n+15]=i[15],e}},Hn=new pe,_t=new Ct,Vd=new pe(0,0,0),Gd=new pe(1,1,1),nn=new pe,ji=new pe,at=new pe,Sl=new Ct,Ml=new Qe,vi=class t{constructor(e=0,n=0,i=0,r=t.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=n,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,n,i,r=this._order){return this._x=e,this._y=n,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,n=this._order,i=!0){let r=e.elements,s=r[0],o=r[4],a=r[8],c=r[1],h=r[5],l=r[9],d=r[2],u=r[6],f=r[10];switch(n){case"XYZ":this._y=Math.asin(oe(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-l,f),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(u,h),this._z=0);break;case"YXZ":this._x=Math.asin(-oe(l,-1,1)),Math.abs(l)<.9999999?(this._y=Math.atan2(a,f),this._z=Math.atan2(c,h)):(this._y=Math.atan2(-d,s),this._z=0);break;case"ZXY":this._x=Math.asin(oe(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-d,f),this._z=Math.atan2(-o,h)):(this._y=0,this._z=Math.atan2(c,s));break;case"ZYX":this._y=Math.asin(-oe(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(u,f),this._z=Math.atan2(c,s)):(this._x=0,this._z=Math.atan2(-o,h));break;case"YZX":this._z=Math.asin(oe(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-l,h),this._y=Math.atan2(-d,s)):(this._x=0,this._y=Math.atan2(a,f));break;case"XZY":this._z=Math.asin(-oe(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(u,h),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-l,f),this._y=0);break;default:ke("Euler: .setFromRotationMatrix() encountered an unknown order: "+n)}return this._order=n,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,n,i){return Sl.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Sl,n,i)}setFromVector3(e,n=this._order){return this.set(e.x,e.y,e.z,n)}reorder(e){return Ml.setFromEuler(this),this.setFromQuaternion(Ml,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],n=0){return e[n]=this._x,e[n+1]=this._y,e[n+2]=this._z,e[n+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};vi.DEFAULT_ORDER="XYZ";var or=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},kd=0,Tl=new pe,Wn=new Qe,Vt=new Ct,Zi=new pe,fi=new pe,zd=new pe,Hd=new Qe,Al=new pe(1,0,0),El=new pe(0,1,0),wl=new pe(0,0,1),Pl={type:"added"},Wd={type:"removed"},Xn={type:"childadded",child:null},fs={type:"childremoved",child:null},Yn=class t extends gi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:kd++}),this.uuid=Ws(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=t.DEFAULT_UP.clone();let e=new pe,n=new vi,i=new Qe,r=new pe(1,1,1);function s(){i.setFromEuler(n,!1)}function o(){n.setFromQuaternion(i,void 0,!1)}n._onChange(s),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new Ct},normalMatrix:{value:new Y}}),this.matrix=new Ct,this.matrixWorld=new Ct,this.matrixAutoUpdate=t.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=t.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new or,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,n){this.quaternion.setFromAxisAngle(e,n)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,n){return Wn.setFromAxisAngle(e,n),this.quaternion.multiply(Wn),this}rotateOnWorldAxis(e,n){return Wn.setFromAxisAngle(e,n),this.quaternion.premultiply(Wn),this}rotateX(e){return this.rotateOnAxis(Al,e)}rotateY(e){return this.rotateOnAxis(El,e)}rotateZ(e){return this.rotateOnAxis(wl,e)}translateOnAxis(e,n){return Tl.copy(e).applyQuaternion(this.quaternion),this.position.add(Tl.multiplyScalar(n)),this}translateX(e){return this.translateOnAxis(Al,e)}translateY(e){return this.translateOnAxis(El,e)}translateZ(e){return this.translateOnAxis(wl,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Vt.copy(this.matrixWorld).invert())}lookAt(e,n,i){e.isVector3?Zi.copy(e):Zi.set(e,n,i);let r=this.parent;this.updateWorldMatrix(!0,!1),fi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Vt.lookAt(fi,Zi,this.up):Vt.lookAt(Zi,fi,this.up),this.quaternion.setFromRotationMatrix(Vt),r&&(Vt.extractRotation(r.matrixWorld),Wn.setFromRotationMatrix(Vt),this.quaternion.premultiply(Wn.invert()))}add(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.add(arguments[n]);return this}return e===this?(we("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Pl),Xn.child=e,this.dispatchEvent(Xn),Xn.child=null):we("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let n=this.children.indexOf(e);return n!==-1&&(e.parent=null,this.children.splice(n,1),e.dispatchEvent(Wd),fs.child=e,this.dispatchEvent(fs),fs.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Vt.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Vt.multiply(e.parent.matrixWorld)),e.applyMatrix4(Vt),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Pl),Xn.child=e,this.dispatchEvent(Xn),Xn.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,n){if(this[e]===n)return this;for(let i=0,r=this.children.length;i<r;i++){let o=this.children[i].getObjectByProperty(e,n);if(o!==void 0)return o}}getObjectsByProperty(e,n,i=[]){this[e]===n&&i.push(this);let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].getObjectsByProperty(e,n,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(fi,e,zd),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(fi,Hd,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let n=this.matrixWorld.elements;return e.set(n[8],n[9],n[10]).normalize()}raycast(){}traverse(e){e(this);let n=this.children;for(let i=0,r=n.length;i<r;i++)n[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let n=this.children;for(let i=0,r=n.length;i<r;i++)n[i].traverseVisible(e)}traverseAncestors(e){let n=this.parent;n!==null&&(e(n),n.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let n=e.x,i=e.y,r=e.z,s=this.matrix.elements;s[12]+=n-s[0]*n-s[4]*i-s[8]*r,s[13]+=i-s[1]*n-s[5]*i-s[9]*r,s[14]+=r-s[2]*n-s[6]*i-s[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let n=this.children;for(let i=0,r=n.length;i<r;i++)n[i].updateMatrixWorld(e)}updateWorldMatrix(e,n){let i=this.parent;if(e===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),n===!0){let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].updateWorldMatrix(!1,!0)}}toJSON(e){let n=e===void 0||typeof e=="string",i={};n&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),this.static!==!1&&(r.static=this.static),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(a=>({...a})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(a,c){return a[c.uuid]===void 0&&(a[c.uuid]=c.toJSON(e)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let c=a.shapes;if(Array.isArray(c))for(let h=0,l=c.length;h<l;h++){let d=c[h];s(e.shapes,d)}else s(e.shapes,c)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let c=0,h=this.material.length;c<h;c++)a.push(s(e.materials,this.material[c]));r.material=a}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){let c=this.animations[a];r.animations.push(s(e.animations,c))}}if(n){let a=o(e.geometries),c=o(e.materials),h=o(e.textures),l=o(e.images),d=o(e.shapes),u=o(e.skeletons),f=o(e.animations),p=o(e.nodes);a.length>0&&(i.geometries=a),c.length>0&&(i.materials=c),h.length>0&&(i.textures=h),l.length>0&&(i.images=l),d.length>0&&(i.shapes=d),u.length>0&&(i.skeletons=u),f.length>0&&(i.animations=f),p.length>0&&(i.nodes=p)}return i.object=r,i;function o(a){let c=[];for(let h in a){let l=a[h];delete l.metadata,c.push(l)}return c}}clone(e){return new this.constructor().copy(this,e)}copy(e,n=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),e.pivot!==null&&(this.pivot=e.pivot.clone()),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),n===!0)for(let i=0;i<e.children.length;i++){let r=e.children[i];this.add(r.clone())}return this}};Yn.DEFAULT_UP=new pe(0,1,0);Yn.DEFAULT_MATRIX_AUTO_UPDATE=!0;Yn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var kl={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},rn={h:0,s:0,l:0},Ji={h:0,s:0,l:0};function ds(t,e,n){return n<0&&(n+=1),n>1&&(n-=1),n<1/6?t+(e-t)*6*n:n<1/2?e:n<2/3?t+(e-t)*6*(2/3-n):t}var Pe=class{constructor(e,n,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,n,i)}set(e,n,i){if(n===void 0&&i===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,n,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,n=dt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,ft.colorSpaceToWorking(this,n),this}setRGB(e,n,i,r=ft.workingColorSpace){return this.r=e,this.g=n,this.b=i,ft.colorSpaceToWorking(this,r),this}setHSL(e,n,i,r=ft.workingColorSpace){if(e=Ud(e,1),n=oe(n,0,1),i=oe(i,0,1),n===0)this.r=this.g=this.b=i;else{let s=i<=.5?i*(1+n):i+n-i*n,o=2*i-s;this.r=ds(o,s,e+1/3),this.g=ds(o,s,e),this.b=ds(o,s,e-1/3)}return ft.colorSpaceToWorking(this,r),this}setStyle(e,n=dt){function i(s){s!==void 0&&parseFloat(s)<1&&ke("Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,o=r[1],a=r[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,n);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,n);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,n);break;default:ke("Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=r[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,n);if(o===6)return this.setHex(parseInt(s,16),n);ke("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,n);return this}setColorName(e,n=dt){let i=kl[e.toLowerCase()];return i!==void 0?this.setHex(i,n):ke("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Gt(e.r),this.g=Gt(e.g),this.b=Gt(e.b),this}copyLinearToSRGB(e){return this.r=qn(e.r),this.g=qn(e.g),this.b=qn(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=dt){return ft.workingToColorSpace(Ge.copy(this),e),Math.round(oe(Ge.r*255,0,255))*65536+Math.round(oe(Ge.g*255,0,255))*256+Math.round(oe(Ge.b*255,0,255))}getHexString(e=dt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,n=ft.workingColorSpace){ft.workingToColorSpace(Ge.copy(this),n);let i=Ge.r,r=Ge.g,s=Ge.b,o=Math.max(i,r,s),a=Math.min(i,r,s),c,h,l=(a+o)/2;if(a===o)c=0,h=0;else{let d=o-a;switch(h=l<=.5?d/(o+a):d/(2-o-a),o){case i:c=(r-s)/d+(r<s?6:0);break;case r:c=(s-i)/d+2;break;case s:c=(i-r)/d+4;break}c/=6}return e.h=c,e.s=h,e.l=l,e}getRGB(e,n=ft.workingColorSpace){return ft.workingToColorSpace(Ge.copy(this),n),e.r=Ge.r,e.g=Ge.g,e.b=Ge.b,e}getStyle(e=dt){ft.workingToColorSpace(Ge.copy(this),e);let n=Ge.r,i=Ge.g,r=Ge.b;return e!==dt?`color(${e} ${n.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(n*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,n,i){return this.getHSL(rn),this.setHSL(rn.h+e,rn.s+n,rn.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,n){return this.r=e.r+n.r,this.g=e.g+n.g,this.b=e.b+n.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,n){return this.r+=(e.r-this.r)*n,this.g+=(e.g-this.g)*n,this.b+=(e.b-this.b)*n,this}lerpColors(e,n,i){return this.r=e.r+(n.r-e.r)*i,this.g=e.g+(n.g-e.g)*i,this.b=e.b+(n.b-e.b)*i,this}lerpHSL(e,n){this.getHSL(rn),e.getHSL(Ji);let i=as(rn.h,Ji.h,n),r=as(rn.s,Ji.s,n),s=as(rn.l,Ji.l,n);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let n=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*n+s[3]*i+s[6]*r,this.g=s[1]*n+s[4]*i+s[7]*r,this.b=s[2]*n+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,n=0){return this.r=e[n],this.g=e[n+1],this.b=e[n+2],this}toArray(e=[],n=0){return e[n]=this.r,e[n+1]=this.g,e[n+2]=this.b,e}fromBufferAttribute(e,n){return this.r=e.getX(n),this.g=e.getY(n),this.b=e.getZ(n),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Ge=new Pe;Pe.NAMES=kl;function zl(t){let e={};for(let n in t){e[n]={};for(let i in t[n]){let r=t[n][i];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(ke("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[n][i]=null):e[n][i]=r.clone():Array.isArray(r)?e[n][i]=r.slice():e[n][i]=r}}return e}function Ye(t){let e={};for(let n=0;n<t.length;n++){let i=zl(t[n]);for(let r in i)e[r]=i[r]}return e}function Qi(t,e){return!t||t.constructor===e?t:typeof e.BYTES_PER_ELEMENT=="number"?new e(t):Array.prototype.slice.call(t)}var sn=class{constructor(e,n,i,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new n.constructor(i),this.sampleValues=n,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){let n=this.parameterPositions,i=this._cachedIndex,r=n[i],s=n[i-1];n:{e:{let o;t:{i:if(!(e<r)){for(let a=i+2;;){if(r===void 0){if(e<s)break i;return i=n.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===a)break;if(s=r,r=n[++i],e<r)break e}o=n.length;break t}if(!(e>=s)){let a=n[1];e<a&&(i=2,s=a);for(let c=i-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===c)break;if(r=s,s=n[--i-1],e>=s)break e}o=i,i=0;break t}break n}for(;i<o;){let a=i+o>>>1;e<n[a]?o=a:i=a+1}if(r=n[i],s=n[i-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return i=n.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,s,r)}return this.interpolate_(i,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let n=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r;for(let o=0;o!==r;++o)n[o]=i[s+o];return n}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}},ar=class extends sn{constructor(e,n,i,r){super(e,n,i,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:As,endingEnd:As}}intervalChanged_(e,n,i){let r=this.parameterPositions,s=e-2,o=e+1,a=r[s],c=r[o];if(a===void 0)switch(this.getSettings_().endingStart){case Es:s=e,a=2*n-i;break;case ws:s=r.length-2,a=n+r[s]-r[s+1];break;default:s=e,a=i}if(c===void 0)switch(this.getSettings_().endingEnd){case Es:o=e,c=2*i-n;break;case ws:o=1,c=i+r[1]-r[0];break;default:o=e-1,c=n}let h=(i-n)*.5,l=this.valueSize;this._weightPrev=h/(n-a),this._weightNext=h/(c-i),this._offsetPrev=s*l,this._offsetNext=o*l}interpolate_(e,n,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,h=c-a,l=this._offsetPrev,d=this._offsetNext,u=this._weightPrev,f=this._weightNext,p=(i-n)/(r-n),m=p*p,x=m*p,g=-u*x+2*u*m-u*p,y=(1+u)*x+(-1.5-2*u)*m+(-.5+u)*p+1,v=(-1-f)*x+(1.5+f)*m+.5*p,_=f*x-f*m;for(let M=0;M!==a;++M)s[M]=g*o[l+M]+y*o[h+M]+v*o[c+M]+_*o[d+M];return s}},lr=class extends sn{constructor(e,n,i,r){super(e,n,i,r)}interpolate_(e,n,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,h=c-a,l=(i-n)/(r-n),d=1-l;for(let u=0;u!==a;++u)s[u]=o[h+u]*d+o[c+u]*l;return s}},cr=class extends sn{constructor(e,n,i,r){super(e,n,i,r)}interpolate_(e){return this.copySampleValue_(e-1)}},hr=class extends sn{interpolate_(e,n,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,h=c-a,l=this.settings||this.DefaultSettings_,d=l.inTangents,u=l.outTangents;if(!d||!u){let m=(i-n)/(r-n),x=1-m;for(let g=0;g!==a;++g)s[g]=o[h+g]*x+o[c+g]*m;return s}let f=a*2,p=e-1;for(let m=0;m!==a;++m){let x=o[h+m],g=o[c+m],y=p*f+m*2,v=u[y],_=u[y+1],M=e*f+m*2,b=d[M],T=d[M+1],A=(i-n)/(r-n),S,D,R,L,P;for(let U=0;U<8;U++){S=A*A,D=S*A,R=1-A,L=R*R,P=L*R;let C=P*n+3*L*A*v+3*R*S*b+D*r-i;if(Math.abs(C)<1e-10)break;let G=3*L*(v-n)+6*R*A*(b-v)+3*S*(r-b);if(Math.abs(G)<1e-10)break;A=A-C/G,A=Math.max(0,Math.min(1,A))}s[m]=P*x+3*L*A*_+3*R*S*T+D*g}return s}},lt=class{constructor(e,n,i,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(n===void 0||n.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Qi(n,this.TimeBufferType),this.values=Qi(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let n=e.constructor,i;if(n.toJSON!==this.toJSON)i=n.toJSON(e);else{i={name:e.name,times:Qi(e.times,Array),values:Qi(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(i.interpolation=r)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new cr(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new lr(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new ar(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let n=new hr(this.times,this.values,this.getValueSize(),e);return this.settings&&(n.settings=this.settings),n}setInterpolation(e){let n;switch(e){case mi:n=this.InterpolantFactoryMethodDiscrete;break;case nr:n=this.InterpolantFactoryMethodLinear;break;case er:n=this.InterpolantFactoryMethodSmooth;break;case Ts:n=this.InterpolantFactoryMethodBezier;break}if(n===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return ke("KeyframeTrack:",i),this}return this.createInterpolant=n,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return mi;case this.InterpolantFactoryMethodLinear:return nr;case this.InterpolantFactoryMethodSmooth:return er;case this.InterpolantFactoryMethodBezier:return Ts}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let n=this.times;for(let i=0,r=n.length;i!==r;++i)n[i]+=e}return this}scale(e){if(e!==1){let n=this.times;for(let i=0,r=n.length;i!==r;++i)n[i]*=e}return this}trim(e,n){let i=this.times,r=i.length,s=0,o=r-1;for(;s!==r&&i[s]<e;)++s;for(;o!==-1&&i[o]>n;)--o;if(++o,s!==0||o!==r){s>=o&&(o=Math.max(o,1),s=o-1);let a=this.getValueSize();this.times=i.slice(s,o),this.values=this.values.slice(s*a,o*a)}return this}validate(){let e=!0,n=this.getValueSize();n-Math.floor(n)!==0&&(we("KeyframeTrack: Invalid value size in track.",this),e=!1);let i=this.times,r=this.values,s=i.length;s===0&&(we("KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==s;a++){let c=i[a];if(typeof c=="number"&&isNaN(c)){we("KeyframeTrack: Time is not a valid number.",this,a,c),e=!1;break}if(o!==null&&o>c){we("KeyframeTrack: Out of order keys.",this,a,c,o),e=!1;break}o=c}if(r!==void 0&&Ld(r))for(let a=0,c=r.length;a!==c;++a){let h=r[a];if(isNaN(h)){we("KeyframeTrack: Value is not a valid number.",this,a,h),e=!1;break}}return e}optimize(){let e=this.times.slice(),n=this.values.slice(),i=this.getValueSize(),r=this.getInterpolation()===er,s=e.length-1,o=1;for(let a=1;a<s;++a){let c=!1,h=e[a],l=e[a+1];if(h!==l&&(a!==1||h!==e[0]))if(r)c=!0;else{let d=a*i,u=d-i,f=d+i;for(let p=0;p!==i;++p){let m=n[d+p];if(m!==n[u+p]||m!==n[f+p]){c=!0;break}}}if(c){if(a!==o){e[o]=e[a];let d=a*i,u=o*i;for(let f=0;f!==i;++f)n[u+f]=n[d+f]}++o}}if(s>0){e[o]=e[s];for(let a=s*i,c=o*i,h=0;h!==i;++h)n[c+h]=n[a+h];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=n.slice(0,o*i)):(this.times=e,this.values=n),this}clone(){let e=this.times.slice(),n=this.values.slice(),i=this.constructor,r=new i(this.name,e,n);return r.createInterpolant=this.createInterpolant,r}};lt.prototype.ValueTypeName="";lt.prototype.TimeBufferType=Float32Array;lt.prototype.ValueBufferType=Float32Array;lt.prototype.DefaultInterpolation=nr;var on=class extends lt{constructor(e,n,i){super(e,n,i)}};on.prototype.ValueTypeName="bool";on.prototype.ValueBufferType=Array;on.prototype.DefaultInterpolation=mi;on.prototype.InterpolantFactoryMethodLinear=void 0;on.prototype.InterpolantFactoryMethodSmooth=void 0;var ur=class extends lt{constructor(e,n,i,r){super(e,n,i,r)}};ur.prototype.ValueTypeName="color";var fr=class extends lt{constructor(e,n,i,r){super(e,n,i,r)}};fr.prototype.ValueTypeName="number";var dr=class extends sn{constructor(e,n,i,r){super(e,n,i,r)}interpolate_(e,n,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=(i-n)/(r-n),h=e*a;for(let l=h+a;h!==l;h+=4)Qe.slerpFlat(s,0,o,h-a,o,h,c);return s}},xi=class extends lt{constructor(e,n,i,r){super(e,n,i,r)}InterpolantFactoryMethodLinear(e){return new dr(this.times,this.values,this.getValueSize(),e)}};xi.prototype.ValueTypeName="quaternion";xi.prototype.InterpolantFactoryMethodSmooth=void 0;var an=class extends lt{constructor(e,n,i){super(e,n,i)}};an.prototype.ValueTypeName="string";an.prototype.ValueBufferType=Array;an.prototype.DefaultInterpolation=mi;an.prototype.InterpolantFactoryMethodLinear=void 0;an.prototype.InterpolantFactoryMethodSmooth=void 0;var pr=class extends lt{constructor(e,n,i,r){super(e,n,i,r)}};pr.prototype.ValueTypeName="vector";var mr=class{constructor(e,n,i){let r=this,s=!1,o=0,a=0,c,h=[];this.onStart=void 0,this.onLoad=e,this.onProgress=n,this.onError=i,this._abortController=null,this.itemStart=function(l){a++,s===!1&&r.onStart!==void 0&&r.onStart(l,o,a),s=!0},this.itemEnd=function(l){o++,r.onProgress!==void 0&&r.onProgress(l,o,a),o===a&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(l){r.onError!==void 0&&r.onError(l)},this.resolveURL=function(l){return c?c(l):l},this.setURLModifier=function(l){return c=l,this},this.addHandler=function(l,d){return h.push(l,d),this},this.removeHandler=function(l){let d=h.indexOf(l);return d!==-1&&h.splice(d,2),this},this.getHandler=function(l){for(let d=0,u=h.length;d<u;d+=2){let f=h[d],p=h[d+1];if(f.global&&(f.lastIndex=0),f.test(l))return p}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Hl=new mr,gr=class{constructor(e){this.manager=e!==void 0?e:Hl,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,n){let i=this;return new Promise(function(r,s){i.load(e,r,n,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};gr.DEFAULT_MATERIAL_NAME="__DEFAULT";var Xs="\\[\\]\\.:\\/",Xd=new RegExp("["+Xs+"]","g"),qs="[^"+Xs+"]",qd="[^"+Xs.replace("\\.","")+"]",$d=/((?:WC+[\/:])*)/.source.replace("WC",qs),Yd=/(WCOD+)?/.source.replace("WCOD",qd),Kd=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",qs),jd=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",qs),Zd=new RegExp("^"+$d+Yd+Kd+jd+"$"),Jd=["material","materials","bones","map"],Fs=class{constructor(e,n,i){let r=i||ue.parseTrackName(n);this._targetGroup=e,this._bindings=e.subscribe_(n,r)}getValue(e,n){this.bind();let i=this._targetGroup.nCachedObjects_,r=this._bindings[i];r!==void 0&&r.getValue(e,n)}setValue(e,n){let i=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=i.length;r!==s;++r)i[r].setValue(e,n)}bind(){let e=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=e.length;n!==i;++n)e[n].bind()}unbind(){let e=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=e.length;n!==i;++n)e[n].unbind()}},ue=class t{constructor(e,n,i){this.path=n,this.parsedPath=i||t.parseTrackName(n),this.node=t.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,n,i){return e&&e.isAnimationObjectGroup?new t.Composite(e,n,i):new t(e,n,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Xd,"")}static parseTrackName(e){let n=Zd.exec(e);if(n===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);let i={nodeName:n[2],objectName:n[3],objectIndex:n[4],propertyName:n[5],propertyIndex:n[6]},r=i.nodeName&&i.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let s=i.nodeName.substring(r+1);Jd.indexOf(s)!==-1&&(i.nodeName=i.nodeName.substring(0,r),i.objectName=s)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,n){if(n===void 0||n===""||n==="."||n===-1||n===e.name||n===e.uuid)return e;if(e.skeleton){let i=e.skeleton.getBoneByName(n);if(i!==void 0)return i}if(e.children){let i=function(s){for(let o=0;o<s.length;o++){let a=s[o];if(a.name===n||a.uuid===n)return a;let c=i(a.children);if(c)return c}return null},r=i(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,n){e[n]=this.targetObject[this.propertyName]}_getValue_array(e,n){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)e[n++]=i[r]}_getValue_arrayElement(e,n){e[n]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,n){this.resolvedProperty.toArray(e,n)}_setValue_direct(e,n){this.targetObject[this.propertyName]=e[n]}_setValue_direct_setNeedsUpdate(e,n){this.targetObject[this.propertyName]=e[n],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,n){this.targetObject[this.propertyName]=e[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,n){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[n++]}_setValue_array_setNeedsUpdate(e,n){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[n++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,n){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[n++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,n){this.resolvedProperty[this.propertyIndex]=e[n]}_setValue_arrayElement_setNeedsUpdate(e,n){this.resolvedProperty[this.propertyIndex]=e[n],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,n){this.resolvedProperty[this.propertyIndex]=e[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,n){this.resolvedProperty.fromArray(e,n)}_setValue_fromArray_setNeedsUpdate(e,n){this.resolvedProperty.fromArray(e,n),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,n){this.resolvedProperty.fromArray(e,n),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,n){this.bind(),this.getValue(e,n)}_setValue_unbound(e,n){this.bind(),this.setValue(e,n)}bind(){let e=this.node,n=this.parsedPath,i=n.objectName,r=n.propertyName,s=n.propertyIndex;if(e||(e=t.findNode(this.rootNode,n.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){ke("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let h=n.objectIndex;switch(i){case"materials":if(!e.material){we("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){we("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){we("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let l=0;l<e.length;l++)if(e[l].name===h){h=l;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){we("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){we("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){we("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(h!==void 0){if(e[h]===void 0){we("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[h]}}let o=e[r];if(o===void 0){let h=n.nodeName;we("PropertyBinding: Trying to update property for track: "+h+"."+r+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?a=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){we("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){we("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=s}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=r;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};ue.Composite=Fs;ue.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};ue.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};ue.prototype.GetterByBindingType=[ue.prototype._getValue_direct,ue.prototype._getValue_array,ue.prototype._getValue_arrayElement,ue.prototype._getValue_toArray];ue.prototype.SetterByBindingTypeAndVersioning=[[ue.prototype._setValue_direct,ue.prototype._setValue_direct_setNeedsUpdate,ue.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[ue.prototype._setValue_array,ue.prototype._setValue_array_setNeedsUpdate,ue.prototype._setValue_array_setMatrixWorldNeedsUpdate],[ue.prototype._setValue_arrayElement,ue.prototype._setValue_arrayElement_setNeedsUpdate,ue.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[ue.prototype._setValue_fromArray,ue.prototype._setValue_fromArray_setNeedsUpdate,ue.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Qv=new Float32Array(1);typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"183"}}));typeof window<"u"&&(window.__THREE__?ke("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="183");var Qd=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,ep=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,tp=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,np=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,ip=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,rp=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,sp=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,op=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,ap=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,lp=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,cp=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,hp=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,up=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,fp=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,dp=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,pp=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,mp=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,gp=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,vp=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,xp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,yp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,_p=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,bp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Sp=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Mp=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Tp=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,Ap=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Ep=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,wp=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Pp=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Cp="gl_FragColor = linearToOutputTexel( gl_FragColor );",Ip=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Rp=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Lp=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Fp=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Dp=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Up=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Np=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Bp=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Op=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Vp=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Gp=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,kp=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,zp=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Hp=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Wp=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Xp=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,qp=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,$p=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Yp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Kp=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,jp=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Zp=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return v;
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Jp=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Qp=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,em=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,tm=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,nm=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,im=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,rm=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,sm=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,om=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,am=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,lm=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,cm=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,hm=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,um=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,fm=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,dm=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,pm=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,mm=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,gm=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,vm=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,xm=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,ym=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,_m=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,bm=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Sm=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Mm=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Tm=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Am=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Em=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,wm=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Pm=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Cm=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Im=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Rm=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Lm=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Fm=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Dm=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,Um=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Nm=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Bm=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Om=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Vm=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Gm=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,km=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,zm=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Hm=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Wm=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Xm=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,qm=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,$m=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Ym=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Km=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,jm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Zm=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,Jm=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Qm=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,eg=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,tg=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ng=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,ig=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,rg=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,sg=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,og=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,ag=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,lg=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,cg=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,hg=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,ug=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,fg=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,dg=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,pg=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,mg=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,gg=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,vg=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,xg=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,yg=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,_g=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,bg=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Sg=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Mg=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Tg=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ag=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Eg=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,wg=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Pg=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Cg=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Ig=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Rg=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Z={alphahash_fragment:Qd,alphahash_pars_fragment:ep,alphamap_fragment:tp,alphamap_pars_fragment:np,alphatest_fragment:ip,alphatest_pars_fragment:rp,aomap_fragment:sp,aomap_pars_fragment:op,batching_pars_vertex:ap,batching_vertex:lp,begin_vertex:cp,beginnormal_vertex:hp,bsdfs:up,iridescence_fragment:fp,bumpmap_pars_fragment:dp,clipping_planes_fragment:pp,clipping_planes_pars_fragment:mp,clipping_planes_pars_vertex:gp,clipping_planes_vertex:vp,color_fragment:xp,color_pars_fragment:yp,color_pars_vertex:_p,color_vertex:bp,common:Sp,cube_uv_reflection_fragment:Mp,defaultnormal_vertex:Tp,displacementmap_pars_vertex:Ap,displacementmap_vertex:Ep,emissivemap_fragment:wp,emissivemap_pars_fragment:Pp,colorspace_fragment:Cp,colorspace_pars_fragment:Ip,envmap_fragment:Rp,envmap_common_pars_fragment:Lp,envmap_pars_fragment:Fp,envmap_pars_vertex:Dp,envmap_physical_pars_fragment:Xp,envmap_vertex:Up,fog_vertex:Np,fog_pars_vertex:Bp,fog_fragment:Op,fog_pars_fragment:Vp,gradientmap_pars_fragment:Gp,lightmap_pars_fragment:kp,lights_lambert_fragment:zp,lights_lambert_pars_fragment:Hp,lights_pars_begin:Wp,lights_toon_fragment:qp,lights_toon_pars_fragment:$p,lights_phong_fragment:Yp,lights_phong_pars_fragment:Kp,lights_physical_fragment:jp,lights_physical_pars_fragment:Zp,lights_fragment_begin:Jp,lights_fragment_maps:Qp,lights_fragment_end:em,logdepthbuf_fragment:tm,logdepthbuf_pars_fragment:nm,logdepthbuf_pars_vertex:im,logdepthbuf_vertex:rm,map_fragment:sm,map_pars_fragment:om,map_particle_fragment:am,map_particle_pars_fragment:lm,metalnessmap_fragment:cm,metalnessmap_pars_fragment:hm,morphinstance_vertex:um,morphcolor_vertex:fm,morphnormal_vertex:dm,morphtarget_pars_vertex:pm,morphtarget_vertex:mm,normal_fragment_begin:gm,normal_fragment_maps:vm,normal_pars_fragment:xm,normal_pars_vertex:ym,normal_vertex:_m,normalmap_pars_fragment:bm,clearcoat_normal_fragment_begin:Sm,clearcoat_normal_fragment_maps:Mm,clearcoat_pars_fragment:Tm,iridescence_pars_fragment:Am,opaque_fragment:Em,packing:wm,premultiplied_alpha_fragment:Pm,project_vertex:Cm,dithering_fragment:Im,dithering_pars_fragment:Rm,roughnessmap_fragment:Lm,roughnessmap_pars_fragment:Fm,shadowmap_pars_fragment:Dm,shadowmap_pars_vertex:Um,shadowmap_vertex:Nm,shadowmask_pars_fragment:Bm,skinbase_vertex:Om,skinning_pars_vertex:Vm,skinning_vertex:Gm,skinnormal_vertex:km,specularmap_fragment:zm,specularmap_pars_fragment:Hm,tonemapping_fragment:Wm,tonemapping_pars_fragment:Xm,transmission_fragment:qm,transmission_pars_fragment:$m,uv_pars_fragment:Ym,uv_pars_vertex:Km,uv_vertex:jm,worldpos_vertex:Zm,background_vert:Jm,background_frag:Qm,backgroundCube_vert:eg,backgroundCube_frag:tg,cube_vert:ng,cube_frag:ig,depth_vert:rg,depth_frag:sg,distance_vert:og,distance_frag:ag,equirect_vert:lg,equirect_frag:cg,linedashed_vert:hg,linedashed_frag:ug,meshbasic_vert:fg,meshbasic_frag:dg,meshlambert_vert:pg,meshlambert_frag:mg,meshmatcap_vert:gg,meshmatcap_frag:vg,meshnormal_vert:xg,meshnormal_frag:yg,meshphong_vert:_g,meshphong_frag:bg,meshphysical_vert:Sg,meshphysical_frag:Mg,meshtoon_vert:Tg,meshtoon_frag:Ag,points_vert:Eg,points_frag:wg,shadow_vert:Pg,shadow_frag:Cg,sprite_vert:Ig,sprite_frag:Rg},F={common:{diffuse:{value:new Pe(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Y},alphaMap:{value:null},alphaMapTransform:{value:new Y},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Y}},envmap:{envMap:{value:null},envMapRotation:{value:new Y},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Y}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Y}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Y},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Y},normalScale:{value:new bt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Y},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Y}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Y}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Y}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Pe(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Pe(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Y},alphaTest:{value:0},uvTransform:{value:new Y}},sprite:{diffuse:{value:new Pe(16777215)},opacity:{value:1},center:{value:new bt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Y},alphaMap:{value:null},alphaMapTransform:{value:new Y},alphaTest:{value:0}}},Wl={basic:{uniforms:Ye([F.common,F.specularmap,F.envmap,F.aomap,F.lightmap,F.fog]),vertexShader:Z.meshbasic_vert,fragmentShader:Z.meshbasic_frag},lambert:{uniforms:Ye([F.common,F.specularmap,F.envmap,F.aomap,F.lightmap,F.emissivemap,F.bumpmap,F.normalmap,F.displacementmap,F.fog,F.lights,{emissive:{value:new Pe(0)},envMapIntensity:{value:1}}]),vertexShader:Z.meshlambert_vert,fragmentShader:Z.meshlambert_frag},phong:{uniforms:Ye([F.common,F.specularmap,F.envmap,F.aomap,F.lightmap,F.emissivemap,F.bumpmap,F.normalmap,F.displacementmap,F.fog,F.lights,{emissive:{value:new Pe(0)},specular:{value:new Pe(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Z.meshphong_vert,fragmentShader:Z.meshphong_frag},standard:{uniforms:Ye([F.common,F.envmap,F.aomap,F.lightmap,F.emissivemap,F.bumpmap,F.normalmap,F.displacementmap,F.roughnessmap,F.metalnessmap,F.fog,F.lights,{emissive:{value:new Pe(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Z.meshphysical_vert,fragmentShader:Z.meshphysical_frag},toon:{uniforms:Ye([F.common,F.aomap,F.lightmap,F.emissivemap,F.bumpmap,F.normalmap,F.displacementmap,F.gradientmap,F.fog,F.lights,{emissive:{value:new Pe(0)}}]),vertexShader:Z.meshtoon_vert,fragmentShader:Z.meshtoon_frag},matcap:{uniforms:Ye([F.common,F.bumpmap,F.normalmap,F.displacementmap,F.fog,{matcap:{value:null}}]),vertexShader:Z.meshmatcap_vert,fragmentShader:Z.meshmatcap_frag},points:{uniforms:Ye([F.points,F.fog]),vertexShader:Z.points_vert,fragmentShader:Z.points_frag},dashed:{uniforms:Ye([F.common,F.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Z.linedashed_vert,fragmentShader:Z.linedashed_frag},depth:{uniforms:Ye([F.common,F.displacementmap]),vertexShader:Z.depth_vert,fragmentShader:Z.depth_frag},normal:{uniforms:Ye([F.common,F.bumpmap,F.normalmap,F.displacementmap,{opacity:{value:1}}]),vertexShader:Z.meshnormal_vert,fragmentShader:Z.meshnormal_frag},sprite:{uniforms:Ye([F.sprite,F.fog]),vertexShader:Z.sprite_vert,fragmentShader:Z.sprite_frag},background:{uniforms:{uvTransform:{value:new Y},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Z.background_vert,fragmentShader:Z.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Y}},vertexShader:Z.backgroundCube_vert,fragmentShader:Z.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Z.cube_vert,fragmentShader:Z.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Z.equirect_vert,fragmentShader:Z.equirect_frag},distance:{uniforms:Ye([F.common,F.displacementmap,{referencePosition:{value:new pe},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Z.distance_vert,fragmentShader:Z.distance_frag},shadow:{uniforms:Ye([F.lights,F.fog,{color:{value:new Pe(0)},opacity:{value:1}}]),vertexShader:Z.shadow_vert,fragmentShader:Z.shadow_frag}};Wl.physical={uniforms:Ye([Wl.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Y},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Y},clearcoatNormalScale:{value:new bt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Y},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Y},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Y},sheen:{value:0},sheenColor:{value:new Pe(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Y},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Y},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Y},transmissionSamplerSize:{value:new bt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Y},attenuationDistance:{value:0},attenuationColor:{value:new Pe(0)},specularColor:{value:new Pe(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Y},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Y},anisotropyVector:{value:new bt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Y}}]),vertexShader:Z.meshphysical_vert,fragmentShader:Z.meshphysical_frag};var U1={[Ds]:"LINEAR_TONE_MAPPING",[Us]:"REINHARD_TONE_MAPPING",[Ns]:"CINEON_TONE_MAPPING",[Bs]:"ACES_FILMIC_TONE_MAPPING",[Vs]:"AGX_TONE_MAPPING",[Gs]:"NEUTRAL_TONE_MAPPING",[Os]:"CUSTOM_TONE_MAPPING"};var N1=new Float32Array(16),B1=new Float32Array(9),O1=new Float32Array(4);var V1={[Ds]:"Linear",[Us]:"Reinhard",[Ns]:"Cineon",[Bs]:"ACESFilmic",[Vs]:"AgX",[Gs]:"Neutral",[Os]:"Custom"};var G1={[Cl]:"SHADOWMAP_TYPE_PCF",[Il]:"SHADOWMAP_TYPE_VSM"};var k1={[Dl]:"ENVMAP_TYPE_CUBE",[zs]:"ENVMAP_TYPE_CUBE",[Ul]:"ENVMAP_TYPE_CUBE_UV"};var z1={[zs]:"ENVMAP_MODE_REFRACTION"};var H1={[Rl]:"ENVMAP_BLENDING_MULTIPLY",[Ll]:"ENVMAP_BLENDING_MIX",[Fl]:"ENVMAP_BLENDING_ADD"};var W1=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);function $s(t,e,n={}){let{interval:i,globalSequences:r=[],globalTime:s=e,fallback:o=0,quaternion:a=!1}=n;if(t==null)return o;if(typeof t=="number"||Array.isArray(t)||ArrayBuffer.isView(t))return t;let c=i?.[0]??-1/0,h=i?.[1]??1/0,l=t.GlobalSeqId;Number.isInteger(l)&&l>=0&&r[l]>0&&(h=r[l],c=0,e=(s%h+h)%h);let d=t.Keys||[],u=0,f=d.length-1;for(;u<=f&&d[u].Frame<c;)u++;for(;f>=u&&d[f].Frame>h;)f--;if(u>f)return o;let p=d[u],m=p;if(e>=d[f].Frame)p=m=d[f];else if(e>p.Frame){let M=u,b=f;for(;M+1<b;){let T=M+b>>1;d[T].Frame<=e?M=T:b=T}p=d[M],m=d[b]}let x=p.Vector,g=m.Vector,y=typeof o=="number";if(p===m||t.LineType===0)return y?x[0]:Array.from(x);let v=Math.max(0,Math.min(1,(e-p.Frame)/(m.Frame-p.Frame)));if(a){let M=new Qe().fromArray(x).normalize(),b=new Qe().fromArray(g).normalize();if((t.LineType===2||t.LineType===3)&&p.OutTan&&m.InTan){let T=M.clone().slerp(b,v),A=new Qe().fromArray(p.OutTan).normalize().slerp(new Qe().fromArray(m.InTan).normalize(),v);return T.slerp(A,2*v*(1-v)).normalize().toArray()}return M.slerp(b,v).normalize().toArray()}let _=Array.from(x,(M,b)=>{if((t.LineType===2||t.LineType===3)&&p.OutTan&&m.InTan){let T=p.OutTan[b],A=m.InTan[b];return t.LineType===3?(1-v)**3*M+3*v*(1-v)**2*T+3*v*v*(1-v)*A+v**3*g[b]:(2*v**3-3*v*v+1)*M+(v**3-2*v*v+v)*T+(v**3-v*v)*A+(-2*v**3+3*v*v)*g[b]}return M+(g[b]-M)*v});return y?_[0]:_}function Lg(t){let e={sequence:0,time:t.Sequences?.[0]?.Interval?.[0]||0,score:-1};for(let[n,i]of(t.Sequences||[]).entries()){let[r,s]=i.Interval;if(!(s>r))continue;let o=new Set(Array.from({length:8},(a,c)=>r+(s-r)*(c+1)/9));for(let a of t.ParticleEmitters2||[])if(a.Squirt)for(let c of a.EmissionRate?.Keys||[])c.Vector[0]>0&&c.Frame>=r&&c.Frame<s&&o.add(Math.min(s,c.Frame+Math.min(120,a.LifeSpan*500)));for(let a of o){let c=0;for(let h of t.ParticleEmitters2||[]){let l=(d,u=a)=>{let f=$s(h[d],u,{interval:i.Interval,globalSequences:t.GlobalSequences,globalTime:u,fallback:d==="Visibility"?1:0});return Number(f?.[0]??f)};if(h.Squirt&&h.EmissionRate?.Keys){let d=t.GlobalSequences[h.EmissionRate.GlobalSeqId],u=d>0?a%d:a;for(let f of h.EmissionRate.Keys)u>=f.Frame&&u-f.Frame<h.LifeSpan*1e3&&l("Visibility",f.Frame)>0&&(c+=Math.max(0,f.Vector[0]))}else c+=Math.max(0,l("EmissionRate"))*Math.max(0,Math.min(h.LifeSpan,(a-r)/1e3))*(l("Visibility")>0?1:0)}for(let h of t.RibbonEmitters||[]){let l=$s(h.Visibility,a,{interval:i.Interval,globalSequences:t.GlobalSequences,globalTime:a,fallback:0});Number(l?.[0]??l)>0&&(c+=Math.max(0,h.EmissionRate*Math.min(h.LifeSpan,(a-r)/1e3)))}c>e.score&&(e={sequence:n,time:a,score:c})}}return e}export{Lg as activeParticleSample,Ki as effectNodes,Id as extractParticleRecipe,en as openDocument,Rd as validateParticleRecipe};
/*! Bundled license information:

three/examples/jsm/libs/fflate.module.js:
  (*!
  fflate - fast JavaScript compression/decompression
  <https://101arrowz.github.io/fflate>
  Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
  version 0.8.2
  *)

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
