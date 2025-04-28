import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, BrowserRouter } from "react-router-dom";
import './styles/app.css';

import Home from './pages/home';
import SavedPaintings from './components/SavedPaintings';

function App() {
  return (
    <BrowserRouter>
      <main>
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/saved" element={<SavedPaintings />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
