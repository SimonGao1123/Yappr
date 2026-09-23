import { useEffect, useState, lazy, Suspense } from 'react'
import { socket } from './socket.js'

import './App.css'
import LoginPage from './LoginPage/LoginPage.js';
// Lazy load pages that aren't immediately needed
const FriendsPage = lazy(() => import('./FriendsPage/FriendsPage.js'));
const ChatsPage = lazy(() => import('./ChatsPage/ChatsPage.js'));
const Settings = lazy(() => import('./SettingsPage/Settings.js'));
const RandomChats = lazy(() => import('./RandomChatsPage/RandomChatsPage.js'));

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
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { errorMessage, fetchJson } from './data/http.js';
import { ToastRegion, showToast } from './ui/Toast.js';
import type { CurrChat, GetChatsResponse } from '../definitions/chatsTypes.js';
import type { SelectMessagesFromChat } from '../definitions/messagingTypes.js';

function App() {
  const navigate = useNavigate();
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
    3 = random chats page
    
    (Only for highlighting tabs)
    */

    const [ifLightMode, setIfLightMode] = useState(true); // true for light mode, false for dark mode
    const [status, setStatus] = useState(0);
    // status for random chat
    // status:
    // 0 = not in queue 
    // 1 = in queue waiting
    // 2 = in chat

    // Theme is applied once at the root; components use tokens, not per-element classes.
    useEffect(() => {
      document.documentElement.setAttribute('data-theme', ifLightMode ? 'light' : 'dark');
    }, [ifLightMode]);

    // Session check. Runs on mount only — it previously re-ran (and force-navigated
    // back to /) every time currentlyLoggingIn changed, contradicting its own comment.
    useEffect(() => {
      navigate("/");
      setDisplayIndex(0);
      fetchJson<MeResponse>("/api/userLogins/me")
        .then(parsed => {
          if (parsed.loggedIn && parsed.user) {
            const {username, id} = parsed.user;
            setLoginStatus(false);
            setCurrentUser({username, id});
          }
        })
        .catch(err => {
          console.log("Error in identifying session", err);
        });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!currentUser?.id) {
          socket.disconnect();
          return;
        }
        socket.connect();
        getAllData();

        // The server pushes on every mutation, so there is no 5s poll any more.
        // The slow interval is only a safety net for a dropped socket.
        const onChatsChanged = () => { refreshChats(); };
        const onFriendsChanged = () => { refreshFriends(); };
        socket.on('chats:changed', onChatsChanged);
        socket.on('friends:changed', onFriendsChanged);

        const intervalId = setInterval(() => {
          refreshChats();
          refreshFriends();
        }, 60000);

        return () => {
          clearInterval(intervalId);
          socket.off('chats:changed', onChatsChanged);
          socket.off('friends:changed', onFriendsChanged);
          socket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id]);

    // Handle browser/tab closing for all pages (automatically leave tab)
    useEffect(() => {
        if (!currentUser?.id) return;

        const handleBeforeUnload = () => {
            // This works on ALL pages in your app
            console.log("Browser/tab closing");
            
            // Leave queue if user is in random chat
            if (status > 0) {
                // Fix: Use Blob with proper content type for sendBeacon
                const data = JSON.stringify({user_id: currentUser.id});
                const blob = new Blob([data], {type: 'application/json'});
                navigator.sendBeacon('/api/randomChats/leaveQueue', blob);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [currentUser?.id, status]);


    async function refreshChats () {
      if (!currentUser?.id) return;
      try {
        const data = await fetchJson<GetChatsResponse>(`/api/chats/displayChats/${currentUser.id}`);
        if (data.success) setAllChats(data.chat_data ?? []);
      } catch (err) {
        showToast(errorMessage(err));
      }
    }

    async function refreshFriends () {
      if (!currentUser?.id) return;
      try {
        const [inc, out, curr] = await Promise.all([
          fetchJson<GetIncFriendsResponse>(`/api/friends/incomingRequests/${currentUser.id}`),
          fetchJson<GetOutFriendsResponse>(`/api/friends/outgoingRequests/${currentUser.id}`),
          fetchJson<GetCurrFriendsResponse>(`/api/friends/currFriends/${currentUser.id}`),
        ]);
        if (inc.success) setInFriendReq(inc.incomingRequests ?? []);
        if (out.success) setOutFriendReq(out.outgoingRequests ?? []);
        if (curr.success) setCurrentFriends(curr.currFriends ?? []);
      } catch (err) {
        showToast(errorMessage(err));
      }
    }

    // Initial load. light_mode is read once here and never re-polled — the old 5s
    // poll re-read it and clobbered a theme the user had just toggled.
    async function getAllData () {
      if (!currentUser?.id) return;
      await Promise.all([refreshChats(), refreshFriends()]);
      try {
        const lightMode = await fetchJson<LightModeResponse>(`/api/settings/ifLightMode/${currentUser.id}`);
        if (lightMode.success && lightMode.light_mode !== undefined) {
          setIfLightMode(lightMode.light_mode === 1);
        }
      } catch {
        // theme is cosmetic; keep the current value rather than nagging
      }
    }


    const MAIN_PAGE = (
      <>
        <div id="top-bar">
          <h1 id="title">YappR</h1>
          <NavBar
            setDisplayIndex={setDisplayIndex}
            displayIndex={displayIndex}
            ifLightMode={ifLightMode}
          />
          <div style={{flex: 1}}></div>
          <Link to="settings" className={`nav-btn desktop-settings ${displayIndex===2?"active-tab":""}`} id="nav-settings-btn" onClick={() => setDisplayIndex(2)} aria-label="Settings">
            <img src={ifLightMode ? settingsIcon : settingsIconDark} alt="" id="settings-icon"/>
          </Link>
        </div>
        <main id="app-main-section">
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
            <Route path="/randomChats" element={
              <RandomChats
              currentUser={currentUser}
              ifLightMode={ifLightMode}
              currentFriends={currentFriends}
              outgoingFriendReq={outgoingFriendReq}
              incomingFriendReq={incomingFriendReq}
              status={status}
              setStatus={setStatus}
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
          <div id="user-info-container"><p id="user-info">Welcome <b>{currentUser.username}</b>, id: {currentUser.id}</p></div>
          </> : <></>}
        </main>
      </>
    );

  return (
    <>
        {currentlyLoggingIn ? <LoginPage setCurrentUser={setCurrentUser} setLoginStatus={setLoginStatus}/> : MAIN_PAGE}
        <ToastRegion />
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
      case 3: return 'RandomYapp';
      default: return 'Menu';
    }
  };
  return (
    <>
      {/* Desktop Navigation */}
      <nav className="desktop-nav">
        <Link to="/" onClick={() => handleNavClick(0)} className={`nav-btn nav-fixed ${displayIndex===0?"active-tab":""}`} id="nav-chats-btn">Chats</Link>
        <Link to="/randomChats" onClick={() => handleNavClick(3)} className={`nav-btn nav-fixed ${displayIndex===3?"active-tab":""}`} id="nav-random-btn">RandomYapp</Link>
        <Link to="/friends" onClick={() => handleNavClick(1)} className={`nav-btn nav-fixed ${displayIndex===1?"active-tab":""}`} id="nav-friends-btn-unique">Friends</Link>
      </nav>
      {/* Mobile Navigation */}
      <div className="mobile-nav">
        <button 
          className="hamburger-btn" 
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
          <div className="dropdown-menu">
            <Link to="/"
              className={`dropdown-item ${displayIndex===0?"active":""}`} 
              onClick={() => handleNavClick(0)}
            >
              Chats
            </Link>
            <Link to="/randomChats" 
              className={`dropdown-item ${displayIndex===3?"active":""}`} 
              onClick={() => handleNavClick(3)}
            >
              RandomYapp
            </Link>
            <Link to="/friends" 
              className={`dropdown-item ${displayIndex===1?"active":""}`} 
              onClick={() => handleNavClick(1)}
            >
              Friends
            </Link>
            <Link to="/settings"
              className={`dropdown-item ${displayIndex===2?"active":""}`} 
              onClick={() => handleNavClick(2)}
            >
              Settings
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

export default App
