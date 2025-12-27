-- USER LOGIN TABLE
-- @block
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT,
    username VARCHAR(30) NOT NULL UNIQUE,
    password VARCHAR(225) NOT NULL,
    email VARCHAR(225) NOT NULL UNIQUE,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id)
);

-- @block
INSERT INTO Users (username, password, email) VALUES ("simon11", "1", "11"); 
INSERT INTO Users (username, password, email) VALUES ("judy1", "2", "21"); 
INSERT INTO Users (username, password, email) VALUES ("alvin1", "3", "31"); 
INSERT INTO Users (username, password, email) VALUES ("gordon1", "4", "41"); 

-- @block 
DROP TABLE Users;
-- @block 
DELETE FROM Users;

-- @block
SELECT * FROM Users;

-- @block
CREATE UNIQUE INDEX uniq_username ON Users(username);
CREATE UNIQUE INDEX uniq_email ON Users(email);

-- @block 
SHOW INDEX FROM Users;


-- FRIENDS TABLE
-- @block
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
-- @block
SELECT * FROM Users;
SELECT * FROM Friends;

-- @block
UPDATE Friends
SET status="accepted"
WHERE friend_id = 6;

-- @block
DELETE FROM Friends;

-- @block
DROP TABLE Friends;

-- CHATS TABLE (holds all chats)
-- @block
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
-- @block
DROP TABLE Chats;

-- @block
-- USERS IN CHAT TABLE (holds users in chat)
CREATE TABLE Chat_Users (
    chat_user_id INT AUTO_INCREMENT,
    chat_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- connects a user to a chat through id's
    PRIMARY KEY (chat_user_id),
    CONSTRAINT fk_chat_id
        FOREIGN KEY (chat_id)
        REFERENCES Chats(chat_id),
    
    CONSTRAINT fk_chat_user_id
        FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
);

-- @block
SELECT * FROM Chats;
SELECT * FROM Chat_Users;
-- @block

DROP TABLE Chat_Users;

