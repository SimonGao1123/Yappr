-- @block
CREATE TABLE Users (
    id INT AUTO_INCREMENT,
    username VARCHAR(30) NOT NULL UNIQUE,
    password VARCHAR(225) NOT NULL,
    email VARCHAR(225) NOT NULL UNIQUE,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
-- @block 
DELETE FROM Users;

-- @block
SELECT * FROM Users;

-- @block
CREATE UNIQUE INDEX uniq_username ON Users(username);
CREATE UNIQUE INDEX uniq_email ON Users(email);

-- @block 
SHOW INDEX FROM Users;