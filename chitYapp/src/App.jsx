import { useEffect, useState } from 'react'

import './App.css'
import LoginPage from './LoginPage/LoginPage.jsx';
import FriendsPage from './FriendsPage/FriendsPage.jsx';
import ChatsPage from './ChatsPage/ChatsPage.jsx';

function handleLogOut (setCurrentUser, setLoginStatus, setDisplay) {
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
  setDisplay(true);
}
function App() {
    // LOGIN PAGE: 
    const [currentlyLoggingIn, setLoginStatus] = useState(true); 
    const [currentUser, setCurrentUser] = useState(null); // holds username/id of current user

    // FRIENDS PAGE:
    const [currentFriends, setCurrentFriends] = useState([]); // holds {username, user_id, friend_id}
    const [outgoingFriendReq, setOutFriendReq] = useState([]);
    const [incomingFriendReq, setInFriendReq] = useState([]); 

    // CHATS PAGE:
    const [displayChatsOrFriends, setDisplay] = useState(true); // if false then display friends

    


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

    const MAIN_PAGE = (
      <>
        <NavBar 
        setCurrentUser={setCurrentUser} 
        setLoginStatus={setLoginStatus} 
        setDisplay={setDisplay}
        displayChatsOrFriends={displayChatsOrFriends}/>

        <main id="app-main-section">
          {displayChatsOrFriends ? 
          <ChatsPage
          currentUser={currentUser}
          currentFriends={currentFriends}
          />
          
          :
          
          <FriendsPage
            currentFriends={currentFriends}
            setCurrentFriends={setCurrentFriends}
            outgoingFriendReq={outgoingFriendReq}
            setOutFriendReq={setOutFriendReq}
            incomingFriendReq={incomingFriendReq}
            setInFriendReq={setInFriendReq}
            currentUser={currentUser}
          />}
          {currentUser ? 
          <div id="user-info-container"><p id="user-info">Welcome {currentUser.username}, id: {currentUser.id}</p></div> : <></>}
        </main>
        
      </>
    );

  return (
    <>
        {currentlyLoggingIn ? <LoginPage setCurrentUser={setCurrentUser} setLoginStatus={setLoginStatus}/> : MAIN_PAGE}
        
    </>
  );
}
function NavBar ({setCurrentUser, setLoginStatus, setDisplay, displayChatsOrFriends}) {
  return (
  <>
    <div id="top-bar">
      <nav>
        <button className={`nav-btn ${displayChatsOrFriends?"active-tab":""}`} onClick={() => setDisplay(true)} id="nav-chats-btn">Chats</button>
        <button className={`nav-btn ${!displayChatsOrFriends?"active-tab":""}`} onClick={() => setDisplay(false)} id="nav-friends-btn">Friends</button>
      </nav>
      <button className="nav-btn" id="logout-btn" onClick={() => handleLogOut(setCurrentUser, setLoginStatus, setDisplay)}>Logout</button>
    </div>
  </>  
  );
}

export default App
