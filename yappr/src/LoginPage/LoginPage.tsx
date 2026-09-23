import { useState } from 'react'
import './LoginPage.css';

import type { LoginPageProps, UserLoginProps, UserRegisterProps } from '../../definitions/loginTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';
import { errorMessage, postJson } from '../data/http.js';

function LoginPage ({setLoginStatus, setCurrentUser}: LoginPageProps) {
    const [loginUserEmail, setLoginUserEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    const [registerUsername, setRegisterUsername] = useState("");
    const [registerPassword, setRegisterPassword] = useState("");
    const [registerEmail, setRegisterEmail] = useState("");

    const [displayLogin, switchLoginDisplay] = useState(true); // true means login is displayed, false means registration 

    const [displayMessage, setDisplayMessage] = useState(""); // displays if login/registration failed

    
    function resetAllFields () {
        setLoginUserEmail("");
        setLoginPassword("");
        setRegisterUsername("");
        setRegisterPassword("");
        setRegisterEmail("");
        setDisplayMessage("");
    }
    const loginSection = <div id="login-section">
                <UserLogin
                loginUserEmail={loginUserEmail}
                setLoginUserEmail={setLoginUserEmail}
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
        <div className='login-shell'>
            <h1 className='title-login'>YappR</h1>
            <main className='main-login'>
                {displayLogin ? loginSection : registerSection}

                <p id="display-msg" role="status" aria-live="polite">{displayMessage}</p>

                {displayLogin ?
                <p className='login-switch'>Register <button type="button" className='inline-btn-login' onClick={() =>
                    {switchLoginDisplay(false)
                    resetAllFields()}}>here</button></p> :
                <p className='login-switch'>Login <button type="button" className='inline-btn-login' onClick={() =>
                {switchLoginDisplay(true)
                resetAllFields()
                }}>here</button></p>}
            </main>
        </div>
    );
}


function UserLogin ({loginUserEmail, setLoginUserEmail, loginPassword, setLoginPassword, setDisplayMessage, setLoginStatus, setCurrentUser}: UserLoginProps) {
    const [submitting, setSubmitting] = useState(false);

    async function handleUserLogin (e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitting) return;

        setSubmitting(true);
        setDisplayMessage("");
        try {
            const parsed = await postJson<standardResponse>("/api/userLogins/login", {
                userOrEmail: loginUserEmail,
                password: loginPassword,
            });

            if (parsed.success && parsed.user) {
                const {username, id} = parsed.user;
                setLoginStatus(false);
                setCurrentUser({username, id});
            }
            setDisplayMessage(parsed.message);
        } catch (error) {
            setDisplayMessage(errorMessage(error));
        } finally {
            setSubmitting(false);
            setLoginPassword("");
        }
    }
    return (
        <>
            <h2 className='login-header'>Login</h2>
            <form className='form-login' onSubmit={handleUserLogin}>
                <div className='login-input-container'>
                    <label className="sr-only" htmlFor="login-username">Username or email</label>
                    <input className="input-login" placeholder="Username/Email" id="login-username" type="text" autoComplete="username" maxLength={225} value={loginUserEmail} onChange={(e) => setLoginUserEmail(e.target.value)}/>
                </div>

                <div className='login-input-container'>
                    <label className="sr-only" htmlFor="login-password">Password</label>
                    <input className="input-login" placeholder='Password' id="login-password" type="password" autoComplete="current-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}/>
                </div>

                <button className="login-btn" id="login-btn" type="submit" disabled={submitting}>
                    {submitting ? "Logging in…" : "Login"}
                </button>
            </form>

        </>
    );
}
function UserRegister ({registerUsername, setRegisterUsername, registerPassword, setRegisterPassword, registerEmail, setRegisterEmail, setDisplayMessage, switchLoginDisplay}: UserRegisterProps) {
    const [confirmRegisterPassword, setConfirmPassword] = useState("");
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // checks if email is valid
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).+$/;
    
    const [submitting, setSubmitting] = useState(false);

    async function handleUserRegister (e:React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitting) return;
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

        setSubmitting(true);
        setDisplayMessage("");
        try {
            const parsed = await postJson<standardResponse>("/api/userLogins/register", {
                username: registerUsername,
                password: registerPassword,
                email: registerEmail,
            });
            if (parsed.success) {
                switchLoginDisplay(true);
                setRegisterUsername("");
                setRegisterEmail("");
            }
            setDisplayMessage(parsed.message);
        } catch (error) {
            setDisplayMessage(errorMessage(error));
        } finally {
            setSubmitting(false);
            setRegisterPassword("");
            setConfirmPassword("");
        }
    }
    return (
        <>
            <h2 className='login-header'>Register</h2>
            <form className='form-login' onSubmit={handleUserRegister}>

                <div className='register-input-container'>
                    <label className="sr-only" htmlFor="register-username">Username</label>
                    <input className="input-login" placeholder="Username" id="register-username" type="text" autoComplete="username" maxLength={30} value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)}/>
                </div>

                <div className='register-input-container'>
                    <label className="sr-only" htmlFor="register-email">Email</label>
                    <input className="input-login" placeholder="Email" id="register-email" type="email" autoComplete="email" maxLength={225} value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)}/>
                </div>

                <div className='register-input-container'>
                    <label className="sr-only" htmlFor="register-password">Password</label>
                    <input className="input-login" placeholder="Password" id="register-password" type="password" autoComplete="new-password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)}/>
                </div>

                <div className='register-input-container'>
                    <label className="sr-only" htmlFor="register-password-confirm">Confirm password</label>
                    <input className="input-login" placeholder="Confirm Password" id="register-password-confirm" type="password" autoComplete="new-password" value={confirmRegisterPassword} onChange={(e) => setConfirmPassword(e.target.value)}/>
                </div>

                <button className="login-btn" id="register-btn" type="submit" disabled={submitting}>
                    {submitting ? "Creating account…" : "Register"}
                </button>
            </form>

        </>
    );
}
export default LoginPage;