import { useEffect, useState } from 'react'

import './App.css'
import LoginPage from './LoginPage/LoginPage.jsx';
import FriendsPage from './FriendsPage/FriendsPage.jsx';

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
    // LOGIN PAGE: 
    const [currentlyLoggingIn, setLoginStatus] = useState(true); 
    const [currentUser, setCurrentUser] = useState(null); // holds username/id of current user

    // FRIENDS PAGE:
    const [currentFriends, setCurrentFriends] = useState([]); // holds {username, user_id, friend_id}
    const [outgoingFriendReq, setOutFriendReq] = useState([]);
    const [incomingFriendReq, setInFriendReq] = useState([]); 
    


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
        <FriendsPage
          currentFriends={currentFriends}
          setCurrentFriends={setCurrentFriends}
          outgoingFriendReq={outgoingFriendReq}
          setOutFriendReq={setOutFriendReq}
          incomingFriendReq={incomingFriendReq}
          setInFriendReq={setInFriendReq}
          currentUser={currentUser}
        />
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
