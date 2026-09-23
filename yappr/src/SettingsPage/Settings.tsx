import { useState } from 'react'
import { useEffect } from 'react';
import './Settings.css';

import type { UpdateUsernameProp, ThemeToggleProp, AlterDescriptionProps, SettingsProps } from '../../definitions/settingsTypes.ts';
import type { standardResponse } from '../../definitions/globalType.js';
import { useNavigate } from 'react-router-dom';
import { errorMessage, postJson, fetchJson } from '../data/http.js';
import { showToast } from '../ui/Toast.js';

function Settings ({setCurrentUser, setLoginStatus, setDisplayIndex, currentUser, ifLightMode, setIfLightMode}: SettingsProps) {
    const navigate = useNavigate();

    const handleLogout = async (e: React.MouseEvent) => {
        e.preventDefault();
        await logOutFunction(setCurrentUser, setLoginStatus, setDisplayIndex, currentUser?.id);
        navigate('/');
    };

    return (
        <main id="settings-main">
            <UpdateUsername setCurrentUser={setCurrentUser} currentUser={currentUser} ifLightMode={ifLightMode}/>
            <AlterDescription currentUser={currentUser} ifLightMode={ifLightMode}/>

            <ThemeToggle ifLightMode={ifLightMode} setIfLightMode={setIfLightMode} currentUser={currentUser}/>
            
            <button onClick={handleLogout} id="logout-btn">Logout</button>
        </main>
    );
}
function UpdateUsername ({currentUser, ifLightMode, setCurrentUser}: UpdateUsernameProp) {
    const [displayMsg, setDisplayMsg] = useState("");
    const [newUsername, setNewUsername] = useState(currentUser.username);
    const [saving, setSaving] = useState(false);

    return (

        <div id="update-username-section">
            <h2>Update Username</h2>
            <label className="sr-only" htmlFor="update-username-input">New username</label>
            <input id="update-username-input" type='text' maxLength={30} value={newUsername} onChange={(e) => setNewUsername(e.target.value)}/>
            <button id="update-username-btn" disabled={saving || !newUsername.trim() || newUsername === currentUser.username} onClick={async () => {
                setSaving(true);
                try { await updateUsernameFunction(currentUser, currentUser.id, newUsername, setDisplayMsg, setCurrentUser); }
                finally { setSaving(false); }
            }}>{saving ? "Saving…" : "Update"}</button>
            <p id="display-msg-update-username-input">{displayMsg}</p>
        </div>
    );
}
async function updateUsernameFunction(currentUser: {username: string, id: number}, user_id: number, newUsername: string, setDisplayMsg: (value: string)=> void, setCurrentUser: (value: {username: string, id: number})=> void) {
    try {
        const parsed = await postJson<standardResponse>("/api/userLogins/updateUsername", {username: currentUser.username, user_id, newUsername});
        setDisplayMsg(parsed.message);
        if (parsed.success && parsed.user) {
            setCurrentUser(parsed.user);
        }
    } catch (err) {
        setDisplayMsg(errorMessage(err));
    }
}
function ThemeToggle ({ifLightMode, setIfLightMode, currentUser}: ThemeToggleProp) {
    if (!currentUser) return null;
    
    return (
        <div id="light-mode-toggle">
            <h2>Theme</h2>
            <div id="theme-options">
                <label htmlFor="dark-mode-radio">
                    <input 
                        type="radio"
                        name="theme"
                        id="dark-mode-radio"
                        checked={!ifLightMode} 
                        onChange={() => setLightDarkMode(setIfLightMode, false, currentUser.id)}
                    />
                    Dark Mode
                </label>
                <label htmlFor="light-mode-radio">
                    <input 
                        type="radio"
                        name="theme"
                        id="light-mode-radio"
                        checked={ifLightMode} 
                        onChange={() => setLightDarkMode(setIfLightMode, true, currentUser.id)}
                    />
                    Light Mode
                </label>
            </div>
        </div>
    );
}

async function setLightDarkMode (setIfLightMode: (value: boolean) => void, ifLightMode: boolean, user_id: number) {
    // apply straight away, undo if the server rejects it
    setIfLightMode(ifLightMode);
    try {
        await postJson<standardResponse>("/api/settings/switchLightDarkMode", {ifLightMode, user_id});
    } catch (err) {
        setIfLightMode(!ifLightMode);
        showToast(errorMessage(err));
    }
}

async function logOutFunction (setCurrentUser: (value: {username: string, id: number} | null)=> void, setLoginStatus: (value: boolean)=> void, setDisplayIndex: (value: number)=> void, id: number) {
    try {
        // Leave queue/chat on unmount or user change (when logout button clicked)
        fetch('/api/randomChats/leaveQueue', {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({user_id: id})
        }).catch(err => console.log(err));

        const response = await fetch("/api/userLogins/logout", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            credentials: "include"
        });
        const parsed: standardResponse = await response.json();
        console.log(parsed);
    } catch (err) {
        console.log("Error in logging out of session", err);
    }

    setCurrentUser(null); // removes data of login user
    setLoginStatus(true); // returns to login page
    setDisplayIndex(0); // next time open automatically goes to chats
}

function AlterDescription ({currentUser, ifLightMode}: AlterDescriptionProps) {
    const [description, setDescription] = useState("");
    const [displayMsg, setDisplayMsg] = useState("");
    const [saving, setSaving] = useState(false);

    async function updateDescription () {
        if (!currentUser) return;
        setSaving(true);
        try {
            const parsed = await postJson<standardResponse>("/api/settings/setDescription", {user_id: currentUser.id, description});
            setDisplayMsg(parsed.message);
        } catch (err) {
            setDisplayMsg(errorMessage(err));
        } finally {
            setSaving(false);
        }
    }

    async function getDescription () {
        if (!currentUser) return;
        try {
            const parsed = await fetchJson<standardResponse>(`/api/settings/getDescription/${currentUser.id}`);
            if (parsed.success && parsed.desc) setDescription(parsed.desc);
        } catch (err) {
            showToast(errorMessage(err));
        }
    }

    useEffect(() => {
        if (!currentUser?.id) return;
        getDescription();
    }, [currentUser?.id]);

    return (
        <div id="description-alter-section">
            <h2>Update Description</h2>
            <label className="sr-only" htmlFor="description">Profile description</label>
            <textarea placeholder='Description' id="description" value={description} onChange={(e) => setDescription(e.target.value)}/>
            <button id="update-description-btn" disabled={saving} onClick={() => updateDescription()}>{saving ? "Saving…" : "Update"}</button>
            <p id="display-description-msg">{displayMsg}</p>
        </div>
    );
}

export default Settings;