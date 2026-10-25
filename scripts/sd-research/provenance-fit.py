import json,itertools,numpy as np
from scipy.spatial import cKDTree
from pathlib import Path
R=Path('D:/Codex/sd-research');ds=json.loads((R/'data/provenance-fit-input.json').read_text());t=ds[0];T=np.array(t['points']);tm=T.mean(0);Ts=T-tm;tu,td,tv=np.linalg.svd(Ts,full_matrices=False);treeT=cKDTree(T);diag=np.linalg.norm(np.ptp(T,axis=0));results=[]
for src in ds[1:]:
 S=np.array(src['points']);sm=S.mean(0);Ss=S-sm;su,sd,sv=np.linalg.svd(Ss,full_matrices=False);best=None
 for perm in itertools.permutations(range(3)):
  for signs in itertools.product([-1,1],repeat=3):
   axes=tv[list(perm)]*np.array(signs)[:,None];scale=np.sqrt((td[list(perm)]**2/len(T))/(sd**2/len(S)));A=sv.T@np.diag(scale)@axes;B=tm-sm@A
   for it in range(40):
    F=S@A+B;ds1,idx=treeT.query(F);ds2,idx2=cKDTree(F).query(T)
    # Symmetric nearest-neighbour fit; keep all points so a source cannot collapse onto an attractive fragment.
    X=np.vstack([S,S[idx2]]);Y=np.vstack([T[idx],T]);C=np.linalg.lstsq(np.c_[X,np.ones(len(X))],Y,rcond=None)[0];An=C[:3];Bn=C[3]
    if np.linalg.cond(An)>20:break
    if np.max(np.abs(A-An))<1e-9 and np.max(np.abs(B-Bn))<1e-8:A=An;B=Bn;break
    A,B=An,Bn
   F=S@A+B;da,ia=treeT.query(F);db,ib=cKDTree(F).query(T);rms=np.sqrt((np.mean(da**2)+np.mean(db**2))/2)/diag
   if best is None or rms<best['rms']:
    targetfaces={tuple(sorted(f))for f in t['faces']};exactmapped=sum(tuple(sorted(int(ia[i])for i in f))in targetfaces and max(da[i]for i in f)<diag*.005 for f in src['faces'])
    best={'rms':float(rms),'sourceMax':float(da.max()/diag),'targetMax':float(db.max()/diag),'sourceWithinHalfPercent':int((da<diag*.005).sum()),'targetWithinHalfPercent':int((db<diag*.005).sum()),'mappedFaceMatchesWithinHalfPercent':int(exactmapped),'affine':A.tolist(),'translation':B.tolist(),'singularScale':np.linalg.svd(A,compute_uv=False).tolist(),'sourceToTargetIndex':ia.tolist()}
 result={'targetPart':t['partId'],'sourcePart':src['partId'],'sourcePoints':len(S),'targetPoints':len(T),'sourceFaces':len(src['faces']),'targetFaces':len(t['faces']),'method':'Symmetric nearest-neighbour affine ICP, 48 PCA starts; experimental candidate comparison, not proof of authorship or exact provenance',**best};results.append(result);print({k:v for k,v in result.items()if k not in ['affine','translation','sourceToTargetIndex']},flush=True)
(R/'data/provenance-affine-candidates.json').write_text(json.dumps(results,indent=2))
