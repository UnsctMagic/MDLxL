import React, { useEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import './warning-toasts.css';

function WarningToast({ warning, onDismiss, persistent = false }) {
  const dismiss = useRef(onDismiss); dismiss.current = onDismiss;
  useEffect(() => {
    if (persistent) return;
    const timer = setTimeout(() => dismiss.current(), 5000);
    return () => clearTimeout(timer);
  }, [warning.id, persistent]);
  return <div className="warning-toast" data-alert="" data-persistent={persistent || undefined} role="alert">
    <button className="warning-message" title={warning.title || 'Click to dismiss this warning'} onClick={warning.onAction || onDismiss}><TriangleAlert size={13} aria-hidden="true"/>{warning.message}</button>
    {persistent && <button className="warning-dismiss" aria-label={`Dismiss ${warning.message}`} onClick={onDismiss}>×</button>}
  </div>;
}

// A repair stays available until dismissed; transient errors are newest first.
export default function WarningToasts({ messages, onDismiss, actionWarning }) {
  const [dismissedAction, setDismissedAction] = useState(null);
  const actionId = actionWarning?.id;
  useEffect(() => setDismissedAction(null), [actionId]);
  const action = actionWarning && dismissedAction !== actionId ? actionWarning : null;
  return <div className="warning-toasts" aria-label="Warnings">
    {messages.slice(0, action ? 1 : 2).map(warning => <WarningToast key={warning.id} warning={warning} onDismiss={() => onDismiss(warning.id)}/>)}
    {action && <WarningToast key={'action:' + actionId} warning={action} persistent onDismiss={() => setDismissedAction(actionId)}/>}
  </div>;
}
