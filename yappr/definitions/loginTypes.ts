import type { RowDataPacket } from 'mysql2';

export type CurrUser = {
    id: number,
    username: string
}
export type MeResponse = {
    loggedIn: boolean,
    user?: CurrUser    
}
export type LoginInput = {
    userOrEmail: string,
    password: string
}
export interface CheckValidLogin extends RowDataPacket {
    user_id: number,
    username: string,
    password: string
}
export type RegisterInput = {
    username: string,
    password: string,
    email: string
}
export type UpdateUsernameInput = {
    username: string,
    user_id: number,
    newUsername: string
}
export interface LastUpdatedUsername extends RowDataPacket {
    last_updated_username: string
}
export type UserLoginProps = {
    loginUserEmail: string,
    setLoginUserEmail: (value: string)=> void,
    loginPassword: string, 
    setLoginPassword: (value: string)=> void, 
    setDisplayMessage: (value: string)=> void, 
    setLoginStatus: (value: boolean)=> void, 
    setCurrentUser: (value: {username: string, id: number})=> void
}
export type UserRegisterProps = {
    registerUsername: string, 
    setRegisterUsername: (value: string)=> void, 
    registerPassword: string, 
    setRegisterPassword: (value: string)=> void, 
    registerEmail: string, 
    setRegisterEmail: (value: string)=> void, 
    setDisplayMessage: (value: string)=> void, 
    switchLoginDisplay: (value: boolean)=> void
}
export type LoginPageProps = {
    setLoginStatus: (value:boolean)=>void,
    setCurrentUser: (value: {username:string, id:number})=>void
}