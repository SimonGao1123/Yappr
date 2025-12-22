import { useState } from 'react'

import './App.css'
import LoginPage from './LoginPage/LoginPage.jsx';

function App() {
    const [currentlyLoggingIn, setLoginStatus] = useState(true); 

  return (
    <>
        {currentlyLoggingIn ? <LoginPage setLoginStatus={setLoginStatus}/> : <></>}
        
    </>
  );
}

export default App
