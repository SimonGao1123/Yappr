export type SendRequestInput = {
    sender_id: number,
    receiver_id: string | number
}
export interface CheckIfUsernameOrID {
    user_id: number,
    username?: string
} 
export interface CurrStatus {
    friend_id: number,
    status: string    
} 
export type CancelRequestInput = {
    friend_id: number, 
    receiver_id: number, 
    receiver_username: string
}
export interface FriendRequestQuery {
    status: string,
    sender_id: number,
    receiver_id: number    
}
export type AcceptRejectRequestInput = { 
    friend_id: number, 
    sender_username: string, 
    sender_id: number
}
export type UnfriendInput = {
    friend_id: number, 
    other_user_username: string
}
export interface CurrOutIncFriendsQuery {
    friend_id: number,
    username: string,
    user_id: number
}
export type GetCurrFriendsResponse = {
    message: string,
    success: boolean,
    currFriends?: CurrOutIncFriendsQuery[]
}
export type GetIncFriendsResponse = {
    message: string,
    success: boolean,
    incomingRequests?: CurrOutIncFriendsQuery[]
}
export type GetOutFriendsResponse = {
    message: string,
    success: boolean,
    outgoingRequests?: CurrOutIncFriendsQuery[]
}
export type FriendsPageProps = {
    currentFriends: CurrOutIncFriendsQuery[],
    outgoingFriendReq: CurrOutIncFriendsQuery[], 
    incomingFriendReq: CurrOutIncFriendsQuery[], 
    currentUser: {username: string, id: number}, 
    ifLightMode: boolean
}
export type SearchUsersProps = {
    searchBarInput: string, 
    setSearchBarInput: (value: string)=>void, 
    currentUser: {username: string, id: number}, 
    ifLightMode: boolean
}
export type DisplayCurrentFriendsProps = {
    currentFriends: CurrOutIncFriendsQuery[],
    ifLightMode: boolean
}
export type DisplayOutgoingRequestsProps = {
    outgoingFriendReq: CurrOutIncFriendsQuery[],
    ifLightMode: boolean
}
export type DisplayIncomingRequestsProps = {
    incomingFriendReq: CurrOutIncFriendsQuery[],
    ifLightMode: boolean
}