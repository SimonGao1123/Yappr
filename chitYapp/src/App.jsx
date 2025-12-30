import { useEffect, useState } from 'react'

import './App.css'
import LoginPage from './LoginPage/LoginPage.jsx';
import FriendsPage from './FriendsPage/FriendsPage.jsx';
import ChatsPage from './ChatsPage/ChatsPage.jsx';
import Settings from './SettingsPage/Settings.jsx';

import settingsIcon from './images/Gear-icon.png';
function App() {
    // LOGIN PAGE: 
    const [currentlyLoggingIn, setLoginStatus] = useState(true); 
    const [currentUser, setCurrentUser] = useState(null); // holds username/id of current user

    // FRIENDS PAGE:
    const [currentFriends, setCurrentFriends] = useState([]); // holds {username, user_id, friend_id}
    const [outgoingFriendReq, setOutFriendReq] = useState([]);
    const [incomingFriendReq, setInFriendReq] = useState([]); 

    // CHATS PAGE:
    const [displayIndex, setDisplayIndex] = useState(0); 
    /*
    DISPLAY INDEX:
    0 = chats page
    1 = friends page
    2 = settings page
    */

    // runs every time refresh
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

    // auto update of friends
    function getCurrentFriends () {
        fetch(`http://localhost:3000/friends/currFriends/${currentUser.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setCurrentFriends(data.currFriends);
                    }
                })
                .catch(err => console.log(err));
    }
    useEffect(() => {
        if (!currentUser?.id) return;
        getCurrentFriends();
        const intervalId = setInterval(() => {
            getCurrentFriends();
        }, 2000);

        return () => clearInterval(intervalId);
    }, [currentUser?.id, currentFriends, displayIndex]);

    function getOutgoingRequests () {
        fetch(`http://localhost:3000/friends/outgoingRequests/${currentUser.id}`, {
            method: "GET"
        }).then(async response => {
            const data = await response.json();
            if (data.success) {
                setOutFriendReq(data.outgoingRequests);
            }
            
        }).catch(err => {
            console.log(err);
        });
    }
    useEffect(() => {
        if (!currentUser?.id) return;
        getOutgoingRequests();
        const intervalId = setInterval(() => {
            getOutgoingRequests();
        }, 2000);

        return () => clearInterval(intervalId);
    }, [currentUser?.id, outgoingFriendReq, displayIndex]);

    function getIncomingReq () {
        fetch(`http://localhost:3000/friends/incomingRequests/${currentUser.id}`, {
            method: "GET"
        }).then(async response => {
            const parsed = await response.json();
            if (parsed.success) {
                setInFriendReq(parsed.incomingRequests);
            }
        }).catch(err => {
            console.log(err);
        })
    }

    useEffect(() => {
        if (!currentUser?.id) return;
        getIncomingReq();
        const intervalId = setInterval(() => {
            getIncomingReq();
        }, 2000);

        return () => clearInterval(intervalId);
    }, [currentUser?.id, incomingFriendReq, displayIndex]);


    const MAIN_PAGE = (
      <>
        <NavBar  
        setDisplayIndex={setDisplayIndex}
        displayIndex={displayIndex}/>

        <main id="app-main-section">
          
          {displayIndex===0?
          <ChatsPage
          currentUser={currentUser}
          currentFriends={currentFriends}
          />
          : displayIndex===1?
          <FriendsPage
            currentFriends={currentFriends}
            setCurrentFriends={setCurrentFriends}
            outgoingFriendReq={outgoingFriendReq}
            setOutFriendReq={setOutFriendReq}
            incomingFriendReq={incomingFriendReq}
            setInFriendReq={setInFriendReq}
            currentUser={currentUser}
          />
          : displayIndex=== 2?
          <Settings
          setCurrentUser={setCurrentUser}
          setLoginStatus={setLoginStatus}
          setDisplayIndex={setDisplayIndex}
          currentUser={currentUser}
          />
          :
          <></>}
          {currentUser ? 
          <div id="user-info-container"><p id="user-info">Welcome <b>{currentUser.username}</b>, id: {currentUser.id}</p></div> : <></>}
        </main>
        
      </>
    );

  return (
    <>
        {currentlyLoggingIn ? <LoginPage setCurrentUser={setCurrentUser} setLoginStatus={setLoginStatus}/> : MAIN_PAGE}
        
    </>
  );
}
function NavBar ({setDisplayIndex, displayIndex}) {
  return (
  <>
    <div id="top-bar">
      <nav>
        <button className={`nav-btn ${displayIndex===0?"active-tab":""}`} onClick={() => setDisplayIndex(0)} id="nav-chats-btn">Chats</button>
        <button className={`nav-btn ${displayIndex===1?"active-tab":""}`} onClick={() => setDisplayIndex(1)} id="nav-friends-btn">Friends</button>
      </nav>
      <button className={`nav-btn ${displayIndex===2?"active-tab":""}`} id="nav-settings-btn" onClick={() => setDisplayIndex(2)}><img src={settingsIcon} alt="Settings" id="settings-icon"/></button>
    </div>
  </>  
  );
}

export default App
