import { useState } from 'react'
import './LoginPage.css';

function LoginPage ({setLoginStatus, setCurrentUser}) {
    const [loginUsername, setLoginUsername] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    const [registerUsername, setRegisterUsername] = useState("");
    const [registerPassword, setRegisterPassword] = useState("");
    const [registerEmail, setRegisterEmail] = useState("");

    const [displayLogin, switchLoginDisplay] = useState(true); // true means login is displayed, false means registration 

    const [displayMessage, setDisplayMessage] = useState(""); // displays if login/registration failed
    function resetAllFields () {
        setLoginUsername("");
        setLoginPassword("");
        setRegisterUsername("");
        setRegisterPassword("");
        setRegisterEmail("");
        setDisplayMessage("");
    }
    const loginSection = <div id="login-section">
                <UserLogin
                loginUsername={loginUsername}
                setLoginUsername={setLoginUsername}
                loginPassword={loginPassword}
                setLoginPassword={setLoginPassword}
                setDisplayMessage={setDisplayMessage}
                setLoginStatus={setLoginStatus}
                setCurrentUser={setCurrentUser}
                />
            </div>;

    const registerSection = <div id="register-section">
                <UserRegister
                registerUsername={registerUsername}
                setRegisterUsername={setRegisterUsername}
                registerPassword={registerPassword}
                setRegisterPassword={setRegisterPassword}
                registerEmail={registerEmail}
                setRegisterEmail={setRegisterEmail}
                setDisplayMessage={setDisplayMessage}
                switchLoginDisplay={switchLoginDisplay}
                />
    </div>
            
            
    return (
        <>
            <h1>ChitYapp</h1>
            
            {displayLogin ? loginSection : registerSection}
            
            <p id="display-msg">{displayMessage}</p>
            
            {displayLogin ? 
            <p>Register <button onClick={() => 
                {switchLoginDisplay(false) 
                resetAllFields()}}>here</button></p> :
            <p>Login <button onClick={() => 
            {switchLoginDisplay(true)
            resetAllFields()
            }}>here</button></p>}
        </>
    );
}


function UserLogin ({loginUsername, setLoginUsername, loginPassword, setLoginPassword, setDisplayMessage, setLoginStatus, setCurrentUser}) {
    function handleUserLogin (e) {
        e.preventDefault();

        fetch("http://localhost:3000/userLogins/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            credentials: "include",
            body: JSON.stringify({username: loginUsername, password: loginPassword})
        }).then(async (response) => {
            const parsed = await response.json();

            if (parsed.success) {
                const {username, id} = parsed.user;
                setLoginStatus(false);
                setCurrentUser({username, id}); 
            }
            setDisplayMessage(parsed.message);
        }).catch((error) => {
            console.log("Error while logging in: ", error);
        })
        setLoginUsername("");
        setLoginPassword("");
    }   
    return (
        <>
            <h2>Login</h2>
            <form onSubmit={handleUserLogin}>
                <div className='login-input-container'>
                    <label htmlFor='login-username'>Enter your Username: </label>
                    <input id="login-username" type="text" maxLength={30} value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)}/>
                </div>

                <div className='login-input-container'>
                    <label htmlFor='login-password'>Enter your Password: </label>
                    <input id="login-password" type="text" maxLength={30} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}/>
                </div>

                <button id="login-btn" type="submit">Login</button>
            </form>

        </>
    );
}
function UserRegister ({registerUsername, setRegisterUsername, registerPassword, setRegisterPassword, registerEmail, setRegisterEmail, setDisplayMessage, switchLoginDisplay}) {
    const [confirmRegisterPassword, setConfirmPassword] = useState("");
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // checks if email is valid
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).+$/;
    
    function handleUserRegister (e) {
        e.preventDefault();
        if (confirmRegisterPassword !== registerPassword) {
            setDisplayMessage("Password's don't match");
            return;    
        } // if password and confirm passwords don't match

        if (!emailRegex.test(registerEmail)) {
            setDisplayMessage("Invalid Email");
            return;
        }
        if (!passwordRegex.test(registerPassword) || registerPassword.length < 8) {
            setDisplayMessage("Password needs to be at least 8 characters and contain at least one number and special character");
            setConfirmPassword("");
            setRegisterPassword("");
            return; 
        }

        fetch("http://localhost:3000/userLogins/register", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({username: registerUsername, password: registerPassword, email: registerEmail})
        }).then(async (response) => {
            const parsed = await response.json();
            console.log(parsed);
            if (parsed.success) {
                switchLoginDisplay(true);
            } 
            setDisplayMessage(parsed.message);
        }).catch((error) => {
            console.log("Error occurred while registration: ", error);
        });

        setDisplayMessage("");
        setRegisterUsername("");
        setRegisterPassword("");
        setRegisterEmail("");
    }   
    return (
        <>
            <h2>Register</h2>
            <form onSubmit={handleUserRegister}>

                <div className='register-input-container'>
                    <label htmlFor='register-username'>Enter your Username: </label>
                    <input id="register-username" type="text" maxLength={30} value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)}/>
                </div>

                <div className='register-input-container'>
                    <label htmlFor='register-email'>Enter your Email: </label>
                    <input id="register-email" type="text" maxLength={225} value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)}/>
                </div>

                <div className='register-input-container'>
                    <label htmlFor='register-password'>Enter your Password: </label>
                    <input id="register-password" type="text" maxLength={30} value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)}/>

                    <label htmlFor='register-password-confirm'>Confirm your Password: </label>
                    <input id="register-password-confirm" type="text" maxLength={30} value={confirmRegisterPassword} onChange={(e) => setConfirmPassword(e.target.value)}/>
                </div>

                

                <button id="register-btn" type="submit">Register</button>
            </form>

        </>
    );
}
export default LoginPage;