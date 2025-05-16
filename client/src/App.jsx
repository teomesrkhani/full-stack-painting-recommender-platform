import { Routes, Route, BrowserRouter } from "react-router-dom";
import './styles/app.css';

import Home from './pages/home';

function App() {
  return (
    <BrowserRouter>
      <main>
        <Routes>
          <Route path="/" element={<Home/>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
