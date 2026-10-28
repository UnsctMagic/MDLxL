import React, { useEffect, useRef } from 'react';
import '../src/update-helmet.css';
import { helmetIcon } from '../src/update-helmet-assets.js';

export default function UpdateHelmet({ effects }) {
  const element = useRef(null);
  useEffect(() => effects.attach(element.current), [effects]);
  return <span className="update-helmet" ref={element} aria-hidden="true">
    <img src={helmetIcon} alt=""/>
    <canvas data-helmet="" width="256" height="256"/>
    <canvas data-particles="" width="384" height="384"/>
  </span>;
}
