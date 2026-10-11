(function(){"use strict";function Tn(e){const t=e[0];if(typeof t=="string"&&t.startsWith("TSL:")){const r=e[1];r&&r.isStackTrace?e[0]+=" "+r.getLocation():e[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return e}function Zt(...e){e=Tn(e);const t="THREE."+e.shift();{const r=e[0];r&&r.isStackTrace?console.warn(r.getError(t)):console.warn(t,...e)}}function ue(e,t,r){return Math.max(t,Math.min(r,e))}class W{constructor(t=0,r=0,n=0,i=1){this.isQuaternion=!0,this._x=t,this._y=r,this._z=n,this._w=i}static slerpFlat(t,r,n,i,s,o,l){let h=n[i+0],a=n[i+1],c=n[i+2],d=n[i+3],p=s[o+0],f=s[o+1],u=s[o+2],g=s[o+3];if(d!==g||h!==p||a!==f||c!==u){let v=h*p+a*f+c*u+d*g;v<0&&(p=-p,f=-f,u=-u,g=-g,v=-v);let x=1-l;if(v<.9995){const y=Math.acos(v),b=Math.sin(y);x=Math.sin(x*y)/b,l=Math.sin(l*y)/b,h=h*x+p*l,a=a*x+f*l,c=c*x+u*l,d=d*x+g*l}else{h=h*x+p*l,a=a*x+f*l,c=c*x+u*l,d=d*x+g*l;const y=1/Math.sqrt(h*h+a*a+c*c+d*d);h*=y,a*=y,c*=y,d*=y}}t[r]=h,t[r+1]=a,t[r+2]=c,t[r+3]=d}static multiplyQuaternionsFlat(t,r,n,i,s,o){const l=n[i],h=n[i+1],a=n[i+2],c=n[i+3],d=s[o],p=s[o+1],f=s[o+2],u=s[o+3];return t[r]=l*u+c*d+h*f-a*p,t[r+1]=h*u+c*p+a*d-l*f,t[r+2]=a*u+c*f+l*p-h*d,t[r+3]=c*u-l*d-h*p-a*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,r,n,i){return this._x=t,this._y=r,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,r=!0){const n=t._x,i=t._y,s=t._z,o=t._order,l=Math.cos,h=Math.sin,a=l(n/2),c=l(i/2),d=l(s/2),p=h(n/2),f=h(i/2),u=h(s/2);switch(o){case"XYZ":this._x=p*c*d+a*f*u,this._y=a*f*d-p*c*u,this._z=a*c*u+p*f*d,this._w=a*c*d-p*f*u;break;case"YXZ":this._x=p*c*d+a*f*u,this._y=a*f*d-p*c*u,this._z=a*c*u-p*f*d,this._w=a*c*d+p*f*u;break;case"ZXY":this._x=p*c*d-a*f*u,this._y=a*f*d+p*c*u,this._z=a*c*u+p*f*d,this._w=a*c*d-p*f*u;break;case"ZYX":this._x=p*c*d-a*f*u,this._y=a*f*d+p*c*u,this._z=a*c*u-p*f*d,this._w=a*c*d+p*f*u;break;case"YZX":this._x=p*c*d+a*f*u,this._y=a*f*d+p*c*u,this._z=a*c*u-p*f*d,this._w=a*c*d-p*f*u;break;case"XZY":this._x=p*c*d-a*f*u,this._y=a*f*d-p*c*u,this._z=a*c*u+p*f*d,this._w=a*c*d+p*f*u;break;default:Zt("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return r===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,r){const n=r/2,i=Math.sin(n);return this._x=t.x*i,this._y=t.y*i,this._z=t.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const r=t.elements,n=r[0],i=r[4],s=r[8],o=r[1],l=r[5],h=r[9],a=r[2],c=r[6],d=r[10],p=n+l+d;if(p>0){const f=.5/Math.sqrt(p+1);this._w=.25/f,this._x=(c-h)*f,this._y=(s-a)*f,this._z=(o-i)*f}else if(n>l&&n>d){const f=2*Math.sqrt(1+n-l-d);this._w=(c-h)/f,this._x=.25*f,this._y=(i+o)/f,this._z=(s+a)/f}else if(l>d){const f=2*Math.sqrt(1+l-n-d);this._w=(s-a)/f,this._x=(i+o)/f,this._y=.25*f,this._z=(h+c)/f}else{const f=2*Math.sqrt(1+d-n-l);this._w=(o-i)/f,this._x=(s+a)/f,this._y=(h+c)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,r){let n=t.dot(r)+1;return n<1e-8?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*r.z-t.z*r.y,this._y=t.z*r.x-t.x*r.z,this._z=t.x*r.y-t.y*r.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(ue(this.dot(t),-1,1)))}rotateTowards(t,r){const n=this.angleTo(t);if(n===0)return this;const i=Math.min(1,r/n);return this.slerp(t,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,r){const n=t._x,i=t._y,s=t._z,o=t._w,l=r._x,h=r._y,a=r._z,c=r._w;return this._x=n*c+o*l+i*a-s*h,this._y=i*c+o*h+s*l-n*a,this._z=s*c+o*a+n*h-i*l,this._w=o*c-n*l-i*h-s*a,this._onChangeCallback(),this}slerp(t,r){let n=t._x,i=t._y,s=t._z,o=t._w,l=this.dot(t);l<0&&(n=-n,i=-i,s=-s,o=-o,l=-l);let h=1-r;if(l<.9995){const a=Math.acos(l),c=Math.sin(a);h=Math.sin(h*a)/c,r=Math.sin(r*a)/c,this._x=this._x*h+n*r,this._y=this._y*h+i*r,this._z=this._z*h+s*r,this._w=this._w*h+o*r,this._onChangeCallback()}else this._x=this._x*h+n*r,this._y=this._y*h+i*r,this._z=this._z*h+s*r,this._w=this._w*h+o*r,this.normalize();return this}slerpQuaternions(t,r,n){return this.copy(t).slerp(r,n)}random(){const t=2*Math.PI*Math.random(),r=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),s=Math.sqrt(n);return this.set(i*Math.sin(t),i*Math.cos(t),s*Math.sin(r),s*Math.cos(r))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,r=0){return this._x=t[r],this._y=t[r+1],this._z=t[r+2],this._w=t[r+3],this._onChangeCallback(),this}toArray(t=[],r=0){return t[r]=this._x,t[r+1]=this._y,t[r+2]=this._z,t[r+3]=this._w,t}fromBufferAttribute(t,r){return this._x=t.getX(r),this._y=t.getY(r),this._z=t.getZ(r),this._w=t.getW(r),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class V{constructor(t=0,r=0,n=0){V.prototype.isVector3=!0,this.x=t,this.y=r,this.z=n}set(t,r,n){return n===void 0&&(n=this.z),this.x=t,this.y=r,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,r){switch(t){case 0:this.x=r;break;case 1:this.y=r;break;case 2:this.z=r;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,r){return this.x=t.x+r.x,this.y=t.y+r.y,this.z=t.z+r.z,this}addScaledVector(t,r){return this.x+=t.x*r,this.y+=t.y*r,this.z+=t.z*r,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,r){return this.x=t.x-r.x,this.y=t.y-r.y,this.z=t.z-r.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,r){return this.x=t.x*r.x,this.y=t.y*r.y,this.z=t.z*r.z,this}applyEuler(t){return this.applyQuaternion(Fr.setFromEuler(t))}applyAxisAngle(t,r){return this.applyQuaternion(Fr.setFromAxisAngle(t,r))}applyMatrix3(t){const r=this.x,n=this.y,i=this.z,s=t.elements;return this.x=s[0]*r+s[3]*n+s[6]*i,this.y=s[1]*r+s[4]*n+s[7]*i,this.z=s[2]*r+s[5]*n+s[8]*i,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const r=this.x,n=this.y,i=this.z,s=t.elements,o=1/(s[3]*r+s[7]*n+s[11]*i+s[15]);return this.x=(s[0]*r+s[4]*n+s[8]*i+s[12])*o,this.y=(s[1]*r+s[5]*n+s[9]*i+s[13])*o,this.z=(s[2]*r+s[6]*n+s[10]*i+s[14])*o,this}applyQuaternion(t){const r=this.x,n=this.y,i=this.z,s=t.x,o=t.y,l=t.z,h=t.w,a=2*(o*i-l*n),c=2*(l*r-s*i),d=2*(s*n-o*r);return this.x=r+h*a+o*d-l*c,this.y=n+h*c+l*a-s*d,this.z=i+h*d+s*c-o*a,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const r=this.x,n=this.y,i=this.z,s=t.elements;return this.x=s[0]*r+s[4]*n+s[8]*i,this.y=s[1]*r+s[5]*n+s[9]*i,this.z=s[2]*r+s[6]*n+s[10]*i,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,r){return this.x=ue(this.x,t.x,r.x),this.y=ue(this.y,t.y,r.y),this.z=ue(this.z,t.z,r.z),this}clampScalar(t,r){return this.x=ue(this.x,t,r),this.y=ue(this.y,t,r),this.z=ue(this.z,t,r),this}clampLength(t,r){const n=this.length();return this.divideScalar(n||1).multiplyScalar(ue(n,t,r))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,r){return this.x+=(t.x-this.x)*r,this.y+=(t.y-this.y)*r,this.z+=(t.z-this.z)*r,this}lerpVectors(t,r,n){return this.x=t.x+(r.x-t.x)*n,this.y=t.y+(r.y-t.y)*n,this.z=t.z+(r.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,r){const n=t.x,i=t.y,s=t.z,o=r.x,l=r.y,h=r.z;return this.x=i*h-s*l,this.y=s*o-n*h,this.z=n*l-i*o,this}projectOnVector(t){const r=t.lengthSq();if(r===0)return this.set(0,0,0);const n=t.dot(this)/r;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Qt.copy(this).projectOnVector(t),this.sub(Qt)}reflect(t){return this.sub(Qt.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const r=Math.sqrt(this.lengthSq()*t.lengthSq());if(r===0)return Math.PI/2;const n=this.dot(t)/r;return Math.acos(ue(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const r=this.x-t.x,n=this.y-t.y,i=this.z-t.z;return r*r+n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,r,n){const i=Math.sin(r)*t;return this.x=i*Math.sin(n),this.y=Math.cos(r)*t,this.z=i*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,r,n){return this.x=t*Math.sin(r),this.y=n,this.z=t*Math.cos(r),this}setFromMatrixPosition(t){const r=t.elements;return this.x=r[12],this.y=r[13],this.z=r[14],this}setFromMatrixScale(t){const r=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),i=this.setFromMatrixColumn(t,2).length();return this.x=r,this.y=n,this.z=i,this}setFromMatrixColumn(t,r){return this.fromArray(t.elements,r*4)}setFromMatrix3Column(t,r){return this.fromArray(t.elements,r*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,r=0){return this.x=t[r],this.y=t[r+1],this.z=t[r+2],this}toArray(t=[],r=0){return t[r]=this.x,t[r+1]=this.y,t[r+2]=this.z,t}fromBufferAttribute(t,r){return this.x=t.getX(r),this.y=t.getY(r),this.z=t.getZ(r),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,r=Math.random()*2-1,n=Math.sqrt(1-r*r);return this.x=n*Math.cos(t),this.y=r,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Qt=new V,Fr=new W;class Re{constructor(t,r,n,i,s,o,l,h,a,c,d,p,f,u,g,v){Re.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,r,n,i,s,o,l,h,a,c,d,p,f,u,g,v)}set(t,r,n,i,s,o,l,h,a,c,d,p,f,u,g,v){const x=this.elements;return x[0]=t,x[4]=r,x[8]=n,x[12]=i,x[1]=s,x[5]=o,x[9]=l,x[13]=h,x[2]=a,x[6]=c,x[10]=d,x[14]=p,x[3]=f,x[7]=u,x[11]=g,x[15]=v,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Re().fromArray(this.elements)}copy(t){const r=this.elements,n=t.elements;return r[0]=n[0],r[1]=n[1],r[2]=n[2],r[3]=n[3],r[4]=n[4],r[5]=n[5],r[6]=n[6],r[7]=n[7],r[8]=n[8],r[9]=n[9],r[10]=n[10],r[11]=n[11],r[12]=n[12],r[13]=n[13],r[14]=n[14],r[15]=n[15],this}copyPosition(t){const r=this.elements,n=t.elements;return r[12]=n[12],r[13]=n[13],r[14]=n[14],this}setFromMatrix3(t){const r=t.elements;return this.set(r[0],r[3],r[6],0,r[1],r[4],r[7],0,r[2],r[5],r[8],0,0,0,0,1),this}extractBasis(t,r,n){return this.determinant()===0?(t.set(1,0,0),r.set(0,1,0),n.set(0,0,1),this):(t.setFromMatrixColumn(this,0),r.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(t,r,n){return this.set(t.x,r.x,n.x,0,t.y,r.y,n.y,0,t.z,r.z,n.z,0,0,0,0,1),this}extractRotation(t){if(t.determinant()===0)return this.identity();const r=this.elements,n=t.elements,i=1/rt.setFromMatrixColumn(t,0).length(),s=1/rt.setFromMatrixColumn(t,1).length(),o=1/rt.setFromMatrixColumn(t,2).length();return r[0]=n[0]*i,r[1]=n[1]*i,r[2]=n[2]*i,r[3]=0,r[4]=n[4]*s,r[5]=n[5]*s,r[6]=n[6]*s,r[7]=0,r[8]=n[8]*o,r[9]=n[9]*o,r[10]=n[10]*o,r[11]=0,r[12]=0,r[13]=0,r[14]=0,r[15]=1,this}makeRotationFromEuler(t){const r=this.elements,n=t.x,i=t.y,s=t.z,o=Math.cos(n),l=Math.sin(n),h=Math.cos(i),a=Math.sin(i),c=Math.cos(s),d=Math.sin(s);if(t.order==="XYZ"){const p=o*c,f=o*d,u=l*c,g=l*d;r[0]=h*c,r[4]=-h*d,r[8]=a,r[1]=f+u*a,r[5]=p-g*a,r[9]=-l*h,r[2]=g-p*a,r[6]=u+f*a,r[10]=o*h}else if(t.order==="YXZ"){const p=h*c,f=h*d,u=a*c,g=a*d;r[0]=p+g*l,r[4]=u*l-f,r[8]=o*a,r[1]=o*d,r[5]=o*c,r[9]=-l,r[2]=f*l-u,r[6]=g+p*l,r[10]=o*h}else if(t.order==="ZXY"){const p=h*c,f=h*d,u=a*c,g=a*d;r[0]=p-g*l,r[4]=-o*d,r[8]=u+f*l,r[1]=f+u*l,r[5]=o*c,r[9]=g-p*l,r[2]=-o*a,r[6]=l,r[10]=o*h}else if(t.order==="ZYX"){const p=o*c,f=o*d,u=l*c,g=l*d;r[0]=h*c,r[4]=u*a-f,r[8]=p*a+g,r[1]=h*d,r[5]=g*a+p,r[9]=f*a-u,r[2]=-a,r[6]=l*h,r[10]=o*h}else if(t.order==="YZX"){const p=o*h,f=o*a,u=l*h,g=l*a;r[0]=h*c,r[4]=g-p*d,r[8]=u*d+f,r[1]=d,r[5]=o*c,r[9]=-l*c,r[2]=-a*c,r[6]=f*d+u,r[10]=p-g*d}else if(t.order==="XZY"){const p=o*h,f=o*a,u=l*h,g=l*a;r[0]=h*c,r[4]=-d,r[8]=a*c,r[1]=p*d+g,r[5]=o*c,r[9]=f*d-u,r[2]=u*d-f,r[6]=l*c,r[10]=g*d+p}return r[3]=0,r[7]=0,r[11]=0,r[12]=0,r[13]=0,r[14]=0,r[15]=1,this}makeRotationFromQuaternion(t){return this.compose(Sn,t,Pn)}lookAt(t,r,n){const i=this.elements;return xe.subVectors(t,r),xe.lengthSq()===0&&(xe.z=1),xe.normalize(),Xe.crossVectors(n,xe),Xe.lengthSq()===0&&(Math.abs(n.z)===1?xe.x+=1e-4:xe.z+=1e-4,xe.normalize(),Xe.crossVectors(n,xe)),Xe.normalize(),Ct.crossVectors(xe,Xe),i[0]=Xe.x,i[4]=Ct.x,i[8]=xe.x,i[1]=Xe.y,i[5]=Ct.y,i[9]=xe.y,i[2]=Xe.z,i[6]=Ct.z,i[10]=xe.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,r){const n=t.elements,i=r.elements,s=this.elements,o=n[0],l=n[4],h=n[8],a=n[12],c=n[1],d=n[5],p=n[9],f=n[13],u=n[2],g=n[6],v=n[10],x=n[14],y=n[3],b=n[7],T=n[11],m=n[15],S=i[0],P=i[4],A=i[8],C=i[12],w=i[1],_=i[5],F=i[9],L=i[13],z=i[2],M=i[6],I=i[10],N=i[14],K=i[3],E=i[7],D=i[11],O=i[15];return s[0]=o*S+l*w+h*z+a*K,s[4]=o*P+l*_+h*M+a*E,s[8]=o*A+l*F+h*I+a*D,s[12]=o*C+l*L+h*N+a*O,s[1]=c*S+d*w+p*z+f*K,s[5]=c*P+d*_+p*M+f*E,s[9]=c*A+d*F+p*I+f*D,s[13]=c*C+d*L+p*N+f*O,s[2]=u*S+g*w+v*z+x*K,s[6]=u*P+g*_+v*M+x*E,s[10]=u*A+g*F+v*I+x*D,s[14]=u*C+g*L+v*N+x*O,s[3]=y*S+b*w+T*z+m*K,s[7]=y*P+b*_+T*M+m*E,s[11]=y*A+b*F+T*I+m*D,s[15]=y*C+b*L+T*N+m*O,this}multiplyScalar(t){const r=this.elements;return r[0]*=t,r[4]*=t,r[8]*=t,r[12]*=t,r[1]*=t,r[5]*=t,r[9]*=t,r[13]*=t,r[2]*=t,r[6]*=t,r[10]*=t,r[14]*=t,r[3]*=t,r[7]*=t,r[11]*=t,r[15]*=t,this}determinant(){const t=this.elements,r=t[0],n=t[4],i=t[8],s=t[12],o=t[1],l=t[5],h=t[9],a=t[13],c=t[2],d=t[6],p=t[10],f=t[14],u=t[3],g=t[7],v=t[11],x=t[15],y=h*f-a*p,b=l*f-a*d,T=l*p-h*d,m=o*f-a*c,S=o*p-h*c,P=o*d-l*c;return r*(g*y-v*b+x*T)-n*(u*y-v*m+x*S)+i*(u*b-g*m+x*P)-s*(u*T-g*S+v*P)}transpose(){const t=this.elements;let r;return r=t[1],t[1]=t[4],t[4]=r,r=t[2],t[2]=t[8],t[8]=r,r=t[6],t[6]=t[9],t[9]=r,r=t[3],t[3]=t[12],t[12]=r,r=t[7],t[7]=t[13],t[13]=r,r=t[11],t[11]=t[14],t[14]=r,this}setPosition(t,r,n){const i=this.elements;return t.isVector3?(i[12]=t.x,i[13]=t.y,i[14]=t.z):(i[12]=t,i[13]=r,i[14]=n),this}invert(){const t=this.elements,r=t[0],n=t[1],i=t[2],s=t[3],o=t[4],l=t[5],h=t[6],a=t[7],c=t[8],d=t[9],p=t[10],f=t[11],u=t[12],g=t[13],v=t[14],x=t[15],y=r*l-n*o,b=r*h-i*o,T=r*a-s*o,m=n*h-i*l,S=n*a-s*l,P=i*a-s*h,A=c*g-d*u,C=c*v-p*u,w=c*x-f*u,_=d*v-p*g,F=d*x-f*g,L=p*x-f*v,z=y*L-b*F+T*_+m*w-S*C+P*A;if(z===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const M=1/z;return t[0]=(l*L-h*F+a*_)*M,t[1]=(i*F-n*L-s*_)*M,t[2]=(g*P-v*S+x*m)*M,t[3]=(p*S-d*P-f*m)*M,t[4]=(h*w-o*L-a*C)*M,t[5]=(r*L-i*w+s*C)*M,t[6]=(v*T-u*P-x*b)*M,t[7]=(c*P-p*T+f*b)*M,t[8]=(o*F-l*w+a*A)*M,t[9]=(n*w-r*F-s*A)*M,t[10]=(u*S-g*T+x*y)*M,t[11]=(d*T-c*S-f*y)*M,t[12]=(l*C-o*_-h*A)*M,t[13]=(r*_-n*C+i*A)*M,t[14]=(g*b-u*m-v*y)*M,t[15]=(c*m-d*b+p*y)*M,this}scale(t){const r=this.elements,n=t.x,i=t.y,s=t.z;return r[0]*=n,r[4]*=i,r[8]*=s,r[1]*=n,r[5]*=i,r[9]*=s,r[2]*=n,r[6]*=i,r[10]*=s,r[3]*=n,r[7]*=i,r[11]*=s,this}getMaxScaleOnAxis(){const t=this.elements,r=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],i=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(r,n,i))}makeTranslation(t,r,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,r,0,0,1,n,0,0,0,1),this}makeRotationX(t){const r=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,r,-n,0,0,n,r,0,0,0,0,1),this}makeRotationY(t){const r=Math.cos(t),n=Math.sin(t);return this.set(r,0,n,0,0,1,0,0,-n,0,r,0,0,0,0,1),this}makeRotationZ(t){const r=Math.cos(t),n=Math.sin(t);return this.set(r,-n,0,0,n,r,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,r){const n=Math.cos(r),i=Math.sin(r),s=1-n,o=t.x,l=t.y,h=t.z,a=s*o,c=s*l;return this.set(a*o+n,a*l-i*h,a*h+i*l,0,a*l+i*h,c*l+n,c*h-i*o,0,a*h-i*l,c*h+i*o,s*h*h+n,0,0,0,0,1),this}makeScale(t,r,n){return this.set(t,0,0,0,0,r,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,r,n,i,s,o){return this.set(1,n,s,0,t,1,o,0,r,i,1,0,0,0,0,1),this}compose(t,r,n){const i=this.elements,s=r._x,o=r._y,l=r._z,h=r._w,a=s+s,c=o+o,d=l+l,p=s*a,f=s*c,u=s*d,g=o*c,v=o*d,x=l*d,y=h*a,b=h*c,T=h*d,m=n.x,S=n.y,P=n.z;return i[0]=(1-(g+x))*m,i[1]=(f+T)*m,i[2]=(u-b)*m,i[3]=0,i[4]=(f-T)*S,i[5]=(1-(p+x))*S,i[6]=(v+y)*S,i[7]=0,i[8]=(u+b)*P,i[9]=(v-y)*P,i[10]=(1-(p+g))*P,i[11]=0,i[12]=t.x,i[13]=t.y,i[14]=t.z,i[15]=1,this}decompose(t,r,n){const i=this.elements;t.x=i[12],t.y=i[13],t.z=i[14];const s=this.determinant();if(s===0)return n.set(1,1,1),r.identity(),this;let o=rt.set(i[0],i[1],i[2]).length();const l=rt.set(i[4],i[5],i[6]).length(),h=rt.set(i[8],i[9],i[10]).length();s<0&&(o=-o),Pe.copy(this);const a=1/o,c=1/l,d=1/h;return Pe.elements[0]*=a,Pe.elements[1]*=a,Pe.elements[2]*=a,Pe.elements[4]*=c,Pe.elements[5]*=c,Pe.elements[6]*=c,Pe.elements[8]*=d,Pe.elements[9]*=d,Pe.elements[10]*=d,r.setFromRotationMatrix(Pe),n.x=o,n.y=l,n.z=h,this}makePerspective(t,r,n,i,s,o,l=2e3,h=!1){const a=this.elements,c=2*s/(r-t),d=2*s/(n-i),p=(r+t)/(r-t),f=(n+i)/(n-i);let u,g;if(h)u=s/(o-s),g=o*s/(o-s);else if(l===2e3)u=-(o+s)/(o-s),g=-2*o*s/(o-s);else if(l===2001)u=-o/(o-s),g=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+l);return a[0]=c,a[4]=0,a[8]=p,a[12]=0,a[1]=0,a[5]=d,a[9]=f,a[13]=0,a[2]=0,a[6]=0,a[10]=u,a[14]=g,a[3]=0,a[7]=0,a[11]=-1,a[15]=0,this}makeOrthographic(t,r,n,i,s,o,l=2e3,h=!1){const a=this.elements,c=2/(r-t),d=2/(n-i),p=-(r+t)/(r-t),f=-(n+i)/(n-i);let u,g;if(h)u=1/(o-s),g=o/(o-s);else if(l===2e3)u=-2/(o-s),g=-(o+s)/(o-s);else if(l===2001)u=-1/(o-s),g=-s/(o-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+l);return a[0]=c,a[4]=0,a[8]=0,a[12]=p,a[1]=0,a[5]=d,a[9]=0,a[13]=f,a[2]=0,a[6]=0,a[10]=u,a[14]=g,a[3]=0,a[7]=0,a[11]=0,a[15]=1,this}equals(t){const r=this.elements,n=t.elements;for(let i=0;i<16;i++)if(r[i]!==n[i])return!1;return!0}fromArray(t,r=0){for(let n=0;n<16;n++)this.elements[n]=t[n+r];return this}toArray(t=[],r=0){const n=this.elements;return t[r]=n[0],t[r+1]=n[1],t[r+2]=n[2],t[r+3]=n[3],t[r+4]=n[4],t[r+5]=n[5],t[r+6]=n[6],t[r+7]=n[7],t[r+8]=n[8],t[r+9]=n[9],t[r+10]=n[10],t[r+11]=n[11],t[r+12]=n[12],t[r+13]=n[13],t[r+14]=n[14],t[r+15]=n[15],t}}const rt=new V,Pe=new Re,Sn=new V(0,0,0),Pn=new V(1,1,1),Xe=new V,Ct=new V,xe=new V,Lr=new Re,Dr=new W;class Bt{constructor(t=0,r=0,n=0,i=Bt.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=r,this._z=n,this._order=i}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,r,n,i=this._order){return this._x=t,this._y=r,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,r=this._order,n=!0){const i=t.elements,s=i[0],o=i[4],l=i[8],h=i[1],a=i[5],c=i[9],d=i[2],p=i[6],f=i[10];switch(r){case"XYZ":this._y=Math.asin(ue(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-c,f),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(p,a),this._z=0);break;case"YXZ":this._x=Math.asin(-ue(c,-1,1)),Math.abs(c)<.9999999?(this._y=Math.atan2(l,f),this._z=Math.atan2(h,a)):(this._y=Math.atan2(-d,s),this._z=0);break;case"ZXY":this._x=Math.asin(ue(p,-1,1)),Math.abs(p)<.9999999?(this._y=Math.atan2(-d,f),this._z=Math.atan2(-o,a)):(this._y=0,this._z=Math.atan2(h,s));break;case"ZYX":this._y=Math.asin(-ue(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(p,f),this._z=Math.atan2(h,s)):(this._x=0,this._z=Math.atan2(-o,a));break;case"YZX":this._z=Math.asin(ue(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(-c,a),this._y=Math.atan2(-d,s)):(this._x=0,this._y=Math.atan2(l,f));break;case"XZY":this._z=Math.asin(-ue(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(p,a),this._y=Math.atan2(l,s)):(this._x=Math.atan2(-c,f),this._y=0);break;default:Zt("Euler: .setFromRotationMatrix() encountered an unknown order: "+r)}return this._order=r,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,r,n){return Lr.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Lr,r,n)}setFromVector3(t,r=this._order){return this.set(t.x,t.y,t.z,r)}reorder(t){return Dr.setFromEuler(this),this.setFromQuaternion(Dr,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],r=0){return t[r]=this._x,t[r+1]=this._y,t[r+2]=this._z,t[r+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Bt.DEFAULT_ORDER="XYZ",typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"183"}})),typeof window<"u"&&(window.__THREE__?Zt("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="183");var Ft=(function(e){return e[e.WrapWidth=1]="WrapWidth",e[e.WrapHeight=2]="WrapHeight",e})({}),Z=(function(e){return e[e.None=0]="None",e[e.Transparent=1]="Transparent",e[e.Blend=2]="Blend",e[e.Additive=3]="Additive",e[e.AddAlpha=4]="AddAlpha",e[e.Modulate=5]="Modulate",e[e.Modulate2x=6]="Modulate2x",e})({}),Ve=(function(e){return e[e.DontInterp=0]="DontInterp",e[e.Linear=1]="Linear",e[e.Hermite=2]="Hermite",e[e.Bezier=3]="Bezier",e})({}),_e=(function(e){return e[e.Unshaded=1]="Unshaded",e[e.SphereEnvMap=2]="SphereEnvMap",e[e.TwoSided=16]="TwoSided",e[e.Unfogged=32]="Unfogged",e[e.NoDepthTest=64]="NoDepthTest",e[e.NoDepthSet=128]="NoDepthSet",e})({}),Ye=(function(e){return e[e.DontInheritTranslation=1]="DontInheritTranslation",e[e.DontInheritRotation=2]="DontInheritRotation",e[e.DontInheritScaling=4]="DontInheritScaling",e[e.Billboarded=8]="Billboarded",e[e.BillboardedLockX=16]="BillboardedLockX",e[e.BillboardedLockY=32]="BillboardedLockY",e[e.BillboardedLockZ=64]="BillboardedLockZ",e[e.CameraAnchored=128]="CameraAnchored",e})({}),Jt=(function(e){return e[e.Unshaded=32768]="Unshaded",e[e.SortPrimsFarZ=65536]="SortPrimsFarZ",e[e.LineEmitter=131072]="LineEmitter",e[e.Unfogged=262144]="Unfogged",e[e.ModelSpace=524288]="ModelSpace",e[e.XYQuad=1048576]="XYQuad",e})({}),Me=(function(e){return e[e.Blend=0]="Blend",e[e.Additive=1]="Additive",e[e.Modulate=2]="Modulate",e[e.Modulate2x=3]="Modulate2x",e[e.AlphaKey=4]="AlphaKey",e})({}),Q=(function(e){return e[e.Head=1]="Head",e[e.Tail=2]="Tail",e})({});function Lt(e,t,r){const n=t[0],i=t[1],s=t[2],o=t[3],l=n+n,h=i+i,a=s+s,c=n*l,d=n*h,p=n*a,f=i*h,u=i*a,g=s*a,v=o*l,x=o*h,y=o*a,b=r[0],T=r[1],m=r[2];return e[0]=1-(f+g),e[1]=d+y,e[2]=p-x,e[3]=0,e[4]=d-y,e[5]=1-(c+g),e[6]=u+v,e[7]=0,e[8]=p+x,e[9]=u-v,e[10]=1-(c+f),e[11]=0,e[12]=b-(e[0]*b+e[4]*T+e[8]*m),e[13]=T-(e[1]*b+e[5]*T+e[9]*m),e[14]=m-(e[2]*b+e[6]*T+e[10]*m),e[15]=1,e}function mt(e,t){return e+Math.random()*(t-e)}function Mn(e){return e*Math.PI/180}function Ce(e,t,r){const n=e.createShader(r);return e.shaderSource(n,t),e.compileShader(n),e.getShaderParameter(n,e.COMPILE_STATUS)?n:(alert(e.getShaderInfoLog(n)),null)}function ye(e){return e instanceof WebGL2RenderingContext}var vt=(function(e){return e[e.INT1=0]="INT1",e[e.FLOAT1=1]="FLOAT1",e[e.FLOAT3=2]="FLOAT3",e[e.FLOAT4=3]="FLOAT4",e})(vt||{});vt.INT1+"",vt.FLOAT1+"",vt.FLOAT3+"",vt.FLOAT4+"";var xt=(function(e){return e[e.INT1=0]="INT1",e[e.FLOAT1=1]="FLOAT1",e[e.FLOAT3=2]="FLOAT3",e[e.FLOAT4=3]="FLOAT4",e})(xt||{});xt.INT1+"",xt.FLOAT1+"",xt.FLOAT3+"",xt.FLOAT4+"";var bt=(function(e){return e[e.INT1=0]="INT1",e[e.FLOAT1=1]="FLOAT1",e[e.FLOAT3=2]="FLOAT3",e[e.FLOAT4=3]="FLOAT4",e})(bt||{});bt.INT1+"",bt.FLOAT1+"",bt.FLOAT3+"",bt.FLOAT4+"";var pe=typeof Float32Array<"u"?Float32Array:Array;Math.hypot||(Math.hypot=function(){for(var e=0,t=arguments.length;t--;)e+=arguments[t]*arguments[t];return Math.sqrt(e)});function er(){var e=new pe(9);return pe!=Float32Array&&(e[1]=0,e[2]=0,e[3]=0,e[5]=0,e[6]=0,e[7]=0),e[0]=1,e[4]=1,e[8]=1,e}function Rr(e,t,r,n,i,s,o,l,h,a){return e[0]=t,e[1]=r,e[2]=n,e[3]=i,e[4]=s,e[5]=o,e[6]=l,e[7]=h,e[8]=a,e}function He(){var e=new pe(16);return pe!=Float32Array&&(e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0),e[0]=1,e[5]=1,e[10]=1,e[15]=1,e}function Vr(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e}function En(e,t,r){var n=t[0],i=t[1],s=t[2],o=t[3],l=t[4],h=t[5],a=t[6],c=t[7],d=t[8],p=t[9],f=t[10],u=t[11],g=t[12],v=t[13],x=t[14],y=t[15],b=r[0],T=r[1],m=r[2],S=r[3];return e[0]=b*n+T*l+m*d+S*g,e[1]=b*i+T*h+m*p+S*v,e[2]=b*s+T*a+m*f+S*x,e[3]=b*o+T*c+m*u+S*y,b=r[4],T=r[5],m=r[6],S=r[7],e[4]=b*n+T*l+m*d+S*g,e[5]=b*i+T*h+m*p+S*v,e[6]=b*s+T*a+m*f+S*x,e[7]=b*o+T*c+m*u+S*y,b=r[8],T=r[9],m=r[10],S=r[11],e[8]=b*n+T*l+m*d+S*g,e[9]=b*i+T*h+m*p+S*v,e[10]=b*s+T*a+m*f+S*x,e[11]=b*o+T*c+m*u+S*y,b=r[12],T=r[13],m=r[14],S=r[15],e[12]=b*n+T*l+m*d+S*g,e[13]=b*i+T*h+m*p+S*v,e[14]=b*s+T*a+m*f+S*x,e[15]=b*o+T*c+m*u+S*y,e}function An(e,t){return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=t[0],e[13]=t[1],e[14]=t[2],e[15]=1,e}function Un(e,t){var r=t[0],n=t[1],i=t[2],s=t[4],o=t[5],l=t[6],h=t[8],a=t[9],c=t[10];return e[0]=Math.hypot(r,n,i),e[1]=Math.hypot(s,o,l),e[2]=Math.hypot(h,a,c),e}function wn(e,t){var r=new pe(3);Un(r,t);var n=1/r[0],i=1/r[1],s=1/r[2],o=t[0]*n,l=t[1]*i,h=t[2]*s,a=t[4]*n,c=t[5]*i,d=t[6]*s,p=t[8]*n,f=t[9]*i,u=t[10]*s,g=o+c+u,v=0;return g>0?(v=Math.sqrt(g+1)*2,e[3]=.25*v,e[0]=(d-f)/v,e[1]=(p-h)/v,e[2]=(l-a)/v):o>c&&o>u?(v=Math.sqrt(1+o-c-u)*2,e[3]=(d-f)/v,e[0]=.25*v,e[1]=(l+a)/v,e[2]=(p+h)/v):c>u?(v=Math.sqrt(1+c-o-u)*2,e[3]=(p-h)/v,e[0]=(l+a)/v,e[1]=.25*v,e[2]=(d+f)/v):(v=Math.sqrt(1+u-o-c)*2,e[3]=(l-a)/v,e[0]=(p+h)/v,e[1]=(d+f)/v,e[2]=.25*v),e}function Ir(e,t,r,n){var i=t[0],s=t[1],o=t[2],l=t[3],h=i+i,a=s+s,c=o+o,d=i*h,p=i*a,f=i*c,u=s*a,g=s*c,v=o*c,x=l*h,y=l*a,b=l*c,T=n[0],m=n[1],S=n[2];return e[0]=(1-(u+v))*T,e[1]=(p+b)*T,e[2]=(f-y)*T,e[3]=0,e[4]=(p-b)*m,e[5]=(1-(d+v))*m,e[6]=(g+x)*m,e[7]=0,e[8]=(f+y)*S,e[9]=(g-x)*S,e[10]=(1-(d+u))*S,e[11]=0,e[12]=r[0],e[13]=r[1],e[14]=r[2],e[15]=1,e}function _n(e,t,r,n,i){var s=t[0],o=t[1],l=t[2],h=t[3],a=s+s,c=o+o,d=l+l,p=s*a,f=s*c,u=s*d,g=o*c,v=o*d,x=l*d,y=h*a,b=h*c,T=h*d,m=n[0],S=n[1],P=n[2],A=i[0],C=i[1],w=i[2],_=(1-(g+x))*m,F=(f+T)*m,L=(u-b)*m,z=(f-T)*S,M=(1-(p+x))*S,I=(v+y)*S,N=(u+b)*P,K=(v-y)*P,E=(1-(p+g))*P;return e[0]=_,e[1]=F,e[2]=L,e[3]=0,e[4]=z,e[5]=M,e[6]=I,e[7]=0,e[8]=N,e[9]=K,e[10]=E,e[11]=0,e[12]=r[0]+A-(_*A+z*C+N*w),e[13]=r[1]+C-(F*A+M*C+K*w),e[14]=r[2]+w-(L*A+I*C+E*w),e[15]=1,e}function Cn(e,t,r,n,i){var s=1/Math.tan(t/2),o;return e[0]=s/r,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=s,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[11]=-1,e[12]=0,e[13]=0,e[15]=0,i!==1/0?(o=1/(n-i),e[10]=(i+n)*o,e[14]=2*i*n*o):(e[10]=-1,e[14]=-2*n),e}function nt(e,t,r,n){var i,s,o,l,h,a,c,d,p,f,u=t[0],g=t[1],v=t[2],x=n[0],y=n[1],b=n[2],T=r[0],m=r[1],S=r[2];return Math.abs(u-T)<1e-6&&Math.abs(g-m)<1e-6&&Math.abs(v-S)<1e-6?Vr(e):(c=u-T,d=g-m,p=v-S,f=1/Math.hypot(c,d,p),c*=f,d*=f,p*=f,i=y*p-b*d,s=b*c-x*p,o=x*d-y*c,f=Math.hypot(i,s,o),f?(f=1/f,i*=f,s*=f,o*=f):(i=0,s=0,o=0),l=d*o-p*s,h=p*i-c*o,a=c*s-d*i,f=Math.hypot(l,h,a),f?(f=1/f,l*=f,h*=f,a*=f):(l=0,h=0,a=0),e[0]=i,e[1]=l,e[2]=c,e[3]=0,e[4]=s,e[5]=h,e[6]=d,e[7]=0,e[8]=o,e[9]=a,e[10]=p,e[11]=0,e[12]=-(i*u+s*g+o*v),e[13]=-(l*u+h*g+a*v),e[14]=-(c*u+d*g+p*v),e[15]=1,e)}var Dt=En;function ee(){var e=new pe(3);return pe!=Float32Array&&(e[0]=0,e[1]=0,e[2]=0),e}function Gr(e){var t=new pe(3);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t}function Bn(e){var t=e[0],r=e[1],n=e[2];return Math.hypot(t,r,n)}function $(e,t,r){var n=new pe(3);return n[0]=e,n[1]=t,n[2]=r,n}function yt(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e}function be(e,t,r,n){return e[0]=t,e[1]=r,e[2]=n,e}function zr(e,t,r){return e[0]=t[0]+r[0],e[1]=t[1]+r[1],e[2]=t[2]+r[2],e}function Fn(e,t,r){return e[0]=t[0]-r[0],e[1]=t[1]-r[1],e[2]=t[2]-r[2],e}function Or(e,t,r){return e[0]=t[0]*r,e[1]=t[1]*r,e[2]=t[2]*r,e}function tr(e,t){var r=t[0],n=t[1],i=t[2],s=r*r+n*n+i*i;return s>0&&(s=1/Math.sqrt(s)),e[0]=t[0]*s,e[1]=t[1]*s,e[2]=t[2]*s,e}function Ln(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function it(e,t,r){var n=t[0],i=t[1],s=t[2],o=r[0],l=r[1],h=r[2];return e[0]=i*h-s*l,e[1]=s*o-n*h,e[2]=n*l-i*o,e}function Dn(e,t,r,n){var i=t[0],s=t[1],o=t[2];return e[0]=i+n*(r[0]-i),e[1]=s+n*(r[1]-s),e[2]=o+n*(r[2]-o),e}function Rn(e,t,r,n,i,s){var o=s*s,l=o*(2*s-3)+1,h=o*(s-2)+s,a=o*(s-1),c=o*(3-2*s);return e[0]=t[0]*l+r[0]*h+n[0]*a+i[0]*c,e[1]=t[1]*l+r[1]*h+n[1]*a+i[1]*c,e[2]=t[2]*l+r[2]*h+n[2]*a+i[2]*c,e}function Vn(e,t,r,n,i,s){var o=1-s,l=o*o,h=s*s,a=l*o,c=3*s*l,d=3*h*o,p=h*s;return e[0]=t[0]*a+r[0]*c+n[0]*d+i[0]*p,e[1]=t[1]*a+r[1]*c+n[1]*d+i[1]*p,e[2]=t[2]*a+r[2]*c+n[2]*d+i[2]*p,e}function Ee(e,t,r){var n=t[0],i=t[1],s=t[2],o=r[3]*n+r[7]*i+r[11]*s+r[15];return o=o||1,e[0]=(r[0]*n+r[4]*i+r[8]*s+r[12])/o,e[1]=(r[1]*n+r[5]*i+r[9]*s+r[13])/o,e[2]=(r[2]*n+r[6]*i+r[10]*s+r[14])/o,e}function Nr(e,t,r){var n=r[0],i=r[1],s=r[2],o=r[3],l=t[0],h=t[1],a=t[2],c=i*a-s*h,d=s*l-n*a,p=n*h-i*l,f=i*p-s*d,u=s*c-n*p,g=n*d-i*c,v=o*2;return c*=v,d*=v,p*=v,f*=2,u*=2,g*=2,e[0]=l+c+f,e[1]=h+d+u,e[2]=a+p+g,e}function In(e,t,r,n){var i=[],s=[];return i[0]=t[0]-r[0],i[1]=t[1]-r[1],i[2]=t[2]-r[2],s[0]=i[2]*Math.sin(n)+i[0]*Math.cos(n),s[1]=i[1],s[2]=i[2]*Math.cos(n)-i[0]*Math.sin(n),e[0]=s[0]+r[0],e[1]=s[1]+r[1],e[2]=s[2]+r[2],e}function Gn(e,t,r,n){var i=[],s=[];return i[0]=t[0]-r[0],i[1]=t[1]-r[1],i[2]=t[2]-r[2],s[0]=i[0]*Math.cos(n)-i[1]*Math.sin(n),s[1]=i[0]*Math.sin(n)+i[1]*Math.cos(n),s[2]=i[2],e[0]=s[0]+r[0],e[1]=s[1]+r[1],e[2]=s[2]+r[2],e}var kr=Fn,zn=Bn;(function(){var e=ee();return function(t,r,n,i,s,o){var l,h;for(r||(r=3),n||(n=0),i?h=Math.min(i*r+n,t.length):h=t.length,l=n;l<h;l+=r)e[0]=t[l],e[1]=t[l+1],e[2]=t[l+2],s(e,e,o),t[l]=e[0],t[l+1]=e[1],t[l+2]=e[2];return t}})();function Rt(){var e=new pe(4);return pe!=Float32Array&&(e[0]=0,e[1]=0,e[2]=0,e[3]=0),e}function On(e,t,r,n){var i=new pe(4);return i[0]=e,i[1]=t,i[2]=r,i[3]=n,i}function Nn(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e}function kn(e,t){var r=t[0],n=t[1],i=t[2],s=t[3],o=r*r+n*n+i*i+s*s;return o>0&&(o=1/Math.sqrt(o)),e[0]=r*o,e[1]=n*o,e[2]=i*o,e[3]=s*o,e}function Xn(e,t,r,n){var i=t[0],s=t[1],o=t[2],l=t[3];return e[0]=i+n*(r[0]-i),e[1]=s+n*(r[1]-s),e[2]=o+n*(r[2]-o),e[3]=l+n*(r[3]-l),e}(function(){var e=Rt();return function(t,r,n,i,s,o){var l,h;for(r||(r=4),n||(n=0),i?h=Math.min(i*r+n,t.length):h=t.length,l=n;l<h;l+=r)e[0]=t[l],e[1]=t[l+1],e[2]=t[l+2],e[3]=t[l+3],s(e,e,o),t[l]=e[0],t[l+1]=e[1],t[l+2]=e[2],t[l+3]=e[3];return t}})();function st(){var e=new pe(4);return pe!=Float32Array&&(e[0]=0,e[1]=0,e[2]=0),e[3]=1,e}function Hn(e,t,r){r=r*.5;var n=Math.sin(r);return e[0]=n*t[0],e[1]=n*t[1],e[2]=n*t[2],e[3]=Math.cos(r),e}function Vt(e,t,r,n){var i=t[0],s=t[1],o=t[2],l=t[3],h=r[0],a=r[1],c=r[2],d=r[3],p,f=i*h+s*a+o*c+l*d,u,g,v;return f<0&&(f=-f,h=-h,a=-a,c=-c,d=-d),1-f>1e-6?(p=Math.acos(f),u=Math.sin(p),g=Math.sin((1-n)*p)/u,v=Math.sin(n*p)/u):(g=1-n,v=n),e[0]=g*i+v*h,e[1]=g*s+v*a,e[2]=g*o+v*c,e[3]=g*l+v*d,e}function Wn(e,t){var r=t[0],n=t[1],i=t[2],s=t[3],o=r*r+n*n+i*i+s*s,l=o?1/o:0;return e[0]=-r*l,e[1]=-n*l,e[2]=-i*l,e[3]=s*l,e}function qn(e,t){var r=t[0]+t[4]+t[8],n;if(r>0)n=Math.sqrt(r+1),e[3]=.5*n,n=.5/n,e[0]=(t[5]-t[7])*n,e[1]=(t[6]-t[2])*n,e[2]=(t[1]-t[3])*n;else{var i=0;t[4]>t[0]&&(i=1),t[8]>t[i*3+i]&&(i=2);var s=(i+1)%3,o=(i+2)%3;n=Math.sqrt(t[i*3+i]-t[s*3+s]-t[o*3+o]+1),e[i]=.5*n,n=.5/n,e[3]=(t[s*3+o]-t[o*3+s])*n,e[s]=(t[s*3+i]+t[i*3+s])*n,e[o]=(t[o*3+i]+t[i*3+o])*n}return e}var jn=On,Yn=Nn,Xr=kn,$n=(function(){var e=ee(),t=$(1,0,0),r=$(0,1,0);return function(n,i,s){var o=Ln(i,s);return o<-.999999?(it(e,t,i),zn(e)<1e-6&&it(e,r,i),tr(e,e),Hn(n,e,Math.PI),n):o>.999999?(n[0]=0,n[1]=0,n[2]=0,n[3]=1,n):(it(e,i,s),n[0]=e[0],n[1]=e[1],n[2]=e[2],n[3]=1+o,Xr(n,n))}})(),Kn=(function(){var e=st(),t=st();return function(r,n,i,s,o,l){return Vt(e,n,o,l),Vt(t,i,s,l),Vt(r,e,t,2*l*(1-l)),r}})();(function(){var e=er();return function(t,r,n,i){return e[0]=n[0],e[3]=n[1],e[6]=n[2],e[1]=i[0],e[4]=i[1],e[7]=i[2],e[2]=-r[0],e[5]=-r[1],e[8]=-r[2],Xr(t,qn(t,e))}})();var Te={frame:0,left:null,right:null};function rr(e,t,r){return e*(1-r)+t*r}function Zn(e,t,r,n,i){const s=1-i,o=s*s,l=i*i,h=o*s,a=3*i*o,c=3*l*s,d=l*i;return e*h+t*a+r*c+n*d}function Qn(e,t,r,n,i){const s=i*i,o=s*(2*i-3)+1,l=s*(i-2)+i,h=s*(i-1),a=s*(3-2*i);return e*o+t*l+r*h+n*a}function Jn(e,t,r,n){if(!e)return null;const i=e.Keys;let s=0,o=i.length;if(o===0||i[0].Frame>n)return null;if(i[o-1].Frame<r)return null;for(;o>0;){const l=o>>1;i[s+l].Frame<=t?(s=s+l+1,o-=l+1):o=l}return s===i.length||i[s].Frame>n?s>0&&i[s-1].Frame>=r?(Te.frame=t,Te.left=i[s-1],Te.right=i[s-1],Te):null:s===0||i[s-1].Frame<r?i[s].Frame<=n?(Te.frame=t,Te.left=i[s],Te.right=i[s],Te):null:(Te.frame=t,Te.left=i[s-1],Te.right=i[s],Te)}function ei(e,t,r,n){if(t.Frame===r.Frame)return t.Vector[0];const i=(e-t.Frame)/(r.Frame-t.Frame);return n===Ve.DontInterp?t.Vector[0]:n===Ve.Bezier?Zn(t.Vector[0],t.OutTan[0],r.InTan[0],r.Vector[0],i):n===Ve.Hermite?Qn(t.Vector[0],t.OutTan[0],r.InTan[0],r.Vector[0],i):rr(t.Vector[0],r.Vector[0],i)}function ti(e,t,r,n,i){if(r.Frame===n.Frame)return r.Vector;const s=(t-r.Frame)/(n.Frame-r.Frame);return i===Ve.DontInterp?r.Vector:i===Ve.Bezier?Vn(e,r.Vector,r.OutTan,n.InTan,n.Vector,s):i===Ve.Hermite?Rn(e,r.Vector,r.OutTan,n.InTan,n.Vector,s):Dn(e,r.Vector,n.Vector,s)}function ri(e,t,r,n,i){if(r.Frame===n.Frame)return r.Vector;const s=(t-r.Frame)/(n.Frame-r.Frame);return i===Ve.DontInterp?r.Vector:i===Ve.Hermite||i===Ve.Bezier?Kn(e,r.Vector,r.OutTan,n.InTan,n.Vector,s):Vt(e,r.Vector,n.Vector,s)}var $e={frame:0,from:0,to:0},nr=class{static maxAnimVectorVal(e){if(typeof e=="number")return e;let t=e.Keys[0].Vector[0];for(let r=1;r<e.Keys.length;++r)e.Keys[r].Vector[0]>t&&(t=e.Keys[r].Vector[0]);return t}constructor(e){this.rendererData=e}num(e){const t=this.findKeyframes(e);return t?ei(t.frame,t.left,t.right,e.LineType):null}vec3(e,t){const r=this.findKeyframes(t);return r?ti(e,r.frame,r.left,r.right,t.LineType):null}quat(e,t){const r=this.findKeyframes(t);return r?ri(e,r.frame,r.left,r.right,t.LineType):null}animVectorVal(e,t){let r;return typeof e=="number"?r=e:(r=this.num(e),r===null&&(r=t)),r}findKeyframes(e){if(!e)return null;const{frame:t,from:r,to:n}=this.findLocalFrame(e);return Jn(e,t,r,n)}findLocalFrame(e){return typeof e.GlobalSeqId=="number"?($e.frame=this.rendererData.globalSequencesFrames[e.GlobalSeqId],$e.from=0,$e.to=this.rendererData.model.GlobalSequences[e.GlobalSeqId]):($e.frame=this.rendererData.frame,$e.from=this.rendererData.animationInfo.Interval[0],$e.to=this.rendererData.animationInfo.Interval[1]),$e}},ni=`attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;
attribute vec4 aColor;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

varying vec2 vTextureCoord;
varying vec4 vColor;

void main(void) {
    vec4 position = vec4(aVertexPosition, 1.0);
    gl_Position = uPMatrix * uMVMatrix * position;
    vTextureCoord = aTextureCoord;
    vColor = aColor;
}
`,ii=`precision mediump float;

varying vec2 vTextureCoord;
varying vec4 vColor;

uniform sampler2D uSampler;
uniform vec3 uReplaceableColor;
uniform float uReplaceableType;
uniform float uDiscardAlphaLevel;

float hypot (vec2 z) {
    float t;
    float x = abs(z.x);
    float y = abs(z.y);
    t = min(x, y);
    x = max(x, y);
    t = t / x;
    return (z.x == 0.0 && z.y == 0.0) ? 0.0 : x * sqrt(1.0 + t * t);
}

void main(void) {
    vec2 coords = vec2(vTextureCoord.s, vTextureCoord.t);
    if (uReplaceableType == 0.) {
        gl_FragColor = texture2D(uSampler, coords);
    } else if (uReplaceableType == 1.) {
        gl_FragColor = vec4(uReplaceableColor, 1.0);
    } else if (uReplaceableType == 2.) {
        float dist = hypot(coords - vec2(0.5, 0.5)) * 2.;
        float truncateDist = clamp(1. - dist * 1.4, 0., 1.);
        float alpha = sin(truncateDist);
        gl_FragColor = vec4(uReplaceableColor * alpha, 1.0);
    }
    gl_FragColor *= vColor;

    if (gl_FragColor[3] < uDiscardAlphaLevel) {
        discard;
    }
}
`,si=`struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
}

struct FSUniforms {
    replaceableColor: vec3f,
    replaceableType: u32,
    discardAlphaLevel: f32,
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
@group(1) @binding(0) var<uniform> fsUniforms: FSUniforms;
@group(1) @binding(1) var fsUniformSampler: sampler;
@group(1) @binding(2) var fsUniformTexture: texture_2d<f32>;

struct VSIn {
    @location(0) vertexPosition: vec3f,
    @location(1) textureCoord: vec2f,
    @location(2) color: vec4f,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) textureCoord: vec2f,
    @location(1) color: vec4f,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var position: vec4f = vec4f(in.vertexPosition, 1.0);

    var out: VSOut;
    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * position;
    out.textureCoord = in.textureCoord;
    out.color = in.color;
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
    let texCoord: vec2f = in.textureCoord;
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

    color *= in.color;

    // hand-made alpha-test
    if (color.a < fsUniforms.discardAlphaLevel) {
        discard;
    }

    return color;
}
`,Hr=$(0,0,0),Ie=Rt(),Ge=Rt(),Tt=Rt(),ze=ee(),ae=ee(),Wr=.83,qr=.01,oi=class{constructor(e,t){if(this.shaderProgramLocations={vertexPositionAttribute:null,textureCoordAttribute:null,colorAttribute:null,pMatrixUniform:null,mvMatrixUniform:null,samplerUniform:null,replaceableColorUniform:null,replaceableTypeUniform:null,discardAlphaLevelUniform:null},this.particleStorage=[],this.interp=e,this.rendererData=t,this.emitters=[],t.model.ParticleEmitters2.length){this.particleBaseVectors=[ee(),ee(),ee(),ee()];for(let r=0;r<t.model.ParticleEmitters2.length;++r){const n=t.model.ParticleEmitters2[r],i={index:r,emission:0,squirtFrame:0,particles:[],props:n,capacity:0,baseCapacity:0,type:n.FrameFlags,tailVertices:null,tailVertexBuffer:null,tailVertexGPUBuffer:null,headVertices:null,headVertexBuffer:null,headVertexGPUBuffer:null,tailTexCoords:null,tailTexCoordBuffer:null,tailTexCoordGPUBuffer:null,headTexCoords:null,headTexCoordBuffer:null,headTexCoordGPUBuffer:null,colors:null,colorBuffer:null,colorGPUBuffer:null,indices:null,indexBuffer:null,indexGPUBuffer:null,fsUniformsBuffer:null};i.baseCapacity=Math.ceil(nr.maxAnimVectorVal(i.props.EmissionRate)*i.props.LifeSpan),this.emitters.push(i)}}}destroy(){this.shaderProgram&&(this.vertexShader&&(this.gl.detachShader(this.shaderProgram,this.vertexShader),this.gl.deleteShader(this.vertexShader),this.vertexShader=null),this.fragmentShader&&(this.gl.detachShader(this.shaderProgram,this.fragmentShader),this.gl.deleteShader(this.fragmentShader),this.fragmentShader=null),this.gl.deleteProgram(this.shaderProgram),this.shaderProgram=null),this.particleStorage=[],this.gpuVSUniformsBuffer&&(this.gpuVSUniformsBuffer.destroy(),this.gpuVSUniformsBuffer=null);for(const e of this.emitters)e.colorGPUBuffer&&e.colorGPUBuffer.destroy(),e.indexGPUBuffer&&e.indexGPUBuffer.destroy(),e.headVertexGPUBuffer&&e.headVertexGPUBuffer.destroy(),e.tailVertexGPUBuffer&&e.tailVertexGPUBuffer.destroy(),e.headTexCoordGPUBuffer&&e.headTexCoordGPUBuffer.destroy(),e.tailTexCoordGPUBuffer&&e.tailTexCoordGPUBuffer.destroy(),e.fsUniformsBuffer&&e.fsUniformsBuffer.destroy();this.emitters=[]}initGL(e){this.gl=e,this.initShaders()}initGPUDevice(e){this.device=e,this.gpuShaderModule=e.createShaderModule({label:"particles shader module",code:si}),this.vsBindGroupLayout=this.device.createBindGroupLayout({label:"particles vs bind group layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform",hasDynamicOffset:!1,minBindingSize:128}}]}),this.fsBindGroupLayout=this.device.createBindGroupLayout({label:"particles bind group layout2",entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform",hasDynamicOffset:!1,minBindingSize:32}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d",multisampled:!1}}]}),this.gpuPipelineLayout=this.device.createPipelineLayout({label:"particles pipeline layout",bindGroupLayouts:[this.vsBindGroupLayout,this.fsBindGroupLayout]});const t=(r,n,i)=>e.createRenderPipeline({label:`particles pipeline ${r}`,layout:this.gpuPipelineLayout,vertex:{module:this.gpuShaderModule,buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]},{arrayStride:8,attributes:[{shaderLocation:1,offset:0,format:"float32x2"}]},{arrayStride:16,attributes:[{shaderLocation:2,offset:0,format:"float32x4"}]}]},fragment:{module:this.gpuShaderModule,targets:[{format:navigator.gpu.getPreferredCanvasFormat(),blend:n}]},depthStencil:i});this.gpuPipelines=[t("blend",{color:{operation:"add",srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{operation:"add",srcFactor:"one",dstFactor:"one-minus-src-alpha"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}),t("additive",{color:{operation:"add",srcFactor:"src",dstFactor:"one"},alpha:{operation:"add",srcFactor:"src",dstFactor:"one"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}),t("modulate",{color:{operation:"add",srcFactor:"zero",dstFactor:"src"},alpha:{operation:"add",srcFactor:"zero",dstFactor:"one"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}),t("modulate2x",{color:{operation:"add",srcFactor:"dst",dstFactor:"src"},alpha:{operation:"add",srcFactor:"zero",dstFactor:"one"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}),t("alphaKey",{color:{operation:"add",srcFactor:"src-alpha",dstFactor:"one"},alpha:{operation:"add",srcFactor:"src-alpha",dstFactor:"one"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"})],this.gpuVSUniformsBuffer=this.device.createBuffer({label:"particles vs uniforms",size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.gpuVSUniformsBindGroup=this.device.createBindGroup({layout:this.vsBindGroupLayout,entries:[{binding:0,resource:{buffer:this.gpuVSUniformsBuffer}}]})}initShaders(){const e=this.vertexShader=Ce(this.gl,ni,this.gl.VERTEX_SHADER),t=this.fragmentShader=Ce(this.gl,ii,this.gl.FRAGMENT_SHADER),r=this.shaderProgram=this.gl.createProgram();this.gl.attachShader(r,e),this.gl.attachShader(r,t),this.gl.linkProgram(r),this.gl.getProgramParameter(r,this.gl.LINK_STATUS)||alert("Could not initialise shaders"),this.gl.useProgram(r),this.shaderProgramLocations.vertexPositionAttribute=this.gl.getAttribLocation(r,"aVertexPosition"),this.shaderProgramLocations.textureCoordAttribute=this.gl.getAttribLocation(r,"aTextureCoord"),this.shaderProgramLocations.colorAttribute=this.gl.getAttribLocation(r,"aColor"),this.shaderProgramLocations.pMatrixUniform=this.gl.getUniformLocation(r,"uPMatrix"),this.shaderProgramLocations.mvMatrixUniform=this.gl.getUniformLocation(r,"uMVMatrix"),this.shaderProgramLocations.samplerUniform=this.gl.getUniformLocation(r,"uSampler"),this.shaderProgramLocations.replaceableColorUniform=this.gl.getUniformLocation(r,"uReplaceableColor"),this.shaderProgramLocations.replaceableTypeUniform=this.gl.getUniformLocation(r,"uReplaceableType"),this.shaderProgramLocations.discardAlphaLevelUniform=this.gl.getUniformLocation(r,"uDiscardAlphaLevel")}updateParticle(e,t){t/=1e3,e.lifeSpan-=t,!(e.lifeSpan<=0)&&(e.speed[2]-=e.gravity*t,e.pos[0]+=e.speed[0]*t,e.pos[1]+=e.speed[1]*t,e.pos[2]+=e.speed[2]*t)}resizeEmitterBuffers(e,t){if(t<=e.capacity)return;t=Math.max(t,e.baseCapacity);let r,n,i,s;e.type&Q.Tail&&(r=new Float32Array(t*4*3),i=new Float32Array(t*4*2)),e.type&Q.Head&&(n=new Float32Array(t*4*3),s=new Float32Array(t*4*2));const o=new Float32Array(t*4*4),l=new Uint16Array(t*6);e.capacity&&l.set(e.indices);for(let h=e.capacity;h<t;++h)l[h*6]=h*4,l[h*6+1]=h*4+1,l[h*6+2]=h*4+2,l[h*6+3]=h*4+2,l[h*6+4]=h*4+1,l[h*6+5]=h*4+3;r&&(e.tailVertices=r,e.tailTexCoords=i),n&&(e.headVertices=n,e.headTexCoords=s),e.colors=o,e.indices=l,e.capacity=t,e.indexBuffer||(this.gl?(e.type&Q.Tail&&(e.tailVertexBuffer=this.gl.createBuffer(),e.tailTexCoordBuffer=this.gl.createBuffer()),e.type&Q.Head&&(e.headVertexBuffer=this.gl.createBuffer(),e.headTexCoordBuffer=this.gl.createBuffer()),e.colorBuffer=this.gl.createBuffer(),e.indexBuffer=this.gl.createBuffer()):this.device&&(e.type&Q.Tail&&(e.tailVertexGPUBuffer?.destroy(),e.tailVertexGPUBuffer=this.device.createBuffer({label:`particles tail vertex buffer ${e.index}`,size:r.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),e.tailTexCoordGPUBuffer?.destroy(),e.tailTexCoordGPUBuffer=this.device.createBuffer({label:`particles tail texCoords buffer ${e.index}`,size:i.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST})),e.type&Q.Head&&(e.headVertexGPUBuffer?.destroy(),e.headVertexGPUBuffer=this.device.createBuffer({label:`particles head vertex buffer ${e.index}`,size:n.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),e.headTexCoordGPUBuffer?.destroy(),e.headTexCoordGPUBuffer=this.device.createBuffer({label:`particles head texCoords buffer ${e.index}`,size:s.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST})),e.colorGPUBuffer?.destroy(),e.colorGPUBuffer=this.device.createBuffer({label:`particles color buffer ${e.index}`,size:o.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),e.indexGPUBuffer?.destroy(),e.indexGPUBuffer=this.device.createBuffer({label:`particles index buffer ${e.index}`,size:l.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST})))}update(e){for(const t of this.emitters)this.updateEmitter(t,e)}render(e,t){this.gl.enable(this.gl.CULL_FACE),this.gl.useProgram(this.shaderProgram),this.gl.uniformMatrix4fv(this.shaderProgramLocations.pMatrixUniform,!1,t),this.gl.uniformMatrix4fv(this.shaderProgramLocations.mvMatrixUniform,!1,e),this.gl.enableVertexAttribArray(this.shaderProgramLocations.vertexPositionAttribute),this.gl.enableVertexAttribArray(this.shaderProgramLocations.textureCoordAttribute),this.gl.enableVertexAttribArray(this.shaderProgramLocations.colorAttribute);for(const r of this.emitters)r.particles.length&&(this.setLayerProps(r),this.setGeneralBuffers(r),r.type&Q.Tail&&this.renderEmitterType(r,Q.Tail),r.type&Q.Head&&this.renderEmitterType(r,Q.Head));this.gl.disableVertexAttribArray(this.shaderProgramLocations.vertexPositionAttribute),this.gl.disableVertexAttribArray(this.shaderProgramLocations.textureCoordAttribute),this.gl.disableVertexAttribArray(this.shaderProgramLocations.colorAttribute)}renderGPUEmitterType(e,t,r){r===Q.Tail?(this.device.queue.writeBuffer(t.tailTexCoordGPUBuffer,0,t.tailTexCoords),e.setVertexBuffer(1,t.tailTexCoordGPUBuffer)):(this.device.queue.writeBuffer(t.headTexCoordGPUBuffer,0,t.headTexCoords),e.setVertexBuffer(1,t.headTexCoordGPUBuffer)),r===Q.Tail?(this.device.queue.writeBuffer(t.tailVertexGPUBuffer,0,t.tailVertices),e.setVertexBuffer(0,t.tailVertexGPUBuffer)):(this.device.queue.writeBuffer(t.headVertexGPUBuffer,0,t.headVertices),e.setVertexBuffer(0,t.headVertexGPUBuffer)),e.drawIndexed(t.particles.length*6)}renderGPU(e,t,r){const n=new ArrayBuffer(128),i={mvMatrix:new Float32Array(n,0,16),pMatrix:new Float32Array(n,64,16)};i.mvMatrix.set(t),i.pMatrix.set(r),this.device.queue.writeBuffer(this.gpuVSUniformsBuffer,0,n),e.setBindGroup(0,this.gpuVSUniformsBindGroup);for(const s of this.emitters){if(!s.particles.length)continue;const o=this.gpuPipelines[s.props.FilterMode]||this.gpuPipelines[0];e.setPipeline(o);const l=s.props.TextureID,h=this.rendererData.model.Textures[l],a=new ArrayBuffer(32),c={replaceableColor:new Float32Array(a,0,3),replaceableType:new Uint32Array(a,12,1),discardAlphaLevel:new Float32Array(a,16,1)};c.replaceableColor.set(this.rendererData.teamColor),c.replaceableType.set([h.ReplaceableId||0]),s.props.FilterMode===Me.AlphaKey?c.discardAlphaLevel.set([Wr]):s.props.FilterMode===Me.Modulate||s.props.FilterMode===Me.Modulate2x?c.discardAlphaLevel.set([qr]):c.discardAlphaLevel.set([0]),s.fsUniformsBuffer||(s.fsUniformsBuffer=this.device.createBuffer({label:`particles fs uniforms ${s.index}`,size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})),this.device.queue.writeBuffer(s.fsUniformsBuffer,0,a);const d=this.device.createBindGroup({label:`particles fs uniforms ${s.index}`,layout:this.fsBindGroupLayout,entries:[{binding:0,resource:{buffer:s.fsUniformsBuffer}},{binding:1,resource:this.rendererData.gpuSamplers[l]},{binding:2,resource:(this.rendererData.gpuTextures[h.Image]||this.rendererData.gpuEmptyTexture).createView()}]});e.setBindGroup(1,d),this.device.queue.writeBuffer(s.colorGPUBuffer,0,s.colors),this.device.queue.writeBuffer(s.indexGPUBuffer,0,s.indices),e.setVertexBuffer(2,s.colorGPUBuffer),e.setIndexBuffer(s.indexGPUBuffer,"uint16"),s.type&Q.Tail&&this.renderGPUEmitterType(e,s,Q.Tail),s.type&Q.Head&&this.renderGPUEmitterType(e,s,Q.Head)}}updateEmitter(e,t){if(this.interp.animVectorVal(e.props.Visibility,1)>0){if(e.props.Squirt&&typeof e.props.EmissionRate!="number"){const r=this.interp.findKeyframes(e.props.EmissionRate);r&&r.left&&r.left.Frame!==e.squirtFrame&&(e.squirtFrame=r.left.Frame,r.left.Vector[0]>0&&(e.emission+=r.left.Vector[0]*1e3))}else{const r=this.interp.animVectorVal(e.props.EmissionRate,0);e.emission+=r*t}for(;e.emission>=1e3;)e.emission-=1e3,e.particles.push(this.createParticle(e,this.rendererData.nodes[e.props.ObjectId].matrix))}if(e.particles.length){const r=[];for(const n of e.particles)this.updateParticle(n,t),n.lifeSpan>0?r.push(n):this.particleStorage.push(n);if(e.particles=r,e.type&Q.Head)if(e.props.Flags&Jt.XYQuad)be(this.particleBaseVectors[0],-1,1,0),be(this.particleBaseVectors[1],-1,-1,0),be(this.particleBaseVectors[2],1,1,0),be(this.particleBaseVectors[3],1,-1,0);else{be(this.particleBaseVectors[0],0,-1,1),be(this.particleBaseVectors[1],0,-1,-1),be(this.particleBaseVectors[2],0,1,1),be(this.particleBaseVectors[3],0,1,-1);for(let n=0;n<4;++n)Nr(this.particleBaseVectors[n],this.particleBaseVectors[n],this.rendererData.cameraQuat)}this.resizeEmitterBuffers(e,e.particles.length);for(let n=0;n<e.particles.length;++n)this.updateParticleBuffers(e.particles[n],n,e)}}createParticle(e,t){let r;this.particleStorage.length?r=this.particleStorage.pop():r={emitter:null,pos:ee(),angle:0,speed:ee(),gravity:null,lifeSpan:null};const n=this.interp.animVectorVal(e.props.Width,0),i=this.interp.animVectorVal(e.props.Length,0);let s=this.interp.animVectorVal(e.props.Speed,0);const o=this.interp.animVectorVal(e.props.Variation,0),l=Mn(this.interp.animVectorVal(e.props.Latitude,0));return r.emitter=e,r.pos[0]=e.props.PivotPoint[0]+mt(-n,n),r.pos[1]=e.props.PivotPoint[1]+mt(-i,i),r.pos[2]=e.props.PivotPoint[2],Ee(r.pos,r.pos,t),o>0&&(s*=1+mt(-o,o)),be(r.speed,0,0,s),r.angle=mt(0,Math.PI*2),In(r.speed,r.speed,Hr,mt(0,l)),Gn(r.speed,r.speed,Hr,r.angle),e.props.Flags&Jt.LineEmitter&&(r.speed[0]=0),Ee(r.speed,r.speed,t),r.speed[0]-=t[12],r.speed[1]-=t[13],r.speed[2]-=t[14],r.gravity=this.interp.animVectorVal(e.props.Gravity,0),r.lifeSpan=e.props.LifeSpan,r}updateParticleBuffers(e,t,r){const n=1-e.lifeSpan/r.props.LifeSpan,i=n<r.props.Time;let s;i?s=n/r.props.Time:s=(n-r.props.Time)/(1-r.props.Time),this.updateParticleVertices(e,t,r,i,s),this.updateParticleTexCoords(t,r,i,s),this.updateParticleColor(t,r,i,s)}updateParticleVertices(e,t,r,n,i){let s,o,l;if(n?(s=r.props.ParticleScaling[0],o=r.props.ParticleScaling[1]):(s=r.props.ParticleScaling[1],o=r.props.ParticleScaling[2]),l=rr(s,o,i),r.type&Q.Head){for(let h=0;h<4;++h)if(r.headVertices[t*12+h*3]=this.particleBaseVectors[h][0]*l,r.headVertices[t*12+h*3+1]=this.particleBaseVectors[h][1]*l,r.headVertices[t*12+h*3+2]=this.particleBaseVectors[h][2]*l,r.props.Flags&Jt.XYQuad){const a=r.headVertices[t*12+h*3],c=r.headVertices[t*12+h*3+1];r.headVertices[t*12+h*3]=a*Math.cos(e.angle)-c*Math.sin(e.angle),r.headVertices[t*12+h*3+1]=a*Math.sin(e.angle)+c*Math.cos(e.angle)}}r.type&Q.Tail&&(ze[0]=-e.speed[0]*r.props.TailLength,ze[1]=-e.speed[1]*r.props.TailLength,ze[2]=-e.speed[2]*r.props.TailLength,it(ae,e.speed,this.rendererData.cameraPos),tr(ae,ae),Or(ae,ae,l),r.tailVertices[t*12]=ae[0],r.tailVertices[t*12+1]=ae[1],r.tailVertices[t*12+2]=ae[2],r.tailVertices[t*12+3]=-ae[0],r.tailVertices[t*12+3+1]=-ae[1],r.tailVertices[t*12+3+2]=-ae[2],r.tailVertices[t*12+6]=ae[0]+ze[0],r.tailVertices[t*12+6+1]=ae[1]+ze[1],r.tailVertices[t*12+6+2]=ae[2]+ze[2],r.tailVertices[t*12+9]=-ae[0]+ze[0],r.tailVertices[t*12+9+1]=-ae[1]+ze[1],r.tailVertices[t*12+9+2]=-ae[2]+ze[2]);for(let h=0;h<4;++h)r.headVertices&&(r.headVertices[t*12+h*3]+=e.pos[0],r.headVertices[t*12+h*3+1]+=e.pos[1],r.headVertices[t*12+h*3+2]+=e.pos[2]),r.tailVertices&&(r.tailVertices[t*12+h*3]+=e.pos[0],r.tailVertices[t*12+h*3+1]+=e.pos[1],r.tailVertices[t*12+h*3+2]+=e.pos[2])}updateParticleTexCoords(e,t,r,n){t.type&Q.Head&&this.updateParticleTexCoordsByType(e,t,r,n,Q.Head),t.type&Q.Tail&&this.updateParticleTexCoordsByType(e,t,r,n,Q.Tail)}updateParticleTexCoordsByType(e,t,r,n,i){let s,o;i===Q.Tail?(s=r?t.props.TailUVAnim:t.props.TailDecayUVAnim,o=t.tailTexCoords):(s=r?t.props.LifeSpanUVAnim:t.props.DecayUVAnim,o=t.headTexCoords);const l=s[0],h=s[1],a=Math.round(rr(l,h,n)),c=a%t.props.Columns,d=Math.floor(a/t.props.Rows),p=1/t.props.Columns,f=1/t.props.Rows;o[e*8]=c*p,o[e*8+1]=d*f,o[e*8+2]=c*p,o[e*8+3]=(1+d)*f,o[e*8+4]=(1+c)*p,o[e*8+5]=d*f,o[e*8+6]=(1+c)*p,o[e*8+7]=(1+d)*f}updateParticleColor(e,t,r,n){r?(Ie[0]=t.props.SegmentColor[0][0],Ie[1]=t.props.SegmentColor[0][1],Ie[2]=t.props.SegmentColor[0][2],Ie[3]=t.props.Alpha[0]/255,Ge[0]=t.props.SegmentColor[1][0],Ge[1]=t.props.SegmentColor[1][1],Ge[2]=t.props.SegmentColor[1][2],Ge[3]=t.props.Alpha[1]/255):(Ie[0]=t.props.SegmentColor[1][0],Ie[1]=t.props.SegmentColor[1][1],Ie[2]=t.props.SegmentColor[1][2],Ie[3]=t.props.Alpha[1]/255,Ge[0]=t.props.SegmentColor[2][0],Ge[1]=t.props.SegmentColor[2][1],Ge[2]=t.props.SegmentColor[2][2],Ge[3]=t.props.Alpha[2]/255),Xn(Tt,Ie,Ge,n);for(let i=0;i<4;++i)t.colors[e*16+i*4]=Tt[0],t.colors[e*16+i*4+1]=Tt[1],t.colors[e*16+i*4+2]=Tt[2],t.colors[e*16+i*4+3]=Tt[3]}setLayerProps(e){e.props.FilterMode===Me.AlphaKey?this.gl.uniform1f(this.shaderProgramLocations.discardAlphaLevelUniform,Wr):e.props.FilterMode===Me.Modulate||e.props.FilterMode===Me.Modulate2x?this.gl.uniform1f(this.shaderProgramLocations.discardAlphaLevelUniform,qr):this.gl.uniform1f(this.shaderProgramLocations.discardAlphaLevelUniform,0),e.props.FilterMode===Me.Blend?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA,this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA),this.gl.depthMask(!1)):e.props.FilterMode===Me.Additive?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE),this.gl.depthMask(!1)):e.props.FilterMode===Me.AlphaKey?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE),this.gl.depthMask(!1)):e.props.FilterMode===Me.Modulate?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.ZERO,this.gl.SRC_COLOR,this.gl.ZERO,this.gl.ONE),this.gl.depthMask(!1)):e.props.FilterMode===Me.Modulate2x&&(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.DST_COLOR,this.gl.SRC_COLOR,this.gl.ZERO,this.gl.ONE),this.gl.depthMask(!1));const t=this.rendererData.model.Textures[e.props.TextureID];t.Image?(this.gl.activeTexture(this.gl.TEXTURE0),this.gl.bindTexture(this.gl.TEXTURE_2D,this.rendererData.textures[t.Image]),this.gl.uniform1i(this.shaderProgramLocations.samplerUniform,0),this.gl.uniform1f(this.shaderProgramLocations.replaceableTypeUniform,0)):(t.ReplaceableId===1||t.ReplaceableId===2)&&(this.gl.uniform3fv(this.shaderProgramLocations.replaceableColorUniform,this.rendererData.teamColor),this.gl.uniform1f(this.shaderProgramLocations.replaceableTypeUniform,t.ReplaceableId))}setGeneralBuffers(e){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,e.colorBuffer),this.gl.bufferData(this.gl.ARRAY_BUFFER,e.colors,this.gl.DYNAMIC_DRAW),this.gl.vertexAttribPointer(this.shaderProgramLocations.colorAttribute,4,this.gl.FLOAT,!1,0,0),this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,e.indexBuffer),this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER,e.indices,this.gl.DYNAMIC_DRAW)}renderEmitterType(e,t){t===Q.Tail?(this.gl.bindBuffer(this.gl.ARRAY_BUFFER,e.tailTexCoordBuffer),this.gl.bufferData(this.gl.ARRAY_BUFFER,e.tailTexCoords,this.gl.DYNAMIC_DRAW)):(this.gl.bindBuffer(this.gl.ARRAY_BUFFER,e.headTexCoordBuffer),this.gl.bufferData(this.gl.ARRAY_BUFFER,e.headTexCoords,this.gl.DYNAMIC_DRAW)),this.gl.vertexAttribPointer(this.shaderProgramLocations.textureCoordAttribute,2,this.gl.FLOAT,!1,0,0),t===Q.Tail?(this.gl.bindBuffer(this.gl.ARRAY_BUFFER,e.tailVertexBuffer),this.gl.bufferData(this.gl.ARRAY_BUFFER,e.tailVertices,this.gl.DYNAMIC_DRAW)):(this.gl.bindBuffer(this.gl.ARRAY_BUFFER,e.headVertexBuffer),this.gl.bufferData(this.gl.ARRAY_BUFFER,e.headVertices,this.gl.DYNAMIC_DRAW)),this.gl.vertexAttribPointer(this.shaderProgramLocations.vertexPositionAttribute,3,this.gl.FLOAT,!1,0,0),this.gl.drawElements(this.gl.TRIANGLES,e.particles.length*6,this.gl.UNSIGNED_SHORT,0)}},ai=`attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

varying vec2 vTextureCoord;

void main(void) {
    vec4 position = vec4(aVertexPosition, 1.0);
    gl_Position = uPMatrix * uMVMatrix * position;
    vTextureCoord = aTextureCoord;
}
`,li=`precision mediump float;

varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform vec3 uReplaceableColor;
uniform float uReplaceableType;
uniform float uDiscardAlphaLevel;
uniform vec4 uColor;

float hypot (vec2 z) {
    float t;
    float x = abs(z.x);
    float y = abs(z.y);
    t = min(x, y);
    x = max(x, y);
    t = t / x;
    return (z.x == 0.0 && z.y == 0.0) ? 0.0 : x * sqrt(1.0 + t * t);
}

void main(void) {
    vec2 coords = vec2(vTextureCoord.s, vTextureCoord.t);
    if (uReplaceableType == 0.) {
        gl_FragColor = texture2D(uSampler, coords);
    } else if (uReplaceableType == 1.) {
        gl_FragColor = vec4(uReplaceableColor, 1.0);
    } else if (uReplaceableType == 2.) {
        float dist = hypot(coords - vec2(0.5, 0.5)) * 2.;
        float truncateDist = clamp(1. - dist * 1.4, 0., 1.);
        float alpha = sin(truncateDist);
        gl_FragColor = vec4(uReplaceableColor * alpha, 1.0);
    }
    gl_FragColor *= uColor;

    if (gl_FragColor[3] < uDiscardAlphaLevel) {
        discard;
    }
}
`,hi=`struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
}

struct FSUniforms {
    replaceableColor: vec3f,
    replaceableType: u32,
    discardAlphaLevel: f32,
    color: vec4f,
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
@group(1) @binding(0) var<uniform> fsUniforms: FSUniforms;
@group(1) @binding(1) var fsUniformSampler: sampler;
@group(1) @binding(2) var fsUniformTexture: texture_2d<f32>;

struct VSIn {
    @location(0) vertexPosition: vec3f,
    @location(1) textureCoord: vec2f,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) textureCoord: vec2f,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var position: vec4f = vec4f(in.vertexPosition, 1.0);

    var out: VSOut;
    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * position;
    out.textureCoord = in.textureCoord;
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
    let texCoord: vec2f = in.textureCoord;
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

    color *= fsUniforms.color;

    // hand-made alpha-test
    if (color.a < fsUniforms.discardAlphaLevel) {
        discard;
    }

    return color;
}
`,ci=class{constructor(e,t){if(this.shaderProgramLocations={vertexPositionAttribute:null,textureCoordAttribute:null,pMatrixUniform:null,mvMatrixUniform:null,samplerUniform:null,replaceableColorUniform:null,replaceableTypeUniform:null,discardAlphaLevelUniform:null,colorUniform:null},this.interp=e,this.rendererData=t,this.emitters=[],t.model.RibbonEmitters.length)for(let r=0;r<t.model.RibbonEmitters.length;++r){const n=t.model.RibbonEmitters[r],i={index:r,emission:0,props:n,capacity:0,baseCapacity:0,creationTimes:[],vertices:null,vertexBuffer:null,vertexGPUBuffer:null,texCoords:null,texCoordBuffer:null,texCoordGPUBuffer:null,fsUnifrmsPerLayer:[]};i.baseCapacity=Math.ceil(nr.maxAnimVectorVal(i.props.EmissionRate)*i.props.LifeSpan)+1,this.emitters.push(i)}}destroy(){this.shaderProgram&&(this.vertexShader&&(this.gl.detachShader(this.shaderProgram,this.vertexShader),this.gl.deleteShader(this.vertexShader),this.vertexShader=null),this.fragmentShader&&(this.gl.detachShader(this.shaderProgram,this.fragmentShader),this.gl.deleteShader(this.fragmentShader),this.fragmentShader=null),this.gl.deleteProgram(this.shaderProgram),this.shaderProgram=null),this.gpuVSUniformsBuffer&&(this.gpuVSUniformsBuffer.destroy(),this.gpuVSUniformsBuffer=null);for(const e of this.emitters)for(const t of e.fsUnifrmsPerLayer)t.destroy();this.emitters=[]}initGL(e){this.gl=e,this.initShaders()}initGPUDevice(e){this.device=e,this.gpuShaderModule=e.createShaderModule({label:"ribbons shader module",code:hi}),this.vsBindGroupLayout=this.device.createBindGroupLayout({label:"ribbons vs bind group layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform",hasDynamicOffset:!1,minBindingSize:128}}]}),this.fsBindGroupLayout=this.device.createBindGroupLayout({label:"ribbons bind group layout2",entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform",hasDynamicOffset:!1,minBindingSize:48}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d",multisampled:!1}}]}),this.gpuPipelineLayout=this.device.createPipelineLayout({label:"ribbons pipeline layout",bindGroupLayouts:[this.vsBindGroupLayout,this.fsBindGroupLayout]});const t=(r,n,i)=>e.createRenderPipeline({label:`ribbons pipeline ${r}`,layout:this.gpuPipelineLayout,vertex:{module:this.gpuShaderModule,buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]},{arrayStride:8,attributes:[{shaderLocation:1,offset:0,format:"float32x2"}]}]},fragment:{module:this.gpuShaderModule,targets:[{format:navigator.gpu.getPreferredCanvasFormat(),blend:n}]},depthStencil:i,primitive:{topology:"triangle-strip"}});this.gpuPipelines=[t("none",{color:{operation:"add",srcFactor:"one",dstFactor:"zero"},alpha:{operation:"add",srcFactor:"one",dstFactor:"zero"}},{depthWriteEnabled:!0,depthCompare:"less-equal",format:"depth24plus"}),t("transparent",{color:{operation:"add",srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{operation:"add",srcFactor:"one",dstFactor:"one-minus-src-alpha"}},{depthWriteEnabled:!0,depthCompare:"less-equal",format:"depth24plus"}),t("blend",{color:{operation:"add",srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{operation:"add",srcFactor:"one",dstFactor:"one-minus-src-alpha"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}),t("additive",{color:{operation:"add",srcFactor:"src",dstFactor:"one"},alpha:{operation:"add",srcFactor:"src",dstFactor:"one"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}),t("addAlpha",{color:{operation:"add",srcFactor:"src-alpha",dstFactor:"one"},alpha:{operation:"add",srcFactor:"src-alpha",dstFactor:"one"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}),t("modulate",{color:{operation:"add",srcFactor:"zero",dstFactor:"src"},alpha:{operation:"add",srcFactor:"zero",dstFactor:"one"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}),t("modulate2x",{color:{operation:"add",srcFactor:"dst",dstFactor:"src"},alpha:{operation:"add",srcFactor:"zero",dstFactor:"one"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"})],this.gpuVSUniformsBuffer=this.device.createBuffer({label:"ribbons vs uniforms",size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.gpuVSUniformsBindGroup=this.device.createBindGroup({layout:this.vsBindGroupLayout,entries:[{binding:0,resource:{buffer:this.gpuVSUniformsBuffer}}]})}update(e){for(const t of this.emitters)this.updateEmitter(t,e)}render(e,t){this.gl.useProgram(this.shaderProgram),this.gl.uniformMatrix4fv(this.shaderProgramLocations.pMatrixUniform,!1,t),this.gl.uniformMatrix4fv(this.shaderProgramLocations.mvMatrixUniform,!1,e),this.gl.enableVertexAttribArray(this.shaderProgramLocations.vertexPositionAttribute),this.gl.enableVertexAttribArray(this.shaderProgramLocations.textureCoordAttribute);for(const r of this.emitters){if(r.creationTimes.length<2)continue;this.gl.uniform4f(this.shaderProgramLocations.colorUniform,r.props.Color[0],r.props.Color[1],r.props.Color[2],this.interp.animVectorVal(r.props.Alpha,1)),this.setGeneralBuffers(r);const n=r.props.MaterialID,i=this.rendererData.model.Materials[n];for(let s=0;s<i.Layers.length;++s)this.setLayerProps(i.Layers[s],this.rendererData.materialLayerTextureID[n][s]),this.renderEmitter(r)}this.gl.disableVertexAttribArray(this.shaderProgramLocations.vertexPositionAttribute),this.gl.disableVertexAttribArray(this.shaderProgramLocations.textureCoordAttribute)}renderGPU(e,t,r){const n=new ArrayBuffer(128),i={mvMatrix:new Float32Array(n,0,16),pMatrix:new Float32Array(n,64,16)};i.mvMatrix.set(t),i.pMatrix.set(r),this.device.queue.writeBuffer(this.gpuVSUniformsBuffer,0,n);for(const s of this.emitters){if(s.creationTimes.length<2)continue;this.device.queue.writeBuffer(s.vertexGPUBuffer,0,s.vertices),this.device.queue.writeBuffer(s.texCoordGPUBuffer,0,s.texCoords),e.setVertexBuffer(0,s.vertexGPUBuffer),e.setVertexBuffer(1,s.texCoordGPUBuffer),e.setBindGroup(0,this.gpuVSUniformsBindGroup);const o=s.props.MaterialID,l=this.rendererData.model.Materials[o];for(let h=0;h<l.Layers.length;++h){const a=this.rendererData.materialLayerTextureID[o][h],c=this.rendererData.model.Textures[a],d=l.Layers[h],p=this.gpuPipelines[d.FilterMode]||this.gpuPipelines[0];e.setPipeline(p);const f=new ArrayBuffer(48),u={replaceableColor:new Float32Array(f,0,3),replaceableType:new Uint32Array(f,12,1),discardAlphaLevel:new Float32Array(f,16,1),color:new Float32Array(f,32,4)};u.replaceableColor.set(this.rendererData.teamColor),u.replaceableType.set([c.ReplaceableId||0]),u.discardAlphaLevel.set([d.FilterMode===Z.Transparent?.75:0]),u.color.set([s.props.Color[0],s.props.Color[1],s.props.Color[2],this.interp.animVectorVal(s.props.Alpha,1)]),s.fsUnifrmsPerLayer[h]||(s.fsUnifrmsPerLayer[h]=this.device.createBuffer({label:`ribbons fs uniforms ${s.index} layer ${h}`,size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}));const g=s.fsUnifrmsPerLayer[h];this.device.queue.writeBuffer(g,0,f);const v=this.device.createBindGroup({label:`ribbons fs uniforms ${s.index}`,layout:this.fsBindGroupLayout,entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:this.rendererData.gpuSamplers[a]},{binding:2,resource:(this.rendererData.gpuTextures[c.Image]||this.rendererData.gpuEmptyTexture).createView()}]});e.setBindGroup(1,v),e.draw(s.creationTimes.length*2)}}}initShaders(){const e=this.vertexShader=Ce(this.gl,ai,this.gl.VERTEX_SHADER),t=this.fragmentShader=Ce(this.gl,li,this.gl.FRAGMENT_SHADER),r=this.shaderProgram=this.gl.createProgram();this.gl.attachShader(r,e),this.gl.attachShader(r,t),this.gl.linkProgram(r),this.gl.getProgramParameter(r,this.gl.LINK_STATUS)||alert("Could not initialise shaders"),this.gl.useProgram(r),this.shaderProgramLocations.vertexPositionAttribute=this.gl.getAttribLocation(r,"aVertexPosition"),this.shaderProgramLocations.textureCoordAttribute=this.gl.getAttribLocation(r,"aTextureCoord"),this.shaderProgramLocations.pMatrixUniform=this.gl.getUniformLocation(r,"uPMatrix"),this.shaderProgramLocations.mvMatrixUniform=this.gl.getUniformLocation(r,"uMVMatrix"),this.shaderProgramLocations.samplerUniform=this.gl.getUniformLocation(r,"uSampler"),this.shaderProgramLocations.replaceableColorUniform=this.gl.getUniformLocation(r,"uReplaceableColor"),this.shaderProgramLocations.replaceableTypeUniform=this.gl.getUniformLocation(r,"uReplaceableType"),this.shaderProgramLocations.discardAlphaLevelUniform=this.gl.getUniformLocation(r,"uDiscardAlphaLevel"),this.shaderProgramLocations.colorUniform=this.gl.getUniformLocation(r,"uColor")}resizeEmitterBuffers(e,t){if(t<=e.capacity)return;t=Math.min(t,e.baseCapacity);const r=new Float32Array(t*2*3),n=new Float32Array(t*2*2);e.vertices&&r.set(e.vertices),e.vertices=r,e.texCoords=n,e.capacity=t,this.gl?e.vertexBuffer||(e.vertexBuffer=this.gl.createBuffer(),e.texCoordBuffer=this.gl.createBuffer()):this.device&&(e.vertexGPUBuffer?.destroy(),e.texCoordGPUBuffer?.destroy(),e.vertexGPUBuffer=this.device.createBuffer({label:`ribbon vertex buffer ${e.index}`,size:r.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),e.texCoordGPUBuffer=this.device.createBuffer({label:`ribbon texCoord buffer ${e.index}`,size:n.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}))}updateEmitter(e,t){const r=Date.now();if(this.interp.animVectorVal(e.props.Visibility,0)>0){const n=e.props.EmissionRate;e.emission+=n*t,e.emission>=1e3&&(e.emission=e.emission%1e3,e.creationTimes.length+1>e.capacity&&this.resizeEmitterBuffers(e,e.creationTimes.length+1),this.appendVertices(e),e.creationTimes.push(r))}if(e.creationTimes.length)for(;e.creationTimes[0]+e.props.LifeSpan*1e3<r;){e.creationTimes.shift();for(let n=0;n+6+5<e.vertices.length;n+=6)e.vertices[n]=e.vertices[n+6],e.vertices[n+1]=e.vertices[n+7],e.vertices[n+2]=e.vertices[n+8],e.vertices[n+3]=e.vertices[n+9],e.vertices[n+4]=e.vertices[n+10],e.vertices[n+5]=e.vertices[n+11]}e.creationTimes.length&&this.updateEmitterTexCoords(e,r)}appendVertices(e){const t=Gr(e.props.PivotPoint),r=Gr(e.props.PivotPoint);t[1]-=this.interp.animVectorVal(e.props.HeightBelow,0),r[1]+=this.interp.animVectorVal(e.props.HeightAbove,0);const n=this.rendererData.nodes[e.props.ObjectId].matrix;Ee(t,t,n),Ee(r,r,n);const i=e.creationTimes.length;e.vertices[i*6]=t[0],e.vertices[i*6+1]=t[1],e.vertices[i*6+2]=t[2],e.vertices[i*6+3]=r[0],e.vertices[i*6+4]=r[1],e.vertices[i*6+5]=r[2]}updateEmitterTexCoords(e,t){for(let r=0;r<e.creationTimes.length;++r){let n=(t-e.creationTimes[r])/(e.props.LifeSpan*1e3);const i=this.interp.animVectorVal(e.props.TextureSlot,0),s=i%e.props.Columns,o=Math.floor(i/e.props.Rows),l=1/e.props.Columns,h=1/e.props.Rows;n=s*l+n*l,e.texCoords[r*2*2]=n,e.texCoords[r*2*2+1]=o*h,e.texCoords[r*2*2+2]=n,e.texCoords[r*2*2+3]=(1+o)*h}}setLayerProps(e,t){const r=this.rendererData.model.Textures[t];e.Shading&_e.TwoSided?this.gl.disable(this.gl.CULL_FACE):this.gl.enable(this.gl.CULL_FACE),e.FilterMode===Z.Transparent?this.gl.uniform1f(this.shaderProgramLocations.discardAlphaLevelUniform,.75):this.gl.uniform1f(this.shaderProgramLocations.discardAlphaLevelUniform,0),e.FilterMode===Z.None?(this.gl.disable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.depthMask(!0)):e.FilterMode===Z.Transparent?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA,this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA),this.gl.depthMask(!0)):e.FilterMode===Z.Blend?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA,this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA),this.gl.depthMask(!1)):e.FilterMode===Z.Additive?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFunc(this.gl.SRC_COLOR,this.gl.ONE),this.gl.depthMask(!1)):e.FilterMode===Z.AddAlpha?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE),this.gl.depthMask(!1)):e.FilterMode===Z.Modulate?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.ZERO,this.gl.SRC_COLOR,this.gl.ZERO,this.gl.ONE),this.gl.depthMask(!1)):e.FilterMode===Z.Modulate2x&&(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.DST_COLOR,this.gl.SRC_COLOR,this.gl.ZERO,this.gl.ONE),this.gl.depthMask(!1)),r.Image?(this.gl.activeTexture(this.gl.TEXTURE0),this.gl.bindTexture(this.gl.TEXTURE_2D,this.rendererData.textures[r.Image]),this.gl.uniform1i(this.shaderProgramLocations.samplerUniform,0),this.gl.uniform1f(this.shaderProgramLocations.replaceableTypeUniform,0)):(r.ReplaceableId===1||r.ReplaceableId===2)&&(this.gl.uniform3fv(this.shaderProgramLocations.replaceableColorUniform,this.rendererData.teamColor),this.gl.uniform1f(this.shaderProgramLocations.replaceableTypeUniform,r.ReplaceableId)),e.Shading&_e.NoDepthTest&&this.gl.disable(this.gl.DEPTH_TEST),e.Shading&_e.NoDepthSet&&this.gl.depthMask(!1)}setGeneralBuffers(e){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,e.texCoordBuffer),this.gl.bufferData(this.gl.ARRAY_BUFFER,e.texCoords,this.gl.DYNAMIC_DRAW),this.gl.vertexAttribPointer(this.shaderProgramLocations.textureCoordAttribute,2,this.gl.FLOAT,!1,0,0),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,e.vertexBuffer),this.gl.bufferData(this.gl.ARRAY_BUFFER,e.vertices,this.gl.DYNAMIC_DRAW),this.gl.vertexAttribPointer(this.shaderProgramLocations.vertexPositionAttribute,3,this.gl.FLOAT,!1,0,0)}renderEmitter(e){this.gl.drawArrays(this.gl.TRIANGLE_STRIP,0,e.creationTimes.length*2)}},fi=`attribute vec3 aVertexPosition;
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
}`,ui=`attribute vec3 aVertexPosition;
attribute vec3 aNormal;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

varying vec3 vNormal;
varying vec2 vTextureCoord;

void main(void) {
    vec4 position = vec4(aVertexPosition, 1.0);
    gl_Position = uPMatrix * uMVMatrix * position;
    vTextureCoord = aTextureCoord;
    vNormal = aNormal;
}`,di=`precision mediump float;

varying vec3 vNormal;
varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform vec3 uReplaceableColor;
uniform float uReplaceableType;
uniform float uDiscardAlphaLevel;
uniform mat3 uTVertexAnim;
uniform float uWireframe;

float hypot (vec2 z) {
    float t;
    float x = abs(z.x);
    float y = abs(z.y);
    t = min(x, y);
    x = max(x, y);
    t = t / x;
    return (z.x == 0.0 && z.y == 0.0) ? 0.0 : x * sqrt(1.0 + t * t);
}

void main(void) {
    if (uWireframe > 0.) {
        gl_FragColor = vec4(1.);
        return;
    }

    vec2 texCoord = (uTVertexAnim * vec3(vTextureCoord.s, vTextureCoord.t, 1.)).st;

    if (uReplaceableType == 0.) {
        gl_FragColor = texture2D(uSampler, texCoord);
    } else if (uReplaceableType == 1.) {
        gl_FragColor = vec4(uReplaceableColor, 1.0);
    } else if (uReplaceableType == 2.) {
        float dist = hypot(texCoord - vec2(0.5, 0.5)) * 2.;
        float truncateDist = clamp(1. - dist * 1.4, 0., 1.);
        float alpha = sin(truncateDist);
        gl_FragColor = vec4(uReplaceableColor * alpha, 1.0);
    }

    // hand-made alpha-test
    if (gl_FragColor[3] < uDiscardAlphaLevel) {
        discard;
    }
}
`,pi=`attribute vec3 aVertexPosition;
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
}`,gi=`#version 300 es
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
}`,mi=`precision mediump float;

varying vec2 vTextureCoord;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBinormal;
varying mat3 vTBN;
varying vec3 vFragPos;

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
uniform float uWireframe;

const float PI = 3.14159265359;
const float gamma = 2.2;

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

void main(void) {
    if (uWireframe > 0.) {
        gl_FragColor = vec4(1.);
        return;
    }

    vec2 texCoord = (uTVertexAnim * vec3(vTextureCoord.s, vTextureCoord.t, 1.)).st;

    vec4 orm = texture2D(uOrmSampler, texCoord);

    float occlusion = orm.r;
    float roughness = orm.g;
    float metallic = orm.b;
    float teamColorFactor = orm.a;

    vec4 baseColor = texture2D(uSampler, texCoord);
    vec3 teamColor = baseColor.rgb * uReplaceableColor;
    baseColor.rgb = mix(baseColor.rgb, teamColor, teamColorFactor);
    baseColor.rgb = pow(baseColor.rgb, vec3(gamma));

    vec3 normal = texture2D(uNormalSampler, texCoord).rgb;
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
    // vec3 kD = vec3(1.) - kS;
    vec3 kD = vec3(1.);
    // kD *= 1.0 - metallic;
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

        float lightDepth = texture2D(uShadowMapSampler, shadowMapCoord.xy).r;
        float lightDepth0 = texture2D(uShadowMapSampler, vec2(shadowMapCoord.x + shadowStep, shadowMapCoord.y)).r;
        float lightDepth1 = texture2D(uShadowMapSampler, vec2(shadowMapCoord.x, shadowMapCoord.y + shadowStep)).r;
        float lightDepth2 = texture2D(uShadowMapSampler, vec2(shadowMapCoord.x, shadowMapCoord.y - shadowStep)).r;
        float lightDepth3 = texture2D(uShadowMapSampler, vec2(shadowMapCoord.x - shadowStep, shadowMapCoord.y)).r;
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

    vec3 ambient = vec3(.03);
    ambient *= baseColor.rgb * occlusion;
    color = ambient + totalLight;

    color = color / (vec3(1.) + color);
    color = pow(color, vec3(1. / gamma));

    gl_FragColor = vec4(color, 1.);

    // hand-made alpha-test
    if (gl_FragColor[3] < uDiscardAlphaLevel) {
        discard;
    }
}
`,vi=`#version 300 es
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
`,xi=`attribute vec3 aVertexPosition;
attribute vec3 aColor;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

varying vec3 vColor;

void main(void) {
    vec4 position = vec4(aVertexPosition, 1.0);
    gl_Position = uPMatrix * uMVMatrix * position;
    vColor = aColor;
}`,bi=`precision mediump float;

varying vec3 vColor;

void main(void) {
    gl_FragColor = vec4(vColor, 1.0);
}`,yi=`attribute vec3 aPos;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

varying vec3 vLocalPos;

void main(void) {
    vLocalPos = aPos;
    gl_Position = uPMatrix * uMVMatrix * vec4(aPos, 1.0);
}`,Ti=`precision mediump float;

varying vec3 vLocalPos;

uniform sampler2D uEquirectangularMap;

const vec2 invAtan = vec2(0.1591, 0.3183);

vec2 SampleSphericalMap(vec3 v) {
    // vec2 uv = vec2(atan(v.z, v.x), asin(v.y));
    vec2 uv = vec2(atan(v.x, v.y), asin(-v.z));
    uv *= invAtan;
    uv += 0.5;
    return uv;
}

void main(void) {
    vec2 uv = SampleSphericalMap(normalize(vLocalPos)); // make sure to normalize localPos
    vec3 color = texture2D(uEquirectangularMap, uv).rgb;

    gl_FragColor = vec4(color, 1.0);
}`,Si=`#version 300 es

in vec3 aPos;
out vec3 vLocalPos;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

void main(void) {
    vLocalPos = aPos;
    mat4 rotView = mat4(mat3(uMVMatrix)); // remove translation from the view matrix
    vec4 clipPos = uPMatrix * rotView * 1000. * vec4(aPos, 1.0);

    gl_Position = clipPos.xyww;
}`,Pi=`#version 300 es
precision mediump float;

in vec3 vLocalPos;

out vec4 FragColor;

uniform samplerCube uEnvironmentMap;

void main(void) {
    // vec3 envColor = textureLod(uEnvironmentMap, vLocalPos, 0.0).rgb;
    vec3 envColor = texture(uEnvironmentMap, vLocalPos).rgb;

    FragColor = vec4(envColor, 1.0);
}`,Mi=`attribute vec3 aPos;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

varying vec3 vLocalPos;

void main(void) {
    vLocalPos = aPos;
    gl_Position = uPMatrix * uMVMatrix * vec4(aPos, 1.0);
}`,Ei=`precision mediump float;

varying vec3 vLocalPos;

uniform samplerCube uEnvironmentMap;

const float PI = 3.14159265359;
const float gamma = 2.2;

void main(void) {
    vec3 irradiance = vec3(0.0);

    // the sample direction equals the hemisphere's orientation
    vec3 normal = normalize(vLocalPos);

    vec3 up    = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(up, normal));
    up         = normalize(cross(normal, right));

    const float sampleDelta = 0.025;
    float nrSamples = 0.0;
    for(float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta)
    {
        for(float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta)
        {
            // spherical to cartesian (in tangent space)
            vec3 tangentSample = vec3(sin(theta) * cos(phi),  sin(theta) * sin(phi), cos(theta));
            // tangent space to world
            vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * normal;

            irradiance += pow(textureCube(uEnvironmentMap, sampleVec).rgb, vec3(gamma)) * cos(theta) * sin(theta);
            nrSamples++;
        }
    }
    irradiance = PI * irradiance * (1.0 / float(nrSamples));

    gl_FragColor = vec4(irradiance, 1.0);
}`,Ai=`#version 300 es

in vec3 aPos;

out vec3 vLocalPos;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

void main(void) {
    vLocalPos = aPos;
    gl_Position = uPMatrix * uMVMatrix * vec4(aPos, 1.0);
}`,Ui=`#version 300 es
precision mediump float;

out vec4 FragColor;

in vec3 vLocalPos;

uniform samplerCube uEnvironmentMap;
uniform float uRoughness;

const float PI = 3.14159265359;
const float gamma = 2.2;

float RadicalInverse_VdC(uint bits) {
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}

vec2 Hammersley(uint i, uint N) {
    return vec2(float(i)/float(N), RadicalInverse_VdC(i));
}

vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
    float a = roughness * roughness;

    float phi = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta*cosTheta);

    // from spherical coordinates to cartesian coordinates
    vec3 H;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;

    // from tangent-space vector to world-space sample vector
    vec3 up        = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent   = normalize(cross(up, N));
    vec3 bitangent = cross(N, tangent);

    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;

    return normalize(sampleVec);
}

void main() {
    vec3 N = normalize(vLocalPos);
    vec3 R = N;
    vec3 V = R;

    const uint SAMPLE_COUNT = 1024u;
    float totalWeight = 0.0;
    vec3 prefilteredColor = vec3(0.0);
    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H  = ImportanceSampleGGX(Xi, N, uRoughness);
        vec3 L  = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);
        if(NdotL > 0.0) {
            prefilteredColor += pow(texture(uEnvironmentMap, L).rgb, vec3(gamma)) * NdotL;
            totalWeight      += NdotL;
        }
    }
    prefilteredColor = prefilteredColor / totalWeight;

    FragColor = vec4(prefilteredColor, 1.0);
}`,wi=`#version 300 es

in vec3 aPos;

out vec2 vLocalPos;

void main(void) {
    vLocalPos = aPos.xy;
    gl_Position = vec4(aPos, 1.0);
}`,_i=`#version 300 es
precision mediump float;

in vec2 vLocalPos;

out vec4 FragColor;

const float PI = 3.14159265359;

float RadicalInverse_VdC(uint bits) {
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}

vec2 Hammersley(uint i, uint N) {
    return vec2(float(i)/float(N), RadicalInverse_VdC(i));
}

vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
    float a = roughness * roughness;

    float phi = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta*cosTheta);

    // from spherical coordinates to cartesian coordinates
    vec3 H;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;

    // from tangent-space vector to world-space sample vector
    vec3 up        = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent   = normalize(cross(up, N));
    vec3 bitangent = cross(N, tangent);

    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;

    return normalize(sampleVec);
}

float geometrySchlickGGX(float nDotV, float roughness) {
    float r = roughness;
    float k = r * r / 2.;

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

vec2 IntegrateBRDF(float NdotV, float roughness) {
    vec3 V;
    V.x = sqrt(1.0 - NdotV*NdotV);
    V.y = 0.0;
    V.z = NdotV;

    float A = 0.0;
    float B = 0.0;

    vec3 N = vec3(0.0, 0.0, 1.0);

    const uint SAMPLE_COUNT = 1024u;
    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H  = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L  = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(L.z, 0.0);
        float NdotH = max(H.z, 0.0);
        float VdotH = max(dot(V, H), 0.0);

        if(NdotL > 0.0)
        {
            float G = geometrySmith(N, V, L, roughness);
            float G_Vis = (G * VdotH) / (NdotH * NdotV);
            float Fc = pow(1.0 - VdotH, 5.0);

            A += (1.0 - Fc) * G_Vis;
            B += Fc * G_Vis;
        }
    }
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);
    return vec2(A, B);
}

void main() {
    FragColor = vec4(IntegrateBRDF((vLocalPos.x + 1.0) * .5, (vLocalPos.y + 1.0) * .5), 0., 1.);
}`,Ci=`struct VSUniforms {
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
`,Bi=`struct VSUniforms {
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
`,Fi=`struct VSUniforms {
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
`,Li=`struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;

struct VSIn {
    @location(0) vertexPosition: vec3f,
    @location(1) color: vec3f,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var position: vec4f = vec4f(in.vertexPosition, 1.0);

    var out: VSOut;
    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * position;
    out.color = in.color;
    return out;
}

@fragment fn fs(
    in: VSOut
) -> @location(0) vec4f {
    return vec4f(in.color, 1);
}
`,Di=`struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
@group(1) @binding(0) var fsUniformSampler: sampler;
@group(1) @binding(1) var fsUniformTexture: texture_cube<f32>;

struct VSIn {
    @location(0) vertexPosition: vec3f,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) localPos: vec3f,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    let rotView: mat4x4f = mat4x4f(
        vec4f(vsUniforms.mvMatrix[0].xyz, 0),
        vec4f(vsUniforms.mvMatrix[1].xyz, 0),
        vec4f(vsUniforms.mvMatrix[2].xyz, 0),
        vec4f(0, 0, 0, 1)
    );

    let clipPos: vec4f = vsUniforms.pMatrix * rotView * 1000. * vec4f(in.vertexPosition, 1.0);

    var out: VSOut;
    out.position = clipPos;
    out.localPos = in.vertexPosition;
    return out;
}

@fragment fn fs(
    in: VSOut
) -> @location(0) vec4f {
    return textureSample(fsUniformTexture, fsUniformSampler, in.localPos);
}
`,Ri=`const invAtan: vec2f = vec2f(0.1591, 0.3183);

struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
@group(1) @binding(0) var fsUniformSampler: sampler;
@group(1) @binding(1) var fsUniformTexture: texture_2d<f32>;

struct VSIn {
    @location(0) vertexPosition: vec3f,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) localPos: vec3f,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var out: VSOut;
    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * vec4f(in.vertexPosition, 1);
    out.localPos = in.vertexPosition;
    return out;
}

fn SampleSphericalMap(v: vec3f) -> vec2f {
    // vec2 uv = vec2(atan(v.z, v.x), asin(v.y));
    var uv: vec2f = vec2f(atan2(v.x, v.y), asin(-v.z));
    uv *= invAtan;
    uv += 0.5;
    return uv;
}

@fragment fn fs(
    in: VSOut
) -> @location(0) vec4f {
    let uv: vec2f = SampleSphericalMap(normalize(in.localPos)); // make sure to normalize localPos
    let color: vec3f = textureSample(fsUniformTexture, fsUniformSampler, uv).rgb;

    return vec4f(color, 1.0);
}
`,Vi=`const PI: f32 = 3.14159265359;
const gamma: f32 = 2.2;
const sampleDelta: f32 = 0.025;

struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
@group(1) @binding(0) var fsUniformSampler: sampler;
@group(1) @binding(1) var fsUniformTexture: texture_cube<f32>;

struct VSIn {
    @location(0) vertexPosition: vec3f,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) localPos: vec3f,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var out: VSOut;
    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * vec4f(in.vertexPosition, 1);
    out.localPos = in.vertexPosition;
    return out;
}

@fragment fn fs(
    in: VSOut
) -> @location(0) vec4f {
    var irradiance: vec3f = vec3f(0);

    // the sample direction equals the hemisphere's orientation
    let normal: vec3f = normalize(in.localPos);

    var up: vec3f = vec3f(0.0, 1.0, 0.0);
    let right: vec3f = normalize(cross(up, normal));
    up = normalize(cross(normal, right));

    var nrSamples: i32 = 0;
    for (var phi: f32 = 0.0; phi < 2.0 * PI; phi += sampleDelta)
    {
        for (var theta: f32 = 0.0; theta < 0.5 * PI; theta += sampleDelta)
        {
            // spherical to cartesian (in tangent space)
            let tangentSample: vec3f = vec3f(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
            // tangent space to world
            let sampleVec: vec3f = tangentSample.x * right + tangentSample.y * up + tangentSample.z * normal;

            irradiance += pow(textureSample(fsUniformTexture, fsUniformSampler, sampleVec).rgb, vec3f(gamma)) * cos(theta) * sin(theta);
            nrSamples++;
        }
    }
    irradiance = PI * irradiance * (1.0 / f32(nrSamples));

    return vec4f(irradiance, 1.0);
}
`,Ii=`const PI: f32 = 3.14159265359;
const gamma: f32 = 2.2;

struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
}

struct FSUniforms {
    roughness: f32,
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
@group(1) @binding(0) var<uniform> fsUniforms: FSUniforms;
@group(1) @binding(1) var fsUniformSampler: sampler;
@group(1) @binding(2) var fsUniformTexture: texture_cube<f32>;

struct VSIn {
    @location(0) vertexPosition: vec3f,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) localPos: vec3f,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var out: VSOut;
    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * vec4f(in.vertexPosition, 1);
    out.localPos = in.vertexPosition;
    return out;
}

fn RadicalInverse_VdC(bits: u32) -> f32 {
    var res: u32 = bits;
    res = (res << 16u) | (res >> 16u);
    res = ((res & 0x55555555u) << 1u) | ((res & 0xAAAAAAAAu) >> 1u);
    res = ((res & 0x33333333u) << 2u) | ((res & 0xCCCCCCCCu) >> 2u);
    res = ((res & 0x0F0F0F0Fu) << 4u) | ((res & 0xF0F0F0F0u) >> 4u);
    res = ((res & 0x00FF00FFu) << 8u) | ((res & 0xFF00FF00u) >> 8u);
    return f32(res) * 2.3283064365386963e-10; // / 0x100000000
}

fn Hammersley(i: u32, N: u32) -> vec2f {
    return vec2f(f32(i)/f32(N), RadicalInverse_VdC(i));
}

fn ImportanceSampleGGX(Xi: vec2f, N: vec3f, roughness: f32) -> vec3f {
    let a: f32 = roughness * roughness;

    let phi: f32 = 2.0 * PI * Xi.x;
    let cosTheta: f32 = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    let sinTheta: f32 = sqrt(1.0 - cosTheta*cosTheta);

    // from spherical coordinates to cartesian coordinates
    var H: vec3f;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;

    // from tangent-space vector to world-space sample vector
    var up: vec3f;
    if (abs(N.z) < 0.999) {
        up = vec3f(0.0, 0.0, 1.0);
    } else {
        up = vec3f(1.0, 0.0, 0.0);
    }
    let tangent: vec3f   = normalize(cross(up, N));
    let bitangent: vec3f = cross(N, tangent);

    let sampleVec: vec3f = tangent * H.x + bitangent * H.y + N * H.z;

    return normalize(sampleVec);
}

@fragment fn fs(
    in: VSOut
) -> @location(0) vec4f {
    let N: vec3f = normalize(in.localPos);
    let R: vec3f = N;
    let V: vec3f = R;

    const SAMPLE_COUNT: u32 = 1024u;
    var totalWeight: f32 = 0.0;
    var prefilteredColor: vec3f = vec3f(0.0);
    for(var i: u32 = 0u; i < SAMPLE_COUNT; i++)
    {
        let Xi: vec2f = Hammersley(i, SAMPLE_COUNT);
        let H: vec3f  = ImportanceSampleGGX(Xi, N, fsUniforms.roughness);
        let L: vec3f  = normalize(2.0 * dot(V, H) * H - V);

        let NdotL: f32 = max(dot(N, L), 0.0);
        if(NdotL > 0.0) {
            prefilteredColor += pow(textureSampleLevel(fsUniformTexture, fsUniformSampler, L, 0).rgb, vec3f(gamma)) * NdotL;
            totalWeight      += NdotL;
        }
    }
    prefilteredColor = prefilteredColor / totalWeight;

    return vec4f(prefilteredColor, 1.0);
}
`,Gi=`const PI: f32 = 3.14159265359;

struct VSIn {
    @location(0) vertexPosition: vec3f,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) localPos: vec3f,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var out: VSOut;
    out.position = vec4f(in.vertexPosition, 1);
    out.localPos = in.vertexPosition;
    return out;
}

fn RadicalInverse_VdC(bits: u32) -> f32 {
    var res: u32 = bits;
    res = (res << 16u) | (res >> 16u);
    res = ((res & 0x55555555u) << 1u) | ((res & 0xAAAAAAAAu) >> 1u);
    res = ((res & 0x33333333u) << 2u) | ((res & 0xCCCCCCCCu) >> 2u);
    res = ((res & 0x0F0F0F0Fu) << 4u) | ((res & 0xF0F0F0F0u) >> 4u);
    res = ((res & 0x00FF00FFu) << 8u) | ((res & 0xFF00FF00u) >> 8u);
    return f32(res) * 2.3283064365386963e-10; // / 0x100000000
}

fn Hammersley(i: u32, N: u32) -> vec2f {
    return vec2f(f32(i)/f32(N), RadicalInverse_VdC(i));
}

fn ImportanceSampleGGX(Xi: vec2f, N: vec3f, roughness: f32) -> vec3f {
    let a: f32 = roughness * roughness;

    let phi: f32 = 2.0 * PI * Xi.x;
    let cosTheta: f32 = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    let sinTheta: f32 = sqrt(1.0 - cosTheta*cosTheta);

    // from spherical coordinates to cartesian coordinates
    var H: vec3f;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;

    // from tangent-space vector to world-space sample vector
    var up: vec3f;
    if (abs(N.z) < 0.999) {
        up = vec3f(0.0, 0.0, 1.0);
    } else {
        up = vec3f(1.0, 0.0, 0.0);
    }
    let tangent: vec3f   = normalize(cross(up, N));
    let bitangent: vec3f = cross(N, tangent);

    let sampleVec: vec3f = tangent * H.x + bitangent * H.y + N * H.z;

    return normalize(sampleVec);
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

fn IntegrateBRDF(NdotV: f32, roughness: f32) -> vec2f {
    var V: vec3f;
    V.x = sqrt(1.0 - NdotV*NdotV);
    V.y = 0.0;
    V.z = NdotV;

    var A: f32 = 0.0;
    var B: f32 = 0.0;

    let N: vec3f = vec3f(0.0, 0.0, 1.0);

    const SAMPLE_COUNT: u32 = 1024u;
    for(var i: u32 = 0u; i < SAMPLE_COUNT; i++) {
        let Xi: vec2f = Hammersley(i, SAMPLE_COUNT);
        let H: vec3f  = ImportanceSampleGGX(Xi, N, roughness);
        let L: vec3f  = normalize(2.0 * dot(V, H) * H - V);

        let NdotL: f32 = max(L.z, 0.0);
        let NdotH: f32 = max(H.z, 0.0);
        let VdotH: f32 = max(dot(V, H), 0.0);

        if (NdotL > 0.0) {
            let G: f32 = geometrySmith(N, V, L, roughness);
            let G_Vis: f32 = (G * VdotH) / (NdotH * NdotV);
            let Fc: f32 = pow(1.0 - VdotH, 5.0);

            A += (1.0 - Fc) * G_Vis;
            B += Fc * G_Vis;
        }
    }
    A /= f32(SAMPLE_COUNT);
    B /= f32(SAMPLE_COUNT);

    return vec2f(A, B);
}

@fragment fn fs(
    in: VSOut
) -> @location(0) vec4f {
    return vec4f(IntegrateBRDF((in.localPos.x + 1.0) * .5, (in.localPos.y + 1.0) * .5), 0., 1.);
}
`,zi=`struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) texCoord: vec2f,
};

@vertex fn vs(
    @location(0) position: vec2f
) -> VSOut {
    var vsOutput: VSOut;
    vsOutput.position = vec4f(position * 2.0 - 1.0, 0.0, 1.0);
    vsOutput.texCoord = vec2f(position.x, 1.0 - position.y);
    return vsOutput;
}

@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var textureView: texture_2d<f32>;

@fragment fn fs(
    fsInput: VSOut
) -> @location(0) vec4f {
    return textureSample(textureView, textureSampler, fsInput.texCoord);
}`,jr,ir,ot,sr=new WeakMap;function Yr(e,t){ot||(ot=e.createBuffer({label:"mips vertex buffer",size:48,usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0}),new Float32Array(ot.getMappedRange(0,ot.size)).set([0,0,1,0,0,1,0,1,1,0,1,1]),ot.unmap(),ir=e.createShaderModule({label:"mips shader module",code:zi}),jr=e.createSampler({label:"mips sampler",minFilter:"linear"})),sr[t.format]||(sr[t.format]=e.createRenderPipeline({label:"mips pipeline",layout:"auto",vertex:{module:ir,buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:ir,targets:[{format:t.format}]}}));const r=sr[t.format],n=e.createCommandEncoder({label:"mips encoder"});for(let s=1;s<t.mipLevelCount;++s)for(let o=0;o<t.depthOrArrayLayers;++o){const l=e.createBindGroup({layout:r.getBindGroupLayout(0),entries:[{binding:0,resource:jr},{binding:1,resource:t.createView({dimension:"2d",baseMipLevel:s-1,mipLevelCount:1,baseArrayLayer:o,arrayLayerCount:1})}]}),h={label:"mips render pass",colorAttachments:[{view:t.createView({dimension:"2d",baseMipLevel:s,mipLevelCount:1,baseArrayLayer:o,arrayLayerCount:1}),loadOp:"clear",storeOp:"store"}]},a=n.beginRenderPass(h);a.setPipeline(r),a.setVertexBuffer(0,ot),a.setBindGroup(0,l),a.draw(6),a.end()}const i=n.finish();e.queue.submit([i])}var re=254,at=2048,lt=32,Ke=128,Be=8,ht=512,It=4,Oi=new Set([0,1]),Ni=fi.replace(/\$\{MAX_NODES}/g,String(re)),ki=pi.replace(/\$\{MAX_NODES}/g,String(re)),Xi=gi.replace(/\$\{MAX_NODES}/g,String(re)),Hi=vi.replace(/\$\{MAX_ENV_MIP_LEVELS}/g,String(Be.toFixed(1))),Wi=Ci.replace(/\$\{MAX_NODES}/g,String(re)),qi=Bi.replace(/\$\{MAX_NODES}/g,String(re)).replace(/\$\{MAX_ENV_MIP_LEVELS}/g,String(Be.toFixed(1))),ji=Fi.replace(/\$\{MAX_NODES}/g,String(re)),or=ee(),ar=st(),lr=ee(),hr=$(0,0,0),cr=jn(0,0,0,1),fr=$(1,1,1),Gt=st(),$r=He(),Kr=He(),Ze=ee(),Fe=ee(),Zr=st(),Qr=He(),We=ee(),zt=ee(),Jr=ee(),Ot=ee(),ge=ee(),Nt=ee(),Yi=ee(),en=er(),me=He(),kt=er(),$i=[["none",{color:{operation:"add",srcFactor:"one",dstFactor:"zero"},alpha:{operation:"add",srcFactor:"one",dstFactor:"zero"}},{depthWriteEnabled:!0,depthCompare:"less-equal",format:"depth24plus"}],["transparent",{color:{operation:"add",srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{operation:"add",srcFactor:"one",dstFactor:"one-minus-src-alpha"}},{depthWriteEnabled:!0,depthCompare:"less-equal",format:"depth24plus"}],["blend",{color:{operation:"add",srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{operation:"add",srcFactor:"one",dstFactor:"one-minus-src-alpha"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}],["additive",{color:{operation:"add",srcFactor:"src",dstFactor:"one"},alpha:{operation:"add",srcFactor:"src",dstFactor:"one"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}],["addAlpha",{color:{operation:"add",srcFactor:"src-alpha",dstFactor:"one"},alpha:{operation:"add",srcFactor:"src-alpha",dstFactor:"one"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}],["modulate",{color:{operation:"add",srcFactor:"zero",dstFactor:"src"},alpha:{operation:"add",srcFactor:"zero",dstFactor:"one"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}],["modulate2x",{color:{operation:"add",srcFactor:"dst",dstFactor:"src"},alpha:{operation:"add",srcFactor:"zero",dstFactor:"one"}},{depthWriteEnabled:!1,depthCompare:"less-equal",format:"depth24plus"}]],Ki=class{constructor(e){this.gpuPipelines={},this.vertexBuffer=[],this.normalBuffer=[],this.vertices=[],this.texCoordBuffer=[],this.indexBuffer=[],this.wireframeIndexBuffer=[],this.wireframeIndexGPUBuffer=[],this.groupBuffer=[],this.skinWeightBuffer=[],this.tangentBuffer=[],this.gpuVertexBuffer=[],this.gpuNormalBuffer=[],this.gpuTexCoordBuffer=[],this.gpuGroupBuffer=[],this.gpuIndexBuffer=[],this.gpuSkinWeightBuffer=[],this.gpuTangentBuffer=[],this.gpuFSUniformsBuffers=[],this.isHD=e.Geosets?.some(t=>t.SkinWeights?.length>0),this.shaderProgramLocations={vertexPositionAttribute:null,normalsAttribute:null,textureCoordAttribute:null,groupAttribute:null,skinAttribute:null,weightAttribute:null,tangentAttribute:null,pMatrixUniform:null,mvMatrixUniform:null,samplerUniform:null,normalSamplerUniform:null,ormSamplerUniform:null,replaceableColorUniform:null,replaceableTypeUniform:null,discardAlphaLevelUniform:null,tVertexAnimUniform:null,wireframeUniform:null,nodesMatricesAttributes:null,lightPosUniform:null,lightColorUniform:null,cameraPosUniform:null,shadowParamsUniform:null,shadowMapSamplerUniform:null,shadowMapLightMatrixUniform:null,hasEnvUniform:null,irradianceMapUniform:null,prefilteredEnvUniform:null,brdfLUTUniform:null},this.skeletonShaderProgramLocations={vertexPositionAttribute:null,colorAttribute:null,mvMatrixUniform:null,pMatrixUniform:null},this.model=e,this.rendererData={model:e,frame:0,animation:null,animationInfo:null,globalSequencesFrames:[],rootNode:null,nodes:[],geosetAnims:[],geosetAlpha:[],materialLayerTextureID:[],materialLayerNormalTextureID:[],materialLayerOrmTextureID:[],materialLayerReflectionTextureID:[],teamColor:null,cameraPos:null,cameraQuat:null,lightPos:null,lightColor:null,shadowBias:0,shadowSmoothingStep:0,textures:{},gpuTextures:{},gpuSamplers:[],gpuDepthSampler:null,gpuEmptyTexture:null,gpuEmptyCubeTexture:null,gpuDepthEmptyTexture:null,envTextures:{},gpuEnvTextures:{},requiredEnvMaps:{},irradianceMap:{},gpuIrradianceMap:{},prefilteredEnvMap:{},gpuPrefilteredEnvMap:{}},this.rendererData.teamColor=$(1,0,0),this.rendererData.cameraPos=ee(),this.rendererData.cameraQuat=st(),this.rendererData.lightPos=$(1e3,1e3,1e3),this.rendererData.lightColor=$(1,1,1),this.setSequence(0),this.rendererData.rootNode={node:{},matrix:He(),childs:[]};for(const t of e.Nodes)t&&(this.rendererData.nodes[t.ObjectId]={node:t,matrix:He(),childs:[]});for(const t of e.Nodes)t&&(!t.Parent&&t.Parent!==0?this.rendererData.rootNode.childs.push(this.rendererData.nodes[t.ObjectId]):this.rendererData.nodes[t.Parent].childs.push(this.rendererData.nodes[t.ObjectId]));if(e.GlobalSequences)for(let t=0;t<e.GlobalSequences.length;++t)this.rendererData.globalSequencesFrames[t]=0;for(let t=0;t<e.GeosetAnims.length;++t)this.rendererData.geosetAnims[e.GeosetAnims[t].GeosetId]=e.GeosetAnims[t];for(let t=0;t<e.Materials.length;++t)this.rendererData.materialLayerTextureID[t]=new Array(e.Materials[t].Layers.length),this.rendererData.materialLayerNormalTextureID[t]=new Array(e.Materials[t].Layers.length),this.rendererData.materialLayerOrmTextureID[t]=new Array(e.Materials[t].Layers.length),this.rendererData.materialLayerReflectionTextureID[t]=new Array(e.Materials[t].Layers.length);this.interp=new nr(this.rendererData),this.particlesController=new oi(this.interp,this.rendererData),this.ribbonsController=new ci(this.interp,this.rendererData)}destroy(){if(this.particlesController&&(this.particlesController.destroy(),this.particlesController=null),this.ribbonsController&&(this.ribbonsController.destroy(),this.ribbonsController=null),this.device){for(const e of this.wireframeIndexGPUBuffer)e.destroy();this.gpuMultisampleTexture?.destroy(),this.gpuDepthTexture?.destroy();for(const e of this.gpuVertexBuffer)e.destroy();for(const e of this.gpuNormalBuffer)e.destroy();for(const e of this.gpuTexCoordBuffer)e.destroy();for(const e of this.gpuGroupBuffer)e.destroy();for(const e of this.gpuIndexBuffer)e.destroy();for(const e of this.gpuSkinWeightBuffer)e.destroy();for(const e of this.gpuTangentBuffer)e.destroy();this.gpuVSUniformsBuffer?.destroy();for(const e in this.gpuFSUniformsBuffers)for(const t of this.gpuFSUniformsBuffers[e])t.destroy();this.skeletonGPUVertexBuffer&&(this.skeletonGPUVertexBuffer.destroy(),this.skeletonGPUVertexBuffer=null),this.skeletonGPUColorBuffer&&(this.skeletonGPUColorBuffer.destroy(),this.skeletonGPUColorBuffer=null),this.skeletonGPUUniformsBuffer&&(this.skeletonGPUUniformsBuffer.destroy(),this.skeletonGPUUniformsBuffer=null),this.envVSUniformsBuffer&&(this.envVSUniformsBuffer.destroy(),this.envVSUniformsBuffer=null),this.cubeGPUVertexBuffer&&(this.cubeGPUVertexBuffer.destroy(),this.cubeGPUVertexBuffer=null);for(const e of this.wireframeIndexGPUBuffer)e?.destroy()}this.gl&&(this.skeletonShaderProgram&&(this.skeletonVertexShader&&(this.gl.detachShader(this.skeletonShaderProgram,this.skeletonVertexShader),this.gl.deleteShader(this.skeletonVertexShader),this.skeletonVertexShader=null),this.skeletonFragmentShader&&(this.gl.detachShader(this.skeletonShaderProgram,this.skeletonFragmentShader),this.gl.deleteShader(this.skeletonFragmentShader),this.skeletonFragmentShader=null),this.gl.deleteProgram(this.skeletonShaderProgram),this.skeletonShaderProgram=null),this.shaderProgram&&(this.vertexShader&&(this.gl.detachShader(this.shaderProgram,this.vertexShader),this.gl.deleteShader(this.vertexShader),this.vertexShader=null),this.fragmentShader&&(this.gl.detachShader(this.shaderProgram,this.fragmentShader),this.gl.deleteShader(this.fragmentShader),this.fragmentShader=null),this.gl.deleteProgram(this.shaderProgram),this.shaderProgram=null),this.destroyShaderProgramObject(this.envToCubemap),this.destroyShaderProgramObject(this.envSphere),this.destroyShaderProgramObject(this.convoluteDiffuseEnv),this.destroyShaderProgramObject(this.prefilterEnv),this.destroyShaderProgramObject(this.integrateBRDF),this.gl.deleteBuffer(this.cubeVertexBuffer),this.gl.deleteBuffer(this.squareVertexBuffer))}initRequiredEnvMaps(){this.model.Version>=1e3&&(ye(this.gl)||this.device)&&this.model.Materials.forEach(e=>{let t;if(e.Shader==="Shader_HD_DefaultUnit"&&e.Layers.length===6&&typeof e.Layers[5].TextureID=="number"||this.model.Version>=1100&&(t=e.Layers.find(r=>r.ShaderTypeId===1&&r.ReflectionsTextureID))&&typeof t.ReflectionsTextureID=="number"){const r=this.model.Version>=1100&&t?t.ReflectionsTextureID:e.Layers[5].TextureID;this.rendererData.requiredEnvMaps[this.model.Textures[r].Image]=!0}})}initGL(e){this.gl=e,this.softwareSkinning=this.gl.getParameter(this.gl.MAX_VERTEX_UNIFORM_VECTORS)<4*(re+2),this.anisotropicExt=this.gl.getExtension("EXT_texture_filter_anisotropic")||this.gl.getExtension("MOZ_EXT_texture_filter_anisotropic")||this.gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic"),this.colorBufferFloatExt=this.gl.getExtension("EXT_color_buffer_float"),this.initRequiredEnvMaps(),this.initShaders(),this.initBuffers(),this.initCube(),this.initSquare(),this.initBRDFLUT(),this.particlesController.initGL(e),this.ribbonsController.initGL(e)}async initGPUDevice(e,t,r){this.canvas=e,this.device=t,this.gpuContext=r,this.initRequiredEnvMaps(),this.initGPUShaders(),this.initGPUPipeline(),this.initGPUBuffers(),this.initGPUUniformBuffers(),this.initGPUMultisampleTexture(),this.initGPUDepthTexture(),this.initGPUEmptyTexture(),this.initCube(),this.initGPUBRDFLUT(),this.particlesController.initGPUDevice(t),this.ribbonsController.initGPUDevice(t)}setTextureImage(e,t){if(this.device){const r=this.rendererData.gpuTextures[e]=this.device.createTexture({size:[t.width,t.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:t},{texture:r},{width:t.width,height:t.height}),Yr(this.device,r),this.processEnvMaps(e)}else{this.rendererData.textures[e]=this.gl.createTexture(),this.gl.bindTexture(this.gl.TEXTURE_2D,this.rendererData.textures[e]),this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,t);const r=this.model.Textures.find(n=>n.Image===e)?.Flags||0;this.setTextureParameters(r,!0),this.gl.generateMipmap(this.gl.TEXTURE_2D),this.processEnvMaps(e),this.gl.bindTexture(this.gl.TEXTURE_2D,null)}}setTextureImageData(e,t){let r=1;for(let n=1;n<t.length&&!(t[n].width!==t[n-1].width/2||t[n].height!==t[n-1].height/2);++n,++r);if(this.device){const n=this.rendererData.gpuTextures[e]=this.device.createTexture({size:[t[0].width,t[0].height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST,mipLevelCount:r});for(let i=0;i<r;++i)this.device.queue.writeTexture({texture:n,mipLevel:i},t[i].data,{bytesPerRow:t[i].width*4},{width:t[i].width,height:t[i].height});this.processEnvMaps(e)}else{this.rendererData.textures[e]=this.gl.createTexture(),this.gl.bindTexture(this.gl.TEXTURE_2D,this.rendererData.textures[e]);for(let i=0;i<r;++i)this.gl.texImage2D(this.gl.TEXTURE_2D,i,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,t[i]);const n=this.model.Textures.find(i=>i.Image===e)?.Flags||0;this.setTextureParameters(n,!1),this.processEnvMaps(e),this.gl.bindTexture(this.gl.TEXTURE_2D,null)}}setTextureCompressedImage(e,t,r,n){this.rendererData.textures[e]=this.gl.createTexture(),this.gl.bindTexture(this.gl.TEXTURE_2D,this.rendererData.textures[e]);const i=new Uint8Array(r);let s=1;for(let l=1;l<n.images.length;++l){const h=n.images[l];h.shape.width>=2&&h.shape.height>=2&&(s=l+1)}if(ye(this.gl)){this.gl.texStorage2D(this.gl.TEXTURE_2D,s,t,n.images[0].shape.width,n.images[0].shape.height);for(let l=0;l<s;++l){const h=n.images[l];this.gl.compressedTexSubImage2D(this.gl.TEXTURE_2D,l,0,0,h.shape.width,h.shape.height,t,i.subarray(h.offset,h.offset+h.length))}}else for(let l=0;l<s;++l){const h=n.images[l];this.gl.compressedTexImage2D(this.gl.TEXTURE_2D,l,t,h.shape.width,h.shape.height,0,i.subarray(h.offset,h.offset+h.length))}const o=this.model.Textures.find(l=>l.Image===e)?.Flags||0;this.setTextureParameters(o,ye(this.gl)),this.processEnvMaps(e),this.gl.bindTexture(this.gl.TEXTURE_2D,null)}setGPUTextureCompressedImage(e,t,r,n){const i=new Uint8Array(r);let s=1;for(let l=1;l<n.images.length;++l){const h=n.images[l];h.shape.width>=4&&h.shape.height>=4&&(s=l+1)}const o=this.rendererData.gpuTextures[e]=this.device.createTexture({size:[n.shape.width,n.shape.height],format:t,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST,mipLevelCount:s});for(let l=0;l<s;++l){const h=n.images[l];this.device.queue.writeTexture({texture:o,mipLevel:l},i.subarray(h.offset,h.offset+h.length),{bytesPerRow:h.shape.width*(t==="bc1-rgba-unorm"?2:4)},{width:h.shape.width,height:h.shape.height})}this.processEnvMaps(e)}setCamera(e,t){yt(this.rendererData.cameraPos,e),Yn(this.rendererData.cameraQuat,t)}setLightPosition(e){yt(this.rendererData.lightPos,e)}setLightColor(e){yt(this.rendererData.lightColor,e)}setSequence(e){this.rendererData.animation=e,this.rendererData.animationInfo=this.model.Sequences[this.rendererData.animation],this.rendererData.frame=this.rendererData.animationInfo.Interval[0]}getSequence(){return this.rendererData.animation}setFrame(e){const t=this.model.Sequences.findIndex(r=>r.Interval[0]<=e&&r.Interval[1]>=e);t<0||(this.rendererData.animation=t,this.rendererData.animationInfo=this.model.Sequences[this.rendererData.animation],this.rendererData.frame=e)}getFrame(){return this.rendererData.frame}setTeamColor(e){yt(this.rendererData.teamColor,e)}update(e){this.rendererData.frame+=e,this.rendererData.frame>this.rendererData.animationInfo.Interval[1]&&(this.rendererData.frame=this.rendererData.animationInfo.Interval[0]),this.updateGlobalSequences(e),this.updateNode(this.rendererData.rootNode),this.particlesController.update(e),this.ribbonsController.update(e);for(let t=0;t<this.model.Geosets.length;++t)this.rendererData.geosetAlpha[t]=this.findAlpha(t);for(let t=0;t<this.rendererData.materialLayerTextureID.length;++t)for(let r=0;r<this.rendererData.materialLayerTextureID[t].length;++r){const n=this.model.Materials[t].Layers[r],i=n.TextureID,s=n.NormalTextureID,o=n.ORMTextureID,l=n.ReflectionsTextureID;typeof i=="number"?this.rendererData.materialLayerTextureID[t][r]=i:this.rendererData.materialLayerTextureID[t][r]=this.interp.num(i),typeof s<"u"&&(this.rendererData.materialLayerNormalTextureID[t][r]=typeof s=="number"?s:this.interp.num(s)),typeof o<"u"&&(this.rendererData.materialLayerOrmTextureID[t][r]=typeof o=="number"?o:this.interp.num(o)),typeof l<"u"&&(this.rendererData.materialLayerReflectionTextureID[t][r]=typeof l=="number"?l:this.interp.num(l))}}render(e,t,{wireframe:r,env:n,levelOfDetail:i=0,useEnvironmentMap:s=!1,shadowMapTexture:o,shadowMapMatrix:l,shadowBias:h,shadowSmoothingStep:a,depthTextureTarget:c}){if(!(c&&!this.isHD)){if(this.device){(this.gpuMultisampleTexture.width!==this.canvas.width||this.gpuMultisampleTexture.height!==this.canvas.height)&&(this.gpuMultisampleTexture.destroy(),this.initGPUMultisampleTexture()),(this.gpuDepthTexture.width!==this.canvas.width||this.gpuDepthTexture.height!==this.canvas.height)&&(this.gpuDepthTexture.destroy(),this.initGPUDepthTexture());let d;c?d={label:"shadow renderPass",colorAttachments:[],depthStencilAttachment:{view:c.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}}:(d=this.gpuRenderPassDescriptor,this.gpuRenderPassDescriptor.colorAttachments[0].view=this.gpuMultisampleTexture.createView(),this.gpuRenderPassDescriptor.colorAttachments[0].resolveTarget=this.gpuContext.getCurrentTexture().createView(),this.gpuRenderPassDescriptor.depthStencilAttachment={view:this.gpuDepthTexture.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"});const p=this.device.createCommandEncoder(),f=p.beginRenderPass(d);n&&this.renderEnvironmentGPU(f,e,t);const u=new ArrayBuffer(128+64*re),g={mvMatrix:new Float32Array(u,0,16),pMatrix:new Float32Array(u,64,16),nodesMatrices:new Float32Array(u,128,16*re)};g.mvMatrix.set(e),g.pMatrix.set(t);for(let x=0;x<re;++x)this.rendererData.nodes[x]&&g.nodesMatrices.set(this.rendererData.nodes[x].matrix,x*16);this.device.queue.writeBuffer(this.gpuVSUniformsBuffer,0,u);for(let x=0;x<this.model.Geosets.length;++x){const y=this.model.Geosets[x];if(this.rendererData.geosetAlpha[x]<1e-6||y.LevelOfDetail!==void 0&&y.LevelOfDetail!==i)continue;r&&!this.wireframeIndexGPUBuffer[x]&&this.createWireframeGPUBuffer(x);const b=y.MaterialID,T=this.model.Materials[b];if(f.setVertexBuffer(0,this.gpuVertexBuffer[x]),f.setVertexBuffer(1,this.gpuNormalBuffer[x]),f.setVertexBuffer(2,this.gpuTexCoordBuffer[x]),this.isHD?(f.setVertexBuffer(3,this.gpuTangentBuffer[x]),f.setVertexBuffer(4,this.gpuSkinWeightBuffer[x]),f.setVertexBuffer(5,this.gpuSkinWeightBuffer[x])):f.setVertexBuffer(3,this.gpuGroupBuffer[x]),f.setIndexBuffer(r?this.wireframeIndexGPUBuffer[x]:this.gpuIndexBuffer[x],"uint16"),this.isHD){const m=T.Layers[0];if(c&&!Oi.has(m.FilterMode||0))continue;const S=c?this.gpuShadowPipeline:r?this.gpuWireframePipeline:this.getGPUPipeline(m);f.setPipeline(S);const P=this.rendererData.materialLayerTextureID[b],A=this.rendererData.materialLayerNormalTextureID[b],C=this.rendererData.materialLayerOrmTextureID[b],w=this.rendererData.materialLayerReflectionTextureID[b],_=P[0],F=this.model.Textures[_],L=m?.ShaderTypeId===1?A[0]:P[1],z=this.model.Textures[L],M=m?.ShaderTypeId===1?C[0]:P[2],I=this.model.Textures[M],N=m?.ShaderTypeId===1?w[0]:P[5],K=this.model.Textures[N]?.Image,E=this.rendererData.gpuIrradianceMap[K],D=this.rendererData.gpuPrefilteredEnvMap[K],O=n&&E&&D;this.gpuFSUniformsBuffers[b]||=[];let H=this.gpuFSUniformsBuffers[b][0];H||(H=this.gpuFSUniformsBuffers[b][0]=this.device.createBuffer({label:`fs uniforms ${b}`,size:192,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}));const U=this.getTexCoordMatrix(m),B=new ArrayBuffer(192),R={replaceableColor:new Float32Array(B,0,3),discardAlphaLevel:new Float32Array(B,12,1),tVertexAnim:new Float32Array(B,16,12),lightPos:new Float32Array(B,64,3),hasEnv:new Uint32Array(B,76,1),lightColor:new Float32Array(B,80,3),wireframe:new Uint32Array(B,92,1),cameraPos:new Float32Array(B,96,3),shadowParams:new Float32Array(B,112,3),shadowMapLightMatrix:new Float32Array(B,128,16)};R.replaceableColor.set(this.rendererData.teamColor),R.discardAlphaLevel.set([m.FilterMode===Z.Transparent?.75:0]),R.tVertexAnim.set(U.slice(0,3)),R.tVertexAnim.set(U.slice(3,6),4),R.tVertexAnim.set(U.slice(6,9),8),R.lightPos.set(this.rendererData.lightPos),R.lightColor.set(this.rendererData.lightColor),R.cameraPos.set(this.rendererData.cameraPos),o&&l?(R.shadowParams.set([1,h??1e-6,a??1/1024]),R.shadowMapLightMatrix.set(l)):(R.shadowParams.set([0,0,0]),R.shadowMapLightMatrix.set([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])),R.hasEnv.set([O?1:0]),R.wireframe.set([r?1:0]),this.device.queue.writeBuffer(H,0,B);const q=this.device.createBindGroup({label:`fs uniforms ${b}`,layout:this.fsBindGroupLayout,entries:[{binding:0,resource:{buffer:H}},{binding:1,resource:this.rendererData.gpuSamplers[_]},{binding:2,resource:(this.rendererData.gpuTextures[F.Image]||this.rendererData.gpuEmptyTexture).createView()},{binding:3,resource:this.rendererData.gpuSamplers[L]},{binding:4,resource:(this.rendererData.gpuTextures[z.Image]||this.rendererData.gpuEmptyTexture).createView()},{binding:5,resource:this.rendererData.gpuSamplers[M]},{binding:6,resource:(this.rendererData.gpuTextures[I.Image]||this.rendererData.gpuEmptyTexture).createView()},{binding:7,resource:this.rendererData.gpuDepthSampler},{binding:8,resource:(o||this.rendererData.gpuDepthEmptyTexture).createView()},{binding:9,resource:this.prefilterEnvSampler},{binding:10,resource:(E||this.rendererData.gpuEmptyCubeTexture).createView({dimension:"cube"})},{binding:11,resource:this.prefilterEnvSampler},{binding:12,resource:(D||this.rendererData.gpuEmptyCubeTexture).createView({dimension:"cube"})},{binding:13,resource:this.gpuBrdfSampler},{binding:14,resource:this.gpuBrdfLUT.createView()}]});f.setBindGroup(0,this.gpuVSUniformsBindGroup),f.setBindGroup(1,q),f.drawIndexed(r?y.Faces.length*2:y.Faces.length)}else for(let m=0;m<T.Layers.length;++m){const S=T.Layers[m],P=this.rendererData.materialLayerTextureID[b][m],A=this.model.Textures[P],C=r?this.gpuWireframePipeline:this.getGPUPipeline(S);f.setPipeline(C),this.gpuFSUniformsBuffers[b]||=[];let w=this.gpuFSUniformsBuffers[b][m];w||(w=this.gpuFSUniformsBuffers[b][m]=this.device.createBuffer({label:`fs uniforms ${b} ${m}`,size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}));const _=this.getTexCoordMatrix(S),F=new ArrayBuffer(80),L={replaceableColor:new Float32Array(F,0,3),replaceableType:new Uint32Array(F,12,1),discardAlphaLevel:new Float32Array(F,16,1),wireframe:new Uint32Array(F,20,1),tVertexAnim:new Float32Array(F,32,12)};L.replaceableColor.set(this.rendererData.teamColor),L.replaceableType.set([A.ReplaceableId||0]),L.discardAlphaLevel.set([S.FilterMode===Z.Transparent?.75:0]),L.tVertexAnim.set(_.slice(0,3)),L.tVertexAnim.set(_.slice(3,6),4),L.tVertexAnim.set(_.slice(6,9),8),L.wireframe.set([r?1:0]),this.device.queue.writeBuffer(w,0,F);const z=this.device.createBindGroup({label:`fs uniforms ${b} ${m}`,layout:this.fsBindGroupLayout,entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:this.rendererData.gpuSamplers[P]},{binding:2,resource:(this.rendererData.gpuTextures[A.Image]||this.rendererData.gpuEmptyTexture).createView()}]});f.setBindGroup(0,this.gpuVSUniformsBindGroup),f.setBindGroup(1,z),f.drawIndexed(r?y.Faces.length*2:y.Faces.length)}}this.particlesController.renderGPU(f,e,t),this.ribbonsController.renderGPU(f,e,t),f.end();const v=p.finish();this.device.queue.submit([v]);return}if(n&&this.renderEnvironment(e,t),this.gl.useProgram(this.shaderProgram),this.gl.uniformMatrix4fv(this.shaderProgramLocations.pMatrixUniform,!1,t),this.gl.uniformMatrix4fv(this.shaderProgramLocations.mvMatrixUniform,!1,e),this.gl.uniform1f(this.shaderProgramLocations.wireframeUniform,r?1:0),this.gl.enableVertexAttribArray(this.shaderProgramLocations.vertexPositionAttribute),this.gl.enableVertexAttribArray(this.shaderProgramLocations.normalsAttribute),this.gl.enableVertexAttribArray(this.shaderProgramLocations.textureCoordAttribute),this.isHD?(this.gl.enableVertexAttribArray(this.shaderProgramLocations.skinAttribute),this.gl.enableVertexAttribArray(this.shaderProgramLocations.weightAttribute),this.gl.enableVertexAttribArray(this.shaderProgramLocations.tangentAttribute)):this.softwareSkinning||this.gl.enableVertexAttribArray(this.shaderProgramLocations.groupAttribute),!this.softwareSkinning)for(let d=0;d<re;++d)this.rendererData.nodes[d]&&this.gl.uniformMatrix4fv(this.shaderProgramLocations.nodesMatricesAttributes[d],!1,this.rendererData.nodes[d].matrix);for(let d=0;d<this.model.Geosets.length;++d){const p=this.model.Geosets[d];if(this.rendererData.geosetAlpha[d]<1e-6||p.LevelOfDetail!==void 0&&p.LevelOfDetail!==i)continue;this.softwareSkinning&&this.generateGeosetVertices(d);const f=p.MaterialID,u=this.model.Materials[f];if(this.isHD){this.gl.uniform3fv(this.shaderProgramLocations.lightPosUniform,this.rendererData.lightPos),this.gl.uniform3fv(this.shaderProgramLocations.lightColorUniform,this.rendererData.lightColor),this.gl.uniform3fv(this.shaderProgramLocations.cameraPosUniform,this.rendererData.cameraPos),o&&l?(this.gl.uniform3f(this.shaderProgramLocations.shadowParamsUniform,1,h??1e-6,a??1/1024),this.gl.activeTexture(this.gl.TEXTURE3),this.gl.bindTexture(this.gl.TEXTURE_2D,o),this.gl.uniform1i(this.shaderProgramLocations.shadowMapSamplerUniform,3),this.gl.uniformMatrix4fv(this.shaderProgramLocations.shadowMapLightMatrixUniform,!1,l)):this.gl.uniform3f(this.shaderProgramLocations.shadowParamsUniform,0,0,0);const g=this.model.Version>=1100&&u.Layers.find(b=>b.ShaderTypeId===1&&typeof b.ReflectionsTextureID=="number")?.ReflectionsTextureID||u.Layers[5]?.TextureID,v=this.model.Textures[g]?.Image,x=this.rendererData.irradianceMap[v],y=this.rendererData.prefilteredEnvMap[v];s&&x&&y?(this.gl.uniform1i(this.shaderProgramLocations.hasEnvUniform,1),this.gl.activeTexture(this.gl.TEXTURE4),this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,x),this.gl.uniform1i(this.shaderProgramLocations.irradianceMapUniform,4),this.gl.activeTexture(this.gl.TEXTURE5),this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,y),this.gl.uniform1i(this.shaderProgramLocations.prefilteredEnvUniform,5),this.gl.activeTexture(this.gl.TEXTURE6),this.gl.bindTexture(this.gl.TEXTURE_2D,this.brdfLUT),this.gl.uniform1i(this.shaderProgramLocations.brdfLUTUniform,6)):(this.gl.uniform1i(this.shaderProgramLocations.hasEnvUniform,0),this.gl.uniform1i(this.shaderProgramLocations.irradianceMapUniform,4),this.gl.uniform1i(this.shaderProgramLocations.prefilteredEnvUniform,5),this.gl.uniform1i(this.shaderProgramLocations.brdfLUTUniform,6)),this.setLayerPropsHD(f,u.Layers),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.vertexBuffer[d]),this.gl.vertexAttribPointer(this.shaderProgramLocations.vertexPositionAttribute,3,this.gl.FLOAT,!1,0,0),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.normalBuffer[d]),this.gl.vertexAttribPointer(this.shaderProgramLocations.normalsAttribute,3,this.gl.FLOAT,!1,0,0),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.texCoordBuffer[d]),this.gl.vertexAttribPointer(this.shaderProgramLocations.textureCoordAttribute,2,this.gl.FLOAT,!1,0,0),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.skinWeightBuffer[d]),this.gl.vertexAttribPointer(this.shaderProgramLocations.skinAttribute,4,this.gl.UNSIGNED_BYTE,!1,8,0),this.gl.vertexAttribPointer(this.shaderProgramLocations.weightAttribute,4,this.gl.UNSIGNED_BYTE,!0,8,4),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.tangentBuffer[d]),this.gl.vertexAttribPointer(this.shaderProgramLocations.tangentAttribute,4,this.gl.FLOAT,!1,0,0),r&&!this.wireframeIndexBuffer[d]&&this.createWireframeBuffer(d),this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,r?this.wireframeIndexBuffer[d]:this.indexBuffer[d]),this.gl.drawElements(r?this.gl.LINES:this.gl.TRIANGLES,r?p.Faces.length*2:p.Faces.length,this.gl.UNSIGNED_SHORT,0),o&&l&&(this.gl.activeTexture(this.gl.TEXTURE3),this.gl.bindTexture(this.gl.TEXTURE_2D,null))}else for(let g=0;g<u.Layers.length;++g)this.setLayerProps(u.Layers[g],this.rendererData.materialLayerTextureID[f][g]),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.vertexBuffer[d]),this.gl.vertexAttribPointer(this.shaderProgramLocations.vertexPositionAttribute,3,this.gl.FLOAT,!1,0,0),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.normalBuffer[d]),this.gl.vertexAttribPointer(this.shaderProgramLocations.normalsAttribute,3,this.gl.FLOAT,!1,0,0),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.texCoordBuffer[d]),this.gl.vertexAttribPointer(this.shaderProgramLocations.textureCoordAttribute,2,this.gl.FLOAT,!1,0,0),this.softwareSkinning||(this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.groupBuffer[d]),this.gl.vertexAttribPointer(this.shaderProgramLocations.groupAttribute,4,this.gl.UNSIGNED_SHORT,!1,0,0)),r&&!this.wireframeIndexBuffer[d]&&this.createWireframeBuffer(d),this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,r?this.wireframeIndexBuffer[d]:this.indexBuffer[d]),this.gl.drawElements(r?this.gl.LINES:this.gl.TRIANGLES,r?p.Faces.length*2:p.Faces.length,this.gl.UNSIGNED_SHORT,0)}this.gl.disableVertexAttribArray(this.shaderProgramLocations.vertexPositionAttribute),this.gl.disableVertexAttribArray(this.shaderProgramLocations.normalsAttribute),this.gl.disableVertexAttribArray(this.shaderProgramLocations.textureCoordAttribute),this.isHD?(this.gl.disableVertexAttribArray(this.shaderProgramLocations.skinAttribute),this.gl.disableVertexAttribArray(this.shaderProgramLocations.weightAttribute),this.gl.disableVertexAttribArray(this.shaderProgramLocations.tangentAttribute)):this.softwareSkinning||this.gl.disableVertexAttribArray(this.shaderProgramLocations.groupAttribute),this.particlesController.render(e,t),this.ribbonsController.render(e,t)}}renderEnvironmentGPU(e,t,r){e.setPipeline(this.envPiepeline);const n=new ArrayBuffer(128),i={mvMatrix:new Float32Array(n,0,16),pMatrix:new Float32Array(n,64,16)};i.mvMatrix.set(t),i.pMatrix.set(r),this.device.queue.writeBuffer(this.envVSUniformsBuffer,0,n),e.setBindGroup(0,this.envVSBindGroup);for(const s in this.rendererData.gpuEnvTextures){const o=this.device.createBindGroup({label:`env fs uniforms ${s}`,layout:this.envFSBindGroupLayout,entries:[{binding:0,resource:this.envSampler},{binding:1,resource:this.rendererData.gpuEnvTextures[s].createView({dimension:"cube"})}]});e.setBindGroup(1,o),e.setPipeline(this.envPiepeline),e.setVertexBuffer(0,this.cubeGPUVertexBuffer),e.draw(36)}}renderEnvironment(e,t){if(ye(this.gl)){this.gl.disable(this.gl.BLEND),this.gl.disable(this.gl.DEPTH_TEST),this.gl.disable(this.gl.CULL_FACE);for(const r in this.rendererData.envTextures)this.gl.useProgram(this.envSphere.program),this.gl.uniformMatrix4fv(this.envSphere.uniforms.uPMatrix,!1,t),this.gl.uniformMatrix4fv(this.envSphere.uniforms.uMVMatrix,!1,e),this.gl.activeTexture(this.gl.TEXTURE0),this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,this.rendererData.envTextures[r]),this.gl.uniform1i(this.envSphere.uniforms.uEnvironmentMap,0),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.cubeVertexBuffer),this.gl.enableVertexAttribArray(this.envSphere.attributes.aPos),this.gl.vertexAttribPointer(this.envSphere.attributes.aPos,3,this.gl.FLOAT,!1,0,0),this.gl.drawArrays(this.gl.TRIANGLES,0,36),this.gl.disableVertexAttribArray(this.envSphere.attributes.aPos),this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,null)}}renderSkeleton(e,t,r){const n=[],i=[],s=(a,c)=>{Ee(ge,a.node.PivotPoint,a.matrix),n.push(ge[0],ge[1],ge[2]),Ee(ge,c.node.PivotPoint,c.matrix),n.push(ge[0],ge[1],ge[2]),i.push(0,1,0,0,0,1)},o=a=>{(a.node.Parent||a.node.Parent===0)&&(!r||r.includes(a.node.Name))&&s(a,this.rendererData.nodes[a.node.Parent]);for(const c of a.childs)o(c)};if(o(this.rendererData.rootNode),!n.length)return;const l=new Float32Array(n),h=new Float32Array(i);if(this.device){this.skeletonShaderModule||(this.skeletonShaderModule=this.device.createShaderModule({label:"skeleton",code:Li})),this.skeletonBindGroupLayout||(this.skeletonBindGroupLayout=this.device.createBindGroupLayout({label:"skeleton bind group layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform",hasDynamicOffset:!1,minBindingSize:128}}]})),this.skeletonPipelineLayout||(this.skeletonPipelineLayout=this.device.createPipelineLayout({label:"skeleton pipeline layout",bindGroupLayouts:[this.skeletonBindGroupLayout]})),this.skeletonPipeline||(this.skeletonPipeline=this.device.createRenderPipeline({label:"skeleton pipeline",layout:this.skeletonPipelineLayout,vertex:{module:this.skeletonShaderModule,buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]},{arrayStride:12,attributes:[{shaderLocation:1,offset:0,format:"float32x3"}]}]},fragment:{module:this.skeletonShaderModule,targets:[{format:navigator.gpu.getPreferredCanvasFormat(),blend:{color:{operation:"add",srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{operation:"add",srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"line-list"}})),this.skeletonGPUVertexBuffer?.destroy(),this.skeletonGPUColorBuffer?.destroy(),this.skeletonGPUUniformsBuffer?.destroy();const a=this.skeletonGPUVertexBuffer=this.device.createBuffer({label:"skeleton vertex",size:l.byteLength,usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0});new Float32Array(a.getMappedRange(0,a.size)).set(l),a.unmap();const c=this.skeletonGPUColorBuffer=this.device.createBuffer({label:"skeleton color",size:h.byteLength,usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0});new Float32Array(c.getMappedRange(0,c.size)).set(h),c.unmap();const d=this.skeletonGPUUniformsBuffer=this.device.createBuffer({label:"skeleton vs uniforms",size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),p=this.device.createBindGroup({label:"skeleton uniforms bind group",layout:this.skeletonBindGroupLayout,entries:[{binding:0,resource:{buffer:d}}]}),f={label:"skeleton renderPass",colorAttachments:[{view:this.gpuContext.getCurrentTexture().createView(),clearValue:[.15,.15,.15,1],loadOp:"load",storeOp:"store"}]},u=this.device.createCommandEncoder(),g=u.beginRenderPass(f),v=new ArrayBuffer(128),x={mvMatrix:new Float32Array(v,0,16),pMatrix:new Float32Array(v,64,16)};x.mvMatrix.set(e),x.pMatrix.set(t),this.device.queue.writeBuffer(d,0,v),g.setVertexBuffer(0,a),g.setVertexBuffer(1,c),g.setPipeline(this.skeletonPipeline),g.setBindGroup(0,p),g.draw(l.length/3),g.end();const y=u.finish();this.device.queue.submit([y]);return}this.skeletonShaderProgram||(this.skeletonShaderProgram=this.initSkeletonShaderProgram()),this.gl.disable(this.gl.BLEND),this.gl.disable(this.gl.DEPTH_TEST),this.gl.useProgram(this.skeletonShaderProgram),this.gl.uniformMatrix4fv(this.skeletonShaderProgramLocations.pMatrixUniform,!1,t),this.gl.uniformMatrix4fv(this.skeletonShaderProgramLocations.mvMatrixUniform,!1,e),this.gl.enableVertexAttribArray(this.skeletonShaderProgramLocations.vertexPositionAttribute),this.gl.enableVertexAttribArray(this.skeletonShaderProgramLocations.colorAttribute),this.skeletonVertexBuffer||(this.skeletonVertexBuffer=this.gl.createBuffer()),this.skeletonColorBuffer||(this.skeletonColorBuffer=this.gl.createBuffer()),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.skeletonVertexBuffer),this.gl.bufferData(this.gl.ARRAY_BUFFER,l,this.gl.DYNAMIC_DRAW),this.gl.vertexAttribPointer(this.skeletonShaderProgramLocations.vertexPositionAttribute,3,this.gl.FLOAT,!1,0,0),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.skeletonColorBuffer),this.gl.bufferData(this.gl.ARRAY_BUFFER,h,this.gl.DYNAMIC_DRAW),this.gl.vertexAttribPointer(this.skeletonShaderProgramLocations.colorAttribute,3,this.gl.FLOAT,!1,0,0),this.gl.drawArrays(this.gl.LINES,0,l.length/3),this.gl.disableVertexAttribArray(this.skeletonShaderProgramLocations.vertexPositionAttribute),this.gl.disableVertexAttribArray(this.skeletonShaderProgramLocations.colorAttribute)}initSkeletonShaderProgram(){const e=this.skeletonVertexShader=Ce(this.gl,xi,this.gl.VERTEX_SHADER),t=this.skeletonFragmentShader=Ce(this.gl,bi,this.gl.FRAGMENT_SHADER),r=this.gl.createProgram();return this.gl.attachShader(r,e),this.gl.attachShader(r,t),this.gl.linkProgram(r),this.gl.getProgramParameter(r,this.gl.LINK_STATUS)||alert("Could not initialise shaders"),this.gl.useProgram(r),this.skeletonShaderProgramLocations.vertexPositionAttribute=this.gl.getAttribLocation(r,"aVertexPosition"),this.skeletonShaderProgramLocations.colorAttribute=this.gl.getAttribLocation(r,"aColor"),this.skeletonShaderProgramLocations.pMatrixUniform=this.gl.getUniformLocation(r,"uPMatrix"),this.skeletonShaderProgramLocations.mvMatrixUniform=this.gl.getUniformLocation(r,"uMVMatrix"),r}generateGeosetVertices(e){const t=this.model.Geosets[e],r=this.vertices[e];for(let n=0;n<r.length;n+=3){const i=n/3,s=t.Groups[t.VertexGroup[i]];be(ge,t.Vertices[n],t.Vertices[n+1],t.Vertices[n+2]),be(Nt,0,0,0);for(let o=0;o<s.length;++o)zr(Nt,Nt,Ee(Yi,ge,this.rendererData.nodes[s[o]].matrix));Or(ge,Nt,1/s.length),r[n]=ge[0],r[n+1]=ge[1],r[n+2]=ge[2]}this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.vertexBuffer[e]),this.gl.bufferData(this.gl.ARRAY_BUFFER,r,this.gl.DYNAMIC_DRAW)}setTextureParameters(e,t){if(e&Ft.WrapWidth?this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_S,this.gl.REPEAT):this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_S,this.gl.CLAMP_TO_EDGE),e&Ft.WrapHeight?this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_T,this.gl.REPEAT):this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_T,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MAG_FILTER,this.gl.LINEAR),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,t?this.gl.LINEAR_MIPMAP_NEAREST:this.gl.LINEAR),this.anisotropicExt){const r=this.gl.getParameter(this.anisotropicExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);this.gl.texParameterf(this.gl.TEXTURE_2D,this.anisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT,r)}}processEnvMaps(e){if(!this.rendererData.requiredEnvMaps[e]||!(this.rendererData.textures[e]||this.rendererData.gpuTextures[e])||!(ye(this.gl)||this.device)||!(this.colorBufferFloatExt||this.device))return;this.gl&&(this.gl.disable(this.gl.BLEND),this.gl.disable(this.gl.DEPTH_TEST),this.gl.disable(this.gl.CULL_FACE));const t=He(),r=He(),n=$(0,0,0);let i,s;this.device?(i=[$(1,0,0),$(-1,0,0),$(0,-1,0),$(0,1,0),$(0,0,1),$(0,0,-1)],s=[$(0,-1,0),$(0,-1,0),$(0,0,-1),$(0,0,1),$(0,-1,0),$(0,-1,0)]):(i=[$(1,0,0),$(-1,0,0),$(0,1,0),$(0,-1,0),$(0,0,1),$(0,0,-1)],s=[$(0,-1,0),$(0,-1,0),$(0,0,1),$(0,0,-1),$(0,-1,0),$(0,-1,0)]),Cn(t,Math.PI/2,1,.1,10);let o,l,h;if(this.device){h=this.rendererData.gpuEnvTextures[e]=this.device.createTexture({label:`env cubemap ${e}`,size:[at,at,6],format:navigator.gpu.getPreferredCanvasFormat(),usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING,mipLevelCount:Be});const a=this.device.createCommandEncoder({label:"env to cubemap"}),c=[];for(let p=0;p<6;++p){nt(r,n,i[p],s[p]);const f=a.beginRenderPass({label:"env to cubemap",colorAttachments:[{view:h.createView({dimension:"2d",baseArrayLayer:p,baseMipLevel:0,mipLevelCount:1}),clearValue:[0,0,0,1],loadOp:"clear",storeOp:"store"}]}),u=new ArrayBuffer(128),g={mvMatrix:new Float32Array(u,0,16),pMatrix:new Float32Array(u,64,16)};g.mvMatrix.set(r),g.pMatrix.set(t);const v=this.device.createBuffer({label:`env to cubemap vs uniforms ${p}`,size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});c.push(v),this.device.queue.writeBuffer(v,0,u);const x=this.device.createBindGroup({label:`env to cubemap vs bind group ${p}`,layout:this.envToCubemapVSBindGroupLayout,entries:[{binding:0,resource:{buffer:v}}]});f.setBindGroup(0,x);const y=this.device.createBindGroup({label:`env to cubemap fs uniforms ${p}`,layout:this.envToCubemapFSBindGroupLayout,entries:[{binding:0,resource:this.envToCubemapSampler},{binding:1,resource:this.rendererData.gpuTextures[e].createView()}]});f.setBindGroup(1,y),f.setPipeline(this.envToCubemapPiepeline),f.setVertexBuffer(0,this.cubeGPUVertexBuffer),f.draw(36),f.end()}const d=a.finish();this.device.queue.submit([d]),this.device.queue.onSubmittedWorkDone().finally(()=>{c.forEach(p=>{p.destroy()})})}else if(ye(this.gl)){o=this.gl.createFramebuffer(),this.gl.useProgram(this.envToCubemap.program),l=this.rendererData.envTextures[e]=this.gl.createTexture(),this.gl.activeTexture(this.gl.TEXTURE1),this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,l);for(let a=0;a<6;++a)this.gl.texImage2D(this.gl.TEXTURE_CUBE_MAP_POSITIVE_X+a,0,this.gl.RGBA16F,at,at,0,this.gl.RGBA,this.gl.FLOAT,null);this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_WRAP_S,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_WRAP_T,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_WRAP_R,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR),this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_MAG_FILTER,this.gl.LINEAR),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.cubeVertexBuffer),this.gl.enableVertexAttribArray(this.envToCubemap.attributes.aPos),this.gl.vertexAttribPointer(this.envToCubemap.attributes.aPos,3,this.gl.FLOAT,!1,0,0),this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,o),this.gl.uniformMatrix4fv(this.envToCubemap.uniforms.uPMatrix,!1,t),this.gl.activeTexture(this.gl.TEXTURE0),this.gl.bindTexture(this.gl.TEXTURE_2D,this.rendererData.textures[e]),this.gl.uniform1i(this.envToCubemap.uniforms.uEquirectangularMap,0),this.gl.viewport(0,0,at,at);for(let a=0;a<6;++a)this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER,this.gl.COLOR_ATTACHMENT0,this.gl.TEXTURE_CUBE_MAP_POSITIVE_X+a,l,0),this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT),nt(r,n,i[a],s[a]),this.gl.uniformMatrix4fv(this.envToCubemap.uniforms.uMVMatrix,!1,r),this.gl.drawArrays(this.gl.TRIANGLES,0,36);this.gl.disableVertexAttribArray(this.envToCubemap.attributes.aPos),this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null)}if(this.device?Yr(this.device,h):(this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,l),this.gl.generateMipmap(this.gl.TEXTURE_CUBE_MAP),this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,null)),this.device){h=this.rendererData.gpuIrradianceMap[e]=this.device.createTexture({label:`convolute diffuse ${e}`,size:[lt,lt,6],format:navigator.gpu.getPreferredCanvasFormat(),usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING,mipLevelCount:5});const a=this.device.createCommandEncoder({label:"convolute diffuse"}),c=[];for(let p=0;p<6;++p){nt(r,n,i[p],s[p]);const f=a.beginRenderPass({label:"convolute diffuse",colorAttachments:[{view:h.createView({dimension:"2d",baseArrayLayer:p,baseMipLevel:0,mipLevelCount:1}),clearValue:[0,0,0,1],loadOp:"clear",storeOp:"store"}]}),u=new ArrayBuffer(128),g={mvMatrix:new Float32Array(u,0,16),pMatrix:new Float32Array(u,64,16)};g.mvMatrix.set(r),g.pMatrix.set(t);const v=this.device.createBuffer({label:`convolute diffuse vs uniforms ${p}`,size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});c.push(v),this.device.queue.writeBuffer(v,0,u);const x=this.device.createBindGroup({label:`convolute diffuse vs bind group ${p}`,layout:this.convoluteDiffuseEnvVSBindGroupLayout,entries:[{binding:0,resource:{buffer:v}}]});f.setBindGroup(0,x);const y=this.device.createBindGroup({label:`convolute diffuse fs uniforms ${p}`,layout:this.convoluteDiffuseEnvFSBindGroupLayout,entries:[{binding:0,resource:this.convoluteDiffuseEnvSampler},{binding:1,resource:this.rendererData.gpuEnvTextures[e].createView({dimension:"cube"})}]});f.setBindGroup(1,y),f.setPipeline(this.convoluteDiffuseEnvPiepeline),f.setVertexBuffer(0,this.cubeGPUVertexBuffer),f.draw(36),f.end()}const d=a.finish();this.device.queue.submit([d]),this.device.queue.onSubmittedWorkDone().finally(()=>{c.forEach(p=>{p.destroy()})})}else if(ye(this.gl)){this.gl.useProgram(this.convoluteDiffuseEnv.program);const a=this.rendererData.irradianceMap[e]=this.gl.createTexture();this.gl.activeTexture(this.gl.TEXTURE1),this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,a);for(let c=0;c<6;++c)this.gl.texImage2D(this.gl.TEXTURE_CUBE_MAP_POSITIVE_X+c,0,this.gl.RGBA16F,lt,lt,0,this.gl.RGBA,this.gl.FLOAT,null);this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_WRAP_S,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_WRAP_T,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_WRAP_R,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR),this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_MAG_FILTER,this.gl.LINEAR),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.cubeVertexBuffer),this.gl.enableVertexAttribArray(this.convoluteDiffuseEnv.attributes.aPos),this.gl.vertexAttribPointer(this.convoluteDiffuseEnv.attributes.aPos,3,this.gl.FLOAT,!1,0,0),this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,o),this.gl.uniformMatrix4fv(this.convoluteDiffuseEnv.uniforms.uPMatrix,!1,t),this.gl.activeTexture(this.gl.TEXTURE0),this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,this.rendererData.envTextures[e]),this.gl.uniform1i(this.convoluteDiffuseEnv.uniforms.uEnvironmentMap,0),this.gl.viewport(0,0,lt,lt);for(let c=0;c<6;++c)this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER,this.gl.COLOR_ATTACHMENT0,this.gl.TEXTURE_CUBE_MAP_POSITIVE_X+c,a,0),this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT),nt(r,n,i[c],s[c]),this.gl.uniformMatrix4fv(this.convoluteDiffuseEnv.uniforms.uMVMatrix,!1,r),this.gl.drawArrays(this.gl.TRIANGLES,0,36);this.gl.disableVertexAttribArray(this.convoluteDiffuseEnv.attributes.aPos),this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null),this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,a),this.gl.generateMipmap(this.gl.TEXTURE_CUBE_MAP)}if(this.device){const a=this.rendererData.gpuPrefilteredEnvMap[e]=this.device.createTexture({label:`prefilter env ${e}`,size:[Ke,Ke,6],format:navigator.gpu.getPreferredCanvasFormat(),usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING,mipLevelCount:Be}),c=this.device.createCommandEncoder({label:"prefilter env"}),d=[];for(let f=0;f<Be;++f){const u=new ArrayBuffer(4),g={roughness:new Float32Array(u)},v=f/(Be-1);g.roughness.set([v]);const x=this.device.createBuffer({label:`prefilter env fs uniforms ${f}`,size:4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});d.push(x),this.device.queue.writeBuffer(x,0,u);const y=this.device.createBindGroup({label:`prefilter env fs uniforms ${f}`,layout:this.prefilterEnvFSBindGroupLayout,entries:[{binding:0,resource:{buffer:x}},{binding:1,resource:this.prefilterEnvSampler},{binding:2,resource:this.rendererData.gpuEnvTextures[e].createView({dimension:"cube"})}]});for(let b=0;b<6;++b){const T=c.beginRenderPass({label:"prefilter env",colorAttachments:[{view:a.createView({dimension:"2d",baseArrayLayer:b,baseMipLevel:f,mipLevelCount:1}),clearValue:[0,0,0,1],loadOp:"clear",storeOp:"store"}]});nt(r,n,i[b],s[b]);const m=new ArrayBuffer(128),S={mvMatrix:new Float32Array(m,0,16),pMatrix:new Float32Array(m,64,16)};S.mvMatrix.set(r),S.pMatrix.set(t);const P=this.device.createBuffer({label:"prefilter env vs uniforms",size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});d.push(P),this.device.queue.writeBuffer(P,0,m);const A=this.device.createBindGroup({label:"prefilter env vs bind group",layout:this.prefilterEnvVSBindGroupLayout,entries:[{binding:0,resource:{buffer:P}}]});T.setPipeline(this.prefilterEnvPiepeline),T.setBindGroup(0,A),T.setBindGroup(1,y),T.setVertexBuffer(0,this.cubeGPUVertexBuffer),T.draw(36),T.end()}}const p=c.finish();this.device.queue.submit([p]),this.device.queue.onSubmittedWorkDone().finally(()=>{d.forEach(f=>{f.destroy()})})}else if(ye(this.gl)){this.gl.useProgram(this.prefilterEnv.program);const a=this.rendererData.prefilteredEnvMap[e]=this.gl.createTexture();this.gl.activeTexture(this.gl.TEXTURE1),this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,a),this.gl.texStorage2D(this.gl.TEXTURE_CUBE_MAP,Be,this.gl.RGBA16F,Ke,Ke);for(let c=0;c<Be;++c)for(let d=0;d<6;++d){const p=Ke*.5**c,f=new Float32Array(p*p*4);this.gl.texSubImage2D(this.gl.TEXTURE_CUBE_MAP_POSITIVE_X+d,c,0,0,p,p,this.gl.RGBA,this.gl.FLOAT,f)}this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_WRAP_S,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_WRAP_T,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_WRAP_R,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR_MIPMAP_LINEAR),this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP,this.gl.TEXTURE_MAG_FILTER,this.gl.LINEAR),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.cubeVertexBuffer),this.gl.enableVertexAttribArray(this.prefilterEnv.attributes.aPos),this.gl.vertexAttribPointer(this.prefilterEnv.attributes.aPos,3,this.gl.FLOAT,!1,0,0),this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,o),this.gl.uniformMatrix4fv(this.prefilterEnv.uniforms.uPMatrix,!1,t),this.gl.activeTexture(this.gl.TEXTURE0),this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,this.rendererData.envTextures[e]),this.gl.uniform1i(this.prefilterEnv.uniforms.uEnvironmentMap,0);for(let c=0;c<Be;++c){const d=Ke*.5**c,p=Ke*.5**c;this.gl.viewport(0,0,d,p);const f=c/(Be-1);this.gl.uniform1f(this.prefilterEnv.uniforms.uRoughness,f);for(let u=0;u<6;++u)this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER,this.gl.COLOR_ATTACHMENT0,this.gl.TEXTURE_CUBE_MAP_POSITIVE_X+u,a,c),this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT),nt(r,n,i[u],s[u]),this.gl.uniformMatrix4fv(this.prefilterEnv.uniforms.uMVMatrix,!1,r),this.gl.drawArrays(this.gl.TRIANGLES,0,36)}this.gl.activeTexture(this.gl.TEXTURE1),this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP,null),this.gl.deleteFramebuffer(o)}}initShaderProgram(e,t,r,n){const i=Ce(this.gl,e,this.gl.VERTEX_SHADER),s=Ce(this.gl,t,this.gl.FRAGMENT_SHADER),o=this.gl.createProgram();if(this.gl.attachShader(o,i),this.gl.attachShader(o,s),this.gl.linkProgram(o),!this.gl.getProgramParameter(o,this.gl.LINK_STATUS))throw new Error("Could not initialise shaders");const l={};for(const a in r)if(l[a]=this.gl.getAttribLocation(o,a),l[a]<0)throw new Error("Missing shader attribute location: "+a);const h={};for(const a in n)if(h[a]=this.gl.getUniformLocation(o,a),!h[a])throw new Error("Missing shader uniform location: "+a);return{program:o,vertexShader:i,fragmentShader:s,attributes:l,uniforms:h}}destroyShaderProgramObject(e){e.program&&(e.vertexShader&&(this.gl.detachShader(e.program,e.vertexShader),this.gl.deleteShader(e.vertexShader),e.vertexShader=null),e.fragmentShader&&(this.gl.detachShader(e.program,e.fragmentShader),this.gl.deleteShader(e.fragmentShader),e.fragmentShader=null),this.gl.deleteProgram(e.program),e.program=null)}initShaders(){if(this.shaderProgram)return;let e;this.isHD?e=ye(this.gl)?Xi:ki:this.softwareSkinning?e=ui:e=Ni;let t;this.isHD?t=ye(this.gl)?Hi:mi:t=di;const r=this.vertexShader=Ce(this.gl,e,this.gl.VERTEX_SHADER),n=this.fragmentShader=Ce(this.gl,t,this.gl.FRAGMENT_SHADER),i=this.shaderProgram=this.gl.createProgram();if(this.gl.attachShader(i,r),this.gl.attachShader(i,n),this.gl.linkProgram(i),this.gl.getProgramParameter(i,this.gl.LINK_STATUS)||alert("Could not initialise shaders"),this.gl.useProgram(i),this.shaderProgramLocations.vertexPositionAttribute=this.gl.getAttribLocation(i,"aVertexPosition"),this.shaderProgramLocations.normalsAttribute=this.gl.getAttribLocation(i,"aNormal"),this.shaderProgramLocations.textureCoordAttribute=this.gl.getAttribLocation(i,"aTextureCoord"),this.isHD?(this.shaderProgramLocations.skinAttribute=this.gl.getAttribLocation(i,"aSkin"),this.shaderProgramLocations.weightAttribute=this.gl.getAttribLocation(i,"aBoneWeight"),this.shaderProgramLocations.tangentAttribute=this.gl.getAttribLocation(i,"aTangent")):this.softwareSkinning||(this.shaderProgramLocations.groupAttribute=this.gl.getAttribLocation(i,"aGroup")),this.shaderProgramLocations.pMatrixUniform=this.gl.getUniformLocation(i,"uPMatrix"),this.shaderProgramLocations.mvMatrixUniform=this.gl.getUniformLocation(i,"uMVMatrix"),this.shaderProgramLocations.samplerUniform=this.gl.getUniformLocation(i,"uSampler"),this.shaderProgramLocations.replaceableColorUniform=this.gl.getUniformLocation(i,"uReplaceableColor"),this.isHD?(this.shaderProgramLocations.normalSamplerUniform=this.gl.getUniformLocation(i,"uNormalSampler"),this.shaderProgramLocations.ormSamplerUniform=this.gl.getUniformLocation(i,"uOrmSampler"),this.shaderProgramLocations.lightPosUniform=this.gl.getUniformLocation(i,"uLightPos"),this.shaderProgramLocations.lightColorUniform=this.gl.getUniformLocation(i,"uLightColor"),this.shaderProgramLocations.cameraPosUniform=this.gl.getUniformLocation(i,"uCameraPos"),this.shaderProgramLocations.shadowParamsUniform=this.gl.getUniformLocation(i,"uShadowParams"),this.shaderProgramLocations.shadowMapSamplerUniform=this.gl.getUniformLocation(i,"uShadowMapSampler"),this.shaderProgramLocations.shadowMapLightMatrixUniform=this.gl.getUniformLocation(i,"uShadowMapLightMatrix"),this.shaderProgramLocations.hasEnvUniform=this.gl.getUniformLocation(i,"uHasEnv"),this.shaderProgramLocations.irradianceMapUniform=this.gl.getUniformLocation(i,"uIrradianceMap"),this.shaderProgramLocations.prefilteredEnvUniform=this.gl.getUniformLocation(i,"uPrefilteredEnv"),this.shaderProgramLocations.brdfLUTUniform=this.gl.getUniformLocation(i,"uBRDFLUT")):this.shaderProgramLocations.replaceableTypeUniform=this.gl.getUniformLocation(i,"uReplaceableType"),this.shaderProgramLocations.discardAlphaLevelUniform=this.gl.getUniformLocation(i,"uDiscardAlphaLevel"),this.shaderProgramLocations.tVertexAnimUniform=this.gl.getUniformLocation(i,"uTVertexAnim"),this.shaderProgramLocations.wireframeUniform=this.gl.getUniformLocation(i,"uWireframe"),!this.softwareSkinning){this.shaderProgramLocations.nodesMatricesAttributes=[];for(let s=0;s<re;++s)this.shaderProgramLocations.nodesMatricesAttributes[s]=this.gl.getUniformLocation(i,`uNodesMatrices[${s}]`)}this.isHD&&ye(this.gl)&&(this.envToCubemap=this.initShaderProgram(yi,Ti,{aPos:"aPos"},{uPMatrix:"uPMatrix",uMVMatrix:"uMVMatrix",uEquirectangularMap:"uEquirectangularMap"}),this.envSphere=this.initShaderProgram(Si,Pi,{aPos:"aPos"},{uPMatrix:"uPMatrix",uMVMatrix:"uMVMatrix",uEnvironmentMap:"uEnvironmentMap"}),this.convoluteDiffuseEnv=this.initShaderProgram(Mi,Ei,{aPos:"aPos"},{uPMatrix:"uPMatrix",uMVMatrix:"uMVMatrix",uEnvironmentMap:"uEnvironmentMap"}),this.prefilterEnv=this.initShaderProgram(Ai,Ui,{aPos:"aPos"},{uPMatrix:"uPMatrix",uMVMatrix:"uMVMatrix",uEnvironmentMap:"uEnvironmentMap",uRoughness:"uRoughness"}),this.integrateBRDF=this.initShaderProgram(wi,_i,{aPos:"aPos"},{}))}initGPUShaders(){if(!this.gpuShaderModule){this.gpuShaderModule=this.device.createShaderModule({label:"main",code:this.isHD?qi:Wi}),this.gpuDepthShaderModule=this.device.createShaderModule({label:"depth",code:ji});for(let e=0;e<this.model.Textures.length;++e){const t=this.model.Textures[e].Flags,r=t&Ft.WrapWidth?"repeat":"clamp-to-edge",n=t&Ft.WrapHeight?"repeat":"clamp-to-edge";this.rendererData.gpuSamplers[e]=this.device.createSampler({label:`texture sampler ${e}`,minFilter:"linear",magFilter:"linear",mipmapFilter:"linear",maxAnisotropy:16,addressModeU:r,addressModeV:n})}this.rendererData.gpuDepthSampler=this.device.createSampler({label:"texture depth sampler",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge",compare:"less",minFilter:"nearest",magFilter:"nearest"}),this.isHD&&(this.envShaderModeule=this.device.createShaderModule({label:"env",code:Di}),this.envPiepeline=this.device.createRenderPipeline({label:"env",layout:"auto",vertex:{module:this.envShaderModeule,buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:this.envShaderModeule,targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]},depthStencil:{depthWriteEnabled:!1,depthCompare:"always",format:"depth24plus"},multisample:{count:It}}),this.envVSUniformsBuffer=this.device.createBuffer({label:"env vs uniforms",size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.envVSBindGroupLayout=this.envPiepeline.getBindGroupLayout(0),this.envVSBindGroup=this.device.createBindGroup({label:"env vs bind group",layout:this.envVSBindGroupLayout,entries:[{binding:0,resource:{buffer:this.envVSUniformsBuffer}}]}),this.envSampler=this.device.createSampler({label:"env cube sampler",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge",addressModeW:"clamp-to-edge",minFilter:"linear",magFilter:"linear"}),this.envFSBindGroupLayout=this.envPiepeline.getBindGroupLayout(1),this.envToCubemapShaderModule=this.device.createShaderModule({label:"env to cubemap",code:Ri}),this.envToCubemapPiepeline=this.device.createRenderPipeline({label:"env to cubemap",layout:"auto",vertex:{module:this.envToCubemapShaderModule,buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:this.envToCubemapShaderModule,targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]}}),this.envToCubemapVSBindGroupLayout=this.envToCubemapPiepeline.getBindGroupLayout(0),this.envToCubemapSampler=this.device.createSampler({label:"env to cubemap sampler",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge",minFilter:"linear",magFilter:"linear"}),this.envToCubemapFSBindGroupLayout=this.envToCubemapPiepeline.getBindGroupLayout(1),this.convoluteDiffuseEnvShaderModule=this.device.createShaderModule({label:"convolute diffuse",code:Vi}),this.convoluteDiffuseEnvPiepeline=this.device.createRenderPipeline({label:"convolute diffuse",layout:"auto",vertex:{module:this.convoluteDiffuseEnvShaderModule,buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:this.convoluteDiffuseEnvShaderModule,targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]}}),this.convoluteDiffuseEnvVSBindGroupLayout=this.convoluteDiffuseEnvPiepeline.getBindGroupLayout(0),this.convoluteDiffuseEnvFSBindGroupLayout=this.convoluteDiffuseEnvPiepeline.getBindGroupLayout(1),this.convoluteDiffuseEnvSampler=this.device.createSampler({label:"convolute diffuse",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge",minFilter:"linear",magFilter:"linear"}),this.prefilterEnvShaderModule=this.device.createShaderModule({label:"prefilter env",code:Ii}),this.prefilterEnvPiepeline=this.device.createRenderPipeline({label:"prefilter env",layout:"auto",vertex:{module:this.prefilterEnvShaderModule,buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:this.prefilterEnvShaderModule,targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]}}),this.prefilterEnvVSBindGroupLayout=this.prefilterEnvPiepeline.getBindGroupLayout(0),this.prefilterEnvFSBindGroupLayout=this.prefilterEnvPiepeline.getBindGroupLayout(1),this.prefilterEnvSampler=this.device.createSampler({label:"prefilter env",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge",addressModeW:"clamp-to-edge",minFilter:"linear",magFilter:"linear"}))}}createWireframeBuffer(e){const t=this.model.Geosets[e].Faces,r=new Uint16Array(t.length*2);for(let n=0;n<t.length;n+=3)r[n*2]=t[n],r[n*2+1]=t[n+1],r[n*2+2]=t[n+1],r[n*2+3]=t[n+2],r[n*2+4]=t[n+2],r[n*2+5]=t[n];this.wireframeIndexBuffer[e]=this.gl.createBuffer(),this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,this.wireframeIndexBuffer[e]),this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER,r,this.gl.STATIC_DRAW)}createWireframeGPUBuffer(e){const t=this.model.Geosets[e].Faces,r=new Uint16Array(t.length*2);for(let n=0;n<t.length;n+=3)r[n*2]=t[n],r[n*2+1]=t[n+1],r[n*2+2]=t[n+1],r[n*2+3]=t[n+2],r[n*2+4]=t[n+2],r[n*2+5]=t[n];this.wireframeIndexGPUBuffer[e]=this.device.createBuffer({label:`wireframe ${e}`,size:r.byteLength,usage:GPUBufferUsage.INDEX,mappedAtCreation:!0}),new Uint16Array(this.wireframeIndexGPUBuffer[e].getMappedRange(0,this.wireframeIndexGPUBuffer[e].size)).set(r),this.wireframeIndexGPUBuffer[e].unmap()}initBuffers(){for(let e=0;e<this.model.Geosets.length;++e){const t=this.model.Geosets[e];if(this.vertexBuffer[e]=this.gl.createBuffer(),this.softwareSkinning?this.vertices[e]=new Float32Array(t.Vertices.length):(this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.vertexBuffer[e]),this.gl.bufferData(this.gl.ARRAY_BUFFER,t.Vertices,this.gl.STATIC_DRAW)),this.normalBuffer[e]=this.gl.createBuffer(),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.normalBuffer[e]),this.gl.bufferData(this.gl.ARRAY_BUFFER,t.Normals,this.gl.STATIC_DRAW),this.texCoordBuffer[e]=this.gl.createBuffer(),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.texCoordBuffer[e]),this.gl.bufferData(this.gl.ARRAY_BUFFER,t.TVertices[0],this.gl.STATIC_DRAW),this.isHD)this.skinWeightBuffer[e]=this.gl.createBuffer(),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.skinWeightBuffer[e]),this.gl.bufferData(this.gl.ARRAY_BUFFER,t.SkinWeights,this.gl.STATIC_DRAW),this.tangentBuffer[e]=this.gl.createBuffer(),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.tangentBuffer[e]),this.gl.bufferData(this.gl.ARRAY_BUFFER,t.Tangents,this.gl.STATIC_DRAW);else if(!this.softwareSkinning){this.groupBuffer[e]=this.gl.createBuffer(),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.groupBuffer[e]);const r=new Uint16Array(t.VertexGroup.length*4);for(let n=0;n<r.length;n+=4){const i=n/4,s=t.Groups[t.VertexGroup[i]];r[n]=s[0],r[n+1]=s.length>1?s[1]:re,r[n+2]=s.length>2?s[2]:re,r[n+3]=s.length>3?s[3]:re}this.gl.bufferData(this.gl.ARRAY_BUFFER,r,this.gl.STATIC_DRAW)}this.indexBuffer[e]=this.gl.createBuffer(),this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer[e]),this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER,t.Faces,this.gl.STATIC_DRAW)}}createGPUPipeline(e,t,r,n=this.gpuShaderModule,i={}){return this.device.createRenderPipeline({label:`pipeline ${e}`,layout:this.gpuPipelineLayout,vertex:{module:n,buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]},{arrayStride:12,attributes:[{shaderLocation:1,offset:0,format:"float32x3"}]},{arrayStride:8,attributes:[{shaderLocation:2,offset:0,format:"float32x2"}]},...this.isHD?[{arrayStride:16,attributes:[{shaderLocation:3,offset:0,format:"float32x4"}]},{arrayStride:8,attributes:[{shaderLocation:4,offset:0,format:"uint8x4"}]},{arrayStride:8,attributes:[{shaderLocation:5,offset:4,format:"unorm8x4"}]}]:[{arrayStride:4,attributes:[{shaderLocation:3,offset:0,format:"uint8x4"}]}]]},fragment:{module:n,targets:[{format:navigator.gpu.getPreferredCanvasFormat(),blend:t}]},depthStencil:r,multisample:{count:It},...i})}createGPUPipelineByLayer(e,t){return this.createGPUPipeline(...$i[e],void 0,{primitive:{cullMode:t?"none":"back"}})}getGPUPipeline(e){const t=e.FilterMode||0,r=!!((e.Shading||0)&_e.TwoSided),n=`${t}-${r}`;return this.gpuPipelines[n]||(this.gpuPipelines[n]=this.createGPUPipelineByLayer(t,r)),this.gpuPipelines[n]}initGPUPipeline(){this.vsBindGroupLayout=this.device.createBindGroupLayout({label:"vs bind group layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform",hasDynamicOffset:!1,minBindingSize:128+64*re}}]}),this.fsBindGroupLayout=this.device.createBindGroupLayout({label:"fs bind group layout2",entries:this.isHD?[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform",hasDynamicOffset:!1,minBindingSize:192}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d",multisampled:!1}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d",multisampled:!1}},{binding:5,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:6,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d",multisampled:!1}},{binding:7,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"comparison"}},{binding:8,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"depth",viewDimension:"2d",multisampled:!1}},{binding:9,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:10,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"cube",multisampled:!1}},{binding:11,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:12,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"cube",multisampled:!1}},{binding:13,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:14,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d",multisampled:!1}}]:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform",hasDynamicOffset:!1,minBindingSize:80}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float",viewDimension:"2d",multisampled:!1}}]}),this.gpuPipelineLayout=this.device.createPipelineLayout({label:"pipeline layout",bindGroupLayouts:[this.vsBindGroupLayout,this.fsBindGroupLayout]}),this.gpuWireframePipeline=this.createGPUPipeline("wireframe",{color:{operation:"add",srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{operation:"add",srcFactor:"one",dstFactor:"one-minus-src-alpha"}},{depthWriteEnabled:!0,depthCompare:"less-equal",format:"depth24plus"},void 0,{primitive:{topology:"line-list"}}),this.isHD&&(this.gpuShadowPipeline=this.createGPUPipeline("shadow",void 0,{depthWriteEnabled:!0,depthCompare:"less-equal",format:"depth32float"},this.gpuDepthShaderModule,{fragment:{module:this.gpuDepthShaderModule,targets:[]},multisample:{count:1}})),this.gpuRenderPassDescriptor={label:"basic renderPass",colorAttachments:[{view:null,clearValue:[.15,.15,.15,1],loadOp:"clear",storeOp:"store"}]}}initGPUBuffers(){for(let e=0;e<this.model.Geosets.length;++e){const t=this.model.Geosets[e];if(this.gpuVertexBuffer[e]=this.device.createBuffer({label:`vertex ${e}`,size:t.Vertices.byteLength,usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0}),new Float32Array(this.gpuVertexBuffer[e].getMappedRange(0,this.gpuVertexBuffer[e].size)).set(t.Vertices),this.gpuVertexBuffer[e].unmap(),this.gpuNormalBuffer[e]=this.device.createBuffer({label:`normal ${e}`,size:t.Normals.byteLength,usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0}),new Float32Array(this.gpuNormalBuffer[e].getMappedRange(0,this.gpuNormalBuffer[e].size)).set(t.Normals),this.gpuNormalBuffer[e].unmap(),this.gpuTexCoordBuffer[e]=this.device.createBuffer({label:`texCoord ${e}`,size:t.TVertices[0].byteLength,usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0}),new Float32Array(this.gpuTexCoordBuffer[e].getMappedRange(0,this.gpuTexCoordBuffer[e].size)).set(t.TVertices[0]),this.gpuTexCoordBuffer[e].unmap(),this.isHD)this.gpuSkinWeightBuffer[e]=this.device.createBuffer({label:`SkinWeight ${e}`,size:t.SkinWeights.byteLength,usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0}),new Uint8Array(this.gpuSkinWeightBuffer[e].getMappedRange(0,this.gpuSkinWeightBuffer[e].size)).set(t.SkinWeights),this.gpuSkinWeightBuffer[e].unmap(),this.gpuTangentBuffer[e]=this.device.createBuffer({label:`Tangents ${e}`,size:t.Tangents.byteLength,usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0}),new Float32Array(this.gpuTangentBuffer[e].getMappedRange(0,this.gpuTangentBuffer[e].size)).set(t.Tangents),this.gpuTangentBuffer[e].unmap();else{const n=new Uint8Array(t.VertexGroup.length*4);for(let i=0;i<n.length;i+=4){const s=i/4,o=t.Groups[t.VertexGroup[s]];n[i]=o[0],n[i+1]=o.length>1?o[1]:re,n[i+2]=o.length>2?o[2]:re,n[i+3]=o.length>3?o[3]:re}this.gpuGroupBuffer[e]=this.device.createBuffer({label:`group ${e}`,size:4*t.VertexGroup.length,usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0}),new Uint8Array(this.gpuGroupBuffer[e].getMappedRange(0,this.gpuGroupBuffer[e].size)).set(n),this.gpuGroupBuffer[e].unmap()}const r=Math.ceil(t.Faces.byteLength/4)*4;this.gpuIndexBuffer[e]=this.device.createBuffer({label:`index ${e}`,size:2*r,usage:GPUBufferUsage.INDEX,mappedAtCreation:!0}),new Uint16Array(this.gpuIndexBuffer[e].getMappedRange(0,r)).set(t.Faces),this.gpuIndexBuffer[e].unmap()}}initGPUUniformBuffers(){this.gpuVSUniformsBuffer=this.device.createBuffer({label:"vs uniforms",size:128+64*re,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.gpuVSUniformsBindGroup=this.device.createBindGroup({label:"vs uniforms bind group",layout:this.vsBindGroupLayout,entries:[{binding:0,resource:{buffer:this.gpuVSUniformsBuffer}}]})}initGPUMultisampleTexture(){this.gpuMultisampleTexture=this.device.createTexture({label:"multisample texutre",size:[this.canvas.width,this.canvas.height],format:navigator.gpu.getPreferredCanvasFormat(),usage:GPUTextureUsage.RENDER_ATTACHMENT,sampleCount:It})}initGPUDepthTexture(){this.gpuDepthTexture=this.device.createTexture({label:"depth texture",size:[this.canvas.width,this.canvas.height],format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT,sampleCount:It})}initGPUEmptyTexture(){const e=this.rendererData.gpuEmptyTexture=this.device.createTexture({label:"empty texture",size:[1,1],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});this.device.queue.writeTexture({texture:e},new Uint8Array([255,255,255,255]),{bytesPerRow:4},{width:1,height:1}),this.rendererData.gpuEmptyCubeTexture=this.device.createTexture({label:"empty cube texture",size:[1,1,6],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.rendererData.gpuDepthEmptyTexture=this.device.createTexture({label:"empty depth texture",size:[1,1],format:"depth32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST})}initCube(){const e=new Float32Array([-.5,-.5,-.5,-.5,.5,-.5,.5,-.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,-.5,-.5,-.5,-.5,.5,.5,-.5,.5,-.5,.5,.5,-.5,.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,-.5,-.5,.5,.5,.5,.5,-.5,-.5,.5,.5,.5,.5,.5,.5,.5,-.5,-.5,-.5,-.5,.5,-.5,-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,.5,-.5,-.5,-.5,-.5,-.5,.5,-.5,.5,-.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,-.5,.5,-.5,-.5,.5,.5,-.5,.5,-.5,.5,.5,-.5,.5,.5,.5,-.5,.5,.5,.5]);if(this.device){const t=this.cubeGPUVertexBuffer=this.device.createBuffer({label:"skeleton vertex",size:e.byteLength,usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0});new Float32Array(t.getMappedRange(0,t.size)).set(e),t.unmap()}else this.cubeVertexBuffer=this.gl.createBuffer(),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.cubeVertexBuffer),this.gl.bufferData(this.gl.ARRAY_BUFFER,e,this.gl.STATIC_DRAW)}initSquare(){this.squareVertexBuffer=this.gl.createBuffer(),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.squareVertexBuffer),this.gl.bufferData(this.gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]),this.gl.STATIC_DRAW)}initBRDFLUT(){if(!ye(this.gl)||!this.isHD||!this.colorBufferFloatExt)return;this.brdfLUT=this.gl.createTexture(),this.gl.activeTexture(this.gl.TEXTURE0),this.gl.bindTexture(this.gl.TEXTURE_2D,this.brdfLUT),this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RG16F,ht,ht,0,this.gl.RG,this.gl.FLOAT,null),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_S,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_T,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MAG_FILTER,this.gl.LINEAR);const e=this.gl.createFramebuffer();this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,e),this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER,this.gl.COLOR_ATTACHMENT0,this.gl.TEXTURE_2D,this.brdfLUT,0),this.gl.useProgram(this.integrateBRDF.program),this.gl.viewport(0,0,ht,ht),this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.squareVertexBuffer),this.gl.enableVertexAttribArray(this.integrateBRDF.attributes.aPos),this.gl.vertexAttribPointer(this.integrateBRDF.attributes.aPos,2,this.gl.FLOAT,!1,0,0),this.gl.drawArrays(this.gl.TRIANGLES,0,6),this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null),this.gl.deleteFramebuffer(e)}initGPUBRDFLUT(){const e=this.device.createShaderModule({label:"integrate brdf",code:Gi});this.gpuBrdfLUT=this.device.createTexture({label:"brdf",size:[ht,ht],format:"rg16float",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});const t=new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]),r=this.device.createBuffer({label:"brdf square",size:t.byteLength,usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0});new Float32Array(r.getMappedRange(0,r.size)).set(t),r.unmap();const n=this.device.createCommandEncoder({label:"integrate brdf"}),i=n.beginRenderPass({label:"integrate brdf",colorAttachments:[{view:this.gpuBrdfLUT.createView(),clearValue:[0,0,0,1],loadOp:"clear",storeOp:"store"}]});i.setPipeline(this.device.createRenderPipeline({label:"integrate brdf",layout:"auto",vertex:{module:e,buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:e,targets:[{format:"rg16float"}]}})),i.setVertexBuffer(0,r),i.draw(6),i.end();const s=n.finish();this.device.queue.submit([s]),this.device.queue.onSubmittedWorkDone().finally(()=>{r.destroy()}),this.gpuBrdfSampler=this.device.createSampler({label:"brdf lut",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge",minFilter:"linear",magFilter:"linear"})}updateGlobalSequences(e){for(let t=0;t<this.rendererData.globalSequencesFrames.length;++t)this.rendererData.globalSequencesFrames[t]+=e,this.rendererData.globalSequencesFrames[t]>this.model.GlobalSequences[t]&&(this.rendererData.globalSequencesFrames[t]=0)}updateNode(e){const t=this.interp.vec3(or,e.node.Translation),r=this.interp.quat(ar,e.node.Rotation),n=this.interp.vec3(lr,e.node.Scaling);!t&&!r&&!n?Vr(e.matrix):t&&!r&&!n?An(e.matrix,t):!t&&r&&!n?Lt(e.matrix,r,e.node.PivotPoint):_n(e.matrix,r||cr,t||hr,n||fr,e.node.PivotPoint),(e.node.Parent||e.node.Parent===0)&&Dt(e.matrix,this.rendererData.nodes[e.node.Parent].matrix,e.matrix);const i=e.node.Flags&Ye.BillboardedLockX||e.node.Flags&Ye.BillboardedLockY||e.node.Flags&Ye.BillboardedLockZ;e.node.Flags&Ye.Billboarded?(Ee(Ze,e.node.PivotPoint,e.matrix),(e.node.Parent||e.node.Parent===0)&&(wn(Gt,this.rendererData.nodes[e.node.Parent].matrix),Wn(Gt,Gt),Lt($r,Gt,Ze),Dt(e.matrix,$r,e.matrix)),Lt(Kr,this.rendererData.cameraQuat,Ze),Dt(e.matrix,Kr,e.matrix)):i&&(Ee(Ze,e.node.PivotPoint,e.matrix),yt(Fe,e.node.PivotPoint),e.node.Flags&Ye.BillboardedLockX?Fe[0]+=1:e.node.Flags&Ye.BillboardedLockY?Fe[1]+=1:e.node.Flags&Ye.BillboardedLockZ&&(Fe[2]+=1),Ee(Fe,Fe,e.matrix),kr(Fe,Fe,Ze),be(We,1,0,0),zr(We,We,e.node.PivotPoint),Ee(We,We,e.matrix),kr(We,We,Ze),be(zt,-1,0,0),Nr(zt,zt,this.rendererData.cameraQuat),it(Jr,Fe,zt),it(Ot,Fe,Jr),tr(Ot,Ot),$n(Zr,We,Ot),Lt(Qr,Zr,Ze),Dt(e.matrix,Qr,e.matrix));for(const s of e.childs)this.updateNode(s)}findAlpha(e){const t=this.rendererData.geosetAnims[e];if(!t||t.Alpha===void 0)return 1;if(typeof t.Alpha=="number")return t.Alpha;const r=this.interp.num(t.Alpha);return r===null?1:r}getTexCoordMatrix(e){if(typeof e.TVertexAnimId=="number"){const t=this.rendererData.model.TextureAnims[e.TVertexAnimId],r=this.interp.vec3(or,t.Translation),n=this.interp.quat(ar,t.Rotation),i=this.interp.vec3(lr,t.Scaling);return Ir(me,n||cr,r||hr,i||fr),Rr(kt,me[0],me[1],0,me[4],me[5],0,me[12],me[13],0),kt}else return en}setLayerProps(e,t){const r=this.model.Textures[t];e.Shading&_e.TwoSided?this.gl.disable(this.gl.CULL_FACE):this.gl.enable(this.gl.CULL_FACE),e.FilterMode===Z.Transparent?this.gl.uniform1f(this.shaderProgramLocations.discardAlphaLevelUniform,.75):this.gl.uniform1f(this.shaderProgramLocations.discardAlphaLevelUniform,0),e.FilterMode===Z.None?(this.gl.disable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.depthMask(!0)):e.FilterMode===Z.Transparent?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA,this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA),this.gl.depthMask(!0)):e.FilterMode===Z.Blend?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA,this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA),this.gl.depthMask(!1)):e.FilterMode===Z.Additive?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFunc(this.gl.SRC_COLOR,this.gl.ONE),this.gl.depthMask(!1)):e.FilterMode===Z.AddAlpha?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE),this.gl.depthMask(!1)):e.FilterMode===Z.Modulate?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.ZERO,this.gl.SRC_COLOR,this.gl.ZERO,this.gl.ONE),this.gl.depthMask(!1)):e.FilterMode===Z.Modulate2x&&(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.DST_COLOR,this.gl.SRC_COLOR,this.gl.ZERO,this.gl.ONE),this.gl.depthMask(!1)),r.Image?(this.gl.activeTexture(this.gl.TEXTURE0),this.gl.bindTexture(this.gl.TEXTURE_2D,this.rendererData.textures[r.Image]),this.gl.uniform1i(this.shaderProgramLocations.samplerUniform,0),this.gl.uniform1f(this.shaderProgramLocations.replaceableTypeUniform,0)):(r.ReplaceableId===1||r.ReplaceableId===2)&&(this.gl.uniform3fv(this.shaderProgramLocations.replaceableColorUniform,this.rendererData.teamColor),this.gl.uniform1f(this.shaderProgramLocations.replaceableTypeUniform,r.ReplaceableId)),e.Shading&_e.NoDepthTest&&this.gl.disable(this.gl.DEPTH_TEST),e.Shading&_e.NoDepthSet&&this.gl.depthMask(!1),this.gl.uniformMatrix3fv(this.shaderProgramLocations.tVertexAnimUniform,!1,this.getTexCoordMatrix(e))}setLayerPropsHD(e,t){const r=t[0],n=this.rendererData.materialLayerTextureID[e],i=this.rendererData.materialLayerNormalTextureID[e],s=this.rendererData.materialLayerOrmTextureID[e],o=n[0],l=this.model.Textures[o],h=r?.ShaderTypeId===1?i[0]:n[1],a=this.model.Textures[h],c=r?.ShaderTypeId===1?s[0]:n[2],d=this.model.Textures[c];if(r.Shading&_e.TwoSided?this.gl.disable(this.gl.CULL_FACE):this.gl.enable(this.gl.CULL_FACE),r.FilterMode===Z.Transparent?this.gl.uniform1f(this.shaderProgramLocations.discardAlphaLevelUniform,.75):this.gl.uniform1f(this.shaderProgramLocations.discardAlphaLevelUniform,0),r.FilterMode===Z.None?(this.gl.disable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.depthMask(!0)):r.FilterMode===Z.Transparent?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA,this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA),this.gl.depthMask(!0)):r.FilterMode===Z.Blend?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA,this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA),this.gl.depthMask(!1)):r.FilterMode===Z.Additive?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFunc(this.gl.SRC_COLOR,this.gl.ONE),this.gl.depthMask(!1)):r.FilterMode===Z.AddAlpha?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE),this.gl.depthMask(!1)):r.FilterMode===Z.Modulate?(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.ZERO,this.gl.SRC_COLOR,this.gl.ZERO,this.gl.ONE),this.gl.depthMask(!1)):r.FilterMode===Z.Modulate2x&&(this.gl.enable(this.gl.BLEND),this.gl.enable(this.gl.DEPTH_TEST),this.gl.blendFuncSeparate(this.gl.DST_COLOR,this.gl.SRC_COLOR,this.gl.ZERO,this.gl.ONE),this.gl.depthMask(!1)),this.gl.activeTexture(this.gl.TEXTURE0),this.gl.bindTexture(this.gl.TEXTURE_2D,this.rendererData.textures[l.Image]),this.gl.uniform1i(this.shaderProgramLocations.samplerUniform,0),r.Shading&_e.NoDepthTest&&this.gl.disable(this.gl.DEPTH_TEST),r.Shading&_e.NoDepthSet&&this.gl.depthMask(!1),typeof r.TVertexAnimId=="number"){const p=this.rendererData.model.TextureAnims[r.TVertexAnimId],f=this.interp.vec3(or,p.Translation),u=this.interp.quat(ar,p.Rotation),g=this.interp.vec3(lr,p.Scaling);Ir(me,u||cr,f||hr,g||fr),Rr(kt,me[0],me[1],0,me[4],me[5],0,me[12],me[13],0),this.gl.uniformMatrix3fv(this.shaderProgramLocations.tVertexAnimUniform,!1,kt)}else this.gl.uniformMatrix3fv(this.shaderProgramLocations.tVertexAnimUniform,!1,en);this.gl.activeTexture(this.gl.TEXTURE1),this.gl.bindTexture(this.gl.TEXTURE_2D,this.rendererData.textures[a.Image]),this.gl.uniform1i(this.shaderProgramLocations.normalSamplerUniform,1),this.gl.activeTexture(this.gl.TEXTURE2),this.gl.bindTexture(this.gl.TEXTURE_2D,this.rendererData.textures[d.Image]),this.gl.uniform1i(this.shaderProgramLocations.ormSamplerUniform,2),this.gl.uniform3fv(this.shaderProgramLocations.replaceableColorUniform,this.rendererData.teamColor)}};function Oe(e,t,r={}){const{interval:n,globalSequences:i=[],globalTime:s=t,fallback:o=0,quaternion:l=!1}=r;if(e==null)return o;if(typeof e=="number"||Array.isArray(e)||ArrayBuffer.isView(e))return e;let h=n?.[0]??-1/0,a=n?.[1]??1/0;const c=e.GlobalSeqId;Number.isInteger(c)&&c>=0&&i[c]>0&&(a=i[c],h=0,t=(s%a+a)%a);const d=e.Keys||[];let p=0,f=d.length;for(;p<f;){const P=p+f>>>1;d[P].Frame<h?p=P+1:f=P}const u=p;for(f=d.length;p<f;){const P=p+f>>>1;d[P].Frame<=a?p=P+1:f=P}const g=p-1;if(u>g)return o;let v=d[u],x=v;if(t>=d[g].Frame)v=x=d[g];else if(t>v.Frame){let P=u,A=g;for(;P+1<A;){const C=P+A>>1;d[C].Frame<=t?P=C:A=C}v=d[P],x=d[A]}const y=v.Vector,b=x.Vector,T=typeof o=="number";if(v===x||e.LineType===0)return T?y[0]:Array.from(y);const m=Math.max(0,Math.min(1,(t-v.Frame)/(x.Frame-v.Frame)));if(l){if(m===0||m===1)return Array.from(m===0?y:b);const P=new W().fromArray(y).normalize(),A=new W().fromArray(b).normalize();if((e.LineType===2||e.LineType===3)&&v.OutTan&&x.InTan){const C=P.clone().slerp(A,m),w=new W().fromArray(v.OutTan).normalize().slerp(new W().fromArray(x.InTan).normalize(),m);return C.slerp(w,2*m*(1-m)).normalize().toArray()}return P.slerp(A,m).normalize().toArray()}const S=Array.from(y,(P,A)=>{if((e.LineType===2||e.LineType===3)&&v.OutTan&&x.InTan){const C=v.OutTan[A],w=x.InTan[A];return e.LineType===3?(1-m)**3*P+3*m*(1-m)**2*C+3*m*m*(1-m)*w+m**3*b[A]:(2*m**3-3*m*m+1)*P+(m**3-2*m*m+m)*C+(m**3-m*m)*w+(-2*m**3+3*m*m)*b[A]}return P+(b[A]-P)*m});return T?S[0]:S}function J(e){const t=new Map;for(const r of["Nodes","Bones","Helpers","Attachments","EventObjects","CollisionShapes","ParticleEmitters","ParticleEmitters2","ParticleEmitterPopcorns","Lights","RibbonEmitters"])for(const n of e?.[r]||[])n&&Number.isInteger(n.ObjectId)&&t.set(n.ObjectId,n);return[...t.values()].sort((r,n)=>r.ObjectId-n.ObjectId)}function ur(e,t=0,r=-1,n=t){const i=J(e),s=new Map(i.map(p=>[p.ObjectId,p])),o=new Map,l=new Set,h=e.Sequences?.[r]?.Interval,a=r<0||!h,c={interval:h,globalSequences:e.GlobalSequences,globalTime:n};function d(p){if(o.has(p))return o.get(p);const f=s.get(p);if(!f||l.has(p))return new Re;l.add(p);let u=new Re;if(!a){const g=new V().fromArray(Oe(f.Translation,t,{...c,fallback:[0,0,0]})),v=new W().fromArray(Oe(f.Rotation,t,{...c,fallback:[0,0,0,1],quaternion:!0})),x=new V().fromArray(Oe(f.Scaling,t,{...c,fallback:[1,1,1]})),y=new V().fromArray(f.PivotPoint||e.PivotPoints?.[p]||[0,0,0]);u.compose(g,v,x);const b=y.clone().applyMatrix4(u).sub(g);if(u.setPosition(g.add(y).sub(b)),f.Parent!=null&&s.has(f.Parent)){let T=d(f.Parent);if(f.Flags&7){const m=new V,S=new W,P=new V;T.decompose(m,S,P),f.Flags&1&&m.set(0,0,0),f.Flags&2&&S.identity(),f.Flags&4&&P.set(1,1,1),T=new Re().compose(m,S,P)}u.premultiply(T)}}return l.delete(p),o.set(p,u),u}return i.forEach(p=>d(p.ObjectId)),o}function tn(e,t,r=new Float32Array(e.Vertices.length)){const n=e.Vertices,i=e.SkinWeights;for(let s=0;s<n.length/3;s++){const o=s*3,l=n[o],h=n[o+1],a=n[o+2];let c=0,d=0,p=0,f=0;const u=i?.length>=(s+1)*8,g=u?[i[s*8],i[s*8+1],i[s*8+2],i[s*8+3]]:e.Groups?.[e.VertexGroup?.[s]]||[];for(let v=0;v<g.length;v++){const x=u?i[s*8+4+v]/255:1;if(!x)continue;const y=t.get(g[v])?.elements;c+=(y?y[0]*l+y[4]*h+y[8]*a+y[12]:l)*x,d+=(y?y[1]*l+y[5]*h+y[9]*a+y[13]:h)*x,p+=(y?y[2]*l+y[6]*h+y[10]*a+y[14]:a)*x,f+=x}r[o]=f?c/f:l,r[o+1]=f?d/f:h,r[o+2]=f?p/f:a}return r}function rn(e,t,r,n,i=r){const s=e.GeosetAnims?.find(d=>d.GeosetId===t),o={interval:e.Sequences?.[n]?.Interval,globalSequences:e.GlobalSequences,globalTime:i},l=d=>Number.isFinite(d)?Math.max(0,Math.min(1,d)):1,h=!o.interval,a=s?.Flags&2?h&&s.Color?.Keys?s._MdxDefaults?.Color??[1,1,1]:Oe(s.Color,r,{...o,fallback:[1,1,1]}):[1,1,1],c=h&&s?.Alpha?.Keys?s._MdxDefaults?.Alpha??1:Oe(s?.Alpha,r,{...o,fallback:1});return{color:Array.from(a,l),alpha:l(c)}}function dr(e,t,r){const n=new V;let i=0,s=0;for(const o of e.Geosets||[]){const l=(o.Vertices?.length||0)/3,h=o.SkinWeights,a=[];for(let d=0;d<l;d++){let p=0;if(h?.length===l*8){let f=0;for(let u=0;u<4;u++){const g=h[d*8+u+4];f+=g,h[d*8+u]===t&&(p+=g)}p=f?p/f:0}else{const f=o.Groups?.[o.VertexGroup?.[d]]||[];p=f.length?f.filter(u=>u===t).length/f.length:0}p&&a.push([d,p])}if(!a.length)continue;const c=tn(o,r);for(const[d,p]of a)n.add(new V().fromArray(c,d*3)),s+=p,i++}return i?{center:n.divideScalar(i),influence:s/i}:null}const Ne={move:"Translation",rotate:"Rotation",scale:"Scaling"},nn={Translation:[0,0,0],Rotation:[0,0,0,1],Scaling:[1,1,1]},pr=["X","Y","Z"],gr=e=>new V().fromArray(e);function mr(e,t={}){const r=Ne[e==="translate"?"move":e];return!!(r&&(t[r.toLowerCase()]||t[r]))}function Zi(e="xy"){const t=String(e).toLowerCase();if(t==="xy")return 2;if(t==="xz"||t==="zx")return 1;if(t==="yz")return 0;throw new Error("Choose the XY, ZX, or YZ workplane.")}function vr(e,t={}){const r=Array.from(e);return t.workplaneEnabled&&(r[Zi(t.workplane)]=0),r}function xr(e,t){if(mr(e,t.restrictions))throw new Error(`${Ne[e]} is restricted. Release its restriction to edit it.`)}function Qi(e,t,r={}){const{mode:n="move",axis:i,amount:s=0}=r;if(!Ne[n])throw new Error("Choose Move, Rotate, or Scale.");if(xr(n,r),n!=="move")throw new Error("Rest-pose nodes have position pivots. Use Move to position them; rotate or scale in Movement.");const o=r.values?Array.from(r.values):pr.map(c=>c===String(i).toUpperCase()?Number(s):0);if(o.length!==3||o.some(c=>!Number.isFinite(c)))throw new Error("Enter finite X, Y, and Z values.");const l=vr(o,r),a=on(e,t).map(c=>{const d=c.PivotPoint||e.PivotPoints?.[c.ObjectId]||[0,0,0],p=Array.from(d,(f,u)=>f+l[u]);if(p.length!==3||p.some(f=>!Number.isFinite(f)||Math.abs(f)>34028234663852886e22))throw new Error("The resulting pivot must contain finite model coordinates.");return{node:c,pivot:new Float32Array(p)}});if(l.every(c=>c===0))return 0;e.PivotPoints||=[];for(const{node:c,pivot:d}of a)e.PivotPoints[c.ObjectId]=c.PivotPoint=d;return a.length}function sn(e,t,r,n,i){const s=e.Sequences?.[i]?.Interval;if(!s)throw new Error("Choose an animation before editing movement.");const o=e.GlobalSequences?.[t[r]?.GlobalSeqId],l=Math.round(Number(n));if(!Number.isFinite(l))throw new Error("Choose a valid keyframe time.");return o>0?(l%o+o)%o:Math.max(s[0],Math.min(s[1],l))}function de(e,t,r,n,i){return Array.from(Oe(t[r],n,{interval:e.Sequences?.[i]?.Interval,globalSequences:e.GlobalSequences,globalTime:n,fallback:nn[r],quaternion:r==="Rotation"}))}function on(e,t){const r=new Set(t),n=J(e).filter(i=>r.has(i.ObjectId));if(!n.length)throw new Error("Select a bone or node first.");return n}function Xt(e,t){const r=t.get(e.Parent)?.clone()||new Re;if(!(e.Flags&7))return r;const n=new V,i=new W,s=new V;return r.decompose(n,i,s),e.Flags&1&&n.set(0,0,0),e.Flags&2&&i.identity(),e.Flags&4&&s.set(1,1,1),r.compose(n,i,s)}function an(e,t,r,n,i,s,o){const l=sn(e,t,r,n,i),h=t[r],a=h?.Keys?h:{LineType:1,Keys:[]},c=e.Sequences[i].Interval,d=e.GlobalSequences?.[a.GlobalSeqId]>0,p=(v,x)=>{const y={Frame:v,Vector:new Float32Array(x)};if(a.LineType>=2){const b=a.LineType===2&&r!=="Rotation"?x.map(()=>0):x;y.InTan=new Float32Array(b),y.OutTan=new Float32Array(b)}return y};if(!d&&!a.Keys.some(v=>v.Frame>=c[0]&&v.Frame<=c[1]))for(const v of new Set(c))a.Keys.push(p(v,de(e,t,r,v,i)));const f=a.Keys.findIndex(v=>v.Frame===l),u=f>=0?a.Keys[f]:null,g=p(l,s);if(u&&a.LineType>=2)for(const v of["InTan","OutTan"])u[v]&&(g[v]=new Float32Array(o?o(u[v],a.LineType):u[v]));f<0?a.Keys.push(g):a.Keys[f]=g,a.Keys.sort((v,x)=>v.Frame-x.Frame),t[r]=a}const ln=e=>{for(const t of e)if(!Number.isFinite(t))return!1;return!0};function ct(e,t,r,n,i={}){const s=e.Sequences?.[n]?.Interval;if(!s||!Number.isInteger(r)||r<s[0]||r>s[1])throw new Error("POSE needs a whole millisecond inside an animation.");const o=new Map(J(e).map(a=>[a.ObjectId,a])),l=new Set,h=[];for(const a of t){const c=o.get(a.id),d=a.property;if(!c||!Object.values(Ne).includes(d))throw new Error("POSE target or native channel is missing.");const p=`${a.id}:${d}`;if(l.has(p))throw new Error("POSE chains cannot write the same channel twice.");if(l.add(p),mr(Object.keys(Ne).find(m=>Ne[m]===d),i))throw new Error(`${d} is restricted.`);const f=c[d];if(Number.isInteger(f?.GlobalSeqId)&&f.GlobalSeqId>=0)throw new Error("POSE cannot change a global controller. Choose a local transform track.");let u=Array.from(a.value||[]);if(u.length!==(d==="Rotation"?4:3)||u.some(m=>!Number.isFinite(m)||Math.abs(m)>34028234663852886e22))throw new Error("POSE produced an invalid native transform.");const g=de(e,c,d,r,n);if(d==="Rotation"){if(Math.hypot(...u)<1e-12)throw new Error("POSE produced a zero quaternion.");const m=new W().fromArray(u).normalize(),S=new W().fromArray(g).normalize();if(1-Math.abs(m.dot(S))<1e-12)continue;const P=f?.Keys?.find(A=>A.Frame===r)?.Vector||g;m.dot(new W().fromArray(P))<0&&m.set(-m.x,-m.y,-m.z,-m.w),u=m.toArray()}else if(u.every((m,S)=>Math.abs(m-g[S])<=1e-8))continue;if(f&&!f.Keys&&Array.from(f).some((m,S)=>m!==nn[d][S]))throw new Error("A static transform cannot become a local POSE track without changing other animations.");if(f?.Keys&&(![0,1,2,3].includes(f.LineType)||f.Keys.some(m=>!Number.isInteger(m.Frame)||m.Vector?.length!==u.length||!ln(m.Vector)||f.LineType>=2&&["InTan","OutTan"].some(S=>m[S]?.length!==u.length||!ln(m[S]||[])))))throw new Error("The existing transform controller is malformed.");const x=!f?.Keys?.some(m=>m.Frame>=s[0]&&m.Frame<=s[1])?[...new Set([r,...s])]:[r];if(e.Sequences.some((m,S)=>S!==n&&m.Interval&&x.some(P=>P>=m.Interval[0]&&P<=m.Interval[1])))throw new Error("POSE would change a timestamp shared by another animation.");const y={...c};f!==void 0&&(y[d]=structuredClone(f));const b=f?.Keys?.find(m=>m.Frame===r)?.Vector||g,T=d==="Rotation"?new W().fromArray(u).multiply(new W().fromArray(b).normalize().invert()):null;an(e,y,d,r,n,u,(m,S)=>d==="Rotation"?T.clone().multiply(new W().fromArray(m)).toArray():d==="Scaling"?Array.from(m,(P,A)=>P*(b[A]===0?1:u[A]/b[A])):S===3?Array.from(m,(P,A)=>P+u[A]-b[A]):Array.from(m)),h.push({id:a.id,property:d,track:y[d]})}return h}function br(e,t,r,n,i={}){const s=ct(e,t,r,n,i),o=new Map(J(e).map(l=>[l.ObjectId,l]));for(const{id:l,property:h,track:a}of s)o.get(l)[h]=a;return s.length}function yr(e,t,r,n,i={}){if(i.restPose)return Qi(e,t,i);const{mode:s="rotate",space:o="local",axis:l,amount:h=0}=i,a=Ne[s];if(!a)throw new Error("Choose Move, Rotate, or Scale.");if(xr(s,i),!["world","local"].includes(o))throw new Error("Choose World or Local axes.");const c=i.values?Array.from(i.values):pr.map(b=>b===String(l).toUpperCase()?Number(h):s==="scale"?1:0);if(c.length!==3||c.some(b=>!Number.isFinite(b)))throw new Error("Enter finite X, Y, and Z values.");if(s==="scale"&&c.some(b=>Math.abs(b)<1e-6))throw new Error("Scale must not be zero.");const d=on(e,t);d.forEach(b=>sn(e,b,a,r,n));const p=ur(e,r,n,r),f=new Map;if(s==="rotate"&&i.rotateOnOwnAxis){for(const b of d){if(!(e.Bones||[]).includes(b))continue;const T=dr(e,b.ObjectId,p);T&&f.set(b.ObjectId,T)}f.size&&xr("move",i)}const u=new Map;if(s==="move")for(const b of d){const T=gr(c),m=Xt(b,p);o==="local"&&(T.applyQuaternion(new W().fromArray(de(e,b,"Rotation",r,n)).normalize()),T.applyMatrix4(m).sub(new V().applyMatrix4(m))),u.set(b.ObjectId,T.fromArray(vr(T.toArray(),i)))}const g=new Map(J(e).map(b=>[b.ObjectId,b])),v=(b,T=new Set)=>{if(b.Flags&1||T.has(b.ObjectId))return new V;T.add(b.ObjectId);const m=g.get(b.Parent);return m?u.get(m.ObjectId)?.clone()||v(m,T):new V},x=new W().setFromEuler(new Bt(...c.map(b=>b*Math.PI/180),"XYZ")),y=d.map(b=>{const T=de(e,b,a,r,n),m=Xt(b,p),S=new W;if(m.decompose(new V,S,new V),s==="rotate"){const C=o==="world"?S.clone().invert().multiply(x).multiply(S):x,w=_=>{const F=new W().fromArray(_).normalize();return(o==="local"?F.multiply(C):F.premultiply(C)).normalize().toArray()};return{node:b,value:w(T),tangent:w}}if(s==="move"){const C=u.get(b.ObjectId).clone().sub(v(b));if(Math.abs(m.determinant())<1e-12)throw new Error("This parent has zero scale. Restore its scale before moving in world axes.");const w=m.clone().invert();return C.applyMatrix4(w).sub(new V().applyMatrix4(w)),C.lengthSq()<1e-24?null:{node:b,value:gr(T).add(C).toArray(),tangent:(_,F)=>F===3?gr(_).add(C).toArray():Array.from(_)}}const P=new W;p.get(b.ObjectId)?.decompose(new V,P,new V);const A=o==="world"?pr.map((C,w)=>{const _=new V().setComponent(w,1).applyQuaternion(P);return c.reduce((F,L,z)=>F+L*_.getComponent(z)**2,0)}):c;return{node:b,value:T.map((C,w)=>C*A[w]),tangent:C=>Array.from(C,(w,_)=>w*A[_])}}).filter(Boolean);for(const{node:b,value:T,tangent:m}of y)an(e,b,a,r,n,T,m);if(f.size){const b=new Map(J(e).map(m=>[m.ObjectId,m])),T=m=>{let S=0,P=b.get(m.Parent);const A=new Set([m.ObjectId]);for(;P&&!A.has(P.ObjectId);)S++,A.add(P.ObjectId),P=b.get(P.Parent);return S};for(const m of[...d].sort((S,P)=>T(S)-T(P))){const S=f.get(m.ObjectId);if(!S)continue;const P=dr(e,m.ObjectId,ur(e,r,n,r)),A=S.center.clone().sub(P.center).divideScalar(S.influence);A.lengthSq()>1e-20&&yr(e,[m.ObjectId],r,n,{...i,mode:"move",space:"world",values:A.toArray()})}}return y.length}const te=e=>e?.isVector3?e.clone():new V().fromArray(e),Ae=e=>{if(!e)return!1;for(let t=0;t<e.length;t++)if(!Number.isFinite(e[t]))return!1;return!0},hn=e=>[...e.Bones||[],...e.Helpers||[]],Tr=(e,t,r,n)=>({interval:e.Sequences?.[r]?.Interval,globalSequences:e.GlobalSequences,globalTime:n});function Sr(e,t){const r=J(e),n=new Map(r.map(i=>[i.ObjectId,i]));if(new Set(t).size!==t.length||t.some(i=>!n.has(i)))throw new Error("Choose distinct nodes from this model.");for(const i of t){const s=new Set;let o=n.get(i);for(;o;){if(s.has(o.ObjectId))throw new Error("POSE cannot use a cyclic hierarchy.");if(s.add(o.ObjectId),o.Flags&120)throw new Error("POSE cannot use billboarding joints or ancestors.");if(o.Flags&7)throw new Error("POSE cannot use non-default inherited transforms: this preview renderer does not reproduce those flags.");if(!Ae(o.PivotPoint||e.PivotPoints?.[o.ObjectId]))throw new Error("A POSE joint has a missing or invalid pivot.");if(o.Parent==null||o.Parent<0)break;if(o=n.get(o.Parent),!o)throw new Error("A POSE joint has a missing parent.")}}return n}const qe=e=>e?.joints||[e?.root,e?.middle,e?.end];function Ht(e,t){const r=qe(t),n=Sr(e,r);if(t.grip&&(t.grip.length!==3||!Ae(t.grip)))throw new Error("The limb grip must be a finite point.");const i=new Set(hn(e).map(s=>s.ObjectId));if(!i.has(t.root)||!i.has(t.middle))throw new Error("The upper joint and elbow / knee must be Bone or Helper nodes.");if(r.length<3||r[1]!==t.middle||r[0]!==t.root||r.at(-1)!==t.end||r.slice(1).some((s,o)=>t.joints?!ut(e,s,r[o]):n.get(s).Parent!==r[o]))throw new Error("POSE requires two adjacent parent links. Include intervening helpers; joints are never skipped.");return r.map(s=>n.get(s))}function Pr(e){const t=String(e?.Name||"").replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/(left|right)(hand|foot|wrist|ankle)/ig,"$1 $2").toLowerCase();return/chain|rein|guard|camera|over\s*head|cloth|cape|banner/.test(t)?e?.Name||"Object":/(?:^|[\s_.-])(?:hand|wrist)(?=$|[\s_0-9.\-])|(?:^|[\s_.-])[lr]ah$/.test(t)?"Hand":/hoof/.test(t)?"Hoof":/(?:^|[\s_.-])(?:foot|ankle|toe)(?=$|[\s_0-9.\-])/.test(t)?"Foot":/(?:pelvis|hips?)(?=$|[\s_0-9.\-])/.test(t)?"Pelvis":/chest|thorax/.test(t)?"Chest":/neck/.test(t)?"Neck":/(?:^|[\s_.-])wings?(?=$|[\s_0-9.\-])/.test(t)?"Wing":/head/.test(t)?"Head":/spine/.test(t)?"Spine":/(?:^|[\s_.-])tail(?=$|[\s_0-9.\-])/.test(t)?"Tail":/(?:root|body|abdomen)(?=$|[\s_0-9.\-])/.test(t)?"Body":e?.Name||"Object"}const le=(e,t,r,n)=>t.roles?.[r]||Pr(J(e).find(i=>i.ObjectId===r));function Le(e){if(!e||!Ae(e.elements)||e.determinant()<=1e-18)throw new Error("POSE requires a finite, nonsingular, positive transform.");const t=e.elements,r=[0,4,8].map(o=>new V(t[o],t[o+1],t[o+2])),n=r.map(o=>o.length()),i=Math.max(...n);if(Math.min(...n)<=1e-10||n.some(o=>Math.abs(o-i)>i*.02)||r.some((o,l)=>r.some((h,a)=>l!==a&&Math.abs(o.dot(h))>i*i*.02)))throw new Error("POSE supports positive uniform scale; nonuniform scale, reflection and shear are unsupported.");const s=new W;return e.decompose(new V,s,new V),s.normalize()}function cn(e){const t=e.elements,r=[0,4,8].map(n=>Math.hypot(t[n],t[n+1],t[n+2]));return(Math.max(...r)-Math.min(...r))/Math.max(...r)}function ve(e,t,r,n){if(!e.Sequences?.[r]?.Interval||!Number.isFinite(t)||!Number.isFinite(n))throw new Error("Choose a local animation pose before using POSE.");return ur(e,t,r,n)}function ft(e,t,r){return te(t.PivotPoint||e.PivotPoints[t.ObjectId]).applyMatrix4(r.get(t.ObjectId))}function St(e,t,r,n){return r.ObjectId===t.end&&t.grip?te(t.grip).applyMatrix4(n.get(r.ObjectId)):ft(e,r,n)}function ke(e,t,r,n=t,i=new WeakMap){return{matrices:ve(e,t,r,n),byId:new Map(J(e).map(s=>[s.ObjectId,s])),checked:new Set,validatedTracks:i}}function Ue(e,t,r,n,i=r,s=ke(e,r,n,i)){const o=Ht(e,t),{matrices:l,byId:h,checked:a,validatedTracks:c}=s;for(const b of o){let T=b;const m=[];for(;T&&!a.has(T.ObjectId);){for(const[S,P,A]of[["Translation",[0,0,0],!1],["Rotation",[0,0,0,1],!0],["Scaling",[1,1,1],!1]]){const C=T[S];if(C?.Keys&&c.get(C)!==P.length){if(C.Keys.some(_=>!Ae(_.Vector)||_.Vector.length!==P.length||A&&Math.hypot(..._.Vector)<1e-12))throw new Error("A POSE ancestor has an invalid transform key.");c.set(C,P.length)}const w=Oe(C,r,{...Tr(e,r,n,i),fallback:P,quaternion:A});if(!Ae(w)||w.length!==P.length||A&&Math.hypot(...w)<1e-12)throw new Error("A sampled POSE transform is invalid.");if(S==="Scaling"&&(w.some(_=>_<=1e-10)||w.some(_=>Math.abs(_-w[0])>Math.abs(w[0])*1e-5)))throw new Error("POSE supports positive uniform scale only.")}Le(l.get(T.ObjectId)),m.push(T.ObjectId),T=h.get(T.Parent)}for(const S of m)a.add(S)}const d=o.map(b=>St(e,t,b,l)),p=d[0],f=d[1],u=d.at(-1),g=d.slice(1).map((b,T)=>b.distanceTo(d[T]));let v=0;for(const b of o)v=Math.max(v,cn(l.get(b.ObjectId)));const x=Math.max(1e-7,g.reduce((b,T)=>b+T,0)*Math.max(2e-5,v*2));if(!Ae(d.flatMap(b=>b.toArray()))||Math.min(...g)<=1e-7)throw new Error("Choose joints with nonzero segment lengths.");const y=[o[0],o[1],o.at(-1)].map(b=>Le(l.get(b.ObjectId)));return{root:p,middle:f,end:u,points:d,lengths:g,tolerance:x,distortion:v,rotations:y,matrices:l}}function Pt(e,t,r){const n=s=>s.clone().addScaledVector(e,-s.dot(e));let i=t&&n(t);if((!i||i.lengthSq()<1e-12)&&(i=r&&n(r)),!i||i.lengthSq()<1e-12){const s=[new V(1,0,0),new V(0,1,0),new V(0,0,1)].sort((o,l)=>Math.abs(o.dot(e))-Math.abs(l.dot(e)))[0];i=n(s)}return i.normalize()}function Ji(e,t,r,n){if(t=te(t),!Ae(t.toArray())||r&&!Ae(te(r).toArray()))throw new Error("POSE target must be finite.");const{root:i,middle:s,end:o,lengths:[l,h],tolerance:a}=e,c=t.clone().sub(i),d=c.length();let p=d>a?c.divideScalar(d):o.clone().sub(i).normalize();p.lengthSq()<.5&&(p=s.clone().sub(i).normalize());const f=o.clone().sub(i).normalize();f.lengthSq()<.5&&f.copy(s).sub(i).normalize();const u=s.clone().sub(i),g=u.clone().addScaledVector(f,-u.dot(f)),v=new W().setFromUnitVectors(f,p),x=n?te(n):new V(0,0,1).applyQuaternion(e.rotations?.[0]||new W),y=Pt(p,r?te(r).sub(i):g.lengthSq()>a*a?g.applyQuaternion(v):null,x.applyQuaternion(v)),b=Math.abs(l-h),T=l+h,m=Math.max(Math.max(b,a*.1),Math.min(T,d)),S=(l*l-h*h+m*m)/(2*m),P=Math.sqrt(Math.max(0,l*l-S*S));return{middle:i.clone().addScaledVector(p,S).addScaledVector(y,P),end:i.clone().addScaledVector(p,m),bend:y,clamped:d<b-a||d>T+a}}function Qe(e,t,r,n,i,s,o){const h=Le(Xt(t,n)).invert().multiply(r).normalize(),a=new W().fromArray(Oe(t.Rotation,i,{...Tr(e,i,s,o),fallback:[0,0,0,1],quaternion:!0})).normalize();h.dot(a)<0&&h.set(-h.x,-h.y,-h.z,-h.w);const c={id:t.ObjectId,property:"Rotation",value:h.toArray()},d=ct(e,[c],i,s);for(const p of d)t[p.property]=p.track;return c}function fn(e,t,r,n,i,s,o,l){const h=t.grip&&St(e,t,r,i),a=[Qe(e,r,n,i,s,o,l)];if(h){const c=h.sub(St(e,t,r,ve(e,s,o,l))),d=Xt(r,i).clone().invert(),p=c.applyMatrix4(d).sub(new V().applyMatrix4(d)),f={id:r.ObjectId,property:"Translation",value:te(de(e,r,"Translation",s,o)).add(p).toArray()};for(const u of ct(e,[f],s,o))r[u.property]=u.track;a.push(f)}return a}function Wt(e,t,r,n,i,{pole:s,orientation:o,bendMemory:l,strict:h=!1,globalTime:a=r,validatedTracks:c=new WeakMap}={}){if(o&&(!Ae(o)||o.length!==4||Math.hypot(...o)<1e-12))throw new Error("POSE endpoint orientation must be a finite quaternion.");const d=Ue(e,t,r,n,a,ke(e,r,n,a,c));if(qe(t).length>3||d.distortion>2e-4)return es(e,t,d,r,n,i,{pole:s,orientation:o,strict:h,bendMemory:l,globalTime:a,validatedTracks:c});const p=Ji(d,i,s,l);if(!s&&te(i).distanceToSquared(d.end)<1e-20&&(!o||1-Math.abs(new W().fromArray(o).normalize().dot(d.rotations[2]))<1e-12))return{changes:[],bend:p.bend.toArray(),clamped:!1,pose:d};if(h&&p.clamped)throw new Error("Pinned foot is out of reach. Move the body closer; this preview is rejected.");const f=Ht(e,t),u=[],g=(P,A)=>new W().setFromUnitVectors(P.normalize(),A.normalize()),v=g(d.middle.clone().sub(d.root),p.middle.clone().sub(d.root)).multiply(d.rotations[0]);u.push(Qe(e,f[0],v,d.matrices,r,n,a));let x=ve(e,r,n,a),y=ft(e,f[1],x),b=St(e,t,f[2],x);if(y.distanceTo(p.middle)>d.tolerance*4)throw new Error("This hierarchy does not preserve rigid limb motion. No pose was applied.");const T=g(b.sub(y),p.end.clone().sub(y)).multiply(Le(x.get(t.middle)));u.push(Qe(e,f[1],T,x,r,n,a)),x=ve(e,r,n,a);const m=o?new W().fromArray(o).normalize():d.rotations[2];u.push(...fn(e,t,f[2],m,x,r,n,a));const S=Ue(e,t,r,n,a,ke(e,r,n,a,c));if(S.root.distanceTo(d.root)>d.tolerance||S.end.distanceTo(p.end)>d.tolerance*4||S.lengths.some((P,A)=>Math.abs(P-d.lengths[A])>d.tolerance*4)||1-Math.abs(S.rotations[2].dot(m))>1e-7)throw new Error("POSE verification failed. The limb remains unchanged.");return{changes:u,bend:p.bend.toArray(),clamped:p.clamped,pose:S}}function es(e,t,r,n,i,s,{pole:o,orientation:l,strict:h,bendMemory:a,globalTime:c,validatedTracks:d}){const p=Ht(e,t),f=te(s),u=r.points.map(_=>_.clone()),g=r.lengths.reduce((_,F)=>_+F,0),v=Math.max(0,2*Math.max(...r.lengths)-g),x=f.distanceTo(u[0]),y=x>g+r.tolerance||x<v-r.tolerance;if(h&&y)throw new Error("Pinned foot is out of reach.");const b=f.clone().sub(u[0]).normalize(),T=Pt(b,r.middle.clone().sub(r.root),a&&te(a)),m=r.end.clone().sub(r.root).normalize();if(x<g-r.tolerance&&u.slice(1,-1).every(_=>_.clone().sub(u[0]).cross(m).length()<r.tolerance)){let _=0;const F=Math.sqrt(Math.max(0,g*g-x*x))*.25;for(let L=1;L<u.length-1;L++)_+=r.lengths[L-1],u[L].addScaledVector(T,Math.sin(Math.PI*_/g)*F)}if(o){const _=u.at(-1).clone().sub(u[0]).normalize(),F=Pt(_,u[1].clone().sub(u[0])),L=Pt(_,te(o).sub(u[0])),z=new W().setFromAxisAngle(_,Math.atan2(_.dot(F.clone().cross(L)),F.dot(L)));for(let M=1;M<u.length-1;M++)u[M].sub(u[0]).applyQuaternion(z).add(u[0])}if(x>=g){const _=f.clone().sub(u[0]).normalize();for(let F=1;F<u.length;F++)u[F].copy(u[F-1]).addScaledVector(_,r.lengths[F-1])}else{const _=u[0].clone();for(let F=0;F<4096;F++){u.at(-1).copy(f);for(let L=u.length-2;L>=0;L--){const z=u[L].clone().sub(u[L+1]);z.lengthSq()<1e-16&&z.copy(r.points[L]).sub(r.points[L+1]),u[L].copy(u[L+1]).addScaledVector(z.normalize(),r.lengths[L])}u[0].copy(_);for(let L=1;L<u.length;L++){const z=u[L].clone().sub(u[L-1]);z.lengthSq()<1e-16&&z.copy(r.points[L]).sub(r.points[L-1]),u[L].copy(u[L-1]).addScaledVector(z.normalize(),r.lengths[L-1])}if(u.at(-1).distanceTo(f)<Math.max(1e-6,g*1e-6))break}}for(let _=0;_<p.length-1;_++){const F=ve(e,n,i,c),L=ft(e,p[_],F),z=St(e,t,p[_+1],F).sub(L),M=u[_+1].clone().sub(u[_]);z.lengthSq()>1e-16&&M.lengthSq()>1e-16&&Qe(e,p[_],new W().setFromUnitVectors(z.normalize(),M.normalize()).multiply(Le(F.get(p[_].ObjectId))),F,n,i,c)}const S=l?new W().fromArray(l).normalize():r.rotations[2],P=fn(e,t,p.at(-1),S,ve(e,n,i,c),n,i,c),A=Ue(e,t,n,i,c,ke(e,n,i,c,d));if(h&&A.end.distanceTo(f)>Math.max(r.tolerance*8,g*.001))throw new Error("Move closer to the pinned foot.");const C=A.end.clone().sub(A.root).normalize(),w=Pt(C,A.middle.clone().sub(A.root),T);return{changes:[...p.slice(0,-1).map(_=>({id:_.ObjectId,property:"Rotation",value:de(e,_,"Rotation",n,i)})),...P],bend:w.toArray(),clamped:y,pose:A}}function Mt(e){const t={...e},r=new Map;for(const n of["Nodes","Bones","Helpers","Attachments","EventObjects","CollisionShapes","ParticleEmitters","ParticleEmitters2","ParticleEmitterPopcorns","Lights","RibbonEmitters"])e[n]&&(t[n]=e[n].map(i=>i&&(r.has(i)||r.set(i,{...i}),r.get(i))));return t}function un(e,t,r,n,i,s={}){const o=Mt(e),{config:l,restrictions:h={},globalTime:a=r}=s,c=l&&!s.pole?hs(e,l,t,h):null;if(!c)return Wt(o,t,r,n,i,s);const d=Ue(e,t,r,n,a),p=te(i).sub(d.end).multiplyScalar(.15);if(p.lengthSq()<1e-20)return Wt(o,t,r,n,i,s);const f=c.kind==="body"?l.body:c.id,u=Mr(e,f,os(e,l,f,"move",c).filter(x=>x.chain.key!==t.key),r,n,{mode:"move",space:"world",values:p.toArray(),restrictions:h,control:Et(e,l,c,"move")},a);br(o,u.changes,r,n,h);const g=Wt(o,t,r,n,i,{...s,orientation:s.orientation||d.rotations[2].toArray()}),v=[...new Map([...u.changes,...g.changes].map(x=>[`${x.id}:${x.property}`,x])).values()];return ct(e,v,r,n,h),{...u,...g,changes:v,bends:[...u.bends||[],{key:t.key,local:te(g.bend).applyQuaternion(g.pose.rotations[0].clone().invert()).toArray()}]}}function ts(e,t,r){const n=Sr(e,[t]),i=new Set;for(const s of r){const o=Ht(e,s);for(const a of o){if(i.has(a.ObjectId))throw new Error("Pinned legs must have separate joint chains.");i.add(a.ObjectId)}let l=o[0],h=n.get(l.Parent);for(;h;){if(l.Flags&1)throw new Error("This leg disables inherited translation from the body. Choose a body that drives the leg roots.");if(h.ObjectId===t)break;l=h,h=n.get(h.Parent)}if(!h)throw new Error("Choose a body node whose hierarchy drives every configured leg root.")}return n.get(t)}function rs(e,t){if(!t.length)throw new Error("No limb roots are mapped yet. Choose a body node directly.");const r=new Map(J(e).map(s=>[s.ObjectId,s])),n=new Set;let i=r.get(r.get(t[0].root)?.Parent);for(;i&&!n.has(i.ObjectId);){n.add(i.ObjectId);try{return ts(e,i.ObjectId,t),i.ObjectId}catch{i=r.get(i.Parent)}}throw new Error("No shared Bone or Helper ancestor drives these legs.")}function ut(e,t,r){const n=new Map(J(e).map(o=>[o.ObjectId,o])),i=new Set;let s=n.get(t);for(;s&&!i.has(s.ObjectId);){if(s.ObjectId===r)return!0;i.add(s.ObjectId),s=n.get(s.Parent)}return!1}function ns(e,t,r){return t.chains.filter(n=>t.pins.includes(n.key)&&n.end!==r&&ut(e,n.end,r))}const qt=new Set(["Spine","Chest","Neck","Head","Tail","Wing"]);function is(e,t,r=J(e)){const n=r.find(c=>c.ObjectId===t),i=te(n.PivotPoint||e.PivotPoints[t]),s=new Map,o=[n,...r.filter(c=>c.Parent===t&&!qt.has(Pr(c)))].map(c=>dr(e,c.ObjectId,s)?.center).filter(Boolean);if(o.length){const c=o.reduce((d,p)=>d.add(p),new V).divideScalar(o.length);if(c.distanceToSquared(i)>1e-8)return c}const l=r.find(c=>c.Parent===t&&qt.has(Pr(c)));if(l){const c=te(l.PivotPoint||e.PivotPoints[l.ObjectId]);if(c.distanceToSquared(i)>1e-8)return i.clone().lerp(c,.5)}const h=r.find(c=>c.ObjectId===n.Parent),a=h?i.clone().sub(te(h.PivotPoint||e.PivotPoints[h.ObjectId])).multiplyScalar(.5):new V(0,0,1);return a.lengthSq()<1e-8&&a.set(0,0,1),i.add(a)}function Et(e,t,r,n="move"){const i=r?.kind==="body"?t.body:r?.id,s=J(e),o=new Map(s.map(f=>[f.ObjectId,f])),l=o.get(i),h=[];if(!l||r?.marker||!["move","rotate"].includes(n))return{joints:h,heads:[]};if(n==="move"&&i!==t.body&&(t.nodes||[]).includes(i)&&(qt.has(le(e,t,i))||le(e,t,i)==="Body")){const f=new Set(hn(e).map(y=>y.ObjectId)),u=new Set;let g=l;const v=[],x=new Set(t.chains.flatMap(y=>[y.root,y.middle,y.end]));for(;g&&g.ObjectId!==t.body&&f.has(g.ObjectId)&&!u.has(g.ObjectId)&&!x.has(g.ObjectId)&&(!["Body","Pelvis"].includes(le(e,t,g.ObjectId))||g.ObjectId===i);)v.unshift(g.ObjectId),(qt.has(le(e,t,g.ObjectId))||g.ObjectId===i)&&(h.unshift(...v),v.length=0),u.add(g.ObjectId),g=o.get(g.Parent);g&&(g.ObjectId===t.body||["Body","Pelvis"].includes(le(e,t,g.ObjectId)))&&h.unshift(...v)}let a=h[0]??i;if(le(e,t,i)==="Pelvis"){let f=o.get(l.Parent);for(;f;){if(f.ObjectId===t.body||le(e,t,f.ObjectId)==="Body"){a=f.ObjectId;break}f=o.get(f.Parent)}}le(e,t,i)==="Pelvis"&&t.carriers?.[a]!=null&&(h.push(i),a=i);const c=[...t.followers?.[a]||[]],d=t.carriers||{};for(let f=!0;f;){f=!1;for(const[u,g]of Object.entries(d)){const v=Number(u);v!==a&&!c.includes(v)&&[a,...c].some(x=>ut(e,g,x))&&(c.push(v),f=!0)}}const p=(t.nodes||[]).filter(f=>f!==i&&le(e,t,f)==="Head"&&[a,...c].some(u=>ut(e,f,u)));return{joints:h,heads:p,driver:a,followers:c,carriers:d}}function ss(e,t,r,n,i,s,o){const l=Sr(e,t),h=ve(e,i,s,o),a=t.map(y=>l.get(y)),c=a.map(y=>ft(e,y,h)),d=new Set;for(let y of a)for(;y&&!d.has(y.ObjectId);){d.add(y.ObjectId);const b=Oe(y.Scaling,i,{...Tr(e,i,s,o),fallback:[1,1,1]});if(!Ae(b)||b.some(T=>T<=1e-10||Math.abs(T-b[0])>Math.abs(b[0])*1e-5))throw new Error("Connected posing requires positive uniform scale.");y=l.get(y.Parent)}c.push(r.clone().applyMatrix4(h.get(t.at(-1))));const p=c.map(y=>y.clone()),f=a.map(y=>Le(h.get(y.ObjectId))),u=Math.max(...a.map(y=>cn(h.get(y.ObjectId)))),g=Math.max(1e-6,c.slice(1).reduce((y,b,T)=>y+b.distanceTo(c[T]),0)*Math.max(2e-5,u*2));if(c.at(-1).distanceTo(n)<=g*.01)return;for(let y=0;y<32;y++){for(let b=t.length-1;b>=0;b--){const T=c.at(-1).clone().sub(c[b]),m=n.clone().sub(c[b]);if(T.lengthSq()<1e-16||m.lengthSq()<1e-16)continue;const S=new W().slerp(new W().setFromUnitVectors(T.normalize(),m.normalize()),.65);for(let P=b+1;P<c.length;P++)c[P].sub(c[b]).applyQuaternion(S).add(c[b]);for(let P=b;P<f.length;P++)f[P].premultiply(S).normalize()}if(c.at(-1).distanceTo(n)<g)break}for(let y=0;y<a.length;y++)Qe(e,a[y],f[y],ve(e,i,s,o),i,s,o);const v=ve(e,i,s,o),x=a.map(y=>ft(e,y,v));if(x.push(r.clone().applyMatrix4(v.get(t.at(-1)))),x.some((y,b)=>y.distanceTo(c[b])>g*8)||x.slice(1).some((y,b)=>Math.abs(y.distanceTo(x[b])-p[b+1].distanceTo(p[b]))>g*8))throw new Error("This upper-body hierarchy cannot preserve connected motion.")}function os(e,t,r,n="move",i=t.target){const s=Et(e,t,i,n);r=s.driver??s.joints[0]??r;const o=[r,...s.followers||[]],l=new Set(o.flatMap(h=>ns(e,t,h)).map(h=>h.key));return t.chains.filter(h=>l.has(h.key)||["move","rotate"].includes(n)&&h.root!==r&&ut(e,h.root,r)).map(h=>({chain:h,pinned:l.has(h.key),bendLocal:t.bends?.[h.key],target:t.targets?.[h.key]}))}function as(e,t,r,n,i){return e?.frame===n&&e.sequence===i&&qe(t).length===e.joints.length&&qe(t).every((s,o)=>s===e.joints[o])&&[r.root,r.middle,r.end].every((s,o)=>s.distanceTo(te(e.points[o]))<=r.tolerance*.1)&&r.rotations.every((s,o)=>1-Math.abs(s.dot(new W().fromArray(e.rotations[o])))<1e-9)}function ls(e,t,r,n){const i=t.lengthSq();if(i<1e-20)return 1;const s=2*e.dot(t),o=e.length(),l=d=>{const p=e.lengthSq()-d*d,f=s*s-4*i*p;return f<0?null:[(-s-Math.sqrt(f))/(2*i),(-s+Math.sqrt(f))/(2*i)]},h=l(Math.max(n,o)),a=r>1e-8?l(Math.min(r,o)):null;let c=h?Math.max(0,h[1]):1;return a&&a[0]>=0&&a[1]>a[0]&&(c=Math.min(c,a[0])),Math.min(1,c)}function Mr(e,t,r,n,i,s,o=n){const l=new WeakMap,h=(E,D)=>Ue(E,D,n,i,o,ke(E,n,i,o,l)),a=J(e).find(E=>E.ObjectId===t),c=Ne[s.mode];if(!a||!c)throw new Error("Select an object and a Movement tool.");const d=s.values||["X","Y","Z"].map(E=>E===s.axis?s.amount:s.mode==="scale"?1:0);if(d.length!==3||!Ae(d))throw new Error("Enter finite X, Y, and Z values.");const p=s.control||{joints:[],heads:[]},f=p.driver??p.joints[0]??t,u=p.followers||[];p.joints.length||(t=f);const g=p.joints.length||p.heads.length?ve(e,n,i,o):null,v=p.joints.length?is(e,t):null;let x=te(d);v&&s.space==="local"&&x.applyQuaternion(Le(g.get(t))),x.fromArray(vr(x.toArray(),s));const y=p.heads.map(E=>({id:E,rotation:Le(g.get(E))})),b=new Set,T=r.filter(E=>[f,...u].some(D=>E.chain.end!==D&&ut(e,E.chain.end,D))).map(E=>{for(const H of qe(E.chain)){if(b.has(H))throw new Error("Limb controls must have separate joint chains.");b.add(H)}const D=h(e,E.chain),O=E.pinned===!1&&as(E.target,E.chain,D,n,i)?E.target:null;return{...E,pinned:E.pinned!==!1,pose:D,position:te(E.position||O?.position||D.end),orientation:E.orientation||O?.orientation||D.rotations[2].toArray()}}),m=T.filter(E=>E.pinned),S=E=>{const D=E.lengths.reduce((O,H)=>O+H,0);return[Math.max(0,2*Math.max(...E.lengths)-D),D]},P=E=>{const D=Mt(e),O=J(D).find(H=>H.ObjectId===t);if(v){const H=v.clone().applyMatrix4(g.get(t)).addScaledVector(x,E);ss(D,p.joints,v,H,n,i,o)}else{for(const U of Object.values(Ne))O[U]&&(O[U]=structuredClone(O[U]));const H=d.map(U=>s.mode==="scale"?1+(U-1)*E:U*E);yr(D,[t],n,i,{...s,values:H})}if(u.length){const H=ve(e,n,i,o);for(const U of u){const B=p.carriers?.[U]??t,q=ve(D,n,i,o).get(B).clone().multiply(H.get(B).clone().invert()),G=J(D).find(ne=>ne.ObjectId===U);for(const ne of["Translation","Rotation"])G[ne]&&(G[ne]=structuredClone(G[ne]));const Y=ft(e,G,H),se=Y.clone().applyMatrix4(q);yr(D,[U],n,i,{mode:"move",space:"world",values:se.sub(Y).toArray()}),Qe(D,G,Le(q).multiply(Le(H.get(U))),ve(D,n,i,o),n,i,o)}}return D},A=E=>m.every(D=>{const O=h(E,D.chain),H=O.root.distanceTo(D.position);return H<=S(O)[1]+O.tolerance*.1&&H>=S(O)[0]-O.tolerance*.1});let C=1,w=P(1),_=[];if(m.length){let E=s.mode==="move"&&!v;const D=m.map(O=>h(w,O.chain));if(E&&=D.every((O,H)=>O.lengths.every((U,B)=>Math.abs(U-m[H].pose.lengths[B])<O.tolerance)),E)for(let O=0;O<m.length;O++){const H=m[O],U=D[O].root.clone().sub(H.pose.root),B=ls(H.pose.root.clone().sub(H.position),U,...S(H.pose));B<C-1e-7?(C=B,_=[H.chain.key]):B<1&&Math.abs(B-C)<=1e-7&&_.push(H.chain.key),C=Math.min(C,B)}else{let O=0;for(let H=1;H<=8;H++){const U=H/8;if(!A(U===1?w:P(U))){let B=O,R=U;for(let G=0;G<20;G++){const Y=(B+R)/2;A(P(Y))?B=Y:R=Y}C=B;const q=P(R);_=m.filter(G=>{const Y=h(q,G.chain),se=Y.root.distanceTo(G.position),[ne,wt]=S(Y);return se>wt+Y.tolerance*.1||se<ne-Y.tolerance*.1}).map(G=>G.chain.key);break}O=U}}C<1&&(w=P(Math.max(0,C*(1-1e-7))))}const F=new Map(J(w).map(E=>[E.ObjectId,E])),L=F.get(t),z=v?p.joints.map(E=>({id:E,property:"Rotation",value:de(w,F.get(E),"Rotation",n,i)})):[{id:t,property:c,value:de(w,L,c,n,i)}],M=[];for(const E of u)for(const D of["Translation","Rotation"])z.push({id:E,property:D,value:de(w,F.get(E),D,n,i)});s.rotateOnOwnAxis&&s.mode==="rotate"&&z.push({id:t,property:"Translation",value:de(w,L,"Translation",n,i)});for(const E of T){let D;try{D=Wt(w,E.chain,n,i,E.position,{orientation:E.orientation,bendMemory:E.bendLocal&&te(E.bendLocal).applyQuaternion(E.pose.rotations[0]),strict:E.pinned,globalTime:o,validatedTracks:l})}catch(O){throw E.pinned&&(O.blockingKeys=[E.chain.key]),O}z.push(...D.changes),M.push({key:E.chain.key,local:te(D.bend).applyQuaternion(D.pose.rotations[0].clone().invert()).toArray()})}for(const E of y)z.push(Qe(w,F.get(E.id),E.rotation,ve(w,n,i,o),n,i,o));for(const E of m){const D=h(w,E.chain);if(D.end.distanceTo(E.position)>E.pose.tolerance*4||1-Math.abs(D.rotations[2].dot(new W().fromArray(E.orientation)))>1e-7)throw Object.assign(new Error("This transform cannot retain the pins."),{blockingKeys:[E.chain.key]})}const I=T.filter(E=>!E.pinned).map(E=>{const D=h(w,E.chain);return{key:E.chain.key,frame:n,sequence:i,joints:qe(E.chain),position:E.position.toArray(),orientation:E.orientation,points:[D.root,D.middle,D.end].map(O=>O.toArray()),rotations:D.rotations.map(O=>O.toArray())}}),N=[...new Map(z.map(E=>[`${E.id}:${E.property}`,E])).values()],K=ct(e,N,n,i,s.restrictions);return{changes:N.filter(E=>K.some(D=>D.id===E.id&&D.property===E.property)),bends:M,targets:I,limited:C<1,fraction:C,blockingKeys:_}}function hs(e,t,r,n={}){if(t.restrict||!["arm","leg"].includes(r.kind)||["Wing","Tail","Chain"].includes(r.label))return null;const i=new Map(J(e).map(l=>[l.ObjectId,l])),s=new Set;let o=i.get(i.get(r.root)?.Parent);for(;o&&!s.has(o.ObjectId);){if(s.add(o.ObjectId),o.ObjectId===t.body||(t.nodes||[]).includes(o.ObjectId)&&["Chest","Spine","Pelvis","Body"].includes(le(e,t,o.ObjectId))){const l=o.ObjectId===t.body?{kind:"body"}:{kind:"node",id:o.ObjectId},h=Et(e,t,l,"move");return mr(h.joints.length?"rotate":"move",n)?null:l}o=i.get(o.Parent)}return null}const Je=e=>(e=Math.max(0,Math.min(1,e)),e*e*(3-2*e)),Er=1e-7,dn=(e,t)=>{let r=1/0;for(const n of e)r=Math.min(r,n.clone().applyQuaternion(t).z);return-r};function cs({model:e,chains:t,anchors:r,sequence:n,groundHeight:i=0,preservePath:s=!1}){if(!Number.isFinite(i))throw new Error("Ground height must be a finite number.");const o=t.filter(u=>u.chain.kind==="leg");if(o.length<2)return{available:!1,reason:"Step needs at least two mapped legs on the visible character."};const l=new V;let h=0;for(const u of o)for(const g of u.poses.slice(0,-1)){const v=g.end.clone().sub(g.root).normalize(),x=g.middle.clone().sub(g.root);x.addScaledVector(v,-x.dot(v)),x.z=0,x.length()>g.lengths.reduce((y,b)=>y+b,0)*.015&&(l.add(x),h+=x.length())}let a=l.length()/Math.max(h,Er),c="knee bends";const d=J(e),p=new Map(d.map(u=>[u.ObjectId,u])),f=[];for(const u of o){const g=u.chain.end,v=new Set([g]);for(const T of d){let m=T,S=new Set;for(;m&&!S.has(m.ObjectId);){if(S.add(m.ObjectId),m.ObjectId===g){v.add(T.ObjectId);break}m=p.get(m.Parent)}}const x=[],y=u.poses[0],b=y.rotations.at(-1).clone().invert();for(const[T,m]of(e.Geosets||[]).entries()){if(rn(e,T,r[0],n).alpha<=.05)continue;const S=tn(m,y.matrices),P=m.Vertices.length/3;for(let A=0;A<P;A++){let C=0;if(m.SkinWeights?.length===P*8)for(let w=0;w<4;w++)v.has(m.SkinWeights[A*8+w])&&(C+=m.SkinWeights[A*8+w+4]/255);else{const w=m.Groups?.[m.VertexGroup?.[A]]||[];C=w.filter(_=>v.has(_)).length/Math.max(1,w.length)}C>=.5&&x.push(new V().fromArray(S,A*3).sub(y.end).applyQuaternion(b))}}if(!x.length)return{available:!1,reason:"Step needs visible geometry on each mapped foot."};f.push({chain:u.chain,poses:u.poses,length:y.lengths.reduce((T,m)=>T+m,0),points:x})}if(s){const u=new V;let g=0;for(const x of f){const y=Array.from({length:33},(S,P)=>Ue(e,x.chain,r[0]+(r.at(-1)-r[0])*P/32,n)),b=y.map(S=>S.end.z-dn(x.points,S.rotations.at(-1))),T=Math.min(...b),m=Math.max(...b);x.clearance={low:T,high:m,span:m-T};for(let S=1;S<y.length-1;S++)if(b[S]<=T+Math.max(x.length*.025,(m-T)*.18)){const P=y[S-1],A=y[S+1],C=P.end.clone().sub(P.root).sub(A.end.clone().sub(A.root));C.z=0,u.add(C),g+=C.length()}}const v=u.length()/Math.max(g,Er);v>.45&&(l.copy(u),a=v,c="low foot trajectories")}if(!s&&(l.lengthSq()<Er||a<.3))return{available:!1,reason:"Step cannot infer a consistent stride direction from these poses."};if(s&&!f.some(u=>u.clearance.span>u.length*.03))return{available:!1,reason:"Step needs a visible lifting and supporting phase in this detailed walk."};l.normalize(),s&&(c="authored foot clearance");for(const u of f)u.segments=u.poses.slice(1).map((g,v)=>{const x=u.poses[v],y=g.end.clone().sub(g.root).sub(x.end.clone().sub(x.root)).dot(l);return{a:x,b:g,travel:y,moving:Math.abs(y)>u.length*.08,swing:y>0}});return!s&&!f.some(u=>u.segments.some(g=>g.moving))?{available:!1,reason:"Step needs forward and backward stride poses."}:{available:!0,forward:l,confidence:a,directionSource:c,legs:f,groundHeight:i,preservePath:s,length:f.reduce((u,g)=>u+g.length,0)/f.length}}function fs(e,{index:t,u:r,progress:n=r,timing:i=0,follow:s=0,body:o=0,contacts:l=!0,poses:h=null}){if(!e.available)return{feet:[],displacement:new V,available:!1,reason:e.reason};const a=r<=0||r>=1,c=Math.sin(Math.PI*Math.max(0,Math.min(1,r)))**2,d=e.legs.map(u=>{const{a:g,b:v}=u.segments[t];let{moving:x,swing:y}=u.segments[t];const b=a?Math.max(0,Math.min(1,r)):y?r+(Je(r)-r)*i:n,T=!a&&e.preservePath?h?.get(u.chain.key):null;if(!a&&e.preservePath&&!T)throw new Error("Step needs the current foot paths for this detailed animation.");const m=T?T.end.clone():g.end.clone().lerp(v.end,b),S=T?T.rotations.at(-1).clone():g.rotations.at(-1).clone().slerp(v.rotations.at(-1),b),P=dn(u.points,S);let A=x&&!y,C=A?1:0;if(!a&&e.preservePath){const w=m.z-P-e.groundHeight,_=Je((m.z-P-u.clearance.low)/Math.max(u.clearance.span*.5,u.length*.05)),F=1-Je(Math.abs(w)/(u.length*.12));x=u.clearance.span>u.length*.03,y=x&&_>.5,A=x&&_<.5&&F>.05,C=x?F*(1-_):0,x&&(m.z+=u.length*.055*s*c*_),l&&x&&(m.z-=w*Je(r/.22)*Je((1-r)/.22)*F*(1-_))}else if(!a&&x){if(y)m.z+=u.length*.24*s*c;else if(l){m.z-P-e.groundHeight;const w=Je(r/.22)*Je((1-r)/.22);m.z+=(e.groundHeight+P-m.z)*w}}return{chain:u.chain,position:m,orientation:S.toArray(),swing:x&&y,support:A,supportWeight:C,soleOffset:P}}),p=Math.max(0,...d.map(u=>u.supportWeight)),f=new V(0,0,a?0:-e.length*(e.preservePath?.035:.055)*o*c*p);return{available:!0,feet:d,displacement:f}}const At=(e,t=0,r=1)=>Math.max(t,Math.min(r,e)),Ar=e=>(e=At(e),e*e*(3-2*e)),ce=e=>new W().fromArray(e).normalize(),je=e=>new V().fromArray(e),we=(e,t)=>`${e}:${t}`,pn={Rotation:[0,0,0,1],Translation:[0,0,0]},us=180/Math.PI;function ds(e,t){const r=new Ki({Nodes:[],Geosets:[],GeosetAnims:[],Materials:[],ParticleEmitters2:[],RibbonEmitters:[],GlobalSequences:[],Sequences:[e.Sequences[t]]}),n=new Float32Array(4),i=new Float32Array(3),s=(o,l,h)=>{if(r.setFrame(h),!o?.Keys)return o==null?pn[l]:Array.from(o);const a={...o,GlobalSeqId:null},c=l==="Rotation"?r.interp.quat(n,a):r.interp.vec3(i,a);return c?Array.from(c):pn[l]};return{track:s,sample:(o,l,h)=>s(o[l],l,h),destroy:()=>r.destroy()}}function dt(e){const t=e.clone().normalize();t.w<0&&t.set(-t.x,-t.y,-t.z,-t.w);const r=Math.hypot(t.x,t.y,t.z);return r<1e-10?new V:new V(t.x,t.y,t.z).multiplyScalar(2*Math.atan2(r,t.w)/r)}function jt(e){const t=e.length();return t<1e-10?new W:new W().setFromAxisAngle(e.clone().divideScalar(t),t)}const pt=(e,t,r)=>r==="Rotation"?ce(e).angleTo(ce(t)):je(e).distanceTo(je(t));function ps(e,t,r,n,i,s){const o=[Array.from(t[0].OutTan),Array.from(t[1].InTan)],l=[];let h=n;for(let u=1;u<8;u++){const g=t[0].Frame+(t[1].Frame-t[0].Frame)*u/8;for(;h<i-1&&r[h+1].Frame<g;)h++;const v=r[h],x=r[h+1],y=(g-v.Frame)/(x.Frame-v.Frame);l.push({frame:g,magnitude:Math.hypot(...v.Vector)*(1-y)+Math.hypot(...x.Vector)*y})}if(l.every(u=>Math.abs(u.magnitude-1)<1e-6))return;const a={...e,Keys:t},c=u=>(t[0].OutTan=new Float32Array(o[0].map(g=>g*u[0])),t[1].InTan=new Float32Array(o[1].map(g=>g*u[1])),l.map(g=>Math.hypot(...s.track(a,"Rotation",g.frame))-g.magnitude));let d=t.map(u=>Math.hypot(...u.Vector)),p=c(d);const f=u=>u.reduce((g,v)=>g+v*v,0);for(let u=0;u<8&&f(p)>1e-12;u++){const v=d.map((w,_)=>{const F=[...d];return F[_]+=.001,c(F).map((L,z)=>(L-p[z])/.001)}),x=(w,_)=>w.reduce((F,L,z)=>F+L*_[z],0),y=x(v[0],v[0])+1e-10,b=x(v[1],v[1])+1e-10,T=x(v[0],v[1]),m=x(v[0],p),S=x(v[1],p),P=y*b-T*T;if(P<1e-16)break;const A=[(b*m-T*S)/P,(y*S-T*m)/P].map(w=>At(w,-.1,.1));let C=!1;for(const w of[1,.5,.25,.125]){const _=d.map((L,z)=>At(L-A[z]*w,.1,2)),F=c(_);if(f(F)<f(p)){d=_,p=F,C=!0;break}}if(!C)break}c(d)}function et(e,t){const r=[];for(;e.has(t)&&!r.includes(t);)r.push(t),t=e.get(t).Parent;return r}function gs(e,t,r,n){if(!e.Geosets?.length)return new Set(t.keys());const i=new Set,s=Array.from({length:9},(o,l)=>n[0]+(n[1]-n[0])*l/8);for(const[o,l]of e.Geosets.entries()){if(!s.some(a=>rn(e,o,a,r).alpha>.05))continue;const h=new Set;if(l.SkinWeights?.length===l.Vertices.length/3*8)for(let a=0;a<l.SkinWeights.length;a+=8)for(let c=0;c<4;c++)l.SkinWeights[a+4+c]&&h.add(l.SkinWeights[a+c]);else for(const a of new Set(l.Faces||Array.from({length:l.Vertices.length/3},(c,d)=>d)))for(const c of l.Groups?.[l.VertexGroup?.[a]]||[])h.add(c);for(const a of h)for(const c of et(t,a))i.add(c)}return i}function Ur(e,t,r,n,i){const s=new Map(J(e).map(h=>[h.ObjectId,h])),o=new WeakMap,l=n.map(h=>ke(e,h,r,h,o));return{values:n.map(h=>new Map(i.map(a=>[we(a.id,a.property),de(e,s.get(a.id),a.property,h,r)]))),chains:(t.chains||[]).map(h=>({chain:h,poses:n.map((a,c)=>Ue(e,h,a,r,a,l[c]))}))}}function gn(e,t,r,n,i,s){const o=new Map(J(e).map(f=>[f.ObjectId,f])),l=n[1]-n[0],h=[...new Set([...i,...Array.from({length:81},(f,u)=>Math.round(n[0]+l*u/80))])].sort((f,u)=>f-u),a=new WeakMap,c=h.map(f=>{const u=ke(e,f,r,f,a),g=u.matrices,v=o.get(t.body),x=v?je(v.PivotPoint||e.PivotPoints[t.body]).applyMatrix4(g.get(t.body)):new V,y=x.clone().divideScalar(s).toArray();for(const b of t.chains||[]){const T=Ue(e,b,f,r,f,u);if(y.push(...T.end.clone().sub(x).divideScalar(s).toArray()),b.kind==="arm")for(const m of[[1,0,0],[0,0,1]])y.push(...je(m).applyQuaternion(T.rotations[2]).multiplyScalar(.18).toArray())}for(const b of t.nodes||[])["Chest","Spine","Pelvis","Body"].includes(le(e,t,b))&&y.push(...dt(ce(de(e,o.get(b),"Rotation",f,r))).multiplyScalar(.2).toArray());return{frame:f,feature:y}}),d=[0,c.length-1],p=l*.08;for(;d.length<8;){d.sort((g,v)=>g-v);let f=-1,u=.025;for(let g=1;g<d.length;g++){const v=c[d[g-1]],x=c[d[g]];for(let y=d[g-1]+1;y<d[g];y++){const b=c[y];if(b.frame-v.frame<p||x.frame-b.frame<p)continue;const T=(b.frame-v.frame)/(x.frame-v.frame),m=Math.sqrt(b.feature.reduce((S,P,A)=>S+(P-v.feature[A]-(x.feature[A]-v.feature[A])*T)**2,0)/Math.max(1,(t.chains||[]).length));m>u&&(u=m,f=y)}}if(f<0)break;d.push(f)}return d.map(f=>c[f].frame).sort((f,u)=>f-u)}function ms(e,t,r,n,i,s){const o=t.find(a=>a.chain.key===r);let l=e.at(-1),h=-1;for(let a=1;a<e.length-1;a++){let c;if(o){const d=o.poses[a-1],p=o.poses[a],f=p.end.clone().sub(p.root).sub(d.end.clone().sub(d.root));c=f.length()+p.rotations[2].angleTo(d.rotations[2])*s*.28,c*=1+.4*At(-f.z/s)}else c=i.reduce((d,p)=>d+pt(n[a-1].get(we(p.id,p.property)),n[a].get(we(p.id,p.property)),p.property)/(p.property==="Rotation"?1:s),0);c>h&&(h=c,l=e[a])}return l}function mn(e,t,r){const n={Frame:e,Vector:new Float32Array(t)};return r>=2&&(n.InTan=new Float32Array(t.length===4||r===3?t:[0,0,0]),n.OutTan=new Float32Array(n.InTan)),n}function vs(e,t,r,n){const i=e.Sequences?.[r]?.Interval;if(n||=i&&Array.from(i),!i||!n||n.length!==2||n.some(M=>!Number.isInteger(M))||n[0]<i[0]||n[1]>i[1]||n[1]-n[0]<20)throw new Error("Choose an animation, or a longer part of its timeline.");const s=Mt(e),o=new Map(J(s).map(M=>[M.ObjectId,M]));for(const M of o.values())for(const I of["Rotation","Translation","Scaling"])M[I]!==void 0&&(M[I]=structuredClone(M[I]));const l=gs(s,o,r,n);t={...structuredClone(t),chains:(t.chains||[]).filter(M=>qe(M).some(I=>l.has(I))),nodes:(t.nodes||[]).filter(M=>l.has(M))};const h=new Set([...e.Bones||[],...e.Helpers||[]].map(M=>M.ObjectId).filter(M=>l.has(M)));for(const M of[t.body,...t.nodes||[],...(t.chains||[]).flatMap(qe)])o.has(M)&&h.add(M);const a=new Set(n),c=[];for(const M of h)for(const I of["Rotation","Translation"]){const N=o.get(M)?.[I];if(!N?.Keys||Number.isInteger(N.GlobalSeqId)&&N.GlobalSeqId>=0)continue;const K=N.Keys.filter(E=>E.Frame>=n[0]&&E.Frame<=n[1]);if(K.length){for(const E of K)a.add(E.Frame);c.push({id:M,property:I})}}const d=[...a].sort((M,I)=>M-I);let p=d,{values:f,chains:u}=Ur(s,t,r,p,c),g=Math.max(1,...u.map(M=>M.poses[0].lengths.reduce((I,N)=>I+N,0)));const v=c.reduce((M,I)=>M+f.slice(1).reduce((N,K,E)=>N+pt(f[E].get(we(I.id,I.property)),K.get(we(I.id,I.property)),I.property)/(I.property==="Rotation"?1:g),0),0);if(p.length<2||v<1e-6)throw new Error("Create two different poses in this animation first.");const x=c.map(M=>{const I=we(M.id,M.property),N=Math.max(...f.map(E=>pt(f[0].get(I),E.get(I),M.property))),K=M.property==="Rotation"?.015:g*.003;return{...M,weight:N<=K?0:Math.min(1,N/(M.property==="Rotation"?.5:g*.1))}}).filter(M=>M.weight),y=x.reduce((M,I)=>M+I.weight,0),b=p.filter(M=>x.some(I=>o.get(I.id)[I.property].Keys.some(N=>N.Frame===M))),T=b.filter(M=>x.reduce((I,N)=>I+(o.get(N.id)[N.property].Keys.some(K=>K.Frame===M)?N.weight:0),0)>=y*.5).length,m=p.length<=5||p.length<=14&&T>=b.length*.7,S=u.filter(M=>M.chain.kind==="arm"),P=S.length?S:u,A=M=>M.poses.slice(1).reduce((I,N,K)=>I+N.end.clone().sub(N.root).distanceTo(M.poses[K].end.clone().sub(M.poses[K].root))+N.rotations[2].angleTo(M.poses[K].rotations[2])*g*.2,0),C=P.slice().sort((M,I)=>A(I)-A(M))[0]||null;let w=t.body;if(C){const M=et(o,o.get(C.chain.root)?.Parent);w=M.filter(N=>u.some(K=>K.chain.kind==="leg"&&et(o,K.chain.root).includes(N))).find(N=>["Body","Pelvis"].includes(le(s,t,N)))??M.find(N=>["Body","Pelvis"].includes(le(s,t,N)))??w}t.body=w;const _=u.filter(M=>et(o,M.chain.root).includes(w));_.length&&(g=Math.max(1,..._.map(M=>M.poses[0].lengths.reduce((I,N)=>I+N,0)))),m||(p=gn(s,t,r,n,d,g),{values:f,chains:u}=Ur(s,t,r,p,c));const F=ms(p,u,C?.chain.key,f,c,g);let L=w;if(C){let M=o.get(o.get(C.chain.root)?.Parent);for(;M;){if(["Chest","Spine"].includes(le(s,t,M.ObjectId))){L=M.ObjectId;break}M=o.get(M.Parent)}}const z=!s.Sequences[r].NonLooping&&c.every(M=>pt(f[0].get(we(M.id,M.property)),f.at(-1).get(we(M.id,M.property)),M.property)<(M.property==="Rotation"?1e-4:g*1e-4));return{baseline:s,config:t,sequence:r,range:[...n],anchors:p,allKeyFrames:d,channels:c,values:f,chains:u,length:g,sparse:m,driver:C?.chain.key??null,body:w,torso:L,impact:F,loop:z}}function xs(e,t,r,n){return e<=0||e>=1?At(e):t==="swing"?n?e**(1+2.6*r):e+(Ar(e)**(1+.65*r)-e)*r:e+(Ar(e)-e)*r}function bs(e,t){let r=0;for(;r<e.length-2&&t>=e[r+1];)r++;return r}function ys(e,t,r,n,i,s){const o=new Set([0,t.length-1]);t.forEach((u,g)=>{i.has(u.Frame)&&o.add(g)});const l=u=>{const g=Math.max(0,u-1),v=Math.min(t.length-1,u+1),x=t[v].Frame-t[g].Frame;if(!x)return new V;if(r!=="Rotation")return je(t[v].Vector).sub(je(t[g].Vector)).divideScalar(x);const y=ce(t[u].Vector).invert();return dt(y.clone().multiply(ce(t[v].Vector))).sub(dt(y.multiply(ce(t[g].Vector)))).divideScalar(x)},h=(u,g)=>{const v=structuredClone(t[u]),x=structuredClone(t[g]),y=x.Frame-v.Frame;if(e.LineType>=2)if(r==="Rotation"){const b=dt(ce(v.Vector).invert().multiply(ce(x.Vector)));v.OutTan=new Float32Array(ce(v.Vector).multiply(jt(l(u).multiplyScalar(y).sub(b).multiplyScalar(.5))).toArray()),x.InTan=new Float32Array(ce(x.Vector).multiply(jt(b.sub(l(g).multiplyScalar(y)).multiplyScalar(.5))).toArray()),ps(e,[v,x],t,u,g,s)}else{const b=l(u).multiplyScalar(y),T=l(g).multiplyScalar(y);v.OutTan=new Float32Array(e.LineType===2?b.toArray():b.divideScalar(3).add(je(v.Vector)).toArray()),x.InTan=new Float32Array(e.LineType===2?T.toArray():T.multiplyScalar(-1/3).add(je(x.Vector)).toArray())}return[v,x]},a=[...o].sort((u,g)=>u-g),c=a.slice(1).map((u,g)=>[a[g],u]),d=(u,g,v)=>{let x=0;for(let y=g;y<v;y++)for(const b of[.25,.5,.75,1]){const T=t[y],m=t[y+1],S=T.Frame+(m.Frame-T.Frame)*b,P=Math.hypot(...T.Vector)*(1-b)+Math.hypot(...m.Vector)*b;x=Math.max(x,Math.abs(Math.hypot(...s.track(u,r,S))-P))}return x};for(;c.length;){const[u,g]=c.pop();if(g-u<2)continue;const v={...e,Keys:h(u,g)};let x=n,y=-1,b=n/16,T=-1;for(let m=u+1;m<g;m++){const S=s.track(v,r,t[m].Frame),P=pt(S,t[m].Vector,r);if(P>x&&(x=P,y=m),r==="Rotation"&&e.LineType>=2){const A=Math.abs(Math.hypot(...S)-Math.hypot(...t[m].Vector));A>b&&(b=A,T=m)}}if(y<0&&T>=0){const m={...e,Keys:h(u,T)},S={...e,Keys:h(T,g)};Math.max(d(m,u,T),d(S,T,g))<d(v,u,g)*.9&&(y=T)}y>=0&&(o.add(y),c.push([u,y],[y,g]))}const p=[...o].sort((u,g)=>u-g),f=p.map(u=>structuredClone(t[u]));if(e.LineType>=2)for(let u=1;u<p.length;u++){const[g,v]=h(p[u-1],p[u]);f[u-1].OutTan=g.OutTan,f[u].InTan=v.InTan}return f}function Ts(e,t={},r={}){const{baseline:n,sequence:i,range:s,channels:o,sparse:l}=e;let{config:h,length:a}=e,{anchors:c,values:d,chains:p}=e;const f=t.style??"swing";if(!["flow","swing","step"].includes(f))throw new Error("Choose Flow, Swing or Step.");const u=new Map(J(n).map(U=>[U.ObjectId,U]));let g=e.body,v=e.torso,x=e.driver;if(f==="flow"){const U=R=>R.poses.slice(1).reduce((q,G,Y)=>q+G.end.clone().sub(G.root).distanceTo(R.poses[Y].end.clone().sub(R.poses[Y].root))+G.rotations[2].angleTo(R.poses[Y].rotations[2])*a*.2,0),B=p.slice().sort((R,q)=>U(q)-U(R))[0];if(B){x=B.chain.key;const R=et(u,u.get(B.chain.root)?.Parent);g=R.filter(G=>p.some(Y=>Y.chain.kind==="leg"&&et(u,Y.chain.root).includes(G))).find(G=>["Body","Pelvis"].includes(le(n,h,G)))??R.find(G=>["Body","Pelvis"].includes(le(n,h,G)))??g,v=R.find(G=>["Chest","Spine"].includes(le(n,h,G)))??g,h={...h,body:g}}}if(f==="step"){const U=p.filter(B=>B.chain.kind==="leg");if(U.length){const B=Math.min(...U.flatMap(q=>q.poses.map(G=>G.end.z))),R=U.filter(q=>Math.min(...q.poses.map(G=>G.end.z))<B+q.poses[0].lengths.reduce((G,Y)=>G+Y,0)*.4);g=rs(n,R.map(q=>q.chain)),v=g,p=R,h={...h,body:g,chains:p.map(q=>q.chain)},a=Math.max(1,...p.map(q=>q.poses[0].lengths.reduce((G,Y)=>G+Y,0))),!l&&t.anchors==null&&(c=gn(n,h,i,s,e.allKeyFrames,a))}}else{const U=p.filter(B=>et(u,B.chain.root).includes(g));U.length&&(p=U,h={...h,chains:U.map(B=>B.chain)})}const y=[t.timing??65,t.follow??35,t.body??35].map(Number);if(y.some(U=>!Number.isFinite(U)||U<0||U>100))throw new Error("Use settings from 0 to 100.");const[b,T,m]=y.map(U=>U/100),S=f==="flow"?0:T,P=t.contacts!==!1;if(t.anchors!=null){if(!Array.isArray(t.anchors)||t.anchors.some(U=>!Number.isInteger(U)||U<s[0]||U>s[1]))throw new Error("Key poses must be whole milliseconds inside the animation.");c=[...new Set([...s,...t.anchors])].sort((U,B)=>U-B)}const A=f!=="swing"?null:t.hit==null?e.impact:Number(t.hit);if(A!=null&&(!Number.isInteger(A)||A<s[0]||A>s[1]))throw new Error("Choose a hit inside this animation.");const C=A;if(C!=null&&!c.includes(C)&&(c=[...c,C].sort((U,B)=>U-B)),c!==e.anchors&&({values:d,chains:p}=Ur(n,h,i,c,o)),!b&&!S&&!m)return{tracks:[],keyCount:0,anchors:[...c],allKeyFrames:e.allKeyFrames,impact:C,sparse:l};const w=f==="step"?cs({model:n,chains:p,anchors:c,sequence:i,groundHeight:Number(t.ground??0),preservePath:!l}):null;if(w&&!w.available)throw new Error(w.reason);const _=ds(n,i),F=Mt(n),L=n.Sequences[i].Interval;for(const U of J(F))for(const B of["Rotation","Translation","Scaling"]){const R=U[B];R?.Keys&&!(Number.isInteger(R.GlobalSeqId)&&R.GlobalSeqId>=0)&&(U[B]={...R,Keys:R.Keys.filter(q=>q.Frame>=L[0]&&q.Frame<=L[1])})}const z=s[1]-s[0],M=new Set(c),I=s[0]===n.Sequences[i].Interval[0]&&s[1]===n.Sequences[i].Interval[1],N=new Set(c);for(const U of e.allKeyFrames)N.add(U);for(let U=0;U<=Math.min(180,z);U++)N.add(Math.round(s[0]+z*U/Math.min(180,z)));for(let U=1;U<c.length;U++)for(let B=1;B<12;B++)N.add(Math.round(c[U-1]+(c[U]-c[U-1])*B/12));const K=[...N].sort((U,B)=>U-B),E=new Map(o.map(U=>[we(U.id,U.property),U])),D=new Map,O=p.find(U=>U.chain.key===x);for(const U of K){const B=bs(c,U),R=c[B],q=c[B+1],G=q-R,Y=(U-R)/G,se=M.has(U),ne=G>=z*.075,wt=ne?b:0,_t=f==="swing"&&q<C?"flow":f,X=xs(Y,_t,wt,q===C),oe=R+X*G,he=Mt(F),Ss=new Map(J(he).map(k=>[k.ObjectId,k])),Br=[],Yt=ne&&!se?Math.sin(Math.PI*Y)**2:0,Ps=R===C&&B>0,vn=f==="swing"&&Ps&&ne&&Y<.44?Math.sin(Math.PI*Y/.44)**2*S*.16:0;for(const k of o){const j=u.get(k.id),ie=we(k.id,k.property);let fe=_.sample(j,k.property,oe);if(!se&&k.property==="Rotation"){let De=ce(fe);if(f==="swing"&&q===C&&ne){const Se=dt(ce(d[B].get(ie)).invert().multiply(ce(d[B+1].get(ie))));De.multiply(jt(Se.multiplyScalar(-b*.14*Yt*(1-Y)**2)))}if(vn){const Se=dt(ce(d[B-1].get(ie)).invert().multiply(ce(d[B].get(ie)))).clampLength(0,1.4);De.multiply(jt(Se.multiplyScalar(vn)))}fe=De.toArray()}se||Br.push({...k,value:fe})}Br.length&&br(he,Br,U,i,r);const xn=w&&!se&&ne?ke(he,U,i):null,gt=xn?fs(w,{index:B,u:Y,progress:X,timing:b,follow:S,body:m,contacts:P,poses:new Map(p.map(k=>[k.chain.key,Ue(he,k.chain,U,i,U,xn)]))}):null,bn=!w&&P&&ne?p.filter(k=>{if(k.chain.kind!=="leg")return!1;const j=k.poses[B],ie=k.poses[B+1],fe=j.lengths.reduce((De,Se)=>De+Se,0);return j.end.distanceTo(ie.end)<fe*.035&&j.rotations[2].angleTo(ie.rotations[2])<.12}).map(k=>({chain:k.chain,pinned:!0,position:k.poses[B].end.clone().lerp(k.poses[B+1].end,X),orientation:k.poses[B].rotations[2].clone().slerp(k.poses[B+1].rotations[2],X).toArray()})):[],tt=w?0:f==="flow"||l||q===C||R===C?m:0,yn=!se&&tt&&ne?p.filter(k=>k.chain.kind==="arm").map(k=>({chain:k.chain,pose:Ue(he,k.chain,U,i)})):[],$t=[...bn,...(gt?.feet||[]).map(k=>({...k,pinned:!0})),...yn.map(k=>({chain:k.chain,pinned:!0,position:k.pose.end,orientation:k.pose.rotations[2].toArray()}))],Kt=k=>{br(he,k.changes,U,i,r);for(const j of k.changes)E.set(we(j.id,j.property),{id:j.id,property:j.property})};if(gt){for(const j of gt.feet)Kt(un(he,j.chain,U,i,j.position,{orientation:j.orientation,restrictions:r}));const k=ke(he,U,i);$t.length=0;for(const j of gt.feet){const ie=Ue(he,j.chain,U,i,U,k);$t.push({chain:j.chain,pinned:!0,position:ie.end,orientation:ie.rotations.at(-1).toArray()})}}if(!se&&ne&&g!=null&&u.has(g)&&(tt||bn.length||gt?.displacement.lengthSq())){let k=gt?.displacement.clone()||new V;if(tt&&O){const j=O.poses[B],ie=O.poses[B+1],fe=ie.end.clone().sub(ie.root).sub(j.end.clone().sub(j.root)),De=Math.min(1,fe.length()/Math.max(a*.35,1e-5)),Se=fe.clone();Se.z=0,Se.lengthSq()>1e-8&&Se.normalize();const Ms=f==="swing"&&q<=C?-1+2*Ar(Y):1;k.copy(Se).multiplyScalar(a*.035*tt*Yt*De*Ms),k.z-=a*.023*tt*Yt*De}if(Kt(Mr(he,g,$t,U,i,{mode:"move",space:"world",values:k.toArray(),restrictions:r,control:Et(he,h,{kind:"body"},"move")})),tt&&O&&v!=null&&v!==g){const j=O.poses[B],ie=O.poses[B+1],fe=j.end.clone().sub(j.root).cross(ie.end.clone().sub(ie.root));fe.lengthSq()>1e-8&&(fe.normalize().multiplyScalar(.13*tt*Yt*us*(q<=C?1-2*Y:-.35)),Kt(Mr(he,v,$t,U,i,{mode:"rotate",space:"world",values:fe.toArray(),restrictions:r,control:Et(he,h,{kind:"node",id:v},"rotate")})))}for(const j of yn)Kt(un(he,j.chain,U,i,j.pose.end,{orientation:j.pose.rotations[2].toArray()}))}for(const[k,j]of E){D.has(k)||D.set(k,new Map);const ie=se?u.get(j.id):Ss.get(j.id);let fe=se?_.sample(ie,j.property,U):de(he,ie,j.property,U,i);if(!se&&j.property==="Rotation"){const De=Math.hypot(..._.sample(u.get(j.id),j.property,oe));fe=ce(fe).toArray().map(Se=>Se*De)}D.get(k).set(U,fe)}}const H=[];for(const[U,B]of E){const R=u.get(B.id),q=R[B.property],G=q?.Keys?q:{LineType:1,Keys:[]},Y=K.map(X=>mn(X,D.get(U)?.get(X)||_.sample(R,B.property,X),G.LineType));if(Y.every(X=>pt(X.Vector,_.sample(R,B.property,X.Frame),B.property)<1e-6))continue;if(G.LineType===0)throw new Error("Motion needs smooth keys. Choose Linear for the affected bone.");if(!I&&G.LineType>=2&&s.some(X=>!G.Keys.some(oe=>oe.Frame===X)))throw new Error("Include curved keys at both ends, or use the whole animation.");const se=ys(G,Y,B.property,B.property==="Rotation"?.004:a*4e-4,M,_),ne=G.Keys.filter(X=>X.Frame<s[0]||X.Frame>s[1]).map(X=>structuredClone(X)),wt=s.flatMap(X=>G.Keys.filter(oe=>oe.Frame===X).slice(0,-1).map(oe=>structuredClone(oe)));for(const X of se)ct(n,[{...B,value:M.has(X.Frame)?de(n,R,B.property,X.Frame,i):X.Vector}],X.Frame,i,r);for(const X of se)if(M.has(X.Frame)){const oe=G.Keys.findLast(he=>he.Frame===X.Frame);oe&&(X.Vector=new Float32Array(oe.Vector)),[s[0],s[1]].includes(X.Frame)&&oe&&(X.Frame===s[0]&&oe.InTan&&(X.InTan=new Float32Array(oe.InTan)),X.Frame===s[1]&&oe.OutTan&&(X.OutTan=new Float32Array(oe.OutTan)))}const _t=n.Sequences[i].Interval;if(!G.Keys.some(X=>X.Frame>=_t[0]&&X.Frame<=_t[1]))for(const X of _t)(X<s[0]||X>s[1])&&ne.push(mn(X,de(n,R,B.property,X,i),G.LineType));H.push({...B,track:{...structuredClone(G),Keys:[...ne,...wt,...se].sort((X,oe)=>X.Frame-oe.Frame)}})}return _.destroy(),{tracks:H,keyCount:H.reduce((U,B)=>U+B.track.Keys.filter(R=>R.Frame>=s[0]&&R.Frame<=s[1]).length,0),anchors:[...c],allKeyFrames:e.allKeyFrames,impact:C,sparse:l,loop:e.loop,style:f,body:g}}let Ut,wr,_r,Cr;self.onmessage=({data:e})=>{if(e.context){Ut=e.context,wr=null,_r=null,Cr=null;return}try{wr||=vs(Ut.model,Ut.config,Ut.sequence,Ut.range);const t=JSON.stringify([e.settings,e.restrictions]);t!==_r&&(Cr=Ts(wr,e.settings,e.restrictions),_r=t),self.postMessage({variant:e.variant,request:e.request,result:Cr})}catch(t){self.postMessage({variant:e.variant,request:e.request,error:t.message})}}})();
