import { useState } from 'react'
import { useEffect } from 'react';

function Settings ({setCurrentUser, setLoginStatus, setDisplayIndex}) {
    // TODO (after styling chats page):
    return (
        <button onClick={() => logOutFunction(setCurrentUser, setLoginStatus, setDisplayIndex)} id="logout-btn">Logout</button>
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

export default Settings;