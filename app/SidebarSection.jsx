import React, { useState } from 'react';
import './SidebarSection.css';

export default function SidebarSection({ title, className = '', children, defaultOpen = true, ...props }) {
  const [open, setOpen] = useState(defaultOpen);
  return <details {...props} className={`sidebar-section${className ? ` ${className}` : ''}`} open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{title}</summary>
    <div className="sidebar-section-body">{children}</div>
  </details>;
}
