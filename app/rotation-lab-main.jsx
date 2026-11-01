import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import {prepareLab} from './rotation-lab.jsx';
import './styles.css';
await prepareLab();
createRoot(document.getElementById('root')).render(<App/>);
