import React from 'react';
import {ChevronDown,ChevronRight} from 'lucide-react';
export default function GameLibraryRow({as:Tag='div',folder,open,icon,name,detail,count,children,...props}){
 return <Tag {...props}><span className="gf-twist" aria-hidden="true">{folder?(open?<ChevronDown size={12}/>:<ChevronRight size={12}/>):null}</span>{icon}<span className="gf-name" translate="no">{name}{detail&&<small translate="no">{detail}</small>}</span>{folder&&count!=null&&<small className="gf-count">{count.toLocaleString()}</small>}{children}</Tag>;
}
