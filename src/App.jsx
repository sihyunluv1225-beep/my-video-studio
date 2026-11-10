import React, { useState } from 'react';
import Home from './components/Home.jsx';
import Editor from './components/Editor.jsx';

export default function App() {
  const [styleId, setStyleId] = useState(null);
  if (!styleId) return <Home onPick={setStyleId} />;
  return <Editor styleId={styleId} onExit={() => setStyleId(null)} />;
}
