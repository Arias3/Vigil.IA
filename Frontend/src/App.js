import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.js';
import Start from './pages/start';
import Home from './pages/home';
import Settings from './pages/settings';

function App() {
  return (
    <ThemeProvider>
      <Router>
      <div className="App">
        <main>
          <Routes>
            <Route path="/" element={<Start />} />
            <Route path="/home" element={<Home />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
    </ThemeProvider>
  );
}

export default App;