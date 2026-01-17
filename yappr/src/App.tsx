import { useEffect, useState, lazy, Suspense } from 'react'

import './App.css'
import LoginPage from './LoginPage/LoginPage.js';
// Lazy load pages that aren't immediately needed
const FriendsPage = lazy(() => import('./FriendsPage/FriendsPage.js'));
const ChatsPage = lazy(() => import('./ChatsPage/ChatsPage.js'));
const Settings = lazy(() => import('./SettingsPage/Settings.js'));

import settingsIcon from './images/Gear-icon.png';
import settingsIconDark from './images/Gear-icon-Dark.png';
import menuIcon from './images/menu-icon.svg';
import menuIconDark from './images/menu-icon-dark.svg';


import type { CurrUser, MeResponse } from '../definitions/loginTypes.js';
import type { NavBarProps } from '../definitions/globalType.js';
import type { CurrOutIncFriendsQuery, GetCurrFriendsResponse, GetIncFriendsResponse, GetOutFriendsResponse } from '../definitions/friendsTypes.js';

interface LightModeResponse {
  success: boolean;
  light_mode?: number;
  message?: string;
}
import { Link, Route, Routes } from 'react-router-dom';
import type { CurrChat, GetChatsResponse } from '../definitions/chatsTypes.js';
import type { SelectMessagesFromChat } from '../definitions/messagingTypes.js';

function App() {
    // LOGIN PAGE: 
    const [currentlyLoggingIn, setLoginStatus] = useState(true); 
    const [currentUser, setCurrentUser] = useState<CurrUser | null>(null); // holds username/id of current user

    // FRIENDS PAGE:
    const [currentFriends, setCurrentFriends] = useState<CurrOutIncFriendsQuery[]>([]); // holds {username, user_id, friend_id}
    const [outgoingFriendReq, setOutFriendReq] = useState<CurrOutIncFriendsQuery[]>([]);
    const [incomingFriendReq, setInFriendReq] = useState<CurrOutIncFriendsQuery[]>([]); 

    // CHATS PAGE:
    const [allChats, setAllChats] = useState<CurrChat[]>([]);

    const [displayIndex, setDisplayIndex] = useState(0); 
    /*
    DISPLAY INDEX:
    0 = chats page
    1 = friends page
    2 = settings page
    
    (Only for highlighting tabs)
    */

    const [ifLightMode, setIfLightMode] = useState(true); // true for light mode, false for dark mode

    // runs every time refresh - checks session on mount
    useEffect(() => {
      fetch("/api/userLogins/me", {
        method: "GET",
        credentials: "include"
      }).then(async response => {
        const parsed: MeResponse = await response.json();
        if (parsed.loggedIn && parsed.user) {
          const {username, id} = parsed.user;
          setLoginStatus(false);
          setCurrentUser({username, id});
          console.log("/me fetch: ", parsed);
        }
      }).catch(err => {
        console.log("Error in identifying session", err);
      });

    }, []); // Only run once on mount

    useEffect(() => {
        if (!currentUser?.id) return;
          getAllData()
        const intervalId = setInterval(() => {
          getAllData()
        }, 1000);

        return () => clearInterval(intervalId);
    }, [currentUser?.id]); // Remove state dependencies to prevent infinite re-renders


    // fetches all data from backend in parallel
    async function getAllData () {
      if (!currentUser?.id) return;
      try {
        const [ChatData, IncRequests, LightMode, OutRequests, CurrFriends]: [GetChatsResponse, GetIncFriendsResponse, LightModeResponse, GetOutFriendsResponse, GetCurrFriendsResponse]
         = await Promise.all([
          fetch(`/api/chats/displayChats/${currentUser.id}`).then(res => res.json()),
          fetch(`/api/friends/incomingRequests/${currentUser.id}`).then(res => res.json()),
          fetch(`/api/settings/ifLightMode/${currentUser.id}`).then(res => res.json()),
          fetch(`/api/friends/outgoingRequests/${currentUser.id}`).then(res => res.json()),
          fetch(`/api/friends/currFriends/${currentUser.id}`).then(res => res.json())
        ]);
        if (!ChatData.success || !IncRequests.success || !OutRequests.success || !CurrFriends.success) throw new Error("One of the responses was not successful");
        
        setAllChats(ChatData.chat_data ?? []);
        if (LightMode.success && LightMode.light_mode !== undefined) {
          setIfLightMode(LightMode.light_mode === 1);
        }
        setInFriendReq(IncRequests.incomingRequests ?? []);
        setOutFriendReq(OutRequests.outgoingRequests ?? []);
        setCurrentFriends(CurrFriends.currFriends ?? []);
        

      } catch (err) {
        console.error("One promise failed: ", err);
      }
    }


    const MAIN_PAGE = (
      <>
        <h1 id="title">YappR</h1>
        <NavBar  
        setDisplayIndex={setDisplayIndex}
        displayIndex={displayIndex}
        ifLightMode={ifLightMode}
        />

        <main style={!ifLightMode?{backgroundColor: "#1e1e1e"}:{}} id="app-main-section">
          
          {currentUser ?
          <>
          <Suspense fallback={<div className="loading-spinner">Loading...</div>}>
          <Routes>
              <Route path="/" element={
                <ChatsPage
                currentUser={currentUser}
                currentFriends={currentFriends}
                ifLightMode={ifLightMode}
                allChats={allChats}
                setAllChats={setAllChats}
                />
              }/>
                
            <Route path="/friends" element={
              <FriendsPage
                currentFriends={currentFriends}
                outgoingFriendReq={outgoingFriendReq}
                incomingFriendReq={incomingFriendReq}
                currentUser={currentUser}
                ifLightMode={ifLightMode}
              />
            }/>
            
            <Route path="/settings" element={
              <Settings
                setCurrentUser={setCurrentUser}
                setLoginStatus={setLoginStatus}
                setDisplayIndex={setDisplayIndex}
                currentUser={currentUser}
                ifLightMode={ifLightMode} 
                setIfLightMode={setIfLightMode}
              />
            }/>
          </Routes>
          </Suspense>
          <div id="user-info-container" className={!ifLightMode?"dark-mode":""}><p id="user-info" className={!ifLightMode?"dark-mode":""}>Welcome <b>{currentUser.username}</b>, id: {currentUser.id}</p></div>
          </> : <></>}
          
        </main>
        
      </>
    );

  return (
    <>
        {currentlyLoggingIn ? <LoginPage setCurrentUser={setCurrentUser} setLoginStatus={setLoginStatus}/> : MAIN_PAGE}
        
    </>
  );
}
function NavBar ({ifLightMode, setDisplayIndex, displayIndex}: NavBarProps) {
  const [menuOpen, setMenuOpen] = useState(false); // for mobile hamburger menu display
  
  const handleNavClick = (index: number) => {
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
        <Link to="/" onClick={() => handleNavClick(0)} className={`nav-btn ${displayIndex===0?"active-tab":""} ${!ifLightMode?"dark-mode":""}`} id="nav-chats-btn">Chats</Link>
        <Link to="/friends" onClick={() => handleNavClick(1)} className={`nav-btn ${displayIndex===1?"active-tab":""} ${!ifLightMode?"dark-mode":""}`} id="nav-friends-btn">Friends</Link>
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
            <Link to="/"
              className={`dropdown-item ${displayIndex===0?"active":""} ${!ifLightMode?"dark-mode":""}`} 
              onClick={() => handleNavClick(0)}
            >
              Chats
            </Link>
            <Link to="/friends" 
              className={`dropdown-item ${displayIndex===1?"active":""} ${!ifLightMode?"dark-mode":""}`} 
              onClick={() => handleNavClick(1)}
            >
              Friends
            </Link>
            <Link to="/settings"
              className={`dropdown-item ${displayIndex===2?"active":""} ${!ifLightMode?"dark-mode":""}`} 
              onClick={() => handleNavClick(2)}
            >
              Settings
            </Link>
          </div>
        )}
      </div>
      
      <Link to="settings" className={`nav-btn desktop-settings ${displayIndex===2?"active-tab":""} ${!ifLightMode?"dark-mode":""}`} id="nav-settings-btn" onClick={() => setDisplayIndex(2)}>
        <img src={ifLightMode ? settingsIcon : settingsIconDark} alt="Settings" id="settings-icon"/></Link>
    </div>
  </>  
  );
}

export default App
