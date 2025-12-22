import { useEffect, useState } from 'react'

import './App.css'
import LoginPage from './LoginPage/LoginPage.jsx';

function handleLogOut (setCurrentUser, setLoginStatus) {
  fetch("http://localhost:3000/userLogins/logout", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "include"
      }).then(async response => {
        const parsed = await response.json();
        console.log(parsed);
      }).catch(err => {
        console.log("Error in logging out of session", err);
      });

  setCurrentUser(null);
  setLoginStatus(true); 
}
function App() {
    const [currentlyLoggingIn, setLoginStatus] = useState(true); 
    const [currentUser, setCurrentUser] = useState(null); // holds username/id of current user

    useEffect(() => {
      fetch("http://localhost:3000/userLogins/me", {
        method: "GET",
        credentials: "include"
      }).then(async response => {
        const parsed = await response.json();
        if (parsed.loggedIn) {
          const {username, id} = parsed.user;
          setLoginStatus(false);
          setCurrentUser({username, id});
          console.log("/me fetch: ", parsed);
        }
      }).catch(err => {
        console.log("Error in identifying session", err);
      });

    }, []); // will run everytime url path is changed, automatically logs in with user session
    console.log("Curr user: ", currentUser);

    const TEMPORARYPAGE = (
      <>
        {currentUser ? <p>Welcome {currentUser.username}, id: {currentUser.id}</p> : <></>}
        <button onClick={() => handleLogOut(setCurrentUser, setLoginStatus)}>Logout</button>
      </>
    );

  return (
    <>
        {currentlyLoggingIn ? <LoginPage setCurrentUser={setCurrentUser} setLoginStatus={setLoginStatus}/> : TEMPORARYPAGE}
        
    </>
  );
}

export default App
