import { useEffect, useState } from 'react'

import './App.css'
import LoginPage from './LoginPage/LoginPage.jsx';
import FriendsPage from './FriendsPage/FriendsPage.jsx';
import ChatsPage from './ChatsPage/ChatsPage.jsx';
import Settings from './SettingsPage/Settings.jsx';

import settingsIcon from './images/Gear-icon.png';
import settingsIconDark from './images/Gear-icon-Dark.png';
import menuIcon from './images/menu-icon.svg';
import menuIconDark from './images/menu-icon-dark.svg';

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

    const [ifLightMode, setIfLightMode] = useState(true); // true for light mode, false for dark mode

    // runs every time refresh
    useEffect(() => {
      fetch("/userLogins/me", {
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

    useEffect(() => {
        if (!currentUser?.id) return;
        fetch(`/settings/ifLightMode/${currentUser.id}`, {
            method: "GET"
        }).then(async res => {
            const data = await res.json();
            if (data.success) {
                setIfLightMode(data.light_mode===1);
            }
        });
    }, [currentUser?.id]);

    // auto update of friends
    function getCurrentFriends () {
        fetch(`/friends/currFriends/${currentUser.id}`)
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
        fetch(`/friends/outgoingRequests/${currentUser.id}`, {
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
        fetch(`/friends/incomingRequests/${currentUser.id}`, {
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
        <h1 id="title">YappR</h1>
        <NavBar  
        setDisplayIndex={setDisplayIndex}
        displayIndex={displayIndex}
        ifLightMode={ifLightMode}
        />

        <main style={!ifLightMode?{backgroundColor: "#1e1e1e"}:{}} id="app-main-section">
          
          {displayIndex===0?
          <ChatsPage
          currentUser={currentUser}
          currentFriends={currentFriends}
          ifLightMode={ifLightMode}
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
            ifLightMode={ifLightMode}
          />
          : displayIndex=== 2?
          <Settings
          setCurrentUser={setCurrentUser}
          setLoginStatus={setLoginStatus}
          setDisplayIndex={setDisplayIndex}
          currentUser={currentUser}
          ifLightMode={ifLightMode} 
          setIfLightMode={setIfLightMode}
          />
          :
          <></>}
          {currentUser ? 
          <div id="user-info-container" className={!ifLightMode?"dark-mode":""}><p id="user-info" className={!ifLightMode?"dark-mode":""}>Welcome <b>{currentUser.username}</b>, id: {currentUser.id}</p></div> : <></>}
        </main>
        
      </>
    );

  return (
    <>
        {currentlyLoggingIn ? <LoginPage setCurrentUser={setCurrentUser} setLoginStatus={setLoginStatus}/> : MAIN_PAGE}
        
    </>
  );
}
function NavBar ({ifLightMode, setDisplayIndex, displayIndex}) {
  const [menuOpen, setMenuOpen] = useState(false); // for mobile hamburger menu display
  
  const handleNavClick = (index) => {
    setDisplayIndex(index);
    setMenuOpen(false);
  };

  const getTabName = () => {
    switch(displayIndex) {
      case 0: return 'Chats';
      case 1: return 'Friends';
      case 2: return 'Settings';
      default: return 'Menu';
    }
  };

  return (
  <>
    <div id="top-bar" className={!ifLightMode?"dark-mode":""}>
      {/* Desktop Navigation */}
      <nav className="desktop-nav">
        <button className={`nav-btn ${displayIndex===0?"active-tab":""} ${!ifLightMode?"dark-mode":""}`} onClick={() => setDisplayIndex(0)} id="nav-chats-btn">Chats</button>
        <button className={`nav-btn ${displayIndex===1?"active-tab":""} ${!ifLightMode?"dark-mode":""}`} onClick={() => setDisplayIndex(1)} id="nav-friends-btn">Friends</button>
      </nav>
      
      {/* Mobile Navigation */}
      <div className="mobile-nav">
        <button 
          className={`hamburger-btn ${!ifLightMode?"dark-mode":""}`} 
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <img 
            src={ifLightMode ? menuIcon : menuIconDark} 
            alt="Menu" 
            className="menu-icon"
          />
          <span className="current-tab-name">{getTabName()}</span>
        </button>
        
        {menuOpen && (
          <div className={`dropdown-menu ${!ifLightMode?"dark-mode":""}`}>
            <button 
              className={`dropdown-item ${displayIndex===0?"active":""} ${!ifLightMode?"dark-mode":""}`} 
              onClick={() => handleNavClick(0)}
            >
              Chats
            </button>
            <button 
              className={`dropdown-item ${displayIndex===1?"active":""} ${!ifLightMode?"dark-mode":""}`} 
              onClick={() => handleNavClick(1)}
            >
              Friends
            </button>
            <button 
              className={`dropdown-item ${displayIndex===2?"active":""} ${!ifLightMode?"dark-mode":""}`} 
              onClick={() => handleNavClick(2)}
            >
              Settings
            </button>
          </div>
        )}
      </div>
      
      <button className={`nav-btn desktop-settings ${displayIndex===2?"active-tab":""} ${!ifLightMode?"dark-mode":""}`} id="nav-settings-btn" onClick={() => setDisplayIndex(2)}>
        <img src={ifLightMode ? settingsIcon : settingsIconDark} alt="Settings" id="settings-icon"/></button>
    </div>
  </>  
  );
}

export default App
