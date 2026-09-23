export type SetDescriptionInput = {
    user_id: number,
    description: string
}
export interface SelectDescription {
    description: string
}
export interface SelectLightMode {
    light_mode: number
} 
export type SwitchLightDarkModeInput = {
    ifLightMode: boolean,
    user_id: number
}
export type UpdateUsernameProp = {
    currentUser: {username: string, id: number}, 
    ifLightMode: boolean,
    setCurrentUser: (value: {username: string, id: number} | null)=> void
}
export type ThemeToggleProp = {
    ifLightMode: boolean,
    setIfLightMode: (value: boolean) => void,
    currentUser: {username: string, id: number} | null
}
export type AlterDescriptionProps = {
    currentUser: {username: string, id: number} | null,
    ifLightMode: boolean
}
export type SettingsProps = {
    setCurrentUser: (value: {username:string, id:number} | null)=>void, 
    setLoginStatus: (value: boolean)=>void, 
    setDisplayIndex: (value: number)=>void, 
    currentUser: {username: string, id: number}, 
    ifLightMode: boolean, 
    setIfLightMode: (value: boolean)=> void;
}

