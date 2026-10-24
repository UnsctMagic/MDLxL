import React from 'react';

// Render the small formatting subset used in assistant replies. React escapes
// every text node; provider text never becomes HTML or an executable link.
function inline(text) {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part,index)=>
    part.startsWith('**')&&part.endsWith('**')?<strong key={index}>{part.slice(2,-2)}</strong>:
    part.startsWith('`')&&part.endsWith('`')?<code key={index}>{part.slice(1,-1)}</code>:part);
}
export default function AiMessage({text}) {
  const blocks=[],lines=text.split('\n');
  for(let i=0;i<lines.length;) {
    if(!lines[i].trim()){i++;continue;}
    const key=i;
    if(lines[i].startsWith('```')) {
      const code=[];i++;while(i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i++]);i++;
      blocks.push(<pre key={key}><code>{code.join('\n')}</code></pre>);continue;
    }
    if(/^\s*[-*] /.test(lines[i])) {
      const items=[];while(i<lines.length&&/^\s*[-*] /.test(lines[i]))items.push(<li key={i}>{inline(lines[i++].replace(/^\s*[-*] /,''))}</li>);
      blocks.push(<ul key={key}>{items}</ul>);continue;
    }
    if(/^\s*\d+[.)] /.test(lines[i])) {
      const items=[];while(i<lines.length&&/^\s*\d+[.)] /.test(lines[i]))items.push(<li key={i}>{inline(lines[i++].replace(/^\s*\d+[.)] /,''))}</li>);
      blocks.push(<ol key={key}>{items}</ol>);continue;
    }
    if(/^#{1,6} /.test(lines[i])){blocks.push(<h4 key={key}>{inline(lines[i++].replace(/^#{1,6} /,''))}</h4>);continue;}
    const paragraph=[lines[i++]];
    while(i<lines.length&&lines[i].trim()&&!/^(?:```|#{1,6} |\s*[-*] |\s*\d+[.)] )/.test(lines[i]))paragraph.push(lines[i++]);
    blocks.push(<p key={key}>{inline(paragraph.join('\n'))}</p>);
  }
  return <div className="ai-prose" translate="no">{blocks}</div>;
}
