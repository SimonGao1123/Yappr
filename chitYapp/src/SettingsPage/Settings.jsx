import { useState } from 'react'
import { useEffect } from 'react';

function Settings ({setCurrentUser, setLoginStatus, setDisplayIndex, currentUser}) {
    // TODO (after styling chats page):
    return (
        <main id="settings-main">
            <AlterDescription currentUser={currentUser}/>

            
            
            <button onClick={() => logOutFunction(setCurrentUser, setLoginStatus, setDisplayIndex)} id="logout-btn">Logout</button>
        </main>
    );
}

function logOutFunction (setCurrentUser, setLoginStatus, setDisplayIndex) {
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

    setCurrentUser(null); // removes data of login user
    setLoginStatus(true); // returns to login page
    setDisplayIndex(0); // next time open automatically goes to chats

}

function AlterDescription ({currentUser}) {
    const [description, setDescription] = useState("");
    const [displayMsg, setDisplayMsg] = useState("");

    function updateDescription () {
        fetch("http://localhost:3000/settings/setDescription", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({user_id: currentUser.id, description})
        }
        ).then(async res => {
            const parsed = await res.json();
            setDisplayMsg(parsed.message);
        }).catch(err => {
            console.log(err);
        }) 
    }

    function getDescription () {
        fetch(`http://localhost:3000/settings/getDescription/${currentUser.id}`, {
            method: "GET"
        }
        ).then(async res => {
            const parsed = await res.json();
            if (!parsed.success) {
                console.log(parsed.message);
                return;
            }
            setDescription(parsed.desc);
        }).catch(err => {
            console.log(err);
        })
    }

    useEffect(() => {
        if (!currentUser?.id) return;
        getDescription();
    }, [currentUser?.id]);

    return (
        <div id="description-alter-section">
            <h2>Update Description</h2>
            <input placeholder='Description' id="description" type='text' value={description} onChange={(e) => setDescription(e.target.value)}/>
            <button id="update-description-btn" onClick={() => updateDescription()}>Update</button>
            <p id="display-description-msg">{displayMsg}</p>
        </div>
    );
}

export default Settings;