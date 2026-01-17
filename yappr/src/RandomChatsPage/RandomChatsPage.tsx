import { useEffect, useState, lazy, Suspense } from 'react'
import '/RandomChatsPage.css';
import type { GetQueueSize } from '../../definitions/randomChatTypes.js';

function RandomChatsPage ({currentUser}) {
    const [currChat, setCurrChat] = useState(null);
    // currRandom chat

}

// TODO: 
function JoinQueueScreen () {

}
function WaitingScreen () {

}
function ChatDisplay () {

}
function getQueueStatus (id: number) {
    fetch(`/api/randomChats/getRandomChat/${id}`)
    .then(async res => {
        const parsed: GetQueueSize = await res.json();
        // set chat if in chat
    }).catch(err => {
        console.log(err);
    });
}