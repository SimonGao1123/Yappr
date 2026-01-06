import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.js";
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

const rootElement = ReactDOM.createRoot(document.getElementById('root')!);

if (!rootElement) {
  throw new Error("Root element not found");
}

rootElement.render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);