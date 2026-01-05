import { useState } from 'react'
import { useEffect } from 'react';
import './Settings.css';

import type { UpdateUsernameProp, ThemeToggleProp, AlterDescriptionProps, SettingsProps } from '../../definitions/settingsTypes.ts';
import type { standardResponse } from '../../definitions/globalType.js';

function Settings ({setCurrentUser, setLoginStatus, setDisplayIndex, currentUser, ifLightMode, setIfLightMode}: SettingsProps) {
    return (
        <main id="settings-main" className={!ifLightMode?"dark-mode":""}>
            <UpdateUsername setCurrentUser={setCurrentUser} currentUser={currentUser} ifLightMode={ifLightMode}/>
            <AlterDescription currentUser={currentUser} ifLightMode={ifLightMode}/>

            <ThemeToggle ifLightMode={ifLightMode} setIfLightMode={setIfLightMode} currentUser={currentUser}/>
            
            <button onClick={() => logOutFunction(setCurrentUser, setLoginStatus, setDisplayIndex)} id="logout-btn" className={!ifLightMode?"dark-mode":""}>Logout</button>
        </main>
    );
}
function UpdateUsername ({currentUser, ifLightMode, setCurrentUser}: UpdateUsernameProp) {
    const [displayMsg, setDisplayMsg] = useState("");
    const [newUsername, setNewUsername] = useState(currentUser.username);

    return (

        <div className={!ifLightMode?"dark-mode":""} id="update-username-section">
            <h2 className={!ifLightMode?"dark-mode":""}>Update Username</h2>
            <input className={!ifLightMode?"dark-mode":""} id="update-username-input" type='text' maxLength={30} value={newUsername} onChange={(e) => setNewUsername(e.target.value)}/>
            <button id="update-username-btn" onClick={() => updateUsernameFunction(currentUser, currentUser.id, newUsername, setDisplayMsg, setCurrentUser)}>Update</button>
            <p id="display-msg-update-username-input">{displayMsg}</p>
        </div>
    );
}
function updateUsernameFunction(currentUser: {username: string, id: number}, user_id: number, newUsername: string, setDisplayMsg: (value: string)=> void, setCurrentUser: (value: {username: string, id: number})=> void) {
    fetch("/userLogins/updateUsername", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify({username: currentUser.username, user_id, newUsername})
    }).then(async res => {
        const parsed: standardResponse = await res.json();
        setDisplayMsg(parsed.message);
        if (parsed.success && parsed.user) {
            setCurrentUser(parsed.user);
        }
        console.log(parsed);
    }).catch(err => {
        console.log(err);
    });
}
function ThemeToggle ({ifLightMode, setIfLightMode, currentUser}: ThemeToggleProp) {
    if (!currentUser) return null;
    
    return (
        <div id="light-mode-toggle" className={!ifLightMode?"dark-mode":""}>
            <h2 className={!ifLightMode?"dark-mode":""}>Theme</h2>
            <div id="theme-options">
                <label htmlFor="dark-mode-radio" className={!ifLightMode?"dark-mode":""}>
                    <input 
                        type="radio" 
                        id="dark-mode-radio" 
                        className={!ifLightMode?"dark-mode":""} 
                        checked={!ifLightMode} 
                        onChange={() => setLightDarkMode(setIfLightMode, false, currentUser.id)}
                    />
                    Dark Mode
                </label>
                <label htmlFor="light-mode-radio" className={!ifLightMode?"dark-mode":""}>
                    <input 
                        type="radio" 
                        id="light-mode-radio" 
                        className={!ifLightMode?"dark-mode":""} 
                        checked={ifLightMode} 
                        onChange={() => setLightDarkMode(setIfLightMode, true, currentUser.id)}
                    />
                    Light Mode
                </label>
            </div>
        </div>
    );
}

function setLightDarkMode (setIfLightMode: (value: boolean) => void, ifLightMode: boolean, user_id: number) {
    fetch("/settings/switchLightDarkMode", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ifLightMode, user_id})
    }).then(async res => {
        const parsed: standardResponse = await res.json();
        console.log(parsed);
    }).catch(err => {
        console.log(err);
    });
    setIfLightMode(ifLightMode);
}

function logOutFunction (setCurrentUser: (value: {username: string, id: number} | null)=> void, setLoginStatus: (value: boolean)=> void, setDisplayIndex: (value: number)=> void) {
    fetch("/userLogins/logout", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "include"
        }).then(async response => {
        const parsed: standardResponse = await response.json();
        console.log(parsed);
        }).catch(err => {
        console.log("Error in logging out of session", err);
        });

    setCurrentUser(null); // removes data of login user
    setLoginStatus(true); // returns to login page
    setDisplayIndex(0); // next time open automatically goes to chats

}

function AlterDescription ({currentUser, ifLightMode}: AlterDescriptionProps) {
    const [description, setDescription] = useState("");
    const [displayMsg, setDisplayMsg] = useState("");

    function updateDescription () {
        if (!currentUser) return;
        fetch("/settings/setDescription", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({user_id: currentUser.id, description})
        }
        ).then(async res => {
            const parsed: standardResponse = await res.json();
            setDisplayMsg(parsed.message);
        }).catch(err => {
            console.log(err);
        }) 
    }

    function getDescription () {
        if (!currentUser) return;
        fetch(`/settings/getDescription/${currentUser.id}`, {
            method: "GET"
        }
        ).then(async res => {
            const parsed: standardResponse = await res.json();
            if (!parsed.success) {
                console.log(parsed.message);
                return;
            }
            if (parsed.desc) {
                setDescription(parsed.desc);
            }
        }).catch(err => {
            console.log(err);
        })
    }

    useEffect(() => {
        if (!currentUser?.id) return;
        getDescription();
    }, [currentUser?.id]);

    return (
        <div id="description-alter-section" className={!ifLightMode?"dark-mode":""}>
            <h2 className={!ifLightMode?"dark-mode":""}>Update Description</h2>
            <textarea placeholder='Description' id="description" className={!ifLightMode?"dark-mode":""} value={description} onChange={(e) => setDescription(e.target.value)}/>
            <button id="update-description-btn" className={!ifLightMode?"dark-mode":""} onClick={() => updateDescription()}>Update</button>
            <p id="display-description-msg" className={!ifLightMode?"dark-mode":""}>{displayMsg}</p>
        </div>
    );
}

export default Settings;