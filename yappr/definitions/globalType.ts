export type standardResponse = 
| {
    message: string,
    success: true,
    user?: {username: string, id: number},
    desc?: string,
    light_mode?: number
} | {
    message: string,
    success: false
}
export type NavBarProps = {
    ifLightMode: boolean,
    setDisplayIndex: (value: number)=> void,
    displayIndex: number
}