-- USER LOGIN TABLE
-- @block
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT,
    username VARCHAR(30) NOT NULL UNIQUE,
    password VARCHAR(225) NOT NULL,
    email VARCHAR(225) NOT NULL UNIQUE,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description TEXT,

    PRIMARY KEY (user_id)
);


CREATE UNIQUE INDEX uniq_username ON Users(username);
CREATE UNIQUE INDEX uniq_email ON Users(email);

CREATE TABLE Friends (
    friend_id INT AUTO_INCREMENT,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (friend_id),

    CONSTRAINT fk_friends_sender
        FOREIGN KEY (sender_id)
        REFERENCES Users(user_id),
    
    CONSTRAINT fk_friends_receiver
        FOREIGN KEY (receiver_id)
        REFERENCES Users(user_id)
);


CREATE TABLE Chats (
    chat_id INT AUTO_INCREMENT UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    creator_id INT NOT NULL,
    chat_name VARCHAR(30) NOT NULL,

    PRIMARY KEY (chat_id),

    CONSTRAINT fk_chat_creator
        FOREIGN KEY (creator_id)
        REFERENCES Users(user_id)
);

CREATE TABLE Chat_Users (
    chat_user_id INT AUTO_INCREMENT,
    chat_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_message_id INT NOT NULL DEFAULT 0,
    -- connects a user to a chat through id's
    PRIMARY KEY (chat_user_id),
    CONSTRAINT fk_chat_id
        FOREIGN KEY (chat_id)
        REFERENCES Chats(chat_id),
    
    CONSTRAINT fk_chat_user_id
        FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
);

CREATE TABLE Messages (
    message_id INT AUTO_INCREMENT,
    chat_id INT NOT NULL,
    sender_id INT NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted BOOL DEFAULT FALSE,

    PRIMARY KEY (message_id),

    CONSTRAINT fk_msgs_chat_id
        FOREIGN KEY (chat_id)
        REFERENCES Chats(chat_id),
    
    CONSTRAINT fk_sender_id
        FOREIGN KEY (sender_id)
        REFERENCES Users(user_id)
);

-- ADD MORE LATER
CREATE TABLE Settings (
    user_id INT NOT NULL,
    light_mode BOOL DEFAULT TRUE,

    PRIMARY KEY (user_id),

    CONSTRAINT fk_settings_user_id
        FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
);

-- @block
DROP TABLE Messages;
DROP TABLE Settings;
DROP TABLE Chat_Users;
DROP TABLE Chats;
DROP TABLE Friends;
DROP TABLE Users;

-- @block
SELECT * FROM Users;
SELECT * FROM Friends;
SELECT * FROM Chats;
SELECT * FROM Chat_Users;
SELECT * FROM Messages;
SELECT * FROM Settings;
