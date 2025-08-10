import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// (Disabled) Silence verbose console output snippet — re-enabled logs for debugging
;(function disableVerboseLogs() {
  const noop = () => {};

  console.info = noop;
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <App />
  </>,
) 