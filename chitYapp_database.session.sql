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
INSERT INTO Users (username, password, email) VALUES ("simon", "1", "1"); 
INSERT INTO Users (username, password, email) VALUES ("judy", "2", "2"); 
INSERT INTO Users (username, password, email) VALUES ("alvin", "3", "3"); 
INSERT INTO Users (username, password, email) VALUES ("gordon", "4", "4"); 

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
SELECT * FROM Friends;

-- @block
UPDATE Friends
SET status="rejected"
WHERE friend_id = 1;

-- @block
DELETE FROM Friends;

-- @block
DROP TABLE Friends;